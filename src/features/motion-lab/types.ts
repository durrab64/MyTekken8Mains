import type { FormationId } from './engine/formations';

export type Tier = 0 | 1 | 2 | 3;
export type ActiveTier = 1 | 2 | 3;
export type SimulationMode = 'gpgpu' | 'analytic';
export type ContextState = 'active' | 'lost' | 'restored' | 'failed';
export type GpuTimingStatus = 'ok' | 'measuring' | 'unsupported' | 'disjoint' | 'lost';

export interface LabParams {
  pointerStrength: number;
  pointerRadius: number;
  pointerSwirl: number;
  curl: number;
  spring: number;
  damping: number;
  localDamping: number;
  amplitude: number;
}

/** Proposed experimental starts from the R2.2 brief §6.3. */
export const DEFAULT_PARAMS: LabParams = {
  pointerStrength: 4.2,
  pointerRadius: 0.22,
  pointerSwirl: 2.1,
  curl: 0.45,
  spring: 2.6,
  damping: 1.6,
  localDamping: 1.2,
  amplitude: 1.0,
};

/** Ranges are the R2.2 §6.3 experimental envelopes, not production limits. */
export const PARAM_LIMITS: Record<keyof LabParams, readonly [number, number]> = {
  pointerStrength: [2, 6],
  pointerRadius: [0.15, 0.35],
  pointerSwirl: [1, 3.5],
  curl: [0, 1],
  spring: [1.5, 4],
  damping: [1, 2.5],
  localDamping: [0.5, 2],
  amplitude: [0.6, 1.4],
};

export interface LabCapabilities {
  webgl2: boolean;
  colorBufferFloat: boolean;
  floatTargetsVerified: boolean;
  timerQuery: boolean;
  maxTextureSize: number | null;
  renderer: string | null;
  vendor: string | null;
}

export interface LabStats {
  fps: number | null;
  frameMedianMs: number | null;
  frameP95Ms: number | null;
  gpuMs: number | null;
  gpuMedianMs: number | null;
  gpuStatus: GpuTimingStatus;
  tier: ActiveTier;
  /** Active formation identity. Always an implemented id. */
  formation: FormationId;
  formationName: string;
  particleCount: number;
  filaments: number;
  mode: SimulationMode;
  fallbackReason: string | null;
  simSize: number | null;
  drawsPerFrame: number;
  passesPerFrame: number;
  gpgpuBytes: number;
  gpgpuTextures: number;
  context: ContextState;
  runtimeError: string | null;
  paused: boolean;
  cssWidth: number;
  cssHeight: number;
  backingWidth: number;
  backingHeight: number;
  dpr: number;
  renderScale: number;
  capabilities: LabCapabilities;
}

/** Test-only readback of the live simulation (active particles only). */
export interface ParticleStateSummary {
  count: number;
  meanSpeed: number;
  maxSpeed: number;
  meanDisplacement: number;
  maxDisplacement: number;
  simTime: number;
  paused: boolean;
}

export function isActiveTier(tier: Tier): tier is ActiveTier {
  return tier === 1 || tier === 2 || tier === 3;
}
