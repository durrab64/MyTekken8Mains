/**
 * R2.5-0 formation data model for the isolated lab.
 *
 * Jin, Claudio, Dragunov, Victor and Lars are implemented and selectable. The
 * registry, the type system and the selector cover the full five-character
 * set. Unknown shader-side ids still resolve to a disabled sentinel, never to
 * invented geometry.
 */
export type FormationId = 'jin' | 'claudio' | 'dragunov' | 'victor' | 'lars';

export interface FormationPalette {
  deep: readonly [number, number, number];
  fog: readonly [number, number, number];
  glow: readonly [number, number, number];
  vein: readonly [number, number, number];
  tintA: readonly [number, number, number];
  tintB: readonly [number, number, number];
}

export type FormationGlyph = 'streak' | 'chip' | 'diamond' | 'glint';

export interface FormationAtmosphere {
  /** 0 Jin ember column / 1 Claudio / 2 Dragunov / 3 Victor / 4 Lars. */
  mode: number;
  /** Key-light anchor in atmosphere p-space. Used by formations with a fixed lamp. */
  anchor: readonly [number, number];
  /** Band width multiplier. Reserved; current modes use their own constants. */
  band: number;
  /** Charge-pulse period in seconds. 0 = no pulse (Jin/Claudio/Dragunov/Victor). */
  pulsePeriod: number;
}

/**
 * Data-driven formation definition. Intentionally small: geometry lives in
 * GLSL, counts/tier config live in TIER_CONFIG, and interaction constants stay
 * with the user-facing params. This object carries identity, palette, render
 * glyph, atmosphere plumbing and safe defaults.
 */
export interface FormationDefinition {
  id: FormationId;
  character: string;
  name: string;
  title: string;
  /** Only `true` entries may be selected or rendered. */
  implemented: boolean;
  glyph: FormationGlyph;
  /** Formation envelope radius (stage units). */
  radius: number;
  /** Default spring constant for the formation (informational; panel params stay authoritative). */
  spring: number;
  /** Multiplier applied to the UI curl parameter. 1 = unchanged (Jin). */
  curlScale: number;
  /** Depth-layout descriptor for the future shared renderer. Informational in this stage. */
  depth: 'helix' | 'rings' | 'sheets' | 'dial' | 'trunk';
  /** Baseline tangent stretch for sprites; Jin keeps its committed law. */
  stretchBase: number;
  /** Speed-response coefficient on the tangent stretch law. */
  stretchSpeed: number;
  atmosphere: FormationAtmosphere;
  palette: FormationPalette;
}

export const FORMATIONS: Record<FormationId, FormationDefinition> = {
  jin: {
    id: 'jin',
    character: 'Jin Kazama',
    name: 'Ember Pillar',
    title: 'The approved R2.4 reference formation',
    implemented: true,
    glyph: 'streak',
    radius: 0.34,
    spring: 2.6,
    curlScale: 1,
    stretchBase: 1.18,
    stretchSpeed: 0.5,
    depth: 'helix',
    atmosphere: { mode: 0, anchor: [0, -0.7], band: 1, pulsePeriod: 0 },
    palette: {
      deep: [0.05, 0.024, 0.02],
      fog: [0.13, 0.05, 0.038],
      glow: [0.7, 0.11, 0.055],
      vein: [0.95, 0.3, 0.12],
      tintA: [0.95, 0.34, 0.1],
      tintB: [1, 0.72, 0.3],
    },
  },
  // Claudio, Dragunov, Victor and Lars are implemented (R2.5-1…R2.5-4). The
  // registry carries identity, palette, glyph and safe defaults; geometry is
  // evaluated by formationHome()/larsHome() in GLSL and mirrored in JS.
  claudio: {
    id: 'claudio',
    character: 'Claudio Serafino',
    name: 'Radiant Orbit',
    title: 'The approved nested-orbit formation',
    implemented: true,
    glyph: 'glint',
    radius: 0.63,
    spring: 2.6,
    curlScale: 1,
    stretchBase: 1.32,
    stretchSpeed: 0.9,
    depth: 'rings',
    atmosphere: { mode: 1, anchor: [0, 0], band: 1, pulsePeriod: 0 },
    palette: {
      deep: [0.014, 0.028, 0.055],
      fog: [0.085, 0.12, 0.2],
      glow: [0.5, 0.68, 0.88],
      vein: [0.95, 0.83, 0.48],
      tintA: [0.38, 0.62, 0.92],
      tintB: [0.97, 0.9, 0.6],
    },
  },
  dragunov: {
    id: 'dragunov',
    character: 'Sergei Dragunov',
    name: 'Frost Curtain',
    title: 'The approved frozen-curtain formation',
    implemented: true,
    glyph: 'chip',
    radius: 1.25,
    spring: 2.4,
    curlScale: 0.6,
    stretchBase: 2.1,
    stretchSpeed: 0.9,
    depth: 'sheets',
    atmosphere: { mode: 2, anchor: [0, -0.7], band: 1, pulsePeriod: 0 },
    palette: {
      deep: [0.018, 0.026, 0.04],
      fog: [0.065, 0.1, 0.15],
      glow: [0.3, 0.42, 0.55],
      vein: [0.75, 0.85, 0.94],
      tintA: [0.34, 0.42, 0.54],
      tintB: [0.78, 0.86, 0.94],
    },
  },
  victor: {
    id: 'victor',
    character: 'Victor Chevalier',
    name: 'Precision Dial',
    title: 'The approved quantised dial formation',
    implemented: true,
    glyph: 'diamond',
    radius: 0.5,
    spring: 3.2,
    curlScale: 0.4,
    stretchBase: 1.0,
    stretchSpeed: 0.35,
    depth: 'dial',
    atmosphere: { mode: 3, anchor: [-0.55, 0.6], band: 1, pulsePeriod: 0 },
    palette: {
      deep: [0.026, 0.016, 0.05],
      fog: [0.085, 0.055, 0.15],
      glow: [0.42, 0.22, 0.72],
      vein: [0.18, 0.78, 0.85],
      tintA: [0.48, 0.25, 0.82],
      tintB: [0.16, 0.8, 0.86],
    },
  },
  lars: {
    id: 'lars',
    character: 'Lars Alexandersson',
    name: 'Bolt Filament',
    title: 'The approved bolt-filament formation',
    implemented: true,
    glyph: 'streak',
    radius: 1.2,
    spring: 3.0,
    curlScale: 0.7,
    // Long electric streaks: Jin's 1.18 base stretched by the documented 1.3x.
    stretchBase: 1.53,
    stretchSpeed: 0.5,
    depth: 'trunk',
    atmosphere: { mode: 4, anchor: [0, 0], band: 1, pulsePeriod: 2.2 },
    palette: {
      deep: [0.006, 0.022, 0.055],
      fog: [0.03, 0.09, 0.2],
      glow: [0.18, 0.55, 0.95],
      vein: [0.95, 0.8, 0.28],
      tintA: [0.2, 0.62, 0.95],
      tintB: [0.95, 0.78, 0.22],
    },
  },
};

