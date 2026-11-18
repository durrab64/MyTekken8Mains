/**
 * Lab-only GLSL ES 3.0 sources. These are intentionally independent of
 * src/graphics/shaders.ts; the production renderer is not imported or edited.
 */

const NOISE_GLSL = `
const float LAB_TAU = 6.283185307179586;

float labHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float labHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float labNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = labHash21(i);
  float b = labHash21(i + vec2(1.0, 0.0));
  float c = labHash21(i + vec2(0.0, 1.0));
  float d = labHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float labFbm2(vec2 p) {
  return 0.68 * labNoise(p) + 0.32 * labNoise(p * 2.03 + 19.7);
}

float labFbmOctaves(vec2 p, int octaves) {
  float sum = 0.0;
  float amplitude = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    sum += labNoise(p) * amplitude;
    norm += amplitude;
    p = p * 2.03 + 19.7;
    amplitude *= 0.5;
  }
  return sum / max(norm, 1e-5);
}
`;

/**
 * R2.5 formation interface: Jin (LAB_FORMATION_JIN), Claudio
 * (LAB_FORMATION_CLAUDIO), Dragunov (LAB_FORMATION_DRAGUNOV) and Victor
 * (LAB_FORMATION_VICTOR) are implemented; Lars is rejected by the
 * registry/UI/engine before it reaches the GPU. The sentinel branch parks
 * unsupported ids at the clamp ceiling with zeroed alpha instead of
 * fabricating geometry. Declares its own shared uniforms so every program
 * that includes it links cleanly.
 */
