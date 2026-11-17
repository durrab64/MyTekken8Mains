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
 * R2.5-1 formation interface: Jin (LAB_FORMATION_JIN) and Claudio
 * (LAB_FORMATION_CLAUDIO) are implemented; every other id is rejected by the
 * registry/UI/engine before it reaches the GPU. The sentinel branch parks
 * unsupported ids at the clamp ceiling with zeroed alpha instead of
 * fabricating geometry. Declares its own shared uniforms so every program
 * that includes it links cleanly.
 */
const LAB_FORMATION_GLSL = `
const int LAB_FORMATION_JIN = 0;
const int LAB_FORMATION_CLAUDIO = 1;
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
  return vec3(0.0, 1.45, 0.0);
}

/** 1.0 when the active formation is implemented. */
float formationVisibility() {
  return (uFormation == LAB_FORMATION_JIN || uFormation == LAB_FORMATION_CLAUDIO)
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
// R2.5-0 interface only. Jin mode (0) is the only implemented mode; modes
// 1â€“4 are reserved and intentionally render the neutral backplate.
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

  vec2 curl = labCurl(pos.xy * 0.62, uTime, uOctaves) * uCurl * 0.115 * uCurlScale;
  vec2 wind = vec2(0.0, 0.03);
  vec3 springForce = (home - pos) * uSpring;
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

out vec4 outColor;

void main() {
  float r2 = dot(vQuad, vQuad);
  if (r2 > 1.0) {
    discard;
  }

  float soft = exp(-r2 * 3.6);
  float core = exp(-r2 * 17.0);
  vec3 color = vColor + vec3(1.0, 0.91, 0.76) * core * (0.35 + 1.05 * vHard);

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
  } else {
    comp = claudioComponent(seed);
    spark = (comp < 0.5 || labHash11(seed * 91.7 + 3.1) > 0.94) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 2.0; compAlpha = 2.4; }
    else if (comp < 1.5) { gain = 1.35; compAlpha = 2.1; }
    else if (comp < 2.5) { gain = 1.25; compAlpha = 1.9; }
    else if (comp < 3.5) { gain = 1.1; compAlpha = 1.4; }
    else if (comp < 4.5) { gain = 0.85; compAlpha = 1.0; }
    else { gain = 0.95; compAlpha = 1.4; }
  }
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 dir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float stretch = uStretchBase + min(speed, 2.5) * uStretchSpeed + spark * 0.55;
  float sizeScale = uFormation == LAB_FORMATION_JIN ? 1.0 : claudioSizeScale(seed);
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18) * sizeScale;

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (dir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  vec3 color;
  if (uFormation == LAB_FORMATION_JIN) {
    float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
    color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  } else if (comp < 0.5) {
    color = mix(uTintB, vec3(1.0), 0.32);
  } else if (comp < 1.5) {
    color = mix(uTintA, uTintB, 0.35);
  } else if (comp < 2.5) {
    color = uTintA;
  } else if (comp < 3.5) {
    color = mix(uTintA, uTintB, 0.65);
  } else if (comp < 4.5) {
    color = mix(uTintB, uFog, 0.30);
  } else {
    color = mix(uTintA, uTintB, 0.25);
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
  } else {
    comp = claudioComponent(seed);
    spark = (comp < 0.5 || labHash11(seed * 91.7 + 3.1) > 0.94) ? 1.0 : 0.0;
    if (comp < 0.5) { gain = 2.0; compAlpha = 2.4; }
    else if (comp < 1.5) { gain = 1.35; compAlpha = 2.1; }
    else if (comp < 2.5) { gain = 1.25; compAlpha = 1.9; }
    else if (comp < 3.5) { gain = 1.1; compAlpha = 1.4; }
    else if (comp < 4.5) { gain = 0.85; compAlpha = 1.0; }
    else { gain = 0.95; compAlpha = 1.4; }
  }
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 screenDir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-screenDir.y, screenDir.x);
  float stretch = uStretchBase + min(speed, 2.5) * uStretchSpeed + spark * 0.55;
  float sizeScale = uFormation == LAB_FORMATION_JIN ? 1.0 : claudioSizeScale(seed);
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18) * sizeScale;

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (screenDir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  vec3 color;
  if (uFormation == LAB_FORMATION_JIN) {
    float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
    color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  } else if (comp < 0.5) {
    color = mix(uTintB, vec3(1.0), 0.32);
  } else if (comp < 1.5) {
    color = mix(uTintA, uTintB, 0.35);
  } else if (comp < 2.5) {
    color = uTintA;
  } else if (comp < 3.5) {
    color = mix(uTintA, uTintB, 0.65);
  } else if (comp < 4.5) {
    color = mix(uTintB, uFog, 0.30);
  } else {
    color = mix(uTintA, uTintB, 0.25);
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