/** Stable render order for the selector. */
export const FORMATION_ORDER: readonly FormationId[] = [
  'jin',
  'claudio',
  'dragunov',
  'victor',
  'lars',
] as const;

/** Shader-side formation ids. All five indices are implemented. */
export const FORMATION_INDEX: Record<FormationId, number> = {
  jin: 0,
  claudio: 1,
  dragunov: 2,
  victor: 3,
  lars: 4,
} as const;

export function isFormationImplemented(id: FormationId): boolean {
  return FORMATIONS[id].implemented;
}

export interface ActiveFormation {
  id: FormationId;
  index: number;
  character: string;
  name: string;
  title: string;
}

/** Registry lookup used by the engine. Throws on unknown id. */
export function requireFormation(id: string): FormationDefinition {
  const definition = (FORMATIONS as Record<string, FormationDefinition | undefined>)[
    id
  ];
  if (!definition) {
    throw new Error(`Unknown formation "${id}".`);
  }
  return definition;
}

export const SIM_SIZE = 64;
export const SIM_TEXTURE_COUNT = 4;
export const RGBA16F_BYTES_PER_TEXEL = 8;
export const GPGPU_BYTES =
  SIM_SIZE * SIM_SIZE * RGBA16F_BYTES_PER_TEXEL * SIM_TEXTURE_COUNT;
export const GPGPU_KILOBYTES = GPGPU_BYTES / 1024;

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

const F32 = Math.fround;
const fadd = (a: number, b: number): number => F32(F32(a) + F32(b));
const fsub = (a: number, b: number): number => F32(F32(a) - F32(b));
const fmul = (a: number, b: number): number => F32(F32(a) * F32(b));
const fdiv = (a: number, b: number): number => F32(F32(a) / F32(b));

function fractF(value: number): number {
  return F32(value - Math.floor(value));
}