const LAB_FORMATION_GLSL = `
const int LAB_FORMATION_JIN = 0;
const int LAB_FORMATION_CLAUDIO = 1;
const int LAB_FORMATION_DRAGUNOV = 2;
const int LAB_FORMATION_VICTOR = 3;
uniform int uFormation;
uniform int uFormationDetail;   // 0 = T1 lite, 1 = T2 canonical, 2 = T3 high
uniform float uFormationRadius;
uniform float uFilaments;

/**
 * Arc-length compensation. Rows are uniform in this warped lambda so particle
 * spacing along the spiral stays close to even where the radius is widest.
 * Applied identically when seeding, so V.w already stores the warped value.
 */
float formationLambda(float base) {
  return base + 0.05 * sin(LAB_TAU * base);
}

vec3 labJinHome(float lambda, float seed, float filament, float t) {
  // Pair adjacent filaments into one ribbon. Tier2 (4 strands) becomes a
  // double helix; Tier3 (6) a triple helix; Tier1 (1) a single ribbon.
  float ribbonCount = max(1.0, ceil(uFilaments * 0.5));
  float ribbon = floor(filament * 0.5);
  float edge = mod(filament, 2.0);
  float phase = (ribbon / ribbonCount) * LAB_TAU + (edge - 0.5) * 0.09;

  // Wider lower-middle, restrained waist above centre, tapered crown.
  float profile = 0.30 + 0.70 * pow(max(sin(3.14159265359 * lambda), 0.0), 1.5);
  profile *= 1.0 + 0.10 * sin(3.14159265359 * (lambda * 2.0 - 0.15));
  profile *= 1.0 - 0.10 * smoothstep(0.72, 1.0, lambda);

  // Stable per-particle offsets soften each path into a ribbon without
  // breaking its silhouette.
  float radialJitter = labHash11(seed * 71.3 + 13.7) - 0.5;
  float angularJitter = labHash11(seed * 19.1 + 3.3) - 0.5;

  // 12 % embers peel along the outward tangent; the offset is deliberately
  // small so sparks accent the pillar instead of widening it.
  float spark = step(0.88, seed);
  float sparkPulse = 0.5 + 0.5 * sin(t * 1.35 + seed * 61.0 + lambda * 9.0);

  float angle = lambda * LAB_TAU * 2.2 + t * 0.35 + phase;
  angle += angularJitter * 0.10;
  angle += spark * (0.10 + 0.16 * sparkPulse);

  float radius = uFormationRadius * profile;
  radius *= 1.0 + radialJitter * 0.10;
  radius *= 1.0 + spark * (0.10 + 0.24 * sparkPulse);

  // Gentle belly to the right replaces the old radial shear, which distorted
  // the helix instead of bending its centreline.
  float sway = 0.055 * sin(lambda * 3.14159265359 * 1.2 - 0.35);
  float y = mix(-1.18, 1.18, lambda)
          + 0.016 * sin(t * 0.7 + seed * 9.0)
          + (seed - 0.5) * 0.010
          + spark * (0.018 + 0.045 * sparkPulse);
  float x = cos(angle) * radius + sway;
  float z = sin(angle) * radius * 0.58;
  return vec3(x, y, z);
}

/**
 * Claudio component partition. Mirrors claudioComponent() in formations.ts.
 *   0 star Â· 1 ring A (+14Â°) Â· 2 ring B (face-on) Â· 3 ring C (-14Â°)
 *   4 crown (vertical halo) Â· 5 T3 counter-rotating orbiter (missed in T1/T2)
 */
float claudioComponent(float seed) {
  if (uFormationDetail == 0) {
    return seed < 0.22 ? 0.0 : 1.0;
  }
  if (uFormationDetail == 2) {
    if (seed < 0.07) return 0.0;
    if (seed < 0.30) return 1.0;
    if (seed < 0.60) return 2.0;
    if (seed < 0.76) return 3.0;
    if (seed < 0.88) return 4.0;
    return 5.0;
  }
  if (seed < 0.08) return 0.0;
  if (seed < 0.34) return 1.0;
  if (seed < 0.70) return 2.0;
  if (seed < 0.90) return 3.0;
  return 4.0;
}

/** Tiny sprites for the focal star; everyone else reads slightly smaller too. */
float claudioSizeScale(float seed) {
  return claudioComponent(seed) < 0.5 ? 0.80 : 0.78;
}

/** Chips read tight; crystal glints a touch smaller and harder. */
float dragunovSizeScale(float seed) {
  return labHash11(seed * 91.7 + 3.1) > 0.94 ? 0.95 : 1.15;
}

const float CLAUDIO_SIN_INC_A = 0.3746066;   // sin(+22Â°)
const float CLAUDIO_COS_INC_A = 0.9271839;   // cos(+22Â°)
const float CLAUDIO_SIN_INC_C = -0.3746066;  // sin(-22Â°)
const float CLAUDIO_COS_INC_C = 0.9271839;   // cos(-22Â°)
const float CLAUDIO_SIN_ORBIT = 0.0697565;   // sin(4Â°)
const float CLAUDIO_COS_ORBIT = 0.9975641;   // cos(4Â°)
const float CLAUDIO_SIN_AZ = 0.8829476;      // sin(62Â°)
const float CLAUDIO_COS_AZ = 0.4694716;      // cos(62Â°)
const float CLAUDIO_ZOFF = -0.05;            // crown sits behind the star

/**
 * Radiant Orbit: nested inclined orbital planes + a restrained vertical
 * crown halo + a luminous focal star that is a treatment of existing
 * particles, not extra allocation. Orbit hierarchy in Kepler-like order
 * (inner faster). Bounded vertical bob replaces monotonic drift.
 */
vec3 claudioHome(float lambda, float seed, float t) {
  float comp = claudioComponent(seed);
  float rJitter = (labHash11(seed * 29.7 + 4.1) - 0.5) * 0.055;
  float aJitter = (labHash11(seed * 17.3 + 9.7) - 0.5) * 0.045;
  float zJitter = (labHash11(seed * 23.9 + 1.3) - 0.5) * 0.02;
  float bob = 0.018 * sin(t * 0.8 + seed * 6.0);

  if (comp < 0.5) {
    float g = labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1)
            + labHash11(seed * 53.3 + 5.9) - 1.5;
    float r = max(0.018, 0.058 + g * 0.022);
    // A compact comet-like cluster sweeping the inner orbit — reads as a
    // star with direction, not a diffuse lamp at dead centre.
    float theta = 0.16 * t + (lambda - 0.5) * 0.9 + aJitter;
    return vec3(cos(theta) * r * (1.0 + rJitter),
                sin(theta) * r * 0.9 + bob,
                g * 0.02);
  }

  if (comp > 3.5 && comp < 4.5) {
    float r = 0.46 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda + 0.9 + 0.030 * t + aJitter;
    return vec3(cos(theta) * r * CLAUDIO_COS_AZ,
                sin(theta) * r + bob,
                -cos(theta) * r * CLAUDIO_SIN_AZ + CLAUDIO_ZOFF + zJitter);
  }

  float radius;
  float sy;
  float sz;
  float phase;
  float rate;
  if (comp < 1.5) {
    radius = 0.22; sy = CLAUDIO_COS_INC_A; sz = CLAUDIO_SIN_INC_A; phase = 0.0; rate = 0.10;
  } else if (comp < 2.5) {
    radius = 0.42; sy = 1.0; sz = 0.0; phase = 2.1; rate = 0.07;
  } else if (comp < 3.5) {
    radius = 0.68; sy = CLAUDIO_COS_INC_C; sz = CLAUDIO_SIN_INC_C; phase = 4.2; rate = 0.045;
  } else {
    radius = 0.56; sy = CLAUDIO_COS_ORBIT; sz = CLAUDIO_SIN_ORBIT; phase = 3.0; rate = -0.055;
  }

  float r = radius * (1.0 + rJitter);
  float theta = LAB_TAU * lambda + phase + rate * t + aJitter;
  return vec3(cos(theta) * r,
              sin(theta) * r * sy + bob,
              sin(theta) * r * sz + zJitter);
}

/**
 * Dragunov component partition. 0 far sheet, 1 mid, 2 near. T1 is the mid
 * sheet only; T3 uses finer 9-column subdivision + drifting fragments.
 */
float dragunovSheetOf(float seed) {
  if (uFormationDetail == 0) return 1.0;
  if (seed < 0.36) return 0.0;
  if (seed < 0.68) return 1.0;
  return 2.0;
}

float dragunovColsFor(float sheet) {
  if (uFormationDetail == 2) return 9.0;
  if (sheet < 0.5) return 6.0;
  return 7.0;
}

vec2 dragunovColumnBounds(float sheet) {
  if (sheet < 0.5) return vec2(-1.15, 1.15);
  if (sheet < 1.5) return vec2(-1.25, 1.25);
  return vec2(-1.35, 1.35);
}

/** Stable per-particle column index (0..cols-1). */
float dragunovColumnIndex(float seed, float sheet) {
  return floor(labHash11(seed * 13.7 + sheet * 91.0 + 7.0)
               * dragunovColsFor(sheet));
}

/** Stable per-column identity: jitter and lengthMul. */
float dragunovColumnHash(float sheet, float index) {
  return labHash11(index * 3.71 + sheet * 17.3 + 3.1);
}

float dragunovColumnLengthMul(float sheet, float index) {
  return 0.78 + 0.22 * dragunovColumnHash(sheet, index);
}

/**
 * Frost Curtain: three depth-layered warped sheets of vertical columns.
 * Particles cycle within columns top to bottom with per-particle phase
 * spread; sheets warp gently; bottom dissolves per column; a slow crystal
 * pulse travels down one column at a time. Restrained, structured, frozen —
 * never a snowstorm.
 */
vec3 dragunovHome(float lambda, float seed, float t) {
  float comp = uFormationDetail == 0 ? 1.0 : dragunovSheetOf(seed);
  float cols = dragunovColsFor(comp);
  vec2 span = dragunovColumnBounds(comp);
  float index = dragunovColumnIndex(seed, comp);
  float colHash = dragunovColumnHash(comp, index);

  float base = mix(span.x, span.y, (index + 0.5) / cols);
  float x = base + (colHash - 0.5) * 0.06;
  float gauss = (labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1)
               + labHash11(seed * 53.3 + 5.9) - 1.5) * 2.0;
  x += gauss * (0.022 + comp * 0.005);
  x += 0.025 * sin(t * 0.55 + comp * 2.3 + x * 0.6);

  float warp = 0.055 * sin(x * 2.3 + t * 0.25 + comp * 2.1)
             + 0.030 * sin(x * 4.9 - t * 0.4 + comp);

  if (uFormationDetail == 2 && labHash11(seed * 57.7 + 13.1) > 0.92) {
    x += (labHash11(seed * 41.3 + 8.8) - 0.5) * 0.16;
  }

  float fallRate = 0.16 + 0.08 * labHash11(seed * 47.3 + 11.1);
  float phase = labHash11(seed * 23.7 + 9.4);
  // Linear downward fall. Particles fade at the extremes, so the respawn
  // wrap is invisible to both the eye and the spring.
  float u = fract(lambda + phase + t * fallRate * 0.5);
  float y = mix(0.98, -1.08, u) + (labHash11(seed * 61.7 + 3.3) - 0.5) * 0.024;
  float zSheet = (comp - 1.0) * 0.19;
  float z = zSheet + warp * 0.55 + (labHash11(seed * 33.1 + 7.7) - 0.5) * 0.04;
  return vec3(x, y, z);
}

/**
 * Victor component partition. 0 outer ring, 1 inner ring, 2 spokes, 3 hex
 * vertices, 4 orbiter bands, 5 iris, 6 T3 shimmer ring. Mirrors
 * victorComponent() in formations.ts.
 */
float victorComponent(float seed) {
  if (uFormationDetail == 0) {
    if (seed < 0.475) return 0.0;
    if (seed < 0.95) return 1.0;
    return 5.0;
  }
  if (uFormationDetail == 2) {
    if (seed < 0.26) return 0.0;
    if (seed < 0.52) return 1.0;
    if (seed < 0.74) return 2.0;
    if (seed < 0.85) return 3.0;
    if (seed < 0.91) return 4.0;
    if (seed < 0.97) return 6.0;
    return 5.0;
  }
  if (seed < 0.28) return 0.0;
  if (seed < 0.56) return 1.0;
  if (seed < 0.80) return 2.0;
  if (seed < 0.92) return 3.0;
  if (seed < 0.97) return 4.0;
  return 5.0;
}

/** Diamonds stay crisp: rim/spokes regular, orbiters faint, iris brightest. */
float victorSizeScale(float seed) {
  float comp = victorComponent(seed);
  if (comp < 0.5) return 1.06;
  if (comp < 1.5) return 0.98;
  if (comp < 2.5) return 1.02;
  if (comp < 3.5) return 1.08;
  if (comp < 4.5) return 0.86;
  if (comp < 5.5) return 1.12;
  return 0.72;
}

const float VICTOR_STEP_INTERVAL = 1.1;
const float VICTOR_STEP_RAD = 0.5235987756;   // 30°
const float VICTOR_STEP_RATE = 0.4759998;     // 30° per 1.1 s
const float VICTOR_ORBIT_RATE = 0.2617993878; // half a revolution per 12 s

/** Quantised 30° clunk: cubic ease-out inside each 1.1 s interval. */
float victorDialPhase(float t) {
  float raw = t / VICTOR_STEP_INTERVAL;
  float segment = floor(raw);
  float frac = raw - segment;
  float inv = 1.0 - frac;
  float ease = 1.0 - inv * inv * inv;
  return mod(segment, 12.0) * VICTOR_STEP_RAD + ease * VICTOR_STEP_RAD;
}

/** Rim-only flare at the start of each step; inner ring holds steady. */
float victorClunkEnvelope(float t) {
  float frac = fract(t / VICTOR_STEP_INTERVAL);
  return pow(1.0 - frac, 7.0);
}

/**
 * Precision Dial: a counter-rotating mechanical dial. Violet outer rim raised
 * in z, recessed cyan inner ring, six rigid spokes, a hex perimeter, two
 * free-running orbiter bands, and a tiny breathing iris. The outer phase steps
 * in 30° clunks; the inner ring counter-rotates continuously; orbiters are the
 * only smooth, opposed motion. Restrained, 6-fold, precise.
 */
vec3 victorHome(float lambda, float seed, float t) {
  float comp = victorComponent(seed);
  float phase = victorDialPhase(t);
  float rJitter = (labHash11(seed * 27.1 + 4.7) - 0.5) * 0.012;
  float aJitter = (labHash11(seed * 19.3 + 8.1) - 0.5) * 0.03;

  if (comp < 0.5) {
    float radius = 0.5 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda + phase + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.18);
  }

  if (comp < 1.5) {
    float radius = 0.24 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda - 0.5 * VICTOR_STEP_RATE * t + 0.6 + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, -0.15);
  }

  if (comp < 2.5) {
    float spoke = floor(labHash11(seed * 31.7 + 6.3) * 6.0);
    float theta = spoke * (LAB_TAU / 6.0) + phase + aJitter * 0.12;
    float radius = mix(0.24, 0.5, lambda) + rJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.0);
  }

  if (comp < 3.5) {
    // Hexagon rim, not six dots: distribute along the six chord edges between
    // the 60° lattice vertices (still rigid with the outer phase).
    float edge = floor(lambda * 6.0);
    float t = fract(lambda * 6.0);
    float a0 = edge * (LAB_TAU / 6.0) + phase;
    float a1 = (edge + 1.0) * (LAB_TAU / 6.0) + phase;
    vec2 v0 = vec2(cos(a0), sin(a0)) * 0.13;
    vec2 v1 = vec2(cos(a1), sin(a1)) * 0.13;
    vec2 p = mix(v0, v1, t);
    p += normalize(p) * rJitter * 0.20;
    return vec3(p, 0.03);
  }

  if (comp < 4.5) {
    float band = labHash11(seed * 37.3 + 9.2);
    float outerBand = band < 0.5 ? 1.0 : 0.0;
    float radius = mix(0.56, 0.37, outerBand) * (1.0 + rJitter);
    float theta = LAB_TAU * lambda
                + mix(-1.0, 1.0, outerBand) * VICTOR_ORBIT_RATE * t
                + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius,
                mix(-0.05, 0.05, outerBand));
  }

  if (comp > 5.5) {
    float radius = 0.44 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda - phase + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.0);
  }

  // Iris — tight gaussian core; the sprite pass breathes its light.
  float gx = labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1) - 1.0;
  float gy = labHash11(seed * 53.3 + 5.9) + labHash11(seed * 61.3 + 7.7) - 1.0;
  return vec3(gx * 0.018, gy * 0.018, 0.06);
}

/**
 * Formation dispatcher. Unknown ids park particles at the clamp ceiling;
 * sprites are alpha-discarded via formationVisibility(). Never fabricates
 * geometry for an unimplemented formation.
 */
vec3 formationHome(float lambda, float seed, float filament, float t) {
  if (uFormation == LAB_FORMATION_JIN) {
    return labJinHome(lambda, seed, filament, t);
  }
  if (uFormation == LAB_FORMATION_CLAUDIO) {
    return claudioHome(lambda, seed, t);
  }
  if (uFormation == LAB_FORMATION_DRAGUNOV) {
    return dragunovHome(lambda, seed, t);
  }
  if (uFormation == LAB_FORMATION_VICTOR) {
    return victorHome(lambda, seed, t);
  }
  return vec3(0.0, 1.45, 0.0);
}

/** 1.0 when the active formation is implemented. */
float formationVisibility() {
  return (uFormation == LAB_FORMATION_JIN || uFormation == LAB_FORMATION_CLAUDIO
       || uFormation == LAB_FORMATION_DRAGUNOV || uFormation == LAB_FORMATION_VICTOR)
    ? 1.0
    : 0.0;
}
`;

