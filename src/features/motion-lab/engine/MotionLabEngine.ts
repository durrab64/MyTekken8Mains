import {
  assertNoGlError,
  createDataTexture,
  createFramebuffer,
  createGeometry,
  createProgram,
  deleteGeometry,
  deleteProgram,
  drainGlErrors,
  readDebugRendererInfo,
  readGlError,
  uploadTexture,
} from './gl';
import type { GlGeometry } from './gl';
import {
  FORMATIONS,
  FORMATION_INDEX,
  GPGPU_BYTES,
  SIM_SIZE,
  SIM_TEXTURE_COUNT,
  TIER_CONFIG,
  buildInitialState,
  formationHome,
} from './formations';
import type { FormationDefinition, FormationDetail, FormationId } from './formations';
import {
  ATMOSPHERE_FS,
  FULLSCREEN_VS,
  PARTICLE_ANALYTIC_VS,
  PARTICLE_FS,
  PARTICLE_GPGPU_VS,
  POSITION_FS,
  VELOCITY_FS,
} from './shaders';
import { FrameMeter, GpuTimer } from './instrumentation';
import { DEFAULT_PARAMS, PARAM_LIMITS } from '../types';
import type {
  ActiveTier,
  ContextState,
  GpuTimingStatus,
  LabCapabilities,
  LabParams,
  LabStats,
  ParticleStateSummary,
  SimulationMode,
} from '../types';

const STAGE_SCALE = 0.82;
const DPR_CAP = 1.5;
const MAX_BACKING_PIXELS = 2_800_000;
const MAX_SPEED = 2.5;
const POINTER_SMOOTHING = 6;
const POINTER_VELOCITY_SMOOTHING = 14;
const POINTER_ACTIVE_SMOOTHING = 10;
const DEFAULT_RENDER_SCALE = 1;
const MIN_RENDER_SCALE = 0.25;
const MAX_RENDER_SCALE = 1;

type UniformMap = Record<string, WebGLUniformLocation | null>;

/**
 * One ping-pong slot. Position and velocity get their own framebuffers so a
 * pass can read the other slot's texture without creating an attachment
 * feedback loop on the draw target.
 */
interface SimState {
  position: WebGLTexture;
  velocity: WebGLTexture;
  positionFramebuffer: WebGLFramebuffer;
  velocityFramebuffer: WebGLFramebuffer;
}

interface Viewport {
  cssWidth: number;
  cssHeight: number;
  width: number;
  height: number;
  dpr: number;
  aspect: number;
}

interface PointerClient {
  x: number;
  y: number;
  active: boolean;
}

interface LoseContextExtension {
  loseContext(): void;
  restoreContext(): void;
}

export interface MotionLabOptions {
  tier: ActiveTier;
  params: LabParams;
  resolutionScale?: number;
  /** Active formation. Unimplemented ids throw at boot. */
  formation?: FormationId;
  onStats: (stats: LabStats) => void;
}

export class WebGlUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGlUnavailableError';
  }
}