/** JS mirror of labHash11 in the shaders — bit-exact float32 semantics. */
function hash11(value: number): number {
  let p = fractF(fmul(F32(value), 0.1031));
  p = fmul(p, fadd(p, 33.33));
  p = fmul(p, fadd(p, p));
  return fractF(p);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** JS mirror of formationLambda: near-uniform arc-length spacing. */
export function formationLambda(base: number): number {
  return Math.fround(
    Math.fround(base) +
      0.05 * Math.sin(F32(F32(Math.PI * 2 * Math.fround(base)))),
  );
}

/**
 * Round a number through IEEE half precision, as the RGBA16F textures do.
 * Exact for values in [-2^16, 2^16) with no subnormal underflow; the seeded
 * seeds/lambdas both live in [0, 1).
 */
function roundHalfFloat(value: number): number {
  if (value === 0) return 0;
  const a = Math.abs(value);
  const sign = value < 0 ? -1 : 1;
  if (a >= 65504) return sign * 65504;
  if (a < 2 ** -24) return sign * 0;
  if (a >= 2 ** -14) {
    const E = Math.floor(Math.log2(a));
    if (E > 15) return sign * 65504;
    const eField = E + 15;
    const mant = a / Math.pow(2, E) - 1;
    let mantBits = Math.floor(mant * 1024);
    const frac = mant * 1024 - mantBits;
    if (frac > 0.5 || (frac === 0.5 && (mantBits & 1) === 1)) {
      mantBits += 1;
      if (mantBits === 1024) {
        const e2 = eField + 1;
        if (e2 >= 31) return sign * 65504;
        return sign * Math.pow(2, E + 1);
      }
    }
    return sign * Math.pow(2, E) * (1 + mantBits / 1024);
  }
  // Subnormal: value = m * 2^-24, m in [0, 1023]
  const mant = a * 16777216;
  let m = Math.floor(mant);
  const frac = mant - m;
  if (frac > 0.5 || (frac === 0.5 && (m & 1) === 1)) m += 1;
  if (m >= 1024) return sign * Math.pow(2, -14);
  return sign * m / 16777216;
}

const DRAGUNOV_SHEET_CONFIG = [
  { minX: -1.15, maxX: 1.15, cols: 6 },
  { minX: -1.25, maxX: 1.25, cols: 7 },
  { minX: -1.35, maxX: 1.35, cols: 7 },
] as const;
const DRAGUNOV_T3_COLS = 9;
const DRAGUNOV_ZSHEET = [-0.19, 0.0, 0.19] as const;

/** Dragunov sheet index; mirrors dragunovSheet() in the shaders. */
export function dragunovSheet(seed: number, detail: FormationDetail): number {
  if (detail === 0) return 1;
  if (seed < 0.36) return 0;
  if (seed < 0.68) return 1;
  return 2;
}

/** Column index for a Dragunov particle (stable per seed + sheet). */
export function dragunovColumnIndex(
  seed: number,
  sheet: number,
  detail: FormationDetail,
): number {
  const cols =
    detail === 2 ? DRAGUNOV_T3_COLS : DRAGUNOV_SHEET_CONFIG[sheet].cols;
  const arg = fadd(fadd(fmul(seed, 13.7), fmul(sheet, 91.0)), 7.0);
  return Math.floor(fmul(hash11(arg), cols));
}

/** Stable per-column identity (jitter / lengthMul). */
export function dragunovColumnHash(sheet: number, index: number): number {
  const arg = fadd(fadd(fmul(index, 3.71), fmul(sheet, 17.3)), 3.1);
  return hash11(arg);
}

/**
 * Mirror of dragunovHome. Three depth-layered sheets of vertical columns with
 * controlled dissolution and restrained fall. The "web" of columns is the
 * silhouette; particles cycle top to bottom with per-particle phase spread.
 */
function dragunovHome(
  lambda: number,
  seed: number,
  time: number,
  detail: FormationDetail,
): [number, number, number] {
  const comp = detail === 0 ? 1 : dragunovSheet(seed, detail);
  const cfg = DRAGUNOV_SHEET_CONFIG[comp];
  const cols = detail === 2 ? DRAGUNOV_T3_COLS : cfg.cols;
  const index = dragunovColumnIndex(seed, comp, detail);
  const colHash = dragunovColumnHash(comp, index);

  const base = fadd(
    cfg.minX,
    fmul(fdiv(fadd(index, 0.5), cols), fsub(cfg.maxX, cfg.minX)),
  );
  let x = fadd(base, fmul(fsub(colHash, 0.5), 0.06));
  const gauss = fmul(
    fsub(
      fadd(
        fadd(
          hash11(fadd(fmul(seed, 29.1), 2.4)),
          hash11(fadd(fmul(seed, 41.7), 3.1)),
        ),
        hash11(fadd(fmul(seed, 53.3), 5.9)),
      ),
      1.5,
    ),
    2.0,
  );
  x = fadd(x, fmul(gauss, fadd(0.022, fmul(comp, 0.005))));

  // Lateral crossed-sheet columns lose a little speed near the gust
  // centreline; kept restrained to preserve the frozen silhouette.
  x = fadd(
    x,
    fmul(0.025, Math.sin(fadd(fadd(fmul(time, 0.55), fmul(comp, 2.3)), fmul(x, 0.6)))),
  );

  // Wavy sheet warp — in-plane fbm proxy, identical in GLSL.
  const warp = fadd(
    fmul(0.055, Math.sin(fadd(fadd(fmul(x, 2.3), fmul(time, 0.25)), fmul(comp, 2.1)))),
    fmul(0.03, Math.sin(fadd(fsub(fmul(x, 4.9), fmul(time, 0.4)), comp))),
  );

  // Fragments in T3 drift slightly off the sheet — broken ice, not a wall of glass.
  if (detail === 2 && hash11(fadd(fmul(seed, 57.7), 13.1)) > 0.92) {
    x = fadd(x, fmul(fsub(hash11(fadd(fmul(seed, 41.3), 8.8)), 0.5), 0.16));
  }

  const fallRate = fadd(0.16, fmul(0.08, hash11(fadd(fmul(seed, 47.3), 11.1))));
  const phase = hash11(fadd(fmul(seed, 23.7), 9.4));
  // Linear downward fall. Particles fade at the extremes, so the respawn
  // wrap is invisible to both the eye and the spring.
  const u = fractF(F32(F32(F32(lambda) + F32(phase)) + F32(F32(F32(time) * F32(fallRate)) * 0.5)));
  const yMix = fadd(0.98, fmul(fsub(-1.08, 0.98), u));
  const y = fadd(
    yMix,
    fmul(fsub(hash11(fadd(fmul(seed, 61.7), 3.3)), 0.5), 0.024),
  );
  const z = fadd(
    DRAGUNOV_ZSHEET[comp],
    fadd(fmul(warp, 0.55), fmul(fsub(hash11(fadd(fmul(seed, 33.1), 7.7)), 0.5), 0.04)),
  );

  return [x, y, z];
}

const VICTOR_STEP_INTERVAL = 1.1;
const VICTOR_STEP_RAD = Math.PI / 6;
/** Average outer-step rate; the inner ring counter-rotates at half of it. */
const VICTOR_STEP_RATE = VICTOR_STEP_RAD / VICTOR_STEP_INTERVAL;
/** Half a revolution per 12 s for the free-running orbiter bands. */
const VICTOR_ORBIT_RATE = (Math.PI * 2 * 0.5) / 12;

/**
 * Victor component partition. 0 outer ring, 1 inner ring, 2 spokes, 3 hex
 * rim, 4 orbiter bands, 5 iris, 6 T3 shimmer ring. Matches
 * victorComponent() in the shaders.
 */
export function victorComponent(seed: number, detail: FormationDetail): number {
  if (detail === 0) {
    if (seed < 0.475) return 0;
    if (seed < 0.95) return 1;
    return 5;
  }
  if (detail === 2) {
    if (seed < 0.26) return 0;
    if (seed < 0.52) return 1;
    if (seed < 0.74) return 2;
    if (seed < 0.85) return 3;
    if (seed < 0.91) return 4;
    if (seed < 0.97) return 6;
    return 5;
  }
  if (seed < 0.28) return 0;
  if (seed < 0.56) return 1;
  if (seed < 0.8) return 2;
  if (seed < 0.92) return 3;
  if (seed < 0.97) return 4;
  return 5;
}

/**
 * Quantised dial phase: a 30° clunk every 1.1 s. Cubic ease-out inside each
 * interval, wrapped to a full turn so the value stays precise over long runs.
 * Mirrors victorDialPhase() in the shaders.
 */
export function victorDialPhase(time: number): number {
  const raw = time / VICTOR_STEP_INTERVAL;
  const segment = Math.floor(raw);
  const frac = raw - segment;
  const inv = 1 - frac;
  const ease = 1 - inv * inv * inv;
  return (segment % 12) * VICTOR_STEP_RAD + ease * VICTOR_STEP_RAD;
}

/** Mirrors victorClunkEnvelope() in the shaders (rim flare only). */
export function victorClunkEnvelope(time: number): number {
  const frac = time / VICTOR_STEP_INTERVAL - Math.floor(time / VICTOR_STEP_INTERVAL);
  return Math.pow(1 - frac, 7);
}

/**
 * JS mirror of victorHome. A precise counter-rotating dial: violet outer rim
 * raised in z, cyan inner ring recessed, six spokes and a hex perimeter
 * rigid with the outer clunk phase, two free-running orbiter bands, and a
 * tiny breathing iris at the centre.
 */
function victorHome(
  lambda: number,
  seed: number,
  time: number,
  detail: FormationDetail,
): [number, number, number] {
  const tau = Math.PI * 2;
  const comp = victorComponent(seed, detail);
  const phase = victorDialPhase(time);
  const rJitter = (hash11(seed * 27.1 + 4.7) - 0.5) * 0.012;
  const aJitter = (hash11(seed * 19.3 + 8.1) - 0.5) * 0.03;

  if (comp === 0) {
    const theta = tau * lambda + phase + aJitter;
    const radius = 0.5 * (1 + rJitter);
    return [Math.cos(theta) * radius, Math.sin(theta) * radius, 0.18];
  }

  if (comp === 1) {
    // Continuous counter-rotation at half the outer average step rate.
    const theta = tau * lambda - 0.5 * VICTOR_STEP_RATE * time + 0.6 + aJitter;
    const radius = 0.24 * (1 + rJitter);
    return [Math.cos(theta) * radius, Math.sin(theta) * radius, -0.15];
  }

  if (comp === 2) {
    const spoke = Math.floor(hash11(seed * 31.7 + 6.3) * 6);
    const theta = spoke * (tau / 6) + phase + aJitter * 0.12;
    const radius = 0.24 + (0.5 - 0.24) * lambda + rJitter;
    return [Math.cos(theta) * radius, Math.sin(theta) * radius, 0];
  }

  if (comp === 3) {
    // Hexagon rim: six chord edges between the 60° lattice vertices.
    const edge = Math.floor(lambda * 6);
    const t = lambda * 6 - edge;
    const a0 = edge * (tau / 6) + phase;
    const a1 = (edge + 1) * (tau / 6) + phase;
    const v0x = Math.cos(a0) * 0.13;
    const v0y = Math.sin(a0) * 0.13;
    const v1x = Math.cos(a1) * 0.13;
    const v1y = Math.sin(a1) * 0.13;
    let x = v0x + (v1x - v0x) * t;
    let y = v0y + (v1y - v0y) * t;
    const len = Math.hypot(x, y) || 1;
    x += (x / len) * rJitter * 0.2;
    y += (y / len) * rJitter * 0.2;
    return [x, y, 0.03];
  }

  if (comp === 4) {
    const band = hash11(seed * 37.3 + 9.2);
    const outerBand = band < 0.5;
    const radius = (outerBand ? 0.37 : 0.56) * (1 + rJitter);
    const theta =
      tau * lambda +
      (outerBand ? 1 : -1) * VICTOR_ORBIT_RATE * time +
      aJitter;
    return [
      Math.cos(theta) * radius,
      Math.sin(theta) * radius,
      outerBand ? 0.05 : -0.05,
    ];
  }

  if (comp === 6) {
    const theta = tau * lambda - phase + aJitter;
    const radius = 0.44 * (1 + rJitter);
    return [Math.cos(theta) * radius, Math.sin(theta) * radius, 0];
  }

  // Iris — a tiny gaussian core at the centre; the shader breathes its light.
  const gx = hash11(seed * 29.1 + 2.4) + hash11(seed * 41.7 + 3.1) - 1;
  const gy = hash11(seed * 53.3 + 5.9) + hash11(seed * 61.3 + 7.7) - 1;
  return [gx * 0.018, gy * 0.018, 0.06];
}

/** JS mirror of jinHome. Used only to seed the GPGPU textures; the shader
 * re-derives the target every frame. Adjacent filaments share a ribbon, so
 * Tier2 reads as a double helix, Tier3 as a triple, Tier1 as one ribbon. The
 * profile is wide through the lower-middle, tightens above centre and tapers
 * at the crown; 12 % of embers peel outward along the tangent.
 */
function jinHome(
  lambda: number,
  seed: number,
  filament: number,
  time: number,
  radius: number = FORMATIONS.jin.radius,
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

/** R2.5-1 Claudio detail level: 0 = Tier 1 lite, 1 = Tier 2 canonical, 2 = Tier 3 high. */
export type FormationDetail = 0 | 1 | 2;

/** Claudio component partition; mirrors claudioComponent() in the shaders. */
export function claudioComponent(seed: number, detail: FormationDetail): number {
  if (detail === 0) {
    return seed < 0.22 ? 0 : 1;
  }
  if (detail === 2) {
    if (seed < 0.07) return 0;
    if (seed < 0.3) return 1;
    if (seed < 0.6) return 2;
    if (seed < 0.76) return 3;
    if (seed < 0.88) return 4;
    return 5;
  }
  if (seed < 0.08) return 0;
  if (seed < 0.34) return 1;
  if (seed < 0.7) return 2;
  if (seed < 0.9) return 3;
  return 4;
}

const CLAUDIO_COS_INC_A = 0.9271839; // cos(+22Â°)
const CLAUDIO_SIN_INC_A = 0.3746066; // sin(+22Â°)
const CLAUDIO_COS_INC_C = 0.9271839; // cos(-22Â°)
const CLAUDIO_SIN_INC_C = -0.3746066; // sin(-22Â°)
const CLAUDIO_COS_ORBIT = 0.9975641; // cos(4Â°)
const CLAUDIO_SIN_ORBIT = 0.0697565; // sin(4Â°)
const CLAUDIO_COS_AZ = 0.4694716; // cos(62Â°)
const CLAUDIO_SIN_AZ = 0.8829476; // sin(62Â°)
const CLAUDIO_ZOFF = -0.05;

/**
 * JS mirror of claudioHome. Nested inclined orbital planes, a restrained
 * vertical crown halo, and a luminous focal star â€” the star is a treatment
 * derived from existing particles inside the same budget, not new particles.
 */
function claudioHome(
  lambda: number,
  seed: number,
  time: number,
  detail: FormationDetail,
): [number, number, number] {
  const tau = Math.PI * 2;
  const comp = claudioComponent(seed, detail);
  const rJitter = (hash11(seed * 29.7 + 4.1) - 0.5) * 0.055;
  const aJitter = (hash11(seed * 17.3 + 9.7) - 0.5) * 0.045;
  const zJitter = (hash11(seed * 23.9 + 1.3) - 0.5) * 0.02;
  // Gentle vertical breathing (bounded) instead of unbounded drift.
  const bob = 0.018 * Math.sin(time * 0.8 + seed * 6.0);

  if (comp === 0) {
    const g =
      hash11(seed * 29.1 + 2.4) +
      hash11(seed * 41.7 + 3.1) +
      hash11(seed * 53.3 + 5.9) -
      1.5;
    const r = Math.max(0.018, 0.058 + g * 0.022);
    const theta = 0.16 * time + (lambda - 0.5) * 0.9 + aJitter;
    return [
      Math.cos(theta) * r * (1 + rJitter),
      Math.sin(theta) * r * 0.9 + bob,
      g * 0.02,
    ];
  }

  if (comp === 4) {
    const radius = 0.46 * (1 + rJitter);
    const theta = tau * lambda + 0.9 + 0.03 * time + aJitter;
    const x = Math.cos(theta) * radius * CLAUDIO_COS_AZ;
    const z = -Math.cos(theta) * radius * CLAUDIO_SIN_AZ + CLAUDIO_ZOFF + zJitter;
    return [x, Math.sin(theta) * radius + bob, z];
  }

  let radius = 0.42;
  let sy = 1;
  let sz = 0;
  let phase = 2.1;
  let rate = 0.07;
  if (comp === 1) {
    radius = 0.22;
    sy = CLAUDIO_COS_INC_A;
    sz = CLAUDIO_SIN_INC_A;
    phase = 0;
    rate = 0.1;
  } else if (comp === 3) {
    radius = 0.68;
    sy = CLAUDIO_COS_INC_C;
    sz = CLAUDIO_SIN_INC_C;
    phase = 4.2;
    rate = 0.045;
  } else if (comp === 5) {
    radius = 0.56;
    sy = CLAUDIO_COS_ORBIT;
    sz = CLAUDIO_SIN_ORBIT;
    phase = 3.0;
    rate = -0.055; // counter-rotating faint orbiter (Tier 3)
  }

  const r = radius * (1 + rJitter);
  const theta = tau * lambda + phase + rate * time + aJitter;
  return [
    Math.cos(theta) * r,
    Math.sin(theta) * r * sy + bob,
    Math.sin(theta) * r * sz + zJitter,
  ];
}

/**
 * Lars component partition. Mirrors larsComponent() in the shaders.
 *   0 trunk / 1 fork A / 2 fork B / 3 sub A1 / 4 sub A2 / 5 sub B1 /
 *   6 sub B2 / 7 socket A / 8 socket B.
 * T1 keeps the trunk, both forks and the junction sockets (simplified
 * trunk-and-fork silhouette, no sub-branches); T2 adds both forks and
 * the two junction sockets; T3 adds four sub-branches and widens the
 * socket share.
 */
export function larsComponent(seed: number, detail: FormationDetail): number {
  if (detail === 0) {
    // Tier 1 — simplified but recognisable trunk-and-fork silhouette.
    if (seed < 0.72) return 0;
    if (seed < 0.84) return 1;
    if (seed < 0.96) return 2;
    if (seed < 0.98) return 7;
    return 8;
  }
  if (detail === 2) {
    if (seed < 0.54) return 0;
    if (seed < 0.69) return 1;
    if (seed < 0.84) return 2;
    if (seed < 0.87) return 3;
    if (seed < 0.9) return 4;
    if (seed < 0.93) return 5;
    if (seed < 0.96) return 6;
    if (seed < 0.98) return 7;
    return 8;
  }
  if (seed < 0.60) return 0;
  if (seed < 0.78) return 1;
  if (seed < 0.96) return 2;
  if (seed < 0.98) return 7;
  return 8;
}

export const LARS_PULSE_PERIOD = 2.2;
export const LARS_PULSE_WIDTH = 0.18;
const LARS_TRUNK_ROOT = -1.18;
const LARS_TRUNK_TIP = 1.18;
const LARS_BRANCH_A_START = 0.35;
const LARS_BRANCH_B_START = -0.3;

/** 1D value noise over hash11; mirrors larsNoise1() in the shaders. */
function larsNoise1(value: number): number {
  const i = Math.floor(value);
  const f = F32(value - i);
  const u = fmul(fmul(f, f), fsub(3, fmul(2, f)));
  const a = hash11(F32(i));
  const b = hash11(F32(i + 1));
  return fadd(fmul(a, fsub(1, u)), fmul(b, u));
}

/** Two-octave 1D fbm in [0,1]; mirrors larsFbm1() in the shaders. */
function larsFbm1(value: number): number {
  const first = larsNoise1(value);
  const second = larsNoise1(fadd(fmul(value, 2.03), 19.7));
  return fadd(fmul(0.68, first), fmul(0.32, second));
}

/**
 * Trunk centreline: 0.30*signed fbm(s*2.6 + t*0.8) + 0.16*sin(s*4.3 + t*3.1)
 * + 0.05*sway. The lab's fbm is 0..1, so the fbm term is mapped to -1..1.
 * Mirrors larsTrunkX() in the shaders.
 */
function larsTrunkX(y: number, time: number): number {
  const fbm = larsFbm1(fadd(fmul(y, 2.6), fmul(time, 0.8)));
  const signed = fsub(fmul(2, fbm), 1);
  const wave = Math.sin(fadd(fmul(y, 4.3), fmul(time, 3.1)));
  const sway = Math.sin(fadd(fmul(time, 0.3), 0.7));
  return fadd(
    fadd(
      fadd(fmul(0.3, signed), fmul(0.16, wave)),
      fmul(0.05, sway),
    ),
    fmul(0.30, y),
  );
}

function larsBranchY(f: number, side: number): number {
  const start = side > 0 ? LARS_BRANCH_A_START : LARS_BRANCH_B_START;
  return fadd(start, fmul(f, fsub(LARS_TRUNK_TIP, start)));
}

/** Fork centreline: starts at the trunk junction and follows its own fbm. */
function larsBranchX(f: number, side: number, time: number): number {
  const y = larsBranchY(f, side);
  const startY = side > 0 ? LARS_BRANCH_A_START : LARS_BRANCH_B_START;
  const anchorX = larsTrunkX(startY, time);
  const wig =
    larsFbm1(
      fadd(fadd(fmul(y, 3.6), fmul(time, 1.2)), fmul(side, 4.7)),
    ) *
      2 -
    1;
  // Divergence starts at zero so the fork's first particles sit inside the
  // trunk (a junction, not a floating line); the fbm wiggle is also weighted
  // by f so the root stays anchored.
  const divergence = fmul(side, fmul(0.70, f));
  const flick = fmul(side, fmul(0.12, smoothstep(0.82, 1, f)));
  return fadd(
    fadd(fadd(anchorX, divergence), flick),
    fmul(0.2, fmul(wig, f)),
  );
}

function larsSubBranch(
  f: number,
  side: number,
  parentF: number,
  endY: number,
  spread: number,
  time: number,
): [number, number] {
  const parentY = larsBranchY(parentF, side);
  const parentX = larsBranchX(parentF, side, time);
  const y = fadd(parentY, fmul(f, fsub(endY, parentY)));
  const wig =
    larsFbm1(
      fadd(fadd(fmul(y, 4.8), fmul(time, 1.5)), fmul(side, 9.1)),
    ) *
      2 -
    1;
  const x = fadd(
    fadd(parentX, fmul(side, fadd(0.05, fmul(spread, f)))),
    fmul(0.16, wig),
  );
  return [x, y];
}

/**
 * JS mirror of larsHome. One dominant trunk (two interleaved strands) with
 * two distinct forks, gold junction sockets and optional Tier 3 sub-branches.
 * The charge pulse is a shading envelope, so it never perturbs the spring.
 */
function larsHome(
  lambda: number,
  seed: number,
  time: number,
  detail: FormationDetail,
  filament: number,
): [number, number, number] {
  const comp = larsComponent(seed, detail);
  const strand = filament % 2;
  const side = strand === 0 ? -1 : 1;
  const microX = fmul(
    fsub(hash11(fadd(fmul(seed, 31.7), 5.3)), 0.5),
    0.012,
  );
  const microY = fmul(
    fsub(hash11(fadd(fmul(seed, 47.1), 7.9)), 0.5),
    0.01,
  );
  const microZ = fmul(
    fsub(hash11(fadd(fmul(seed, 23.3), 3.7)), 0.5),
    0.012,
  );
  const shimmer = fmul(
    0.02,
    Math.sin(
      fadd(
        fadd(fmul(time, 8.7), fmul(seed, Math.PI * 2)),
        fmul(strand, 2.1),
      ),
    ),
  );

  if (comp === 0) {
    const y = fadd(
      fadd(LARS_TRUNK_ROOT, fmul(LARS_TRUNK_TIP - LARS_TRUNK_ROOT, lambda)),
      fmul(microY, 0.5),
    );
    const fbmZ = larsFbm1(fadd(fmul(y, 1.3), fmul(time, 0.5)));
    return [
      fadd(
        fadd(larsTrunkX(y, time), fmul(side, 0.035)),
        fadd(microX, shimmer),
      ),
      y,
      fadd(
        fadd(
          fmul(side, 0.045),
          fmul(0.05, fsub(fmul(2, fbmZ), 1)),
        ),
        microZ,
      ),
    ];
  }

  if (comp === 1 || comp === 2) {
    const branchSide = comp === 1 ? 1 : -1;
    const y = larsBranchY(lambda, branchSide);
    const fbmZ = larsFbm1(
      fadd(
        fadd(fmul(y, 1.7), fmul(time, 0.6)),
        fmul(branchSide, 3.3),
      ),
    );
    return [
      fadd(
        fadd(larsBranchX(lambda, branchSide, time), fmul(branchSide, 0.035)),
        fadd(microX, fmul(shimmer, 0.7)),
      ),
      y,
      fadd(
        fadd(
          fmul(side, 0.045),
          fmul(0.04, fsub(fmul(2, fbmZ), 1)),
        ),
        microZ,
      ),
    ];
  }

  if (comp >= 3 && comp <= 6) {
    let subSide = 1;
    let parentF = 0.22;
    let endY = 0.96;
    let spread = 0.42;
    if (comp === 4) {
      parentF = 0.52;
      endY = 1.12;
      spread = 0.3;
    } else if (comp === 5) {
      subSide = -1;
      parentF = 0.18;
      endY = 0.88;
      spread = 0.4;
    } else if (comp === 6) {
      subSide = -1;
      parentF = 0.48;
      endY = 1.06;
      spread = 0.3;
    }
    const [x, y] = larsSubBranch(
      lambda,
      subSide,
      parentF,
      endY,
      spread,
      time,
    );
    return [
      fadd(fadd(x, microX), fmul(shimmer, 0.6)),
      y,
      fadd(fmul(subSide, 0.03), microZ),
    ];
  }

  // Junction sockets: persistent bright points at the two fork origins,
  // nudged toward the camera so the gold glint reads against the blue cable.
  const socketSide = comp === 7 ? 1 : -1;
  const socketY = comp === 7 ? LARS_BRANCH_A_START : LARS_BRANCH_B_START;
  return [
    fadd(
      fadd(larsTrunkX(socketY, time), fmul(socketSide, 0.04)),
      fmul(microX, 1.4),
    ),
    fadd(socketY, fmul(microY, 1.2)),
    fadd(0.12, fadd(fmul(socketSide, 0.02), fmul(microZ, 1.2))),
  ];
}

/** Fractional position of the charge front in [0,1); 1 / 2.2 s = 0.455 Hz. */
export function larsPulsePhase(time: number): number {
  return fractF(time / LARS_PULSE_PERIOD);
}

/** Brightness envelope of the front at a local parameter; mirrors the GLSL. */
export function larsPulseFront(localS: number, time: number): number {
  const phase = fractF(time / LARS_PULSE_PERIOD - localS);
  const distance = Math.min(phase, 1 - phase);
  return 1 - smoothstep(0, LARS_PULSE_WIDTH, distance);
}

/**
 * Atmosphere micro-lift: a short arrival flash at the tip plus a fading
 * afterglow at the root. Capped at 1 and applied by the atmosphere shader as
 * a multiplier well below the documented 8% luminance ceiling.
 */
export function larsAtmospherePulse(time: number): number {
  const phase = larsPulsePhase(time);
  const arrival =
    smoothstep(0.88, 0.97, phase) * (1 - smoothstep(0.97, 1, phase));
  const afterglow = (1 - smoothstep(0, 0.12, phase)) * 0.55;
  return Math.min(1, arrival + afterglow);
}

/**
 * Formation-aware home evaluation. Implemented ids route to their per-
 * formation function; any other id throws rather than fabricates geometry.
 * Used by the engine readback mirror and seeding path; the shader path
 * goes through FORMATION_GLSL. detail selects the tier-aware component
 * partition for Claudio and Dragunov (0 = Tier 1 lite, 1 = canonical,
 * 2 = high); Jin ignores it.
 */
export function formationHome(
  formationId: FormationId,
  lambda: number,
  seed: number,
  filament: number,
  time: number,
  radius?: number,
  filaments: number = 6,
  detail: FormationDetail = 1,
): [number, number, number] {
  if (formationId === 'jin') {
    return jinHome(lambda, seed, filament, time, radius, filaments);
  }
  if (formationId === 'claudio') {
    return claudioHome(lambda, seed, time, detail);
  }
  if (formationId === 'dragunov') {
    return dragunovHome(lambda, seed, time, detail);
  }
  if (formationId === 'victor') {
    return victorHome(lambda, seed, time, detail);
  }
  if (formationId === 'lars') {
    return larsHome(lambda, seed, time, detail, filament);
  }
  throw new Error(`Formation "${formationId}" has no home function.`);
}

export interface InitialParticleState {
  positions: Float32Array;
  velocities: Float32Array;
}

/**
 * One texel = one particle. RGB is position/velocity, position.w is the stable
 * seed, velocity.w is the formation coordinate lambda. Only implemented ids
 * may be seeded; anything else throws before any GPU state is written. Jin
 * seeds interleaved filaments; Lars seeds two interleaved cable strands;
 * Claudio/Dragunov/Victor seed serially (the lambda coordinate is the
 * arc/fall/component position directly, so distribution stays uniform by
 * construction).
 */
export function buildInitialState(
  size: number,
  count: number,
  filaments: number,
  time: number,
  formationId: FormationId = 'jin',
  detail: FormationDetail = 1,
): InitialParticleState {
  if (FORMATIONS[formationId]?.implemented !== true) {
    throw new Error(
      `Cannot seed formation "${formationId}": it is not implemented in this build.`,
    );
  }
  const texels = size * size;
  const positions = new Float32Array(texels * 4);
  const velocities = new Float32Array(texels * 4);
  const streams =
    formationId === 'jin' ? filaments : formationId === 'lars' ? 2 : 1;
  const rows = Math.max(1, Math.ceil(count / streams));

  for (let index = 0; index < texels; index += 1) {
    const active = index < count;
    // Odd filaments advance half a row so paired strands interleave along the
    // ribbon instead of sitting side-by-side in visible steps.
    const stagger = (index % streams) % 2 === 0 ? 0 : 0.5;
    const base = active
      ? (Math.floor(index / streams) + 0.5 + stagger) / rows
      : hash11(index * 3.71 + 1.23);
    const lambda = roundHalfFloat(formationLambda(base));
    const seed = roundHalfFloat(hash11(index * 1.37 + 4.11));
    const filament = index % streams;
    const home = formationHome(
      formationId,
      lambda,
      seed,
      filament,
      time,
      FORMATIONS[formationId].radius,
      filaments,
      detail,
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