export const FULLSCREEN_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const ATMOSPHERE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAspect;
uniform vec3 uDeep;
uniform vec3 uFog;
uniform vec3 uGlow;
// R2.5 formation atmosphere interface. Jin (0), Claudio (1), Dragunov (2) and
// Victor (3) are implemented; mode 4 (Lars) is reserved and intentionally
// renders the neutral backplate.
uniform int uAtmosMode;
uniform vec2 uAtmosAnchor;
uniform float uAtmosBand;
uniform float uAtmosPulse;

out vec4 outColor;

${NOISE_GLSL}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

  vec3 color = mix(uDeep * 0.36, uFog * 0.22, smoothstep(0.05, 0.95, vUv.y));
  if (uAtmosMode == 0) {
    float column = exp(-pow(p.x / 0.32, 2.0));
    float band = smoothstep(-1.05, -0.55, p.y) * (1.0 - smoothstep(0.45, 1.10, p.y));
    color += uGlow * 0.16 * column * band;

    float base = exp(-dot(p - vec2(0.0, -0.70), p - vec2(0.0, -0.70)) * 4.5);
    color += uGlow * 0.13 * base;

    float core = exp(-dot(p, p) * 2.4);
    color += uGlow * 0.055 * core;

    float haze = labFbm2(vec2(p.x * 1.7, p.y * 1.1 - uTime * 0.035));
    color += uGlow * 0.065 * haze * band * column;
  } else if (uAtmosMode == 1) {
    // Claudio â€” Radiant Orbit: near-black indigo void, tight star glow, faint horizon warmth.
    float r2 = dot(p, p);
    float starCore = exp(-r2 * 3.4) * 0.115;
    float halo = exp(-r2 * 1.7) * 0.055;
    float cross = (exp(-pow(p.x * 11.0, 2.0)) + exp(-pow(p.y * 8.0, 2.0))) * 0.016;
    float haze = labFbm2(vec2(p.x * 1.6, p.y * 0.9 - uTime * 0.018))
               * exp(-r2 * 1.0) * 0.025;
    color = mix(uDeep * 0.24, uFog * 0.115, smoothstep(0.05, 0.95, vUv.y));
    color += uGlow * (starCore + halo + cross + haze);
  } else if (uAtmosMode == 2) {
    // Dragunov — Frost Curtain: steel-cold slit at the base, vertical streak haze, no bloom.
    float slit = exp(-pow((p.y + 0.72) * 4.4, 2.0)) * exp(-pow(p.x * 1.35, 2.0)) * 0.30;
    float haze = labFbm2(vec2(p.x * 9.0, p.y * 0.9 - uTime * 0.022));
    float streaks = smoothstep(0.55, 0.9, haze) * 0.09;
    float core = exp(-dot(p - vec2(0.0, -0.55), p - vec2(0.0, -0.55)) * 3.2) * 0.12;
    color = mix(uDeep * 0.30, uFog * 0.15, smoothstep(0.05, 0.95, vUv.y));
    color += uGlow * (slit + core + streaks);
  } else if (uAtmosMode == 3) {
    // Victor — Precision Dial: deep plum module lit by one hard upper-left
    // lamp, faint horizontal datum lines, chromatic fringe at the lamp edge.
    vec2 lamp = p - vec2(-0.55, 0.60);
    float lampCore = exp(-dot(lamp, lamp) * 12.0) * 0.34;
    float lampHalo = exp(-dot(lamp, lamp) * 3.2) * 0.10;
    float lr = length(lamp);
    float fringe = smoothstep(0.24, 0.30, lr) * (1.0 - smoothstep(0.30, 0.40, lr)) * 0.020;
    float datum = pow(0.5 + 0.5 * sin(p.y * 52.0), 22.0) * 0.022;
    datum *= 1.0 - smoothstep(0.60, 1.00, abs(p.x));
    color = mix(uDeep * 0.42, uFog * 0.16, smoothstep(0.05, 0.95, vUv.y));
    color += uGlow * (lampCore + lampHalo);
    color += vec3(0.55, 0.12, 0.45) * fringe;
    color += vec3(0.36, 0.30, 0.52) * datum;
  } else {
    // Neutral backplate only. Reserved modes must not exist yet.
  }

  float vignette = smoothstep(1.40, 0.35, length(p * vec2(0.75, 0.92)));
  color *= mix(0.62, 1.0, vignette);

  float grain = labHash21(gl_FragCoord.xy + uTime * 23.0) - 0.5;
  color += grain * 0.006;

  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

