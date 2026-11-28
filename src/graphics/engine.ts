import { activateCssFallback, isReducedMotion, normalizeEnvironment } from './fallback';
import type { CharacterId } from './fallback';
import { environments } from './environments';
import type { EnvironmentConfig } from './environments';
import { ART, atmosphereFragmentSource, atmosphereVertexSource } from './shaders';
import { createParticles, applyParticleEnv, drawParticles, destroyParticles } from './particles';
import type { ParticlePaletteOverride, Particles } from './particles';
import { FORMATION_INDEX, type FormationId } from './formation';
import { FORMATION_PARTICLE_PALETTE, FORMATION_RADIUS, FORMATION_TIER_FILAMENTS } from './formationRestoration';
import { NEUTRAL_FORMATION_POINTER, normalizePointerToRegion } from './pointerRegion';

export type EntryTier = 'tier0' | 'tier1' | 'tier2' | 'tier3';
export type CapTier = 'tier1' | 'tier2' | 'tier3';
export type QualityChoice = 'auto' | EntryTier;

export interface TierCap {
  resScale: number;
  dprCap: number;
  octaves: number;
  particles: number;
  art: 0 | 1;
}

export interface FxTierchangeEvent {
  tier: EntryTier;
  reason: string;
}
export interface FxErrorEvent {
  reason: string;
  message: string;
}
export type FxEvent = FxTierchangeEvent | FxErrorEvent;
export type FxEventType = 'tierchange' | 'error';

export interface InitializeResult {
  ok: true;
  tier: EntryTier;
  reason: string;
}

export interface Renderer {
  initialize(canvas?: HTMLCanvasElement | null): Promise<InitializeResult>;
  setEnvironment(id: string): CharacterId;
  setPointer(xNorm: number, yNorm: number): void;
  setQuality(tier: string): void;
  resize(): void;
  dispose(): void;
  on(event: FxEventType, callback: (payload: FxEvent) => void): () => void;
}

const TIER_CAPS: Record<CapTier, TierCap> = {
  tier1: { resScale: 0.25, dprCap: 1.25, octaves: 3, particles: 450, art: 0 },
  tier2: { resScale: 0.5, dprCap: 1.25, octaves: 4, particles: 1100, art: 1 },
  tier3: { resScale: 0.5, dprCap: 1.5, octaves: 5, particles: 2200, art: 1 },
};
const TIER_ORDER: readonly CapTier[] = ['tier1', 'tier2', 'tier3'];
const QUALITY_VALUES: readonly QualityChoice[] = ['auto', 'tier0', 'tier1', 'tier2', 'tier3'];

type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type WipeSnapshot = { deep: number[]; fog: number[]; glow: number[]; vein: number[]; mode: number };
type ArtState = 0 | 1 | -1;

