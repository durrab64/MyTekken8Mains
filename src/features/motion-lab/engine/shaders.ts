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
 * R2.5-0 formation interface. Only LAB_FORMATION_JIN is implemented. Other
 * ids never reach this shader (the registry/UI/engine reject them first);
 * the sentinel branch exists so an unsupported id parks particles at the
 * clamp ceiling with zeroed alpha instead of fabricating geometry.
 * Declares its own shared uniforms (uFormation, uFormationRadius,
 * uFilaments) so every program that includes it links cleanly.
 */
/**
 * R2.5-0 formation interface. Only LAB_FORMATION_JIN is implemented. Other
 * ids never reach this shader (the registry/UI/engine reject them first);
 * the sentinel branch exists so an unsupported id parks particles at the
 * clamp ceiling with zeroed alpha instead of fabricating geometry.
 */
const LAB_FORMATION_GLSL = `
const int LAB_FORMATION_JIN = 0;
uniform int uFormation;
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
 * Formation dispatcher. Unknown ids park particles at the clamp ceiling;
 * sprites are alpha-discarded via formationVisibility(). Never fabricates
 * geometry for an unimplemented formation.
 */
vec3 formationHome(float lambda, float seed, float filament, float t) {
  if (uFormation != LAB_FORMATION_JIN) {
    return vec3(0.0, 1.45, 0.0);
  }
  return labJinHome(lambda, seed, filament, t);
}

/** 0.0 when the active formation is unsupported; 1.0 for Jin. */
float formationVisibility() {
  return uFormation == LAB_FORMATION_JIN ? 1.0 : 0.0;
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
// 1–4 are reserved and intentionally render the neutral backplate.
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
  }
  // else: neutral backplate only. No reserved mode renders effects yet.

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
  float spark = step(0.88, seed);
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 dir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float stretch = 1.18 + min(speed, 2.5) * 0.5 + spark * 0.55;
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18);

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (dir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
  vec3 color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  color = mix(color, uFog, (1.0 - depth) * 0.34);
  vColor = color * (0.90 + 0.52 * depth);
  vAlpha = (0.22 + 0.32 * labHash11(seed * 11.0 + 2.0))
         * (0.60 + 0.44 * depth)
         * (0.78 + 0.50 * spark);
  vHard = spark;
  vAlpha *= formationVisibility();
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

out vec2 vQuad;
out vec3 vColor;
out float vAlpha;
out float vHard;

${NOISE_GLSL}
${LAB_FORMATION_GLSL}

void main() {
  float fi = float(gl_InstanceID);
  float filament = mod(fi, uFilaments);
  float rows = max(1.0, ceil(float(uCount) / uFilaments));
  float edge = mod(fi, uFilaments);
  float stagger = 0.5 * mod(edge, 2.0);
  float lambda = formationLambda((floor(fi / uFilaments) + 0.5 + stagger) / rows);
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

  float spark = step(0.88, seed);
  float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

  vec2 screenVel = vec2(vel.x / uAspect, vel.y);
  float speed = length(screenVel);
  vec2 screenDir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
  vec2 perp = vec2(-screenDir.y, screenDir.x);
  float stretch = 1.18 + min(speed, 2.5) * 0.5 + spark * 0.55;
  float basePx = mix(1.7, 4.0, labHash11(seed * 91.7 + 3.1)) * uSize * uDpr
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18);

  vec2 clip = vec2(pos.x / uAspect, pos.y) * uStageScale;
  vec2 offset = (screenDir * aCorner.x * stretch + perp * aCorner.y)
              * (2.0 * basePx / uResolution);
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vQuad = aCorner;
  float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
  vec3 color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
  color = mix(color, uFog, (1.0 - depth) * 0.34);
  vColor = color * (0.90 + 0.52 * depth);
  vAlpha = (0.22 + 0.32 * labHash11(seed * 11.0 + 2.0))
         * (0.60 + 0.44 * depth)
         * (0.78 + 0.50 * spark)
         * formationVisibility();
  vHard = spark;
}
`;