export const VELOCITY_FS = `#version 300 es
precision highp float;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform int uSimSize;
uniform float uTime;
uniform float uDt;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uPointerSwirl;
uniform vec2 uPointerVelocity;
uniform float uSpring;
uniform float uDamping;
uniform float uLocalDamping;
uniform float uCurl;
uniform int uOctaves;
uniform float uAmplitude;
uniform float uMaxSpeed;
uniform float uCurlScale;

layout(location = 0) out vec4 outVelocity;

${NOISE_GLSL}
${LAB_FORMATION_GLSL}

vec2 labCurl(vec2 p, float t, int octaves) {
  const float e = 0.055;
  vec2 drift = vec2(t * 0.045, -t * 0.028);
  float a = labFbmOctaves(p + vec2(0.0, e) + drift, octaves);
  float b = labFbmOctaves(p - vec2(0.0, e) + drift, octaves);
  float c = labFbmOctaves(p + vec2(e, 0.0) + drift, octaves);
  float d = labFbmOctaves(p - vec2(e, 0.0) + drift, octaves);
  return vec2(a - b, -(c - d)) / (2.0 * e);
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(uPosition, coord, 0);
  vec4 V = texelFetch(uVelocity, coord, 0);

  float seed = P.w;
  float lambda = V.w;
  int index = coord.x + coord.y * uSimSize;
  float filament = mod(float(index), uFilaments);
  vec3 home = formationHome(lambda, seed, filament, uTime);

  // Victor packs two stiffness classes into the existing seed byte range:
  // the lattice snaps back hard (3.2 / 2.6 of the panel spring), orbiters
  // ride softer (2.2 / 2.6) with normal curl. All other formations multiply
  // by exactly 1.0.
  float springMul = 1.0;
  float curlMul = 1.0;
  if (uFormation == LAB_FORMATION_VICTOR) {
    float victorComp = victorComponent(seed);
    bool orbiter = victorComp > 3.5 && victorComp < 4.5;
    springMul = orbiter ? 0.8461538 : 1.2307692;
    curlMul = orbiter ? 2.5 : 1.0;
  }

  vec3 pos = P.xyz;
  vec3 vel = V.xyz;

  vec2 delta = pos.xy - uPointer;
  float dist2 = dot(delta, delta);
  float radius2 = max(uPointerRadius * uPointerRadius, 1e-4);
  float fall = exp(-dist2 / radius2) * uPointerActive;
  vec2 dir = delta * inversesqrt(max(dist2, 1e-6));
  vec2 tangent = vec2(-dir.y, dir.x);
  vec2 pointerForce = (dir * uPointerStrength + tangent * uPointerSwirl) * fall;
  pointerForce += uPointerVelocity * fall * 0.45;

  vec2 curl = labCurl(pos.xy * 0.62, uTime, uOctaves) * uCurl * 0.115 * uCurlScale * curlMul;
  vec2 wind = vec2(0.0, 0.03);
  vec3 springForce = (home - pos) * uSpring * springMul;
  vec3 force = springForce + vec3((pointerForce + curl + wind) * uAmplitude, 0.0);

  vel += force * uDt;
  float damping = uDamping + uLocalDamping * fall;
  vel *= exp(-damping * uDt);

  float speed = length(vel);
  if (speed > uMaxSpeed) {
    vel *= uMaxSpeed / max(speed, 1e-6);
  }

  outVelocity = vec4(vel, lambda);
}
`;

