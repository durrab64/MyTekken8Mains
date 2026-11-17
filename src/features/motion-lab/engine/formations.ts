export interface TierConfig {
  particles: number;
  filaments: number;
  pointerRadius: number;
  octaves: number;
  gpgpu: boolean;
}

export const TIER_CONFIG: Record<1 | 2 | 3, TierConfig> = {
  1: { particles: 450, filaments: 1, pointerRadius: 0.3, octaves: 3, gpgpu: true },
  2: { particles: 1100, filaments: 4, pointerRadius: 0.24, octaves: 4, gpgpu: true },
  3: { particles: 2200, filaments: 6, pointerRadius: 0.2, octaves: 5, gpgpu: true },
};

export const JIN_FORMATION = {
  id: 'jin',
  name: 'Jin Kazama',
  title: 'Ember Pillar',
  radius: 0.34,
  palette: {
    deep: [0.05, 0.024, 0.02],
    fog: [0.13, 0.05, 0.038],
    glow: [0.7, 0.11, 0.055],
    vein: [0.95, 0.3, 0.12],
    tintA: [0.95, 0.34, 0.1],
    tintB: [1, 0.72, 0.3],
  },
} as const;

export const SIM_SIZE = 64;
export const SIM_TEXTURE_COUNT = 4;
export const RGBA16F_BYTES_PER_TEXEL = 8;
export const GPGPU_BYTES =
  SIM_SIZE * SIM_SIZE * RGBA16F_BYTES_PER_TEXEL * SIM_TEXTURE_COUNT;
export const GPGPU_KILOBYTES = GPGPU_BYTES / 1024;

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** JS mirror of labHash11 in the shaders (deterministic particle identity). */
export function hash11(value: number): number {
  let p = fract(value * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

/** JS mirror of jinLambda: near-uniform arc-length spacing along the spiral. */
export function jinLambda(base: number): number {
  return base + 0.05 * Math.sin(Math.PI * 2 * base);
}

/**
 * JS mirror of labJinHome. Used only to seed the GPGPU textures; the shader
 * re-derives the target every frame. Adjacent filaments share a ribbon, so
 * Tier2 reads as a double helix, Tier3 as a triple, Tier1 as one ribbon. The
 * profile is wide through the lower-middle, tightens above centre and tapers
 * at the crown; 12 % of embers peel outward along the tangent.
 */
export function jinHome(
  lambda: number,
  seed: number,
  filament: number,
  time: number,
  radius: number = JIN_FORMATION.radius,
  filaments: number = 6,
): [number, number, number] {
  const tau = Math.PI * 2;
  const ribbonCount = Math.max(1, Math.ceil(filaments * 0.5));
  const ribbon = Math.floor(filament * 0.5);
  const edge = filament % 2;
  const phase = (ribbon / ribbonCount) * tau + (edge - 0.5) * 0.09;

  const profile =
    (0.3 + 0.7 * Math.pow(Math.max(Math.sin(Math.PI * lambda), 0), 1.5)) *
    (1 + 0.1 * Math.sin(Math.PI * (lambda * 2 - 0.15))) *
    (1 - 0.1 * smoothstep(0.72, 1, lambda));

  const radialJitter = hash11(seed * 71.3 + 13.7) - 0.5;
  const angularJitter = hash11(seed * 19.1 + 3.3) - 0.5;

  const spark = seed >= 0.88 ? 1 : 0;
  const sparkPulse =
    0.5 + 0.5 * Math.sin(time * 1.35 + seed * 61 + lambda * 9);

  let angle = lambda * tau * 2.2 + time * 0.35 + phase;
  angle += angularJitter * 0.1;
  angle += spark * (0.1 + 0.16 * sparkPulse);

  const radial = radius * profile * (1 + radialJitter * 0.1);
  const r = radial * (1 + spark * (0.1 + 0.24 * sparkPulse));

  const sway = 0.055 * Math.sin(lambda * Math.PI * 1.2 - 0.35);
  const y =
    -1.18 +
    2.36 * lambda +
    0.016 * Math.sin(time * 0.7 + seed * 9) +
    (seed - 0.5) * 0.01 +
    spark * (0.018 + 0.045 * sparkPulse);
  const x = Math.cos(angle) * r + sway;
  const z = Math.sin(angle) * r * 0.58;
  return [x, y, z];
}

export interface InitialParticleState {
  positions: Float32Array;
  velocities: Float32Array;
}

/**
 * One texel = one particle. RGB is position/velocity, position.w is the stable
 * seed, velocity.w is the formation coordinate lambda.
 */
export function buildInitialState(
  size: number,
  count: number,
  filaments: number,
  time: number,
): InitialParticleState {
  const texels = size * size;
  const positions = new Float32Array(texels * 4);
  const velocities = new Float32Array(texels * 4);
  const rows = Math.max(1, Math.ceil(count / filaments));

  for (let index = 0; index < texels; index += 1) {
    const active = index < count;
    // Odd filaments advance half a row so paired strands interleave along the
    // ribbon instead of sitting side-by-side in visible steps.
    const stagger = (index % filaments) % 2 === 0 ? 0 : 0.5;
    const base = active
      ? (Math.floor(index / filaments) + 0.5 + stagger) / rows
      : hash11(index * 3.71 + 1.23);
    const lambda = jinLambda(base);
    const seed = hash11(index * 1.37 + 4.11);
    const filament = index % filaments;
    const home = jinHome(
      lambda,
      seed,
      filament,
      time,
      JIN_FORMATION.radius,
      filaments,
    );

    positions[index * 4] = home[0];
    positions[index * 4 + 1] = home[1];
    positions[index * 4 + 2] = home[2];
    positions[index * 4 + 3] = seed;

    velocities[index * 4] = 0;
    velocities[index * 4 + 1] = 0;
    velocities[index * 4 + 2] = 0;
    velocities[index * 4 + 3] = lambda;
  }

  return { positions, velocities };
}