export function createRenderer(): Renderer {
  const state = {
    initialized: false,
    environment: normalizeEnvironment(typeof document !== 'undefined' ? document.body?.dataset?.env : undefined),
    quality: 'auto' as QualityChoice,
    entryTier: 'tier2' as EntryTier,
    pointer: { x: 0.5, y: 0.5 },
    formationPointer: { x: NEUTRAL_FORMATION_POINTER.x, y: NEUTRAL_FORMATION_POINTER.y },
    heroVisible: false,
    disposed: true,
    debug: false,
    currentFormation: null as FormationId | null,
  };
  const wipe: { from: WipeSnapshot | null; to: EnvironmentConfig | null; start: number; reseeded: boolean; active: boolean } = { from: null, to: null, start: 0, reseeded: true, active: false };
  const ptrW = { x: 0.5, y: 0.5 };
  const formPtrW = { x: NEUTRAL_FORMATION_POINTER.x, y: NEUTRAL_FORMATION_POINTER.y };
  let formationPointerActive = false;
  const disp: WipeSnapshot = { deep: [0, 0, 0], fog: [0, 0, 0], glow: [0, 0, 0], vein: [0, 0, 0], mode: 0 };
  const listeners: Record<FxEventType, Set<(payload: FxEvent) => void>> = {
    tierchange: new Set(),
    error: new Set(),
  };

  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let uniforms: Record<string, WebGLUniformLocation | null> | null = null;
  let particles: Particles | null = null;
  let particleCount = 0;
  let artImg: HTMLImageElement | null = null;
  let artTex: WebGLTexture | null = null;
  let artState: ArtState = 0;
  let canvasEl: HTMLCanvasElement | null = null;
  let formationEl: HTMLElement | null = null;
  let rafId = 0;
  let running = false;
  let startSeconds = 0;
  let frameCount = 0;
  let resizeTimer = 0;
  let lastTierStepCheck = 0;
  const frameDeltas: number[] = [];
  let gpuTimerExt: TimerExt | null = null;
  let gpuQuery: WebGLQuery | null = null;
  let gpuMsSmoothed: number | null = null;
  let heroObserver: IntersectionObserver | null = null;
  let dprMedia: MediaQueryList | null = null;
  const detach: Array<() => void> = [];
  let contextOff: (() => void) | null = null;

  const avgDelta = () => frameDeltas.reduce((a, b) => a + b, 0) / (frameDeltas.length || 1);
  const emit = (type: FxEventType, payload: FxEvent) => {
    for (const cb of listeners[type] ?? []) {
      try {
        cb(payload);
      } catch (error) {
        console.error('fx listener error', error);
      }
    }
  };
  const on = (event: FxEventType, callback: (payload: FxEvent) => void) => {
    const bucket = listeners[event];
    bucket.add(callback);
    return () => {
      bucket.delete(callback);
    };
  };

  function tierForQuery(): QualityChoice {
    try {
      const fx = new URLSearchParams(window.location.search).get('fx');
      if (fx === 'off') return 'tier0';
      if (fx === 'low') return 'tier1';
      if (fx === 'high') return 'tier3';
    } catch { }
    return 'auto';
  }
  function detectEntryTier(): CapTier {
    try {
      if (window.matchMedia('(pointer: coarse)').matches) return 'tier1';
      const cores = navigator.hardwareConcurrency ?? 4;
      if (cores >= 8) return 'tier3';
      if (cores >= 4) return 'tier2';
      return 'tier1';
    } catch {
      return 'tier2';
    }
  }
  function chooseTier(): QualityChoice {
    if (state.quality !== 'auto') return state.quality;
    const forced = tierForQuery();
    if (forced !== 'auto') return forced;
    return detectEntryTier();
  }
  const isCapTier = (tier: EntryTier): tier is CapTier => tier === 'tier1' || tier === 'tier2' || tier === 'tier3';

const formationDetailForTier = (tier: EntryTier): 'tier1' | 'tier2' | 'tier3' | null => {
  if (tier === 'tier1' || tier === 'tier2' || tier === 'tier3') return tier;
  return null;
};
  function currentFormationState(): { id: FormationId; index: number; detail: number; radius: number; filaments: number } | null {
    const id = state.currentFormation;
    if (!id) return null;
    const detailKey = formationDetailForTier(state.entryTier) ?? 'tier2';
    const detail = detailKey === 'tier1' ? 0 : detailKey === 'tier2' ? 1 : 2;
    return {
      id,
      index: FORMATION_INDEX[id],
      detail,
      radius: FORMATION_RADIUS[id],
      filaments: FORMATION_TIER_FILAMENTS[detailKey],
    };
  }
  function particlePaletteOverride(formation: { id: FormationId }): ParticlePaletteOverride | null {
    if (formation.id === 'lars') return null;
    return { ...FORMATION_PARTICLE_PALETTE[formation.id], size: 1, gain: 1 };
  }
  function applyParticleFormation(env: EnvironmentConfig): void {
    if (!gl || !particles) return;
    const formation = currentFormationState();
    if (!formation) return;
    applyParticleEnv(
      gl,
      particles,
      env,
      formation.radius,
      formation.filaments,
      formation.index,
      formation.detail,
      particlePaletteOverride(formation),
    );
  }
  function applyFormationUniforms(): void {
    if (!gl || !particles) return;
    const formation = currentFormationState();
    if (!formation) return;
    gl.useProgram(particles.program);
    gl.uniform1f(particles.u.uFormationRadius, formation.radius);
    gl.uniform1f(particles.u.uFilaments, formation.filaments);
    gl.uniform1i(particles.u.uFormation, formation.index);
    gl.uniform1i(particles.u.uFormationDetail, formation.detail);
  }

  function compileShader(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type);
    if (!shader) throw new Error('shader creation failed');
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(shader) || 'unknown compile error';
      gl!.deleteShader(shader);
      throw new Error(`shader compile failed: ${log}`);
    }
    return shader;
  }
  function buildProgram(): WebGLProgram {
    const g = gl!;
    const vert = compileShader(g.VERTEX_SHADER, atmosphereVertexSource);
    const frag = compileShader(g.FRAGMENT_SHADER, atmosphereFragmentSource);
    const linked = g.createProgram();
    if (!linked) throw new Error('program creation failed');
    g.attachShader(linked, vert);
    g.attachShader(linked, frag);
    g.linkProgram(linked);
    g.deleteShader(vert);
    g.deleteShader(frag);
    if (!g.getProgramParameter(linked, g.LINK_STATUS)) {
      const log = g.getProgramInfoLog(linked) || 'unknown link error';
      g.deleteProgram(linked);
      throw new Error(`program link failed: ${log}`);
    }
    return linked;
  }
  function locateUniforms(): Record<string, WebGLUniformLocation | null> {
    const names = ['uTime', 'uResolution', 'uPointer', 'uWipe', 'uDeep', 'uFog', 'uGlow', 'uVein', 'uOctaves', 'uMode', 'uArtRect', 'uFormation', 'uFormationDetail'];
    const map: Record<string, WebGLUniformLocation | null> = {};
    for (const name of names) map[name] = gl!.getUniformLocation(program!, name);
    return map;
  }
  function artInit(): void {
    const g = gl!;
    const T = g.TEXTURE_2D;
    artTex = g.createTexture();
    g.bindTexture(T, artTex);
    g.texImage2D(T, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(T, k, v);
    g.generateMipmap(T);
  }
  function artLoad(): void {
    if (artState) return;
    const g = gl!;
    const T = g.TEXTURE_2D;
    if (!artImg) artImg = document.querySelector<HTMLImageElement>('#' + state.environment + ' img');
    if (!artImg || !artImg.complete) return;
    if (!artImg.naturalWidth) { artState = -1; return; }
    g.bindTexture(T, artTex);
    g.texImage2D(T, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, artImg);
    g.generateMipmap(T);
    artState = 1;
  }
  function artFrame(): void {
    const g = gl!;
    const u = uniforms!;
    const entry = isCapTier(state.entryTier) ? state.entryTier : 'tier2';
    const on = ART && TIER_CAPS[entry]?.art === 1;
    if (on && !artState) artLoad();
    const artRect = u.uArtRect;
    if (!on || artState !== 1 || !artImg) {
      if (artRect) g.uniform4f(artRect, 0, 0, 0, 0);
      return;
    }
    const r = artImg.getBoundingClientRect();
    const w = canvasEl?.clientWidth ?? 1;
    const h = canvasEl?.clientHeight ?? 1;
    if (artRect) g.uniform4f(artRect, r.left / w, 1 - (r.top + r.height) / h, r.width / w, r.height / h);
  }
  const lerp3 = (a: number[], b: number[], k: number): number[] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const copy = (d: WipeSnapshot, s: EnvironmentConfig): void => {
    d.deep = [...s.deep];
    d.fog = [...s.fog];
    d.glow = [...s.glow];
    d.vein = [...s.vein];
    d.mode = s.mode;
  };
  function flushEnv(): void {
    const g = gl!;
    const u = uniforms!;
    g.useProgram(program);
    g.uniform3fv(u.uDeep, disp.deep);
    g.uniform3fv(u.uFog, disp.fog);
    g.uniform3fv(u.uGlow, disp.glow);
    g.uniform3fv(u.uVein, disp.vein);
    g.uniform1i(u.uMode, disp.mode);
  }
  function applyEnvironment(env: EnvironmentConfig): void {
    copy(disp, env);
    flushEnv();
    applyParticleFormation(env);
  }
  function applyTierCaps(tier: CapTier): void {
    const g = gl!;
    const caps = TIER_CAPS[tier];
    state.entryTier = tier;
    particleCount = caps.particles;
    if (program) g.useProgram(program);
    g.uniform1i(uniforms!.uOctaves, caps.octaves);
    resizeBackingStore(caps);
    applyFormationUniforms();
  }
  function resizeBackingStore(caps: TierCap = TIER_CAPS[isCapTier(state.entryTier) ? state.entryTier : 'tier2']): void {
    if (!gl || !canvasEl) return;
    const g = gl;
    if (program) g.useProgram(program);
    const cssW = Math.max(1, canvasEl.clientWidth || window.innerWidth);
    const cssH = Math.max(1, canvasEl.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, caps.dprCap);
    const w = Math.max(1, Math.floor(cssW * dpr * caps.resScale));
    const h = Math.max(1, Math.floor(cssH * dpr * caps.resScale));
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
      g.viewport(0, 0, w, h);
    } else {
      g.viewport(0, 0, w, h);
    }
    g.uniform2f(uniforms!.uResolution, w, h);
    if (particles) {
      g.useProgram(particles.program);
      g.uniform1f(particles.u.uAspect, w / h);
    }
  }
  function teardownGl(lost?: 1): void {
    cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
    frameCount = 0;
    frameDeltas.length = 0;
    wipe.active = false;
    deactivateFormationPointer();
    formPtrW.x = NEUTRAL_FORMATION_POINTER.x;
    formPtrW.y = NEUTRAL_FORMATION_POINTER.y;
    gpuQuery = null;
    gpuMsSmoothed = null;
    if (gl && !lost) {
      const g = gl;
      if (particles) destroyParticles(g, particles);
      if (program) g.deleteProgram(program);
      if (vao) g.deleteVertexArray(vao);
      if (artTex) g.deleteTexture(artTex);
    }
    particles = null;
    particleCount = 0;
    program = null;
    vao = null;
    uniforms = null;
    artTex = null;
    artState = 0;
    artImg = null;
    gl = null;
  }
  const onDprChange = () => {
    resizeBackingStore();
  };
  function detachAll(): void {
    heroObserver?.disconnect();
    heroObserver = null;
    dprMedia?.removeEventListener?.('change', onDprChange);
    dprMedia = null;
    while (detach.length) {
      const off = detach.pop();
      if (!off) continue;
      try {
        off();
      } catch { }
    }
    window.clearTimeout(resizeTimer);
  }
  function onWindowResize(): void {
    deactivateFormationPointer();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => resizeBackingStore(), 150);
  }
  function onVisibilityChange(): void {
    if (document.hidden) {
      deactivateFormationPointer();
      cancelAnimationFrame(rafId);
      rafId = 0;
      running = false;
    } else {
      startLoop();
    }
  }
  function onPageHide(): void {
    dispose();
  }
  function hookContext(c: HTMLCanvasElement): void {
    if (contextOff) return;
    const add = (n: string, f: (e: Event) => void) => (c.addEventListener(n, f), () => c.removeEventListener(n, f));
    const a = add('webglcontextlost', onContextLost);
    const b = add('webglcontextrestored', onContextRestored);
    contextOff = () => {
      a();
      b();
    };
  }
  function onContextLost(event: Event): void {
    event.preventDefault();
    teardownGl(1);
    detachAll();
    if (state.quality !== 'tier0') state.initialized = false;
    canvasEl?.classList.remove('fx-canvas--live');
    activateCssFallback('context-lost');
    emit('tierchange', { tier: 'tier0', reason: 'context-lost' });
  }
  function onContextRestored(): void {
    if (state.disposed || state.quality === 'tier0') return;
    state.initialized = true;
    void bootBackend('restored');
  }
  function formationRegion(): HTMLElement | null {
    if (formationEl && !formationEl.isConnected) formationEl = null;
    if (!formationEl) {
      formationEl = document.querySelector<HTMLElement>('[data-fx-region="hero"]');
    }
    return formationEl;
  }
  function deactivateFormationPointer(): void {
    formationPointerActive = false;
    state.formationPointer.x = NEUTRAL_FORMATION_POINTER.x;
    state.formationPointer.y = NEUTRAL_FORMATION_POINTER.y;
  }
  function resetFormationPointer(): void {
    deactivateFormationPointer();
    formPtrW.x = NEUTRAL_FORMATION_POINTER.x;
    formPtrW.y = NEUTRAL_FORMATION_POINTER.y;
    if (gl && particles) {
      gl.useProgram(particles.program);
      gl.uniform2f(particles.u.uPointer, formPtrW.x, formPtrW.y);
    }
  }
  function activateFormationPointer(x: number, y: number): void {
    const wasActive = formationPointerActive;
    state.formationPointer.x = x;
    state.formationPointer.y = y;
    formationPointerActive = true;
    if (!wasActive && gl && particles) {
      formPtrW.x = x;
      formPtrW.y = y;
      gl.useProgram(particles.program);
      gl.uniform2f(particles.u.uPointer, formPtrW.x, formPtrW.y);
    }
  }

  /**
   * Convert the hero's formation field into WebGL viewport coordinates.
   *
   * The canvas stays full-bleed (one context, one RAF), but the particle pass
   * is clipped to this rectangle so formations read as a dedicated field
   * beside the character instead of a page-wide background. The shader's
   * aspect uniform is set to the region aspect, so geometry is never
   * stretched; no formation geometry or pulse values are modified.
   */
  function formationViewport(el: HTMLElement): { x: number; y: number; w: number; h: number } | null {
    if (!gl || !canvasEl) return null;
    const rect = el.getBoundingClientRect();
    const cssW = canvasEl.clientWidth || 1;
    const cssH = canvasEl.clientHeight || 1;
    const left = Math.max(0, rect.left);
    const right = Math.min(cssW, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(cssH, rect.bottom);
    if (right - left < 24 || bottom - top < 24) return null;

    const bufferW = gl.drawingBufferWidth || canvasEl.width;
    const bufferH = gl.drawingBufferHeight || canvasEl.height;
    const sx = bufferW / cssW;
    const sy = bufferH / cssH;
    return {
      x: Math.floor(left * sx),
      y: Math.floor((cssH - bottom) * sy),
      w: Math.max(1, Math.floor((right - left) * sx)),
      h: Math.max(1, Math.floor((bottom - top) * sy)),
    };
  }

  function startLoop(): void {
    if (running || document.hidden || !gl) return;
    running = true;
    let last = performance.now();
    const frame = (now: number) => {
      if (!running || document.hidden) return;
      rafId = requestAnimationFrame(frame);
      const delta = now - last;
      last = now;
      frameDeltas.push(delta);
      if (frameDeltas.length > 90) frameDeltas.shift();
      if (state.debug && frameCount > 0 && frameCount % 240 === 0) {
        const avg = avgDelta();
        console.debug(`[fx] tier=${state.entryTier} cpu-interval-avg=${avg.toFixed(2)}ms (not GPU time) gpu-ms=${gpuMsSmoothed?.toFixed(3) ?? 'unsupported'}`);
      }
      governTier(now);
      const g = gl!;
      const u = uniforms!;
      const bufferW = g.drawingBufferWidth || 1;
      const bufferH = g.drawingBufferHeight || 1;
      g.viewport(0, 0, bufferW, bufferH);
      if (wipe.active && wipe.from && wipe.to) {
        const k = Math.min(1, (now - wipe.start) / 380);
        const ease = 1 - Math.pow(1 - k, 3);
        disp.deep = lerp3(wipe.from.deep, wipe.to.deep, ease);
        disp.fog = lerp3(wipe.from.fog, wipe.to.fog, ease);
        disp.glow = lerp3(wipe.from.glow, wipe.to.glow, ease);
        disp.vein = lerp3(wipe.from.vein, wipe.to.vein, ease);
        disp.mode = k < 0.5 ? wipe.from.mode : wipe.to.mode;
        flushEnv();
        g.uniform1f(u.uWipe, k);
        if (k >= 0.5 && !wipe.reseeded) {
          applyParticleFormation(wipe.to);
          wipe.reseeded = true;
        }
        if (k >= 1) wipe.active = false;
      }
      const px = state.pointer.x;
      const py = state.pointer.y;
      const dxp = px - ptrW.x;
      const dyp = py - ptrW.y;
      if (Math.abs(dxp) > 0.002 || Math.abs(dyp) > 0.002) {
        ptrW.x += dxp * (1 - Math.exp(-((delta || 16) / 1000) * 6));
        ptrW.y += dyp * (1 - Math.exp(-((delta || 16) / 1000) * 6));
        g.useProgram(program);
        g.uniform2f(u.uPointer, ptrW.x, ptrW.y);
        document.documentElement.style.setProperty('--pdx', ((ptrW.x - 0.5) * 2).toFixed(3));
        document.documentElement.style.setProperty('--pdy', ((ptrW.y - 0.5) * 2).toFixed(3));
        document.documentElement.style.setProperty('--rim-g', Math.max(0, 1 - Math.hypot(ptrW.x - 0.5, ptrW.y - 0.55) / 0.8).toFixed(3));
      }
      const fpTarget = formationPointerActive ? state.formationPointer : NEUTRAL_FORMATION_POINTER;
      const dfx = fpTarget.x - formPtrW.x;
      const dfy = fpTarget.y - formPtrW.y;
      if (Math.abs(dfx) > 0.002 || Math.abs(dfy) > 0.002) {
        formPtrW.x += dfx * (1 - Math.exp(-((delta || 16) / 1000) * 6));
        formPtrW.y += dfy * (1 - Math.exp(-((delta || 16) / 1000) * 6));
        if (particles) {
          g.useProgram(particles.program);
          g.uniform2f(particles.u.uPointer, formPtrW.x, formPtrW.y);
        }
      }
      if (!state.heroVisible) return;
      if (gpuTimerExt && frameCount % 60 === 30) {
        gpuQuery = g.createQuery();
        if (gpuQuery) g.beginQuery(gpuTimerExt.TIME_ELAPSED_EXT, gpuQuery);
      }
      if (gpuTimerExt && gpuQuery && frameCount % 60 === 31) {
        g.endQuery(gpuTimerExt.TIME_ELAPSED_EXT);
      }
      if (gpuTimerExt && gpuQuery && frameCount % 60 === 33 && g.getQueryParameter(gpuQuery, g.QUERY_RESULT_AVAILABLE)) {
        const ns = g.getQueryParameter(gpuQuery, g.QUERY_RESULT) as number;
        const ms = ns / 1e6;
        gpuMsSmoothed = gpuMsSmoothed == null ? ms : gpuMsSmoothed * 0.75 + ms * 0.25;
        g.deleteQuery(gpuQuery);
        gpuQuery = null;
      }
      const tSec = ((now - startSeconds) / 1000) % 3600;
      g.useProgram(program);
      g.uniform1f(u.uTime, tSec);
      artFrame();
      g.drawArrays(g.TRIANGLES, 0, 3);
      if (particles && particleCount > 0) {
        const region = formationRegion();
        if (region) {
          const vp = formationViewport(region);
          if (vp) {
            g.viewport(vp.x, vp.y, vp.w, vp.h);
            g.useProgram(particles.program);
            g.uniform1f(particles.u.uAspect, vp.w / vp.h);
            drawParticles(g, particles, tSec, particleCount);
            g.viewport(0, 0, bufferW, bufferH);
          }
        } else {
          /* Legacy fallback if the hero region is absent. */
          g.useProgram(particles.program);
          g.uniform1f(particles.u.uAspect, bufferW / bufferH);
          drawParticles(g, particles, tSec, particleCount);
        }
      }
      frameCount += 1;
    };
    rafId = requestAnimationFrame(frame);
  }
  function governTier(now: number): void {
    if (frameDeltas.length < 90) return;
    if (now - lastTierStepCheck < 900) return;
    const avg = avgDelta();
    const idx = TIER_ORDER.indexOf(state.entryTier as CapTier);
    if (avg > 24 && idx > 0) {
      lastTierStepCheck = now;
      applyTierCaps(TIER_ORDER[idx - 1]);
      frameDeltas.length = 0;
      emit('tierchange', { tier: state.entryTier, reason: 'governor-step-down' });
    } else if (avg < 12 && idx < TIER_ORDER.length - 1) {
      lastTierStepCheck = now;
      applyTierCaps(TIER_ORDER[idx + 1]);
      frameDeltas.length = 0;
      emit('tierchange', { tier: state.entryTier, reason: 'governor-step-up' });
    } else {
      lastTierStepCheck = now;
    }
  }
  function ensureHeroObserver(): void {
    heroObserver?.disconnect();
    state.heroVisible = true;
    if (canvasEl) canvasEl.style.opacity = '1';
    const hero = document.querySelector('main');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    heroObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          state.heroVisible = entry.isIntersecting;
          if (canvasEl) canvasEl.style.opacity = state.heroVisible ? '1' : '0';
        }
      },
      { threshold: [0, 0.08, 0.5] },
    );
    heroObserver.observe(hero);
  }
  async function bootBackend(reason = 'init'): Promise<InitializeResult> {
    detachAll();
    const tier = chooseTier();
    if (tier === 'tier0') {
      activateCssFallback('fx-off');
      emit('tierchange', { tier: 'tier0', reason: 'fx-off' });
      return { ok: true, tier: 'tier0', reason: 'fx-off' };
    }
    const canvas = canvasEl;
    if (!canvas) {
      activateCssFallback('no-canvas');
      emit('tierchange', { tier: 'tier0', reason: 'no-canvas' });
      return { ok: true, tier: 'tier0', reason: 'no-canvas' };
    }
    let context: WebGL2RenderingContext | null = null;
    try {
      context = canvas.getContext('webgl2', {
        antialias: false,
        depth: false,
        stencil: false,
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      context = null;
      console.warn('webgl2 context creation threw', error);
    }
    if (!context) {
      activateCssFallback('webgl2-unavailable');
      emit('tierchange', { tier: 'tier0', reason: 'webgl2-unavailable' });
      return { ok: true, tier: 'tier0', reason: 'webgl2-unavailable' };
    }
    gl = context;
    try {
      program = buildProgram();
      gl.useProgram(program);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      uniforms = locateUniforms();
      if (ART) artInit();
      gl.uniform2f(uniforms.uResolution, 1, 1);
      gl.uniform1f(uniforms.uTime, 0);
      gl.uniform2f(uniforms.uPointer, 0.5, 0.5);
      gl.uniform1f(uniforms.uWipe, 1.0);
      particles = createParticles(gl);
      resetFormationPointer();
      state.currentFormation = state.environment as FormationId;
      applyEnvironment(environments[normalizeEnvironment(state.environment)] ?? environments.jin);
      gl.useProgram(program);
      gl.uniform1i(uniforms.uFormation, FORMATION_INDEX[state.currentFormation]);
      gl.uniform1i(uniforms.uFormationDetail, 1);
      applyTierCaps(isCapTier(tier as EntryTier) ? (tier as CapTier) : 'tier2');
      gpuTimerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    } catch (error) {
      console.error('fx backend init failed; Tier 0 engaged', error);
      teardownGl();
      detachAll();
      state.initialized = false;
      activateCssFallback('shader-error');
      emit('error', { reason: 'shader-error', message: String((error as Error)?.message ?? error) });
      emit('tierchange', { tier: 'tier0', reason: 'shader-error' });
      return { ok: true, tier: 'tier0', reason: 'shader-error' };
    }
    hookContext(canvas);
    window.addEventListener('resize', onWindowResize);
    detach.push(() => window.removeEventListener('resize', onWindowResize));
    document.addEventListener('visibilitychange', onVisibilityChange);
    detach.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
    window.addEventListener('pagehide', onPageHide);
    detach.push(() => window.removeEventListener('pagehide', onPageHide));
    if (!window.matchMedia?.('(pointer: coarse)').matches) {
      const onPointerMove = (e: PointerEvent) => {
        state.pointer.x = e.clientX / window.innerWidth;
        state.pointer.y = 1 - e.clientY / window.innerHeight;
        const region = formationRegion();
        if (region) {
          const pointer = normalizePointerToRegion(e.clientX, e.clientY, region.getBoundingClientRect());
          if (pointer) {
            activateFormationPointer(pointer.x, pointer.y);
            return;
          }
        } else {
          // The landing stage uses the legacy full-viewport particle fallback.
          activateFormationPointer(state.pointer.x, state.pointer.y);
          return;
        }
        deactivateFormationPointer();
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      detach.push(() => window.removeEventListener('pointermove', onPointerMove));
      const onPointerNeutral = () => deactivateFormationPointer();
      document.documentElement.addEventListener('pointerleave', onPointerNeutral, { passive: true });
      detach.push(() => document.documentElement.removeEventListener('pointerleave', onPointerNeutral));
      window.addEventListener('pointercancel', onPointerNeutral, { passive: true });
      detach.push(() => window.removeEventListener('pointercancel', onPointerNeutral));
      window.addEventListener('blur', onPointerNeutral);
      detach.push(() => window.removeEventListener('blur', onPointerNeutral));
      window.addEventListener('scroll', onPointerNeutral, { passive: true });
      detach.push(() => window.removeEventListener('scroll', onPointerNeutral));
    }
    try {
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener?.('change', onDprChange);
    } catch {
      dprMedia = null;
    }
    ensureHeroObserver();
    startSeconds = performance.now();
    canvas.classList.add('fx-canvas--live');
    document.body.dataset.fx = 'webgl';
    document.body.dataset.fxReason = state.entryTier;
    startLoop();
    emit('tierchange', { tier: state.entryTier, reason });
    return { ok: true, tier: state.entryTier, reason };
  }
  async function initialize(canvas?: HTMLCanvasElement | null): Promise<InitializeResult> {
    if (state.initialized) {
      return { ok: true, tier: state.entryTier, reason: 'already-initialized' };
    }
    state.disposed = false;
    canvasEl = canvas ?? (document.getElementById('fx') as HTMLCanvasElement | null);
    state.debug = false;
    try {
      state.debug = new URLSearchParams(window.location.search).get('debug') === '1';
    } catch {
      state.debug = false;
    }
    const reduced = isReducedMotion();
    if (reduced) {
      state.initialized = true;
      activateCssFallback('reduced-motion');
      emit('tierchange', { tier: 'tier0', reason: 'reduced-motion' });
      return { ok: true, tier: 'tier0', reason: 'reduced-motion' };
    }
    state.initialized = true;
    return bootBackend('init');
  }
  function setEnvironment(id: string): CharacterId {
    const env = normalizeEnvironment(id);
    const same = state.environment === env;
    state.environment = env;
    state.currentFormation = env as FormationId;
    resetFormationPointer();
    document.body.dataset.env = env;
    if (gl && !same) {
      artImg = null;
      artState = 0;
      wipe.from = { deep: [...disp.deep], fog: [...disp.fog], glow: [...disp.glow], vein: [...disp.vein], mode: disp.mode };
      wipe.to = environments[env] ?? environments.jin;
      wipe.start = performance.now();
      wipe.reseeded = false;
      wipe.active = true;
      if (uniforms) {
        gl.useProgram(program);
        gl.uniform1f(uniforms.uWipe, 0);
        gl.uniform1i(uniforms.uFormation, FORMATION_INDEX[env as FormationId]);
        gl.uniform1i(uniforms.uFormationDetail, 1);
      }
      applyParticleFormation(environments[env] ?? environments.jin);
    }
    return env;
  }
  const clamp01 = (value: number): number =>
    Number.isNaN(Number(value)) ? 0.5 : Math.min(1, Math.max(0, Number(value)));
  function setPointer(xNorm: number, yNorm: number): void {
    const x = clamp01(xNorm);
    const y = clamp01(yNorm);
    state.pointer.x = x;
    state.pointer.y = y;
    state.formationPointer.x = x;
    state.formationPointer.y = y;
    formationPointerActive = true;
    ptrW.x = x;
    ptrW.y = y;
    formPtrW.x = x;
    formPtrW.y = y;
    if (gl && uniforms) {
      if (particles) {
        gl.useProgram(particles.program);
        gl.uniform2f(particles.u.uPointer, x, y);
      }
      gl.useProgram(program);
      gl.uniform2f(uniforms.uPointer, x, y);
    }
  }
  function setQuality(tier: string): void {
    if (!QUALITY_VALUES.includes(tier as QualityChoice)) tier = 'auto';
    const choice = tier as QualityChoice;
    state.quality = choice;
    if (choice === 'tier0') {
      teardownGl();
      detachAll();
      document.body.dataset.fx = 'css';
      document.body.dataset.fxReason = 'fx-off';
      canvasEl?.classList.remove('fx-canvas--live');
      emit('tierchange', { tier: 'tier0', reason: 'fx-off' });
      return;
    }
    if (choice !== 'auto' && !gl) {
      if (!state.disposed && state.initialized) void bootBackend('quality');
      return;
    }
    if (choice !== 'auto' && gl) {
      applyTierCaps(choice as CapTier);
      frameDeltas.length = 0;
    }
  }
  function resize(): void {
    resizeBackingStore();
  }
  function dispose(): void {
    state.disposed = true;
    teardownGl();
    detachAll();
    contextOff?.();
    contextOff = null;
    state.initialized = false;
    document.body.dataset.fx = 'css';
    document.body.dataset.fxReason = 'disposed';
    canvasEl?.classList.remove('fx-canvas--live');
  }

  return {
    initialize,
    setEnvironment,
    setPointer,
    setQuality,
    resize,
    dispose,
    on,
  };
}
