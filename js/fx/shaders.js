/**
 * SLEDGE — GLSL ES 3.0 shader sources (Phase 5.2)
 * Atmosphere pass only. No particles, no wipe distortion, no grain,
 * no vignette — CSS owns grain/vignette exclusively.
 * WebGL-unavailable or compile/link failure ⇒ Tier 0 (CSS), never a crash.
 */

export const atmosphereVertexSource = /* glsl */ `#version 300 es
    void main() {
      // Fullscreen triangle from gl_VertexID — no geometry buffers needed.
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }
`;

export const atmosphereFragmentSource = /* glsl */ `#version 300 es
    precision highp float;

    uniform float uTime;
    uniform vec2  uResolution;   // canvas backing-store pixels
    uniform vec2  uPointer;      // normalized [0..1] — inert until P5.4
    uniform float uWipe;         // reserved — inert until P5.4 (1.0 = no wipe)
    uniform vec3  uDeep;         // deep haze base
    uniform vec3  uFog;          // mid haze / fog band
    uniform vec3  uGlow;         // crimson glow (floor / pillar key)
    uniform vec3  uVein;         // energy-vein hot color
    uniform int   uOctaves;      // FBM octaves (quality tier)

    out vec4 outColor;

    /* ---------- deterministic noise ---------- */
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.55;
      for (int i = 0; i < 6; i++) {
        if (i >= uOctaves) { break; }
        value += amplitude * vnoise(p);
        p = p * 2.03 + vec2(17.31, 9.13);
        amplitude *= 0.52;
      }
      return value;
    }

    void main() {
      // Centered coords, aspect-correct (y in [-1, 1]).
      vec2 p = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
      float t = uTime * 0.055;

      /* ---- domain warp (two low-freq samples are enough) ---- */
      vec2 warp;
      warp.x = fbm(p * 1.6 + vec2(t, -t * 0.6) + 1.7);
      warp.y = fbm(p * 1.6 + vec2(-t * 0.8 + 5.2, t + 3.1) + 4.3);
      warp = (warp - 0.5) * 1.35;

      /* ---- main molten haze field, slowly rising ---- */
      float haze = fbm(p * 1.35 + warp + vec2(0.0, -t * 1.7));

      /* ---- energy veins: brighter filaments advected upward ---- */
      float veins = fbm(p * 2.55 + warp * 1.8 + vec2(t * 0.5, -t * 2.5));
      veins = smoothstep(0.52, 0.76, veins);
      veins *= smoothstep(1.15, 0.25, abs(p.x));   // concentrated near the pillar column
      veins *= smoothstep(-0.15, 0.55, p.y * -1.0 + 1.0); // fade near very top & bottom edges

      /* ---- compose: near-black base → fog → vein heat ---- */
      vec3 col = uDeep;
      col = mix(col, uFog, smoothstep(0.12, 0.78, haze) * 0.9);
      col = mix(col, uGlow * 0.55, smoothstep(0.55, 0.95, haze) * 0.6);
      col = mix(col, uVein, clamp(veins * 0.8, 0.0, 1.0));

      /* ---- horizon floor glow (bottom third) ---- */
      float floorMask = smoothstep(0.25, -0.95, p.y);
      float floorPulse = 0.82 + 0.18 * sin(uTime * 0.7 + haze * 3.0);
      col = mix(col, uGlow * 0.9, floorMask * floorMask * 0.6 * floorPulse);

      /* ---- atmospheric energy pillar (right-of-center column) ---- */
      float pillar = exp(-pow((p.x - 0.62) * 4.3, 2.0));
      float pillarCore = exp(-pow((p.x - 0.62) * 11.0, 2.0));
      float pillarPulse = 0.72 + 0.28 * sin(uTime * 0.85);
      float heightFade = smoothstep(1.15, -0.35, p.y);
      col = mix(col, uGlow * 0.95, pillar * heightFade * 0.5 * pillarPulse);
      col = mix(col, uVein * 0.75, pillarCore * heightFade * 0.32 * pillarPulse);

      /* ---- gentle top key (light from above, biased left) ---- */
      float topKey = smoothstep(0.95, -0.35, p.y) * smoothstep(0.35, -1.1, p.x);
      col = mix(col, uGlow * 0.45, topKey * 0.22);

      /* ---- subtle depth vignette baked into atmosphere (very soft) ----
         CSS still owns the film vignette; this only seats the haze. */
      float edge = length(p * vec2(0.72, 1.0));
      col *= 1.0 - smoothstep(0.95, 1.75, edge) * 0.35;

      outColor = vec4(col, 1.0);
    }
`;