export const POSITION_FS = `#version 300 es
precision highp float;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDt;

layout(location = 0) out vec4 outPosition;

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(uPosition, coord, 0);
  vec4 V = texelFetch(uVelocity, coord, 0);

  vec3 pos = P.xyz + V.xyz * uDt;
  pos.x = clamp(pos.x, -2.0, 2.0);
  pos.y = clamp(pos.y, -1.45, 1.45);
  pos.z = clamp(pos.z, -0.45, 0.45);

  outPosition = vec4(pos, P.w);
}
`;

export const PARTICLE_FS = `#version 300 es
precision highp float;

in vec2 vQuad;
in vec3 vColor;
in float vAlpha;
in float vHard;
in float vGlyph;

out vec4 outColor;

void main() {
  float r2 = dot(vQuad, vQuad);
  if (vGlyph > 0.5) {
    // Rotated-square (diamond) contour for Victor's lattice glyphs.
    float d = abs(vQuad.x) + abs(vQuad.y);
    if (d > 1.0) {
      discard;
    }
    r2 = d * d;
  } else if (r2 > 1.0) {
    discard;
  }

  float soft = exp(-r2 * (vGlyph > 0.5 ? 2.6 : 3.6));
  float core = exp(-r2 * (vGlyph > 0.5 ? 12.0 : 17.0));
  vec3 coreTint = vGlyph > 0.5 ? vec3(0.68, 0.94, 1.0) : vec3(1.0, 0.91, 0.76);
  vec3 color = vColor + coreTint * core * (0.35 + 1.05 * vHard);

  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  float brightnessClip = 1.0 - smoothstep(0.78, 1.0, luminance) * 0.55;

  outColor = vec4(color, soft * vAlpha * brightnessClip);
}
`;

