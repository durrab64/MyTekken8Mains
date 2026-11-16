/** SLEDGE - GLSL ES 3.0 (Phase 5.3): one parameterized atmosphere (modes 0-4)
    + one stateless instanced-particle system. CSS owns grain + vignette. */
export const atmosphereVertexSource = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const atmosphereFragmentSource = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uPointer;   // reserved (P5.4)
uniform float uWipe;      // reserved (P5.4)
uniform vec3  uDeep, uFog, uGlow, uVein;
uniform int   uOctaves, uMode;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 6; i++) {
    if (i >= uOctaves) break;
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.31, 9.13);
    a *= 0.52;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  float t = uTime * 0.055;

  vec2 warp;
  warp.x = fbm(p * 1.6 + vec2(t, -t * 0.6) + 1.7);
  warp.y = fbm(p * 1.6 + vec2(-t * 0.8 + 5.2, t + 3.1) + 4.3);
  warp = (warp - 0.5) * 1.35;
  float haze = fbm(p * 1.35 + warp + vec2(0.0, -t * 1.7));
  float veins = fbm(p * 2.55 + warp * 1.8 + vec2(t * 0.5, -t * 2.5));
  veins = smoothstep(0.52, 0.76, veins) * (1.0 - smoothstep(0.25, 1.15, abs(p.x)));

  vec3 col = mix(uDeep, uFog, smoothstep(0.12, 0.78, haze) * 0.9);
  col = mix(col, uGlow * 0.55, smoothstep(0.55, 0.95, haze) * 0.6);
  col = mix(col, uVein, clamp(veins * 0.8, 0.0, 1.0));

  if (uMode == 0) {              // Jin -- ember pillar + horizon floor glow
    float floorMask = 1.0 - smoothstep(-0.95, 0.25, p.y);
    float floorPulse = 0.82 + 0.18 * sin(uTime * 0.7 + haze * 3.0);
    col = mix(col, uGlow * 0.9, floorMask * floorMask * 0.6 * floorPulse);
    float pillar = exp(-pow((p.x - 0.62) * 4.3, 2.0));
    float core = exp(-pow((p.x - 0.62) * 11.0, 2.0));
    float pulse = 0.72 + 0.28 * sin(uTime * 0.85);
    float hf = 1.0 - smoothstep(-0.35, 1.15, p.y);
    col = mix(col, uGlow * 0.95, pillar * hf * 0.5 * pulse);
    col = mix(col, uVein * 0.75, core * hf * 0.32 * pulse);
    float key = (1.0 - smoothstep(-0.35, 0.95, p.y)) * (1.0 - smoothstep(-1.1, 0.35, p.x));
    col = mix(col, uGlow * 0.45, key * 0.22);
  } else if (uMode == 1) {       // Claudio -- celestial god rays
    float rays = pow(max(0.0, 1.0 - abs(p.x + 0.15) * 1.9), 3.5) * (1.0 - smoothstep(-0.4, 1.1, p.y));
    rays *= 0.6 + 0.4 * fbm(p * 3.0 + vec2(0.0, t * 0.4));
    col = mix(col, uGlow, rays * 0.5);
    float band = smoothstep(-0.15, 0.35, p.y) * (1.0 - smoothstep(0.5, 0.9, p.y));
    col = mix(col, uGlow * 0.5, band * 0.22);
  } else if (uMode == 2) {       // Dragunov -- cold low sun
    float sun = exp(-pow((p.y + 0.74) * 6.0, 2.0));
    sun *= exp(-pow((p.x + 0.72) * 2.4, 2.0));
    col = mix(col, uVein, sun * 0.75);
    col = mix(col, uFog * 0.5, (1.0 - smoothstep(-0.9, 0.4, p.y)) * 0.35);
  } else if (uMode == 3) {       // Victor -- overhead light blade
    float blade = exp(-pow((p.y - 0.55 - 0.18 * sin(t * 0.24)) * 7.0, 2.0));
    blade *= exp(-pow(abs(p.x) * 2.1, 2.0));
    col = mix(col, uVein, blade * 0.7);
    float spot = exp(-pow(p.x * 1.5, 2.0)) * (1.0 - smoothstep(-0.2, 0.9, p.y));
    col = mix(col, uGlow, spot * 0.4);
  } else {                       // Lars -- teal stormfront arcs
    float band = smoothstep(0.5, 0.9, p.y);
    float jag = fbm(p * vec2(9.0, 26.0) + vec2(t * 3.2, 0.0));
    float envelope = 0.5 + 0.5 * sin(uTime * 1.7 + floor(t * 2.0));
    float arc = (1.0 - smoothstep(0.46, 0.5, abs(jag - 0.5))) * band * envelope;
    col = mix(col, uVein, arc * 0.8);
    col = mix(col, uGlow * 0.6, band * 0.25);
  }

  float edge = length(p * vec2(0.72, 1.0));
  col *= 1.0 - smoothstep(0.95, 1.75, edge) * 0.35;
  outColor = vec4(col, 1.0);
}
`;

export const particleVertexSource = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime, uSwirl, uSize, uSeed;
uniform vec2 uOrigin, uDir;
uniform vec3 uTintA, uTintB;
out vec3 vTint;
out float vFade;
out vec2 vQuad;
float hash11(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  vec2 corner = vec2(float((0x1A >> gl_VertexID) & 1), float((0x34 >> gl_VertexID) & 1)) - 0.5;
  vQuad = corner;
  float seed = float(gl_InstanceID) * 13.37 + uSeed * 91.7;
  float r1 = hash11(seed + 1.0), r2 = hash11(seed + 2.0), r3 = hash11(seed + 3.0);
  float life = fract(uTime / (9.0 + r3 * 7.0) + r2);
  vec2 pos = uOrigin + vec2((r1 - 0.5) * 0.82, (r2 - 0.5) * 0.2) + uDir * life;
  pos.x += sin(uTime * 0.9 + seed * 6.1 + life * 9.4) * uSwirl * 0.055;
  pos.y += cos(uTime * 0.65 + seed * 3.7 + life * 7.9) * uSwirl * 0.04;
  float size = mix(0.011, 0.03, r3) * uSize * (1.0 - life * 0.55);
  vFade = smoothstep(0.0, 0.14, life) * (1.0 - smoothstep(0.72, 1.0, life));
  vTint = mix(uTintA, uTintB, r3);
  gl_Position = vec4(pos + corner * size * 2.0, 0.0, 1.0);
}
`;

export const particleFragmentSource = /* glsl */ `#version 300 es
precision highp float;
in vec3 vTint;
in float vFade;
in vec2 vQuad;
out vec4 outColor;
void main() {
  float a = smoothstep(0.5, 0.12, length(vQuad)) * vFade;
  outColor = vec4(vTint, a);
}
`;