function uniformMap(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly string[],
): UniformMap {
  const map: UniformMap = {};
  for (const name of names) {
    map[name] = gl.getUniformLocation(program, name);
  }
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeParams(input: Partial<LabParams>): LabParams {
  const next: LabParams = { ...DEFAULT_PARAMS, ...input };
  for (const key of Object.keys(PARAM_LIMITS) as (keyof LabParams)[]) {
    const [min, max] = PARAM_LIMITS[key];
    const value = Number.isFinite(next[key])
      ? next[key]
      : DEFAULT_PARAMS[key];
    next[key] = clamp(value, min, max);
  }
  return next;
}

export class MotionLabEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly onStats: (stats: LabStats) => void;

  private tier: ActiveTier;
  private formationId: FormationId = 'jin';
  private params: LabParams;
  private caps: LabCapabilities;
  private mode: SimulationMode = 'analytic';
  private fallbackReason: string | null = null;
  private floatTargetsFailure: string | null = null;
  private contextState: ContextState = 'active';
  private runtimeError: string | null = null;
  private disposed = false;
  private resolutionScale: number;

  private atmosphereProgram: WebGLProgram | null = null;
  private velocityProgram: WebGLProgram | null = null;
  private positionProgram: WebGLProgram | null = null;
  private gpgpuProgram: WebGLProgram | null = null;
  private analyticProgram: WebGLProgram | null = null;
  private fullscreenGeometry: GlGeometry | null = null;
  private quadGeometry: GlGeometry | null = null;

  private atmosphereUniforms: UniformMap = {};
  private velocityUniforms: UniformMap = {};
  private positionUniforms: UniformMap = {};
  private gpgpuUniforms: UniformMap = {};
  private analyticUniforms: UniformMap = {};

  private simA: SimState | null = null;
  private simB: SimState | null = null;
  private currentSim: SimState | null = null;
  private nextSim: SimState | null = null;

  private timer: GpuTimer | null = null;
  private readonly frameMeter = new FrameMeter();
  private gpuSamples: number[] = [];
  private lastStatsAt = 0;

  private viewport: Viewport = {
    cssWidth: 0,
    cssHeight: 0,
    width: 0,
    height: 0,
    dpr: 1,
    aspect: 1,
  };

  private raf: number | null = null;
  private lastTimestamp: number | null = null;
  private simTime = 0;
  private frameDt = 1 / 60;
  private paused = false;

  private pointerTarget = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  private pointerVelocity = { x: 0, y: 0 };
  private pointerClient: PointerClient = { x: 0, y: 0, active: false };
  private pointerTargetActive = 0;
  private pointerActive = 0;

  private resizeObserver: ResizeObserver | null = null;
  private loseContextExtension: LoseContextExtension | null = null;

  constructor(canvas: HTMLCanvasElement, options: MotionLabOptions) {
    this.canvas = canvas;
    this.tier = options.tier;
    const requested = options.formation ?? 'jin';
    const definition = (
      FORMATIONS as Record<string, FormationDefinition | undefined>
    )[requested];
    if (!definition || !definition.implemented) {
      throw new Error(
        `Formation "${requested}" is not implemented in this build.`,
      );
    }
    this.formationId = definition.id;
    this.params = sanitizeParams(options.params);
    this.resolutionScale = clamp(
      options.resolutionScale ?? DEFAULT_RENDER_SCALE,
      MIN_RENDER_SCALE,
      MAX_RENDER_SCALE,
    );
    this.onStats = options.onStats;

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
    } catch (error) {
      throw new WebGlUnavailableError(
        `WebGL2 context creation threw: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!gl) {
      throw new WebGlUnavailableError(
        'WebGL2 is not available in this browser, so the GPGPU lab cannot start.',
      );
    }

    this.gl = gl;
    this.caps = this.queryCapabilities();
    this.loseContextExtension = gl.getExtension(
      'WEBGL_lose_context',
    ) as LoseContextExtension | null;

    try {
      this.initGlResources();
      this.applyTier(this.tier);
    } catch (error) {
      this.destroyGlResources();
      this.releaseSimResources();
      throw error;
    }

    this.attachEvents();
    this.resize();
    this.emitStats(true);
    this.startLoop();
  }

  // ---------------------------------------------------------------- public API

  getStats(): LabStats {
    return this.buildStats();
  }

  getCapabilities(): LabCapabilities {
    return { ...this.caps };
  }

  getGpuSamples(): number[] {
    return [...this.gpuSamples];
  }

  clearGpuSamples(): void {
    this.gpuSamples = [];
    this.timer?.resetSamples();
  }

  getFrameSamples(): number[] {
    return this.frameMeter.getSamples();
  }

  clearFrameSamples(): void {
    this.frameMeter.reset();
  }

  private formationDetail(): FormationDetail {
    return this.tier === 1 ? 0 : this.tier === 2 ? 1 : 2;
  }

  setTier(tier: ActiveTier): void {
    if (this.disposed || this.tier === tier) return;
    this.applyTier(tier);
  }

  /**
   * Formation switch lifecycle (approved switching architecture):
   * 1. validate the requested id against the registry;
   * 2. prepare the target formation's deterministic state;
   * 3. re-seed beneath the caller's 380 ms wipe — the canvas hides the swap;
   * 4. keep the active formation across context loss/restore (restore re-seeds it).
   *
   * Returns false and leaves the current formation running on refusal.
   */
  setFormation(id: string): boolean {
    if (this.disposed) return false;
    const definition = (
      FORMATIONS as Record<string, FormationDefinition | undefined>
    )[id];
    if (!definition || !definition.implemented) {
      this.runtimeError = `Formation "${id}" is not implemented in this build.`;
      this.emitStats(true);
      return false;
    }
    if (this.formationId === definition.id) {
      return true;
    }
    this.formationId = definition.id;
    this.runtimeError = null;
    if (this.mode === 'gpgpu') {
      try {
        this.seedSimulation(this.simTime);
        this.verifyFloatSimulation();
      } catch (error) {
        this.runtimeError =
          error instanceof Error ? error.message : String(error);
        this.emitStats(true);
        return false;
      }
    }
    // Formation-specific samples belong to the formation that produced them.
    this.gpuSamples = [];
    this.timer?.resetSamples();
    this.frameMeter.reset();
    this.emitStats(true);
    return true;
  }

  setParams(params: Partial<LabParams>): void {
    if (this.disposed) return;
    this.params = sanitizeParams({ ...this.params, ...params });
  }

  setResolutionScale(scale: number): void {
    if (this.disposed) return;
    const next = clamp(scale, MIN_RENDER_SCALE, MAX_RENDER_SCALE);
    if (Math.abs(next - this.resolutionScale) < 1e-4) return;
    this.resolutionScale = next;
    this.resize();
    this.emitStats(true);
  }

  setPaused(paused: boolean): void {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    this.lastTimestamp = null;
    this.emitStats(true);
  }

  reset(): void {
    if (this.disposed) return;
    this.simTime = 0;
    this.pointerVelocity = { x: 0, y: 0 };
    this.pointerActive = this.pointerTargetActive;
    if (this.mode === 'gpgpu') {
      try {
        this.seedSimulation(0);
        this.verifyFloatSimulation();
      } catch (error) {
        this.runtimeError =
          error instanceof Error ? error.message : String(error);
      }
    }
    this.emitStats(true);
  }

  loseContextForTest(): boolean {
    if (!this.loseContextExtension || this.contextState !== 'active') {
      return false;
    }
    this.loseContextExtension.loseContext();
    return true;
  }

  restoreContextForTest(): boolean {
    if (!this.loseContextExtension || this.contextState !== 'lost') {
      return false;
    }
    this.loseContextExtension.restoreContext();
    return true;
  }

  checkGlError(): string | null {
    return readGlError(this.gl);
  }

  /**
   * Test-only readback used by the lab harness to verify that the pointer
   * actually disturbs the field and that the spring recovers. Returns null in
   * analytic mode, when paused, or if the readback fails.
   */
  sampleParticleState(): ParticleStateSummary | null {
    if (
      this.disposed ||
      this.mode !== 'gpgpu' ||
      this.paused ||
      !this.currentSim ||
      this.contextState !== 'active'
    ) {
      return null;
    }

    const gl = this.gl;
    const config = TIER_CONFIG[this.tier];
    const texels = SIM_SIZE * SIM_SIZE * 4;
    const positions = new Float32Array(texels);
    const velocities = new Float32Array(texels);

    drainGlErrors(gl);
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      this.currentSim.positionFramebuffer,
    );
    gl.readPixels(
      0,
      0,
      SIM_SIZE,
      SIM_SIZE,
      gl.RGBA,
      gl.FLOAT,
      positions,
    );
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      this.currentSim.velocityFramebuffer,
    );
    gl.readPixels(
      0,
      0,
      SIM_SIZE,
      SIM_SIZE,
      gl.RGBA,
      gl.FLOAT,
      velocities,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (readGlError(gl)) {
      return null;
    }

    let speedSum = 0;
    let speedMax = 0;
    let displacementSum = 0;
    let displacementMax = 0;

    for (let index = 0; index < config.particles; index += 1) {
      const x = index % SIM_SIZE;
      const y = Math.floor(index / SIM_SIZE);
      const offset = (y * SIM_SIZE + x) * 4;
      const seed = positions[offset + 3];
      const lambda = velocities[offset + 3];
      const filament = index % config.filaments;
      const home = formationHome(
        this.formationId,
        lambda,
        seed,
        filament,
        this.simTime,
        FORMATIONS[this.formationId].radius,
        config.filaments,
        this.formationDetail(),
      );
      const dx = positions[offset] - home[0];
      const dy = positions[offset + 1] - home[1];
      const dz = positions[offset + 2] - home[2];
      const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const speed = Math.sqrt(
        velocities[offset] * velocities[offset] +
          velocities[offset + 1] * velocities[offset + 1] +
          velocities[offset + 2] * velocities[offset + 2],
      );

      speedSum += speed;
      speedMax = Math.max(speedMax, speed);
      displacementSum += displacement;
      displacementMax = Math.max(displacementMax, displacement);
    }

    return {
      count: config.particles,
      meanSpeed: speedSum / config.particles,
      maxSpeed: speedMax,
      meanDisplacement: displacementSum / config.particles,
      maxDisplacement: displacementMax,
      simTime: this.simTime,
      paused: this.paused,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.detachEvents();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyGlResources();
    this.releaseSimResources();
  }

  // ------------------------------------------------------------------ lifecycle

  private queryCapabilities(): LabCapabilities {
    const gl = this.gl;
    const debug = readDebugRendererInfo(gl);
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));

    return {
      webgl2: true,
      colorBufferFloat: Boolean(gl.getExtension('EXT_color_buffer_float')),
      floatTargetsVerified: false,
      timerQuery: Boolean(
        gl.getExtension('EXT_disjoint_timer_query_webgl2'),
      ),
      maxTextureSize: Number.isFinite(maxTextureSize)
        ? maxTextureSize
        : null,
      renderer: debug.renderer,
      vendor: debug.vendor,
    };
  }

  private initGlResources(): void {
    const gl = this.gl;
    drainGlErrors(gl);

    this.atmosphereProgram = createProgram(
      gl,
      FULLSCREEN_VS,
      ATMOSPHERE_FS,
      'atmosphere',
    );
    this.velocityProgram = createProgram(
      gl,
      FULLSCREEN_VS,
      VELOCITY_FS,
      'velocity',
    );
    this.positionProgram = createProgram(
      gl,
      FULLSCREEN_VS,
      POSITION_FS,
      'position',
    );
    this.gpgpuProgram = createProgram(
      gl,
      PARTICLE_GPGPU_VS,
      PARTICLE_FS,
      'particles-gpgpu',
    );
    this.analyticProgram = createProgram(
      gl,
      PARTICLE_ANALYTIC_VS,
      PARTICLE_FS,
      'particles-analytic',
    );

    this.atmosphereUniforms = uniformMap(gl, this.atmosphereProgram, [
      'uTime',
      'uAspect',
      'uDeep',
      'uFog',
      'uGlow',
      'uAtmosMode',
      'uAtmosAnchor',
      'uAtmosBand',
      'uAtmosPulse',
    ]);
    this.velocityUniforms = uniformMap(gl, this.velocityProgram, [
      'uPosition',
      'uVelocity',
      'uSimSize',
      'uTime',
      'uDt',
      'uPointer',
      'uPointerActive',
      'uPointerRadius',
      'uPointerStrength',
      'uPointerSwirl',
      'uPointerVelocity',
      'uSpring',
      'uDamping',
      'uLocalDamping',
      'uCurl',
      'uOctaves',
      'uAmplitude',
      'uMaxSpeed',
      'uFormationRadius',
      'uFilaments',
      'uCurlScale',
      'uFormation',
      'uFormationDetail',
    ]);
    this.positionUniforms = uniformMap(gl, this.positionProgram, [
      'uPosition',
      'uVelocity',
      'uDt',
    ]);
    this.gpgpuUniforms = uniformMap(gl, this.gpgpuProgram, [
      'uPosition',
      'uVelocity',
      'uSimSize',
      'uTime',
      'uResolution',
      'uAspect',
      'uDpr',
      'uSize',
      'uStageScale',
      'uTintA',
      'uTintB',
      'uFog',
      'uFormation',
      'uFormationDetail',
      'uStretchBase',
      'uStretchSpeed',
    ]);
    this.analyticUniforms = uniformMap(gl, this.analyticProgram, [
      'uCount',
      'uTime',
      'uFormationRadius',
      'uFilaments',
      'uPointer',
      'uPointerActive',
      'uPointerRadius',
      'uPointerStrength',
      'uPointerSwirl',
      'uResolution',
      'uAspect',
      'uDpr',
      'uSize',
      'uStageScale',
      'uTintA',
      'uTintB',
      'uFog',
      'uFormation',
      'uFormationDetail',
      'uStretchBase',
      'uStretchSpeed',
    ]);

    this.fullscreenGeometry = createGeometry(
      gl,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
    );
    this.quadGeometry = createGeometry(
      gl,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
    );

    this.timer = new GpuTimer(gl);
    assertNoGlError(gl, 'lab GL setup');
  }

  private destroyGlResources(): void {
    const gl = this.gl;
    this.timer?.dispose();
    this.timer = null;

    deleteProgram(gl, this.atmosphereProgram);
    deleteProgram(gl, this.velocityProgram);
    deleteProgram(gl, this.positionProgram);
    deleteProgram(gl, this.gpgpuProgram);
    deleteProgram(gl, this.analyticProgram);
    deleteGeometry(gl, this.fullscreenGeometry);
    deleteGeometry(gl, this.quadGeometry);

    this.atmosphereProgram = null;
    this.velocityProgram = null;
    this.positionProgram = null;
    this.gpgpuProgram = null;
    this.analyticProgram = null;
    this.fullscreenGeometry = null;
    this.quadGeometry = null;
    this.atmosphereUniforms = {};
    this.velocityUniforms = {};
    this.positionUniforms = {};
    this.gpgpuUniforms = {};
    this.analyticUniforms = {};
  }

  /** Context loss invalidates every object; drop references without deleting. */
  private forgetGlResources(): void {
    this.timer = null;
    this.atmosphereProgram = null;
    this.velocityProgram = null;
    this.positionProgram = null;
    this.gpgpuProgram = null;
    this.analyticProgram = null;
    this.fullscreenGeometry = null;
    this.quadGeometry = null;
    this.simA = null;
    this.simB = null;
    this.currentSim = null;
    this.nextSim = null;
    this.atmosphereUniforms = {};
    this.velocityUniforms = {};
    this.positionUniforms = {};
    this.gpgpuUniforms = {};
    this.analyticUniforms = {};
  }

  private applyTier(tier: ActiveTier): void {
    this.tier = tier;
    const config = TIER_CONFIG[tier];
    let mode: SimulationMode = 'analytic';
    let reason: string | null = null;

    if (config.gpgpu) {
      if (!this.caps.colorBufferFloat) {
        reason =
          'EXT_color_buffer_float is unavailable, so float render targets cannot be verified. Formation-lite is running analytically.';
      } else if (this.floatTargetsFailure) {
        reason = this.floatTargetsFailure;
      } else {
        try {
          if (!this.simA || !this.simB) {
            this.createSimResources();
          }
          this.seedSimulation(this.simTime);
          if (!this.caps.floatTargetsVerified) {
            this.verifyFloatSimulation();
          }
          mode = 'gpgpu';
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.floatTargetsFailure = `Float render targets failed: ${message}`;
          reason = this.floatTargetsFailure;
          this.releaseSimResources();
        }
      }
    }

    if (mode === 'analytic') {
      this.releaseSimResources();
    }

    this.mode = mode;
    this.fallbackReason =
      mode === 'analytic' && config.gpgpu ? reason : null;

    // Measurements belong to the tier that produced them.
    this.gpuSamples = [];
    this.timer?.resetSamples();
    this.frameMeter.reset();

    this.emitStats(true);
  }

  private createSimResources(): void {
    const gl = this.gl;
    drainGlErrors(gl);

    const textures: WebGLTexture[] = [];
    const framebuffers: WebGLFramebuffer[] = [];

    const makeTexture = (): WebGLTexture => {
      const texture = createDataTexture(gl, SIM_SIZE);
      textures.push(texture);
      return texture;
    };
    const makeFramebuffer = (
      texture: WebGLTexture,
      label: string,
    ): WebGLFramebuffer => {
      const framebuffer = createFramebuffer(gl, [texture], label);
      framebuffers.push(framebuffer);
      return framebuffer;
    };

    try {
      const positionA = makeTexture();
      const velocityA = makeTexture();
      const positionB = makeTexture();
      const velocityB = makeTexture();

      const positionFramebufferA = makeFramebuffer(
        positionA,
        'position A',
      );
      const velocityFramebufferA = makeFramebuffer(
        velocityA,
        'velocity A',
      );
      const positionFramebufferB = makeFramebuffer(
        positionB,
        'position B',
      );
      const velocityFramebufferB = makeFramebuffer(
        velocityB,
        'velocity B',
      );

      this.simA = {
        position: positionA,
        velocity: velocityA,
        positionFramebuffer: positionFramebufferA,
        velocityFramebuffer: velocityFramebufferA,
      };
      this.simB = {
        position: positionB,
        velocity: velocityB,
        positionFramebuffer: positionFramebufferB,
        velocityFramebuffer: velocityFramebufferB,
      };
      this.currentSim = this.simA;
      this.nextSim = this.simB;

      assertNoGlError(gl, 'simulation target creation');
    } catch (error) {
      for (const framebuffer of framebuffers) {
        gl.deleteFramebuffer(framebuffer);
      }
      for (const texture of textures) {
        gl.deleteTexture(texture);
      }
      this.simA = null;
      this.simB = null;
      this.currentSim = null;
      this.nextSim = null;
      throw error;
    }
  }

  private releaseSimResources(): void {
    const gl = this.gl;
    for (const target of [this.simA, this.simB]) {
      if (!target) continue;
      gl.deleteFramebuffer(target.positionFramebuffer);
      gl.deleteFramebuffer(target.velocityFramebuffer);
      gl.deleteTexture(target.position);
      gl.deleteTexture(target.velocity);
    }
    this.simA = null;
    this.simB = null;
    this.currentSim = null;
    this.nextSim = null;
    this.caps.floatTargetsVerified = false;
  }

  private seedSimulation(time: number): void {
    if (!this.simA || !this.simB) {
      throw new Error('Simulation targets are not allocated');
    }

    const config = TIER_CONFIG[this.tier];
    const state = buildInitialState(
      SIM_SIZE,
      config.particles,
      config.filaments,
      time,
      this.formationId,
      this.formationDetail(),
    );

    for (const target of [this.simA, this.simB]) {
      uploadTexture(
        this.gl,
        target.position,
        SIM_SIZE,
        state.positions,
      );
      uploadTexture(
        this.gl,
        target.velocity,
        SIM_SIZE,
        state.velocities,
      );
    }

    this.currentSim = this.simA;
    this.nextSim = this.simB;
    assertNoGlError(this.gl, 'simulation seed');
  }

  /**
   * Completeness is necessary but not sufficient: render-to-float can still
   * fail on a driver that advertises the extension. Read one seeded texel back
   * through a float attachment before reporting or using the GPGPU path.
   */
  private verifyFloatSimulation(): void {
    if (!this.simA) {
      throw new Error('No simulation target to verify');
    }

    const gl = this.gl;
    drainGlErrors(gl);
    const probe = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simA.positionFramebuffer);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, probe);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const error = readGlError(gl);
    if (error) {
      throw new Error(`readback rejected (${error})`);
    }
    if (!probe.every((value) => Number.isFinite(value))) {
      throw new Error('readback returned non-finite values');
    }

    this.caps.floatTargetsVerified = true;
  }

  // -------------------------------------------------------------------- events

  private attachEvents(): void {
    this.canvas.addEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.canvas.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.canvas.addEventListener(
      'pointermove',
      this.handlePointerMove,
      { passive: true },
    );
    this.canvas.addEventListener(
      'pointerdown',
      this.handlePointerDown,
      { passive: true },
    );
    this.canvas.addEventListener('pointerup', this.handlePointerUp, {
      passive: true,
    });
    this.canvas.addEventListener(
      'pointercancel',
      this.handlePointerUp,
      { passive: true },
    );
    this.canvas.addEventListener(
      'pointerenter',
      this.handlePointerEnter,
      { passive: true },
    );
    this.canvas.addEventListener(
      'pointerleave',
      this.handlePointerLeave,
      { passive: true },
    );
    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('blur', this.handleWindowBlur);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }

  private detachEvents(): void {
    this.canvas.removeEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.canvas.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.canvas.removeEventListener(
      'pointermove',
      this.handlePointerMove,
    );
    this.canvas.removeEventListener(
      'pointerdown',
      this.handlePointerDown,
    );
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener(
      'pointercancel',
      this.handlePointerUp,
    );
    this.canvas.removeEventListener(
      'pointerenter',
      this.handlePointerEnter,
    );
    this.canvas.removeEventListener(
      'pointerleave',
      this.handlePointerLeave,
    );
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.disposed) return;

    this.contextState = 'lost';
    this.stopLoop();
    this.timer?.markLost();
    this.forgetGlResources();
    this.pointerTargetActive = 0;
    this.pointerClient.active = false;
    this.emitStats(true);
  };

  private handleContextRestored = (): void => {
    if (this.disposed) return;

    this.contextState = 'restored';
    this.runtimeError = null;
    this.floatTargetsFailure = null;

    try {
      this.caps = this.queryCapabilities();
      this.loseContextExtension = this.gl.getExtension(
        'WEBGL_lose_context',
      ) as LoseContextExtension | null;
      this.initGlResources();
      this.applyTier(this.tier);
      this.contextState = 'active';
      this.resize();
      this.emitStats(true);
      this.startLoop();
    } catch (error) {
      this.runtimeError =
        error instanceof Error ? error.message : String(error);
      this.contextState = 'failed';
      this.destroyGlResources();
      this.releaseSimResources();
      this.emitStats(true);
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    this.updatePointerClient(event);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.updatePointerClient(event);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') {
      this.pointerTargetActive = 0;
      this.pointerClient.active = false;
    }
  };

  private handlePointerEnter = (event: PointerEvent): void => {
    this.updatePointerClient(event);
    // Start from the entry point instead of sweeping across the stage from
    // the previous exit position.
    this.pointer.x = this.pointerTarget.x;
    this.pointer.y = this.pointerTarget.y;
    this.pointerVelocity = { x: 0, y: 0 };
  };

  private handlePointerLeave = (): void => {
    this.pointerTargetActive = 0;
    this.pointerClient.active = false;
  };

  private handleWindowResize = (): void => {
    this.resize();
  };

  private handleWindowBlur = (): void => {
    this.pointerTargetActive = 0;
    this.pointerClient.active = false;
  };

  private updatePointerClient(event: PointerEvent): void {
    this.pointerClient.x = event.clientX;
    this.pointerClient.y = event.clientY;
    this.pointerClient.active = true;
    this.pointerTargetActive = 1;
    this.refreshPointerTarget();
  }

  private refreshPointerTarget(): void {
    if (!this.pointerClient.active) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = ((this.pointerClient.x - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((this.pointerClient.y - rect.top) / rect.height) * 2;
    const aspect = rect.width / rect.height;

    this.pointerTarget.x = (nx * aspect) / STAGE_SCALE;
    this.pointerTarget.y = ny / STAGE_SCALE;
  }

  // ------------------------------------------------------------------- resize

  private resize(): void {
    if (this.disposed) return;

    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);

    if (cssWidth < 2 || cssHeight < 2) {
      return;
    }

    const baseScale =
      Math.min(window.devicePixelRatio || 1, DPR_CAP) *
      this.resolutionScale;
    let scale = baseScale;
    if (cssWidth * cssHeight * scale * scale > MAX_BACKING_PIXELS) {
      scale = Math.sqrt(MAX_BACKING_PIXELS / (cssWidth * cssHeight));
    }

    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.viewport = {
      cssWidth,
      cssHeight,
      width,
      height,
      dpr: width / cssWidth,
      aspect: cssWidth / cssHeight,
    };

    this.refreshPointerTarget();
  }

  // --------------------------------------------------------------------- loop

  private startLoop(): void {
    if (this.disposed || this.raf !== null) return;
    this.lastTimestamp = null;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private frame = (timestamp: number): void => {
    this.raf = null;
    if (this.disposed || this.contextState !== 'active') return;

    // ResizeObserver/window resize notifications can be deferred while the
    // window is occluded. Compare the live CSS box each frame so the backing
    // store can never stay at a stale resolution.
    if (
      Math.abs(this.canvas.clientWidth - this.viewport.cssWidth) > 1 ||
      Math.abs(this.canvas.clientHeight - this.viewport.cssHeight) > 1
    ) {
      this.resize();
    }

    const hadPrevious = this.lastTimestamp !== null;
    const deltaMs = hadPrevious
      ? timestamp - (this.lastTimestamp as number)
      : 1000 / 60;
    this.lastTimestamp = timestamp;

    const dt = clamp(deltaMs / 1000, 0, 1 / 30);
    this.frameDt = dt;
    if (hadPrevious) {
      this.frameMeter.push(deltaMs);
    }

    try {
      if (!this.paused) {
        this.simTime += dt;
        this.updatePointer(dt);
      }

      const sample = this.timer?.poll(timestamp) ?? null;
      if (sample !== null) {
        this.gpuSamples.push(sample);
        if (this.gpuSamples.length > 720) {
          this.gpuSamples.shift();
        }
      }

      this.timer?.begin();
      this.render();
      this.timer?.end();
    } catch (error) {
      this.runtimeError =
        error instanceof Error ? error.message : String(error);
      this.contextState = 'failed';
      this.stopLoop();
      this.timer?.dispose();
      this.timer = null;
      this.emitStats(true);
      return;
    }

    this.emitStats(false, timestamp);
    this.raf = requestAnimationFrame(this.frame);
  };

  private updatePointer(dt: number): void {
    const previousX = this.pointer.x;
    const previousY = this.pointer.y;
    const smoothing = 1 - Math.exp(-POINTER_SMOOTHING * dt);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * smoothing;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * smoothing;

    if (dt > 1e-5) {
      const rawVelocityX = (this.pointer.x - previousX) / dt;
      const rawVelocityY = (this.pointer.y - previousY) / dt;
      const velocitySmoothing =
        1 - Math.exp(-POINTER_VELOCITY_SMOOTHING * dt);
      this.pointerVelocity.x +=
        (clamp(rawVelocityX, -4, 4) - this.pointerVelocity.x) *
        velocitySmoothing;
      this.pointerVelocity.y +=
        (clamp(rawVelocityY, -4, 4) - this.pointerVelocity.y) *
        velocitySmoothing;
    }

    const activeSmoothing =
      1 - Math.exp(-POINTER_ACTIVE_SMOOTHING * dt);
    this.pointerActive +=
      (this.pointerTargetActive - this.pointerActive) * activeSmoothing;
    if (this.pointerTargetActive === 0 && this.pointerActive < 0.01) {
      this.pointerActive = 0;
    }
  }

  // -------------------------------------------------------------------- render

  private render(): void {
    const gl = this.gl;
    const { width, height, aspect, dpr } = this.viewport;
    const activeDef = FORMATIONS[this.formationId];

    if (
      width < 2 ||
      height < 2 ||
      !this.atmosphereProgram ||
      !this.fullscreenGeometry ||
      !this.quadGeometry
    ) {
      return;
    }

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    if (
      this.mode === 'gpgpu' &&
      !this.paused &&
      this.velocityProgram &&
      this.positionProgram &&
      this.currentSim &&
      this.nextSim
    ) {
      this.runSimulation();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.018, 0.008, 0.006, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.atmosphereProgram);
    gl.uniform1f(this.atmosphereUniforms.uTime, this.simTime);
    gl.uniform1f(this.atmosphereUniforms.uAspect, aspect);
    gl.uniform3f(
      this.atmosphereUniforms.uDeep,
      activeDef.palette.deep[0],
      activeDef.palette.deep[1],
      activeDef.palette.deep[2],
    );
    gl.uniform3f(
      this.atmosphereUniforms.uFog,
      activeDef.palette.fog[0],
      activeDef.palette.fog[1],
      activeDef.palette.fog[2],
    );
    gl.uniform3f(
      this.atmosphereUniforms.uGlow,
      activeDef.palette.glow[0],
      activeDef.palette.glow[1],
      activeDef.palette.glow[2],
    );
    gl.uniform1i(
      this.atmosphereUniforms.uAtmosMode,
      activeDef.atmosphere.mode,
    );
    gl.uniform2f(
      this.atmosphereUniforms.uAtmosAnchor,
      activeDef.atmosphere.anchor[0],
      activeDef.atmosphere.anchor[1],
    );
    gl.uniform1f(
      this.atmosphereUniforms.uAtmosBand,
      activeDef.atmosphere.band,
    );
    gl.uniform1f(
      this.atmosphereUniforms.uAtmosPulse,
      activeDef.atmosphere.pulsePeriod,
    );
    gl.bindVertexArray(this.fullscreenGeometry.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const count = TIER_CONFIG[this.tier].particles;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    if (this.mode === 'gpgpu' && this.gpgpuProgram && this.currentSim) {
      gl.useProgram(this.gpgpuProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.currentSim.position);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.currentSim.velocity);
      gl.uniform1i(this.gpgpuUniforms.uPosition, 0);
      gl.uniform1i(this.gpgpuUniforms.uVelocity, 1);
      gl.uniform1i(this.gpgpuUniforms.uSimSize, SIM_SIZE);
      gl.uniform1f(this.gpgpuUniforms.uTime, this.simTime);
      gl.uniform2f(this.gpgpuUniforms.uResolution, width, height);
      gl.uniform1f(this.gpgpuUniforms.uAspect, aspect);
      gl.uniform1f(this.gpgpuUniforms.uDpr, dpr);
      gl.uniform1f(this.gpgpuUniforms.uSize, 1);
      gl.uniform1f(this.gpgpuUniforms.uStageScale, STAGE_SCALE);
      gl.uniform3f(
        this.gpgpuUniforms.uTintA,
        activeDef.palette.tintA[0],
        activeDef.palette.tintA[1],
        activeDef.palette.tintA[2],
      );
      gl.uniform3f(
        this.gpgpuUniforms.uTintB,
        activeDef.palette.tintB[0],
        activeDef.palette.tintB[1],
        activeDef.palette.tintB[2],
      );
      gl.uniform3f(
        this.gpgpuUniforms.uFog,
        activeDef.palette.fog[0],
        activeDef.palette.fog[1],
        activeDef.palette.fog[2],
      );
      gl.uniform1i(
        this.gpgpuUniforms.uFormation,
        FORMATION_INDEX[this.formationId],
      );
      gl.uniform1i(
        this.gpgpuUniforms.uFormationDetail,
        this.formationDetail(),
      );
      gl.uniform1f(
        this.gpgpuUniforms.uStretchBase,
        activeDef.stretchBase,
      );
      gl.uniform1f(
        this.gpgpuUniforms.uStretchSpeed,
        activeDef.stretchSpeed,
      );
    } else if (this.analyticProgram) {
      gl.useProgram(this.analyticProgram);
      gl.uniform1i(this.analyticUniforms.uCount, count);
      gl.uniform1f(this.analyticUniforms.uTime, this.simTime);
      gl.uniform1f(
        this.analyticUniforms.uFormationRadius,
        activeDef.radius,
      );
      gl.uniform1f(
        this.analyticUniforms.uFilaments,
        TIER_CONFIG[this.tier].filaments,
      );
      gl.uniform1i(
        this.analyticUniforms.uFormation,
        FORMATION_INDEX[this.formationId],
      );
      gl.uniform1i(
        this.analyticUniforms.uFormationDetail,
        this.formationDetail(),
      );
      gl.uniform1f(
        this.analyticUniforms.uStretchBase,
        activeDef.stretchBase,
      );
      gl.uniform1f(
        this.analyticUniforms.uStretchSpeed,
        activeDef.stretchSpeed,
      );
      gl.uniform2f(
        this.analyticUniforms.uPointer,
        this.pointer.x,
        this.pointer.y,
      );
      gl.uniform1f(
        this.analyticUniforms.uPointerActive,
        this.pointerActive,
      );
      gl.uniform1f(
        this.analyticUniforms.uPointerRadius,
        this.params.pointerRadius,
      );
      gl.uniform1f(
        this.analyticUniforms.uPointerStrength,
        this.params.pointerStrength,
      );
      gl.uniform1f(
        this.analyticUniforms.uPointerSwirl,
        this.params.pointerSwirl,
      );
      gl.uniform2f(this.analyticUniforms.uResolution, width, height);
      gl.uniform1f(this.analyticUniforms.uAspect, aspect);
      gl.uniform1f(this.analyticUniforms.uDpr, dpr);
      gl.uniform1f(this.analyticUniforms.uSize, 1);
      gl.uniform1f(this.analyticUniforms.uStageScale, STAGE_SCALE);
      gl.uniform3f(
        this.analyticUniforms.uTintA,
        activeDef.palette.tintA[0],
        activeDef.palette.tintA[1],
        activeDef.palette.tintA[2],
      );
      gl.uniform3f(
        this.analyticUniforms.uTintB,
        activeDef.palette.tintB[0],
        activeDef.palette.tintB[1],
        activeDef.palette.tintB[2],
      );
      gl.uniform3f(
        this.analyticUniforms.uFog,
        activeDef.palette.fog[0],
        activeDef.palette.fog[1],
        activeDef.palette.fog[2],
      );
    }

    gl.bindVertexArray(this.quadGeometry.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  /**
   * Two GPGPU draws per frame:
   *   1. velocity: read position A + velocity A, write velocity B
   *   2. position: read position A + velocity B, write position B
   * Then swap A/B. Four draws total with atmosphere + particles.
   */
  private runSimulation(): void {
    const gl = this.gl;
    const velocityProgram = this.velocityProgram;
    const positionProgram = this.positionProgram;
    const current = this.currentSim;
    const next = this.nextSim;
    const geometry = this.fullscreenGeometry;

    if (
      !velocityProgram ||
      !positionProgram ||
      !current ||
      !next ||
      !geometry
    ) {
      return;
    }

    const config = TIER_CONFIG[this.tier];
    const activeDef = FORMATIONS[this.formationId];

    gl.disable(gl.BLEND);
    gl.bindVertexArray(geometry.vao);

    // Pass 1 — velocity.
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.velocityFramebuffer);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.useProgram(velocityProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.position);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, current.velocity);
    gl.uniform1i(this.velocityUniforms.uPosition, 0);
    gl.uniform1i(this.velocityUniforms.uVelocity, 1);
    gl.uniform1i(this.velocityUniforms.uSimSize, SIM_SIZE);
    gl.uniform1f(this.velocityUniforms.uTime, this.simTime);
    gl.uniform1f(
      this.velocityUniforms.uDt,
      Math.max(this.frameDt, 1 / 240),
    );
    gl.uniform2f(
      this.velocityUniforms.uPointer,
      this.pointer.x,
      this.pointer.y,
    );
    gl.uniform1f(
      this.velocityUniforms.uPointerActive,
      this.pointerActive,
    );
    gl.uniform1f(
      this.velocityUniforms.uPointerRadius,
      this.params.pointerRadius,
    );
    gl.uniform1f(
      this.velocityUniforms.uPointerStrength,
      this.params.pointerStrength,
    );
    gl.uniform1f(
      this.velocityUniforms.uPointerSwirl,
      this.params.pointerSwirl,
    );
    gl.uniform2f(
      this.velocityUniforms.uPointerVelocity,
      this.pointerVelocity.x,
      this.pointerVelocity.y,
    );
    gl.uniform1f(this.velocityUniforms.uSpring, this.params.spring);
    gl.uniform1f(this.velocityUniforms.uDamping, this.params.damping);
    gl.uniform1f(
      this.velocityUniforms.uLocalDamping,
      this.params.localDamping,
    );
    gl.uniform1f(this.velocityUniforms.uCurl, this.params.curl);
    gl.uniform1i(
      this.velocityUniforms.uOctaves,
      config.octaves,
    );
    gl.uniform1f(
      this.velocityUniforms.uAmplitude,
      this.params.amplitude,
    );
    gl.uniform1f(this.velocityUniforms.uMaxSpeed, MAX_SPEED);
    gl.uniform1f(
      this.velocityUniforms.uFormationRadius,
      activeDef.radius,
    );
    gl.uniform1f(
      this.velocityUniforms.uFilaments,
      config.filaments,
    );
    gl.uniform1f(this.velocityUniforms.uCurlScale, activeDef.curlScale);
    gl.uniform1i(
      this.velocityUniforms.uFormation,
      FORMATION_INDEX[this.formationId],
    );
    gl.uniform1i(
      this.velocityUniforms.uFormationDetail,
      this.formationDetail(),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2 — position.
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.positionFramebuffer);
    gl.useProgram(positionProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.position);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, next.velocity);
    gl.uniform1i(this.positionUniforms.uPosition, 0);
    gl.uniform1i(this.positionUniforms.uVelocity, 1);
    gl.uniform1f(
      this.positionUniforms.uDt,
      Math.max(this.frameDt, 1 / 240),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.currentSim = next;
    this.nextSim = current;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.viewport.width, this.viewport.height);
  }

  // --------------------------------------------------------------------- stats

  private buildStats(): LabStats {
    const frame = this.frameMeter.snapshot();
    const config = TIER_CONFIG[this.tier];
    const gpgpu = this.mode === 'gpgpu' && this.simA !== null;

    let gpuLast: number | null = null;
    let gpuMedian: number | null = null;
    let gpuStatus: GpuTimingStatus = 'unsupported';

    if (this.contextState === 'lost' || this.contextState === 'failed') {
      gpuStatus = 'lost';
    } else if (this.timer) {
      const snapshot = this.timer.snapshot();
      gpuLast = snapshot.lastMs;
      gpuMedian = snapshot.medianMs;
      gpuStatus = snapshot.status;
    }

    // atmosphere + 2 GPGPU passes + particles; a paused GPGPU frame skips
    // the two simulation draws.
    const draws = gpgpu && !this.paused ? 4 : 2;

    return {
      fps: frame.fps,
      frameMedianMs: frame.medianMs,
      frameP95Ms: frame.p95Ms,
      gpuMs: gpuLast,
      gpuMedianMs: gpuMedian,
      gpuStatus,
      tier: this.tier,
      formation: this.formationId,
      formationName: FORMATIONS[this.formationId].name,
      particleCount: config.particles,
      filaments: config.filaments,
      mode: this.mode,
      fallbackReason: this.fallbackReason,
      simSize: gpgpu ? SIM_SIZE : null,
      drawsPerFrame: draws,
      passesPerFrame: draws,
      gpgpuBytes: gpgpu ? GPGPU_BYTES : 0,
      gpgpuTextures: gpgpu ? SIM_TEXTURE_COUNT : 0,
      context: this.contextState,
      runtimeError: this.runtimeError,
      paused: this.paused,
      cssWidth: this.viewport.cssWidth,
      cssHeight: this.viewport.cssHeight,
      backingWidth: this.viewport.width,
      backingHeight: this.viewport.height,
      dpr: this.viewport.dpr,
      renderScale: this.resolutionScale,
      capabilities: { ...this.caps },
    };
  }

  private emitStats(force: boolean, now = performance.now()): void {
    if (!force && now - this.lastStatsAt < 250) return;
    this.lastStatsAt = now;
    this.onStats(this.buildStats());
  }
}