export const PARTICLE_GPGPU_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform int uSimSize;
uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uDpr;
uniform float uSize;
uniform float uStageScale;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uFog;
uniform float uStretchBase;
uniform float uStretchSpeed;

out vec2 vQuad;
out vec3 vColor;
out float vAlpha;
out float vHard;
out float vGlyph;

${NOISE_GLSL}
${LAB_FORMATION_GLSL}

void main() {
  int index = gl_InstanceID;
  ivec2 coord = ivec2(index % uSimSize, index / uSimSize);
  vec4 P = texelFetch(uPosition, coord, 0);
  vec4 V = texelFetch(uVelocity, coord, 0);

  vec3 pos = P.xyz;
  vec2 vel = V.xy;
  float seed = P.w;
  float lambda = V.w;
  float alphaFloor = uFormation == LAB_FORMATION_JIN
    ? 0.22 + 0.32 * labHash11(seed * 11.0 + 2.0)
    : 0.36 + 0.13 * labHash11(seed * 11.0 + 2.0);
  float spark;
  float comp = -1.0;
  float gain = 1.0;
  float compAlpha = 1.0;
  if (uFormation == LAB_FORMATION_JIN) {
    spark = step(0.88, seed);
  } else if (uFormation == LAB_FORMATION_CLAUDIO) {
    comp = claudioComponent(seed);
    spark = (comp < 0.5 || labHash11(seed * 91.7 + 3.1) > 0.94) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 2.0; compAlpha = 2.4; }
    else if (comp < 1.5) { gain = 1.35; compAlpha = 2.1; }
    else if (comp < 2.5) { gain = 1.25; compAlpha = 1.9; }
    else if (comp < 3.5) { gain = 1.1; compAlpha = 1.4; }
    else if (comp < 4.5) { gain = 0.85; compAlpha = 1.0; }
    else { gain = 0.95; compAlpha = 1.4; }
  } else if (uFormation == LAB_FORMATION_DRAGUNOV) {
    comp = uFormationDetail == 0 ? 1.0 : dragunovSheetOf(seed);
    spark = step(0.94, labHash11(seed * 91.7 + 3.1));
    if (comp < 0.5) { gain = 1.10; compAlpha = 0.95; }
    else if (comp < 1.5) { gain = 1.30; compAlpha = 1.25; }
    else { gain = 1.45; compAlpha = 1.55; }
    // Controlled, localized dissolution — fade in at the crown, fade out at the
    // base; the respawn wrap is then invisible to both eye and spring.
    float dFallRate = 0.16 + 0.08 * labHash11(seed * 47.3 + 11.1);
    float dPhase = labHash11(seed * 23.7 + 9.4);
    float dU = fract(lambda + dPhase + uTime * dFallRate * 0.5);
    float spawnFade = smoothstep(0.0, 0.14, dU);
    float dissolve = 1.0 - smoothstep(0.82, 1.0, dU);
    compAlpha *= spawnFade * dissolve;
    gain *= 0.82 + 0.35 * dissolve;
  } else {
    // Victor — mechanical lattice. The outer rim flares on each clunk; the
    // inner ring stays dim so the luminance ladder reads rim-over-core at
    // rest and flares further at the step. The iris breathes slowly.
    comp = victorComponent(seed);
    spark = (comp > 4.5 && comp < 5.5) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 1.28; compAlpha = 1.32; }
    else if (comp < 1.5) { gain = 0.96; compAlpha = 1.12; }
    else if (comp < 2.5) { gain = 1.05; compAlpha = 1.10; }
    else if (comp < 3.5) { gain = 1.22; compAlpha = 1.24; }
    else if (comp < 4.5) { gain = 0.92; compAlpha = 0.98; }
    else if (comp < 5.5) { gain = 2.10; compAlpha = 2.25; }
    else { gain = 0.58; compAlpha = 0.62; }
    if (comp < 0.5) {
      float clunk = victorClunkEnvelope(uTime);
      gain *= 1.0 + 0.55 * clunk;
      compAlpha *= 1.0 + 0.35 * clunk;
    }
    if (comp > 4.5 && comp < 5.5) {
      float breath = 0.5 + 0.5 * sin(uTime * 0.9 + seed * 17.0);
      gain *= 0.85 + 0.35 * breath;
      compAlpha *= 0.90 + 0.20 * breath;
    }
  }
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  // Crystal pulse — a single column fires a bright front down its length
  // on a slow cadence. Composed before sprite sizing and shading.
  if (uFormation == LAB_FORMATION_DRAGUNOV && uFormationDetail != 0) {
    float period = uFormationDetail == 2 ? 1.3 : 1.8;
    float n = floor(uTime / period);
    float local = fract(uTime / period);
    float pulsePhase = local * local * (3.0 - 2.0 * local);
    float pulseY = mix(0.98, -1.08, pulsePhase);
    float targetSheet = mod(n, 3.0);
    if (abs(comp - targetSheet) < 0.5) {
      float cols = dragunovColsFor(comp);
      float targetCol = floor(mod(n * 3.71 + 1.3, cols));
      if (abs(dragunovColumnIndex(seed, comp) - targetCol) < 0.5) {
        float pulse = exp(-pow((pos.y - pulseY) * 5.0, 2.0));
        gain *= 1.0 + pulse * 1.5;
        compAlpha *= 1.0 + pulse * 1.1;
        if (pulse > 0.25) spark = 1.0;
      }
    }
  }

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 dir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float stretch = uStretchBase + min(speed, 2.5) * uStretchSpeed + spark * 0.55;
  float sizeScale = uFormation == LAB_FORMATION_JIN
    ? 1.0
    : (uFormation == LAB_FORMATION_CLAUDIO
        ? claudioSizeScale(seed)
        : (uFormation == LAB_FORMATION_DRAGUNOV
            ? dragunovSizeScale(seed)
            : victorSizeScale(seed)));
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18) * sizeScale;

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (dir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  vGlyph = uFormation == LAB_FORMATION_VICTOR ? 1.0 : 0.0;
  vec3 color;
  if (uFormation == LAB_FORMATION_JIN) {
    float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
    color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  } else if (uFormation == LAB_FORMATION_CLAUDIO) {
    if (comp < 0.5) color = mix(uTintB, vec3(1.0), 0.32);
    else if (comp < 1.5) color = mix(uTintA, uTintB, 0.35);
    else if (comp < 2.5) color = uTintA;
    else if (comp < 3.5) color = mix(uTintA, uTintB, 0.65);
    else if (comp < 4.5) color = mix(uTintB, uFog, 0.30);
    else color = mix(uTintA, uTintB, 0.25);
  } else if (uFormation == LAB_FORMATION_DRAGUNOV) {
    // Dragunov — fog-drenched far sheet, steel mid, frost-tipped near.
    if (spark > 0.5) color = mix(uTintB, vec3(1.0), 0.30);
    else if (comp < 0.5) color = mix(uTintA, uFog, 0.55);
    else if (comp < 1.5) color = uTintA;
    else color = mix(uTintA, uTintB, 0.32);
  } else {
    // Victor — violet rim against a cyan core; spokes split the two.
    if (comp < 0.5) color = uTintA;
    else if (comp < 1.5) color = uTintB;
    else if (comp < 2.5) color = mix(uTintA, uTintB, 0.55);
    else if (comp < 3.5) color = mix(uTintB, vec3(1.0), 0.15);
    else if (comp < 4.5) color = mix(uTintA, uTintB, 0.25);
    else if (comp < 5.5) color = mix(uTintB, vec3(1.0), 0.55);
    else color = mix(uTintA, uTintB, 0.40);
  }
  color = mix(color, uFog, (1.0 - depth) * 0.34);
  vColor = color * (0.90 + 0.52 * depth) * gain;
  vAlpha = alphaFloor
         * (0.60 + 0.44 * depth)
         * (0.78 + 0.50 * spark)
         * compAlpha
         * formationVisibility();
  vHard = spark;
}
`;

export const PARTICLE_ANALYTIC_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

uniform int uCount;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uPointerSwirl;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uDpr;
uniform float uSize;
uniform float uStageScale;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uFog;
uniform float uStretchBase;
uniform float uStretchSpeed;

out vec2 vQuad;
out vec3 vColor;
out float vAlpha;
out float vHard;
out float vGlyph;

${NOISE_GLSL}
${LAB_FORMATION_GLSL}

void main() {
  float fi = float(gl_InstanceID);
  float streams = uFormation == LAB_FORMATION_JIN ? uFilaments : 1.0;
  float filament = mod(fi, streams);
  float rows = max(1.0, ceil(float(uCount) / streams));
  float edge = mod(fi, streams);
  float stagger = 0.5 * mod(edge, 2.0);
  float lambda = formationLambda((floor(fi / streams) + 0.5 + stagger) / rows);
  float seed = labHash11(fi * 1.37 + 4.11);

  vec3 home = formationHome(lambda, seed, filament, uTime);
  vec3 previous = formationHome(lambda, seed, filament, uTime - 0.045);
  vec3 motion = (home - previous) / 0.045;

  vec2 delta = home.xy - uPointer;
  float dist2 = dot(delta, delta);
  float fall = exp(-dist2 / max(uPointerRadius * uPointerRadius, 1e-4)) * uPointerActive;
  vec2 dir = delta * inversesqrt(max(dist2, 1e-6));
  vec2 displaced = home.xy
                 + (dir * uPointerStrength + vec2(-dir.y, dir.x) * uPointerSwirl)
                 * fall * 0.035;
  vec3 pos = vec3(displaced, home.z);
  vec2 vel = motion.xy;
  float alphaFloor = uFormation == LAB_FORMATION_JIN
    ? 0.22 + 0.32 * labHash11(seed * 11.0 + 2.0)
    : 0.36 + 0.13 * labHash11(seed * 11.0 + 2.0);

  float spark;
  float comp = -1.0;
  float gain = 1.0;
  float compAlpha = 1.0;
  if (uFormation == LAB_FORMATION_JIN) {
    spark = step(0.88, seed);
  } else if (uFormation == LAB_FORMATION_CLAUDIO) {
    comp = claudioComponent(seed);
    spark = (comp < 0.5 || labHash11(seed * 91.7 + 3.1) > 0.94) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 2.0; compAlpha = 2.4; }
    else if (comp < 1.5) { gain = 1.35; compAlpha = 2.1; }
    else if (comp < 2.5) { gain = 1.25; compAlpha = 1.9; }
    else if (comp < 3.5) { gain = 1.1; compAlpha = 1.4; }
    else if (comp < 4.5) { gain = 0.85; compAlpha = 1.0; }
    else { gain = 0.95; compAlpha = 1.4; }
  } else if (uFormation == LAB_FORMATION_DRAGUNOV) {
    comp = uFormationDetail == 0 ? 1.0 : dragunovSheetOf(seed);
    spark = step(0.94, labHash11(seed * 91.7 + 3.1));
    if (comp < 0.5) { gain = 1.10; compAlpha = 0.95; }
    else if (comp < 1.5) { gain = 1.30; compAlpha = 1.25; }
    else { gain = 1.45; compAlpha = 1.55; }
    // Controlled, localized dissolution — fade in at the crown, fade out at the
    // base; the respawn wrap is then invisible to both eye and spring.
    float dFallRate = 0.16 + 0.08 * labHash11(seed * 47.3 + 11.1);
    float dPhase = labHash11(seed * 23.7 + 9.4);
    float dU = fract(lambda + dPhase + uTime * dFallRate * 0.5);
    float spawnFade = smoothstep(0.0, 0.14, dU);
    float dissolve = 1.0 - smoothstep(0.82, 1.0, dU);
    compAlpha *= spawnFade * dissolve;
    gain *= 0.82 + 0.35 * dissolve;
  } else {
    // Victor — mechanical lattice. The outer rim flares on each clunk; the
    // inner ring stays dim so the luminance ladder reads rim-over-core at
    // rest and flares further at the step. The iris breathes slowly.
    comp = victorComponent(seed);
    spark = (comp > 4.5 && comp < 5.5) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 1.28; compAlpha = 1.32; }
    else if (comp < 1.5) { gain = 0.96; compAlpha = 1.12; }
    else if (comp < 2.5) { gain = 1.05; compAlpha = 1.10; }
    else if (comp < 3.5) { gain = 1.22; compAlpha = 1.24; }
    else if (comp < 4.5) { gain = 0.92; compAlpha = 0.98; }
    else if (comp < 5.5) { gain = 2.10; compAlpha = 2.25; }
    else { gain = 0.58; compAlpha = 0.62; }
    if (comp < 0.5) {
      float clunk = victorClunkEnvelope(uTime);
      gain *= 1.0 + 0.55 * clunk;
      compAlpha *= 1.0 + 0.35 * clunk;
    }
    if (comp > 4.5 && comp < 5.5) {
      float breath = 0.5 + 0.5 * sin(uTime * 0.9 + seed * 17.0);
      gain *= 0.85 + 0.35 * breath;
      compAlpha *= 0.90 + 0.20 * breath;
    }
  }
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  // Crystal pulse — a single column fires a bright front down its length
  // on a slow cadence. Composed before sprite sizing and shading.
  if (uFormation == LAB_FORMATION_DRAGUNOV && uFormationDetail != 0) {
    float period = uFormationDetail == 2 ? 1.3 : 1.8;
    float n = floor(uTime / period);
    float local = fract(uTime / period);
    float pulsePhase = local * local * (3.0 - 2.0 * local);
    float pulseY = mix(0.98, -1.08, pulsePhase);
    float targetSheet = mod(n, 3.0);
    if (abs(comp - targetSheet) < 0.5) {
      float cols = dragunovColsFor(comp);
      float targetCol = floor(mod(n * 3.71 + 1.3, cols));
      if (abs(dragunovColumnIndex(seed, comp) - targetCol) < 0.5) {
        float pulse = exp(-pow((pos.y - pulseY) * 5.0, 2.0));
        gain *= 1.0 + pulse * 1.5;
        compAlpha *= 1.0 + pulse * 1.1;
        if (pulse > 0.25) spark = 1.0;
      }
    }
  }

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 screenDir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-screenDir.y, screenDir.x);
  float stretch = uStretchBase + min(speed, 2.5) * uStretchSpeed + spark * 0.55;
  float sizeScale = uFormation == LAB_FORMATION_JIN
    ? 1.0
    : (uFormation == LAB_FORMATION_CLAUDIO
        ? claudioSizeScale(seed)
        : (uFormation == LAB_FORMATION_DRAGUNOV
            ? dragunovSizeScale(seed)
            : victorSizeScale(seed)));
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18) * sizeScale;

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (screenDir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  vGlyph = uFormation == LAB_FORMATION_VICTOR ? 1.0 : 0.0;
  vec3 color;
  if (uFormation == LAB_FORMATION_JIN) {
    float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
    color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  } else if (uFormation == LAB_FORMATION_CLAUDIO) {
    if (comp < 0.5) color = mix(uTintB, vec3(1.0), 0.32);
    else if (comp < 1.5) color = mix(uTintA, uTintB, 0.35);
    else if (comp < 2.5) color = uTintA;
    else if (comp < 3.5) color = mix(uTintA, uTintB, 0.65);
    else if (comp < 4.5) color = mix(uTintB, uFog, 0.30);
    else color = mix(uTintA, uTintB, 0.25);
  } else if (uFormation == LAB_FORMATION_DRAGUNOV) {
    // Dragunov — fog-drenched far sheet, steel mid, frost-tipped near.
    if (spark > 0.5) color = mix(uTintB, vec3(1.0), 0.30);
    else if (comp < 0.5) color = mix(uTintA, uFog, 0.55);
    else if (comp < 1.5) color = uTintA;
    else color = mix(uTintA, uTintB, 0.32);
  } else {
    // Victor — violet rim against a cyan core; spokes split the two.
    if (comp < 0.5) color = uTintA;
    else if (comp < 1.5) color = uTintB;
    else if (comp < 2.5) color = mix(uTintA, uTintB, 0.55);
    else if (comp < 3.5) color = mix(uTintB, vec3(1.0), 0.15);
    else if (comp < 4.5) color = mix(uTintA, uTintB, 0.25);
    else if (comp < 5.5) color = mix(uTintB, vec3(1.0), 0.55);
    else color = mix(uTintA, uTintB, 0.40);
  }
  color = mix(color, uFog, (1.0 - depth) * 0.34);
  vColor = color * (0.90 + 0.52 * depth) * gain;
  vAlpha = alphaFloor
         * (0.60 + 0.44 * depth)
         * (0.78 + 0.50 * spark)
         * compAlpha
         * formationVisibility();
  vHard = spark;
}
`;
