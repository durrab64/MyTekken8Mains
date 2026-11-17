# R2.2 — Graphics Prototype Brief (research & specification only)

**Milestone:** R2.2 — prototype planning and technical specification
**Project:** SLEDGE — My Tekken 8 Mains
**Status:** This document is research only. No branch, no prototype code, no shader, no dependency, no asset, no commit.
**Repository baseline (verified):** branch `migration/react-typescript`, HEAD `f12e84164da863c16d7d6f86932311ce1234bf01` (`feat: migrate SLEDGE to React and TypeScript`); parent `33bb202038a146406b64eded753e46ea0e397465` (published `origin/main`). Working tree clean except `docs/r2-graphics-technical-design.md` (untracked R2.1 output). No production graphics code exists.

**Confidence legend** (inline tags): **[Repo]** confirmed in the working tree; **[Ext]** externally documented capability/measurement (links in §14); **[Proposed]** design decision for the prototype; **[Assumption]** untested claim, must fail loudly or be labelled in the panel.

---

## 1. Confirmed owner decisions (final for R2.2 planning)

| Area | Decision |
|---|---|
| Rendering | Custom WebGL2 + GLSL ES 3.0 — no new dependencies |
| Dependencies | None for prototype; no Three.js, no GSAP, no post-processing libs |
| Performance targets | Accepted provisionally; validate experimentally on real hardware |
| Formations | All five approved concepts (§7) |
| Cursor interaction | **Heavy, fluid-like** disturbance — the central requirement |
| Character transitions | Existing 380 ms wipe first; **no** 1.0–1.2 s formation morph in prototype |
| Tier1 | Formation-lite **if viable**; else fall back to existing CSS/tint behavior |
| Artwork mask | Existing `?art=on` halo use only; **formation never samples the art texture** |
| Prototype placement | Separate experimental branch `experiment/r2-graphics-lab` (created post-R2.2 approval) |
| GPGPU budget | ~4 MB additional GPU state accepted |
| AXON reference | Inspiration only; no copied branding/assets/visual identity |

These decisions are final and are not reopened here.

---

## 2. Existing renderer constraints (confirmed facts)

**[Repo]** All of the below is in the committed tree (`f12e841`).

### 2.1 Pipeline today

```
frame() → governTier() (avg rAF-delta > 24 ms step down / < 12 ms step up, 900 ms cooldown)
        → wipe 380 ms ease-out-cubic crossfade on env change
        → heroVisible gate (IntersectionObserver on <main>)
        → atmosphere: drawArrays(TRIANGLES, 0, 3)                       [fullscreen fbm, uMode 0–4]
        → particles:  drawArraysInstanced(TRIANGLES, 0, 6, count)        [trig-only, additive]
```

### 2.2 Devices, tiers, caps

Tier1/2/3 particles **450 / 1 100 / 2 200**; `resScale` 0.25 / 0.5 / 0.5; `dprCap` 1.25 / 1.25 / 1.5; `uOctaves` 3 / 4 / 5; `art` 0 / 1 / 1. Tier0 = CSS-only (no context), reduced-motion → Tier0 (`reduced-motion`), `?fx=off|low|high`. Governor reads 90-frame average of rAF deltas.

### 2.3 Resources owned today

One `webgl2` context (`antialias:false, depth:false, stencil:false, alpha:false, powerPreference:'high-performance'`); two programs; one VAO; 1×1 transparent placeholder art texture; 800×941 RGBA8 art texture with mipmaps (`ART`, only when `?art=on` and Jin/all five active + Tier2/3); atmosphere renders straight to canvas — **no FBO, no ping-pong, no external compute**. `EXT_color_buffer_float` is never queried.

### 2.4 Measured baselines (harness, iGPU, DPR 1.2, 1920×1080 CSS / 1152×648 backing, rafshim=1, window occluded)

Jin art-on 2.051/2.344 ms median/p95; Claudio 2.795/3.114; Dragunov 2.047/2.506; Victor 2.325/2.701; Lars 2.261/2.513 (off ≈ same, delta ≤ 0.06 ms). Tier1 450-particle path: medians ≈ 1.0–1.4 ms. All ≤ 3.3 ms p95 — large headroom under the 6.0 ms production target. Context loss → CSS fallback (`context-lost`); restore → full re-init (programs 2→4, draws resume) — proven.

### 2.5 Known gaps the prototype targets

Stateless particles (position is an analytic function of time; no memory); uniform-cloud distribution; one shared soft-radial sprite; no formations; cursor repel is a passive halo, not a fluid exchange; `uSeed` re-rolled on every env change (particles jump); no depth ordering; additive blend only.

### 2.6 Ceilings

No byte ceiling (retired at migration). GPU state soft ceiling ≈ 4 MB added (owner accepted). Bundle discipline matters for a portfolio page — prototype is isolated and does not touch the app bundle.

---

## 3. Prototype architecture

**[Proposed]** Custom WebGL2 + GLSL ES 3.0; **no third-party dependencies**; one new `<canvas>` in the isolated page; one new WebGL2 context; one atmosphere fragment shader (simplified backplate); **two GPGPU compute passes** (velocity, position); one **instanced-quad** sprite pass (no textures, procedural glyph); zero post-processing passes.

### 3.1 Module map (proposal, isolated from production)

```
/motion-lab/
  index.html            # controls, canvas, panel — no nav, no content
  main.js               # boot, resize, DPR, rAF loop, governor callback
  renderer/
    core.js             # context, programs, VAO/FBO/texture management
    atmosphere.js       # simplified fbm backplate (no mode colors; neutral deep/fog, formation-tinted)
    gpgpu.js            # ping-pong FBO/texture creation; velocity & position passes
    formations.js       # parametric formation SDF/target functions F(env, λ)
    particles.js        # instanced quad program, sprite shading, blending
    instrumentation.js  # FPS, frame medians/p95, EXT_disjoint_timer_query_webgl2
  shaders/             # GLSL sources (inlined template literals)
assets: none (only existing PNG references for a section comparison; prototype loads no app art)
```

### 3.2 Rendering sequence per frame

```
1. (input) pointer → world, ptrW smoothing (existing exponential approach, rate ≈ 6/s)
2. GPGPU velocity pass  (64×64×(2 ping-pong) RGBA16F)
3. GPGPU position pass  (64×64×(2 ping-pong) RGBA16F)
4. Atmosphere fullscreen triangle (existing fbm, simplified palette; Jin-default)
5. Particles instanced-quad draw (count = tier)
6. Instrumentation readback (every N frames)
```

Draws per frame: 4 (atmosphere + 2 GPGPU + particles). No depth buffer. No blending on GPGPU passes. Additive blend only on the sprite pass.

### 3.3 State vs. interface separation

**Simulation state (FBO textures, all ephemeral):** position A/B, velocity A/B, optional curl-noise LUT (design: analytic by default; LUT optional). **Interface state (uniform floats/vectors):** `uTime`, `uDt`, `uPointer` (+ strength/radius), `uFormation` (per-env constants), `uMorph` (0→1, disabled in prototype R2.2), `uWipe`, `uAmp`, `uDpr`, `uResolution`. **Rendering state (no React, no app state):** none — the prototype page is standalone.

---

## 4. GPU state and memory calculations

### 4.1 GPGPU texture layout

| Texture | Dimensions | Format | Bytes/texel | Bytes |
|---|---|---|---|---|
| position A | 64 × 64 | RGBA16F | 8 | 32 768 |
| position B | 64 × 64 | RGBA16F | 8 | 32 768 |
| velocity A | 64 × 64 | RGBA16F | 8 | 32 768 |
| velocity B | 64 × 64 | RGBA16F | 8 | 32 768 |
| **GPGPU subtotal** | | | | **131 072 B = 128 KB** |

Slot capacity: 64 × 64 = 4 096 texels ≥ 2 200 particles (Tier3), ≥ 1 100 (Tier2), ≥ 450 (Tier1). Utilization 54 % at Tier3 — fine; better occupancy than 32×32 at 100 %.

Optional curl-noise LUT (`256×256 RG16F`, tileable): + 262 144 B = 256 KB. **Proposed default: analytic curl** (value-noise gradient) ⇒ no LUT, keeps state at 128 KB.

### 4.2 Total additional GPU state (vs. current renderer)

| Item | Bytes |
|---|---|
| position/velocity ping-pong (4 textures) | 131 072 |
| optional curl LUT (off by default) | 0 |
| FBO objects (4, negligible) | ~1 KB |
| formation constants (uniforms, not GPU-resident) | 0 |
| **GPGPU total (no LUT)** | **≈ 128 KB (0.125 MB)** |
| **GPGPU total (with LUT)** | **≈ 384 KB (0.375 MB)** |

Against the ~4 MB owner-approved ceiling: **fits with ≥ 90 % headroom**.

**Does 64×64 fit? Yes.** Even RGBA32F (16 B/texel) ⇒ 256 KB (no LUT) — still ≪ 4 MB.

### 4.3 Unmeasured costs (stated honestly)

Driver-side allocation granularity, alignment to GOP/tile boundaries, mipmap/placement padding, command-list residency, and shader/program cache are **not** represented above and are not knowable from JavaScript. The design treats 4 MB as an order-of-magnitude headroom target, not a strict accounting identity. If the owner requires a hard on-device audit, the prototype's panel will report the queried values (`gl.getParameter(gl.MAX_TEXTURE_SIZE)`, queried texture count) rather than a fake total.

### 4.4 Precision choice

**[Ext]** WebKit notes iOS supports 16-bit floating-point render targets and **does not implement `EXT_float_blend`**; `EXT_color_buffer_float` is available on Safari 15+/Chrome/Firefox/Android.
**[Proposed]** Use **RGBA16F** and **no blending in GPGPU passes**. GPGPU positions are absolute in a ±2.0 working volume ⇒ 16-bit half is sufficient; velocities magnitudes ≪ 1 e3.
**Fallback if `EXT_color_buffer_float` missing:** RGBA8-encoded float encoding (log-encode x,y,z into 8+8+8 bits + shared exponent) ⇒ precision ~4–5 bits/mantissa — usable for Tier1-lite, unusable for Tier3; prototype treats missing extension as "advanced disabled", falls back to analytic Tier1 path (§9).
**[Assumption]** half-float filtering works acceptably on the owner's iGPU; validated on-site.

---

## 5. Simulation design

### 5.1 State representation

Per texel (one particle): `position.xyz` (absolute, normalized to viewport-height units), `seed`/`age` (in `.w` of position for identity; velocity in its own ping-pong). Identity is **deterministic per index** (`hash(i)` seeded once on init; never re-rolled per frame).

### 5.2 Equations (per frame, per particle)

```
// target formation point from SDF/parametric function F():
home = F_env(λ_i, t)               // λ_i ∈ [0,1) assigned at birth; F() per §7
// desired motion:
force = (home − pos) * k_spring     // spring toward formation (recovery)
vel    = vel*(1 − k_damp*dt)        // global viscous damping
vel   += force * dt
vel   += curl(pos, t) * uCurl * dt  // ambient curl noise (wind / turbulence)
vel   += pointerForce(pos) * dt     // §6 — curl tangential + radial push
// integrate
pos   += vel * dt
// hard clamps (anti-explosion):
vel   = clamp(vel, maxSpeed)
```

**Constants (proposed defaults, experimental):** `k_spring = 2.6` (unit²/s, tune 1.5–4.0), `k_damp = 1.6`/s (tune 1.0–2.5), `uCurl = 0.45`, `dt` clamped ≤ 1/30, `maxSpeed = 2.5` world units/s.

### 5.3 Formation targets vs. simulation state

`F_env` is **evaluated in-shader** (analytic); nothing is stored. The formation is re-derived from `λ_i` + time each frame — changing formation means changing `uEnv` + re-seeding `λ` with a staggered mapping (see §8), not resimulating from scratch.

### 5.4 Curl noise

**[Proposed]** Analytic gradient of value noise (3-D) in-shader; or, if too costly on the iGPU, a single `256×256 RG16F` tileable curl LUT (adds 256 KB — still within budget). Decided by on-site measurement; LUT is specified here as an option, not the default.

### 5.5 Four-tap mask / depth cue

The prototype must **not** sample the art texture¹. Depth cueing is achieved with procedural `vDepth = |vel|`-independent: per-particle `λ`-weighted fog mix and size falloff toward screen edges (§8).

> ¹ Confirmed owner decision: artwork halo is art-mask use only. Prototype loads no images.

### 5.6 Hard rules

- Deterministic identity: `λ_i = fract(hash(i * 13.37 + envIndex * 91.7))`.
- No random re-roll on env change; morph via `uMorph = 0 → 1` staggered (§8).
- No simultaneous double simulations; only one position/velocity pair set at a time.
- Formation never samples art texture.

---

## 6. Cursor interaction model (heavy, fluid-like — central requirement)

**[Proposed]** Disturbance is a **gaussian well + tangential curl** point force added to velocity; there is **no global grid solver** (a grid fluid sim would add passes and state — unnecessary for a spring-bound formation). The sensation comes from velocity inertia + spring recovery, not from a stored pressure field.

### 6.1 Pointer → world

```
worldPointer = worldFromScreen(pointer, aspect, dpr)   // match atmosphere UV mapping
d = pos − worldPointer
fall = exp(−|d|² / r²)                                  // gaussian falloff
```

### 6.2 Force model

```
radial  = −normalize(d) * A * fall            // displacement away from cursor
tangent =  perp(normalize(d)) * B * fall      // tangential swirl (fluid-like)
force   = radial + tangent                    // A = radial strength, B = curl
vel    += force * dt                          // accumulate
vel    *= 1.0 − fall * (damp/uRadiusNorm)     // local viscosity inside the well
```

### 6.3 Parameters (experimental ranges; marked on-panel)

| Parameter | Range | Proposed start | Purpose |
|---|---|---|---|
| `uRadius` (interaction radius, viewport-height fraction) | 0.15 – 0.35 | **0.22** (T1 0.30, T2 0.24, T3 0.20) | footprint |
| `A` (radial strength, units/s²) | 2.0 – 6.0 | **4.2** | displacement weight |
| `B` (tangential/curl, units/s²) | 1.0 – 3.5 | **2.1** | swirl |
| `uDampLocal` (viscosity weight, extra damping inside falloff) | 0.5 – 2.0 | **1.2** | fluid vs. spark feel |
| `k_spring` (recovery stiffness) | 1.5 – 4.0 | **2.6** | recovery rate |
| `k_damp` (global damping) | 1.0 – 2.5 | **1.6** | energy bleed |
| Pointer smoothing rate | 3 – 9 /s | **6 /s** | remove raw jitter |
| `uAmp` (global velocity scale) | 0.6 – 1.4 | **1.0** | intensity |

### 6.4 Behavior

- Entry: particles inside `fall > 0.15` get displaced outward + swirl; those on edge get slight angular drag.
- Spread: impulse carries into adjacent particles through the shared velocity field (spring coupling is not particle-to-particle; spread emerges from the common field + exponential falloff — this is the "coherent medium" feel).
- Recovery: once cursor leaves/stalls, spring `k_spring` pulls particles back; damping `k_damp` bleeds energy; formation re-forms within ~300–450 ms (target, to be validated).
- Exit: cursor off-canvas or leaves window: `fall → 0` as `|d| > uRadius*3`; formation settles; no residual force, no permanent drift.
- No explosion: velocity clamped; `spring` dominance as `|d|→uRadius` ensures restoring force wins far from pointer.
- No jitter: pointer smoothing; spring integration semi-implicit (velocity first, then position); fixed `dt` sub-steps if `dt > 1/30` (two half-steps) — prevents spiral divergence on slow frames.

### 6.5 Why not a grid fluid solver

**[Proposed]** A full Jos-Stam grid advection (textures + divergence + pressure + advect passes) would add 4+ render targets and 4+ passes for marginal gain on a formation-bound system (the spring targets dominate the field). If the prototype shows particles not coherently recovering, a minimal "disturbance ring" uniform (expanding gaussian) is the proposed single addition — **not** a grid solver. Flagged as an unresolved technical question (§13).

---

## 7. Five formation definitions (approved concepts, made graphical)

Each formation: parametric equation `F_env(λ, t)` over scalar `λ ∈ [0,1)`; lateral offset from a secondary scalar `μ ∈ [0,1)`; `t = uTime`; output `vec2/vec3` in world space (viewport-height normalized). All have identical archetype sub-structures: **spine filaments + accent sparks** (10 % of particles: high `vSpark`, small, bright white) and a **curl-noise gust term** shared across all five (gives coherence).

### 7.1 Jin — Ember Pillar

- Spine: 6 helical filaments, `y ∈ [-1.18, 1.18]`, radius `r(λ) = R*(0.28 + 0.72*sin(π*(λ+1)/2)^1.35)` (narrow base, wide mid, narrow top), `θ(λ) = λ*TAU*2.5 + t*0.35` (slow ascent), `R = 0.30`.
- Sparks: 12 % of particles leave the helix envelope along outward tangent; short-lived (`age < 0.8 s`), white-hot.
- Motion signature: slow upward ascent + flicker intensity `0.82+0.18*sin(t*7.0+i*2.1)`; shear `pos.x *= 1.0 + 0.35*pos.y`.
- Palette `[Repo]`: glow `[.7,.11,.055] #F25C0D`-ish; vein `[.95,.3,.12] #F24D1F`; tintA `[.95,.34,.1] #F2561A`; tintB `[1,.72,.3] #FFB84D`. (Exact tuples live in `src/graphics/environments.ts`; no new colors invented.)

### 7.2 Claudio — Radiant Orbit

- Spine: 3 tilted rings (radii 0.27, 0.44, 0.63), inclined ±14°, offset along `z`; particles distributed on ring circumferences with vertical jitter; a 4th "crown" arc above at 90° inclination, rim glow.
- Drift: rings rotate at 0.10 / 0.07 / 0.045 rad/s (inner→outer); motes drift `+0.018 /s` upward; subtle twinkle `0.65+0.35*sin(t*2.3+i*1.7)`.
- Palette `[Repo]`: glow `[.5,.68,.88]`; vein `[.95,.83,.48]` (pale gold); tintA `[.38,.62,.92]`; tintB `[.97,.9,.6]`; crown crest `glint = 1.0` at arc endpoints.

### 7.3 Dragunov — Frost Curtain

- Spine: a warped **plane** `z = 0.10*fbm(x*2.1, y*1.6, t*0.3) + 0.03*sin(x*6.2 + t*0.5)` spanning `x ∈ [-1.35, 1.35]`, `y ∈ [-0.55, 0.60]`; sparse density (per-particle in-plane jitter); slow lateral advection `uDir ≈ (0.9, 0.05)`; wind-shear `pos.x += 0.25*pos.y*0.35`.
- Motion signature: measured lateral drift + restrained glint; NO upward pillar; particles fall through `y` faster than they rise (heavy/cold).
- Palette `[Repo]`: glow `[.3,.42,.55]`; vein `[.75,.85,.94]` (frost white); tintA `[.34,.42,.54]`; tintB `[.78,.86,.94]`; horizon band: one elongated aperture displaced per §2.3 mode-2 rules (no new art).

### 7.4 Victor — Precision Dial

- Spine: 6 radial spokes (every 60°, through center `[0.0, 0.05]`) + 2 concentric rings (radii 0.24, 0.50); particles at 24 lattice intersections × 5 particles = 120 primary + 380 decorative orbiters along the same lattice; inner hexagon edge (6 vertices at 60° phases).
- Motion signature: **stepped** rotation — rotation phase quantizes to 30° steps every ~1.1 s with cubic ease ("clunk"); spokes do not orbit; only orbiters move continuously (0.5 rev/12 s); almost no turbulence (`uCurl = 0.18`); dominant single "lamp" source from above-left `[-0.55, 0.60]` (asymmetric highlight).
- Palette `[Repo]`: glow `[.42,.22,.72]` (violet); vein `[.18,.78,.85]` (cyan); tintA `[.48,.25,.82]`; tintB `[.16,.8,.86]`.

### 7.5 Lars — Bolt Filament

- Spine: 1 main arc `P(y)` from `(-0.55, -1.15)` to `(0.62, 1.18)` with lateral fbm offset `mid = 0.38*fbm(y*2.6, t*0.8) + 0.18*sin(y*4.3 + t*3.1)`; 2 secondary branches; particles trace the arc with `λ` along arc length; occasional white-hot "junction flare" every ~2.2 s (`ev` pulse).
- Motion signature: **lateral** energy; drift `(0.42, 0.10)` rightward-upward; streak length ∝ `|vel|`; spark lifetime ≤ 0.6 s; `uCurl = 0.75`; flash intensity `0.5+0.5*sin(t*3.4+floor(t*1.1))` (event-driven).
- Palette `[Repo]`: glow `[.18,.55,.95]` (electric blue); vein `[.95,.8,.28]` (gold); tintA `[.2,.62,.95]`; tintB `[.95,.78,.22]`; CSS `--lars-accent: #38BDF8` (reference, not new).

### 7.6 Common rules across the five

- All particles have identical `vSpark` law (only `uSharp` differs by env in `environments.ts`); glyph shape: Jin/Lars streaks (elongated along velocity); Claudio/Dragunov round; Victor diamond (rotated square).
- Formation size: Jin width 0.34; Claudio ring max 0.63; Dragunov x-extent 2.7; Victor radius 0.52; Lars arc x-extent ~1.2.
- `F` functions share `hash_i` seeding → same identity every time → stable morph.
- All use `uMorph` (formation replacement) via λ re-mapping — see §8.

---

## 8. Rendering and lighting strategy

### 8.1 Point sprites vs instanced quads

**[Ext + Proposed]** `ALIASED_POINT_SIZE_RANGE` is implementation-defined; several mobile GPUs clamp to 1 px–64 px (even 255). Instanced quads sized up to ~64 px are safe everywhere and already in use. **Decision: instanced quads** (same VAO pattern as current particles).

### 8.2 Procedural glyph

No textures. Fragment shader from `vQuad`:

- Round: `exp(-d² * k)` soft disc (today's, `k=9`).
- Streak: anisotropic falloff along `vQuad.x` vs `vQuad.y` (streak direction = velocity direction, passed varying).
- Diamond (Victor): `d = abs(q.x) + abs(q.y); a = exp(-(d-uRadius)² * k)` plus inner core line `abs(vQuad.x)≈uR` for the radial spokes.

All use `discard` outside radius to cut overdraw.

### 8.3 Depth & fog

`vDepth = clamp(|vel|/maxSpeed, 0.0, 1.0)` (speed→"energy") **and** `vDepthFog` from `λ` (Jin: base particles darker (fog-mix to `uFog`), tips white-hot; Claudio: outer ring dimmer; Dragunov: edges fade; Victor: rim-lit; Lars: every 4th particle dimmer). Fog = `mix(col, uFog, fogAmount)` with fog from `λ` and `vDepth` — cheap, adds depth without halos.

### 8.4 Blending/clipping

Additive `SRC_ALPHA, ONE` (unchanged). Brightness clip: `a *= (1.0 - smoothstep(0.72, 1.0, lum))` prevents white blowout when overlapping filaments (Jin especially). No alpha-to-coverage, no MSAA.

### 8.5 Atmosphere backplate

Simplified fbm (2 octaves, same `hash21` family) — deliberately **cheaper** than production atmosphere (since formation is the star here); neutral near-black + slight cyan cast + vignette + CSS grain (unchanged, CSS-level). Jin default (innovation: one env loaded at a time through the selector).

### 8.6 Compositing & legibility

Canvas `z-index: 0`; atmosphere behind text; formation opacity per-env caps `≤ 0.9` (T1 ≤ 0.65); no text rendered through formation — formation anchors to right third for stage pages, full-bleed for the lab page only. **Artwork never occluded by formation in production integration** (prototype tests visual judgement first).

### 8.7 Vignette & grain

CSS `body::before` vignette (unchanged) + CSS `body::after` grain (unchanged) — no new CSS added in prototype; production integration may tune gradients (not in R2.2).

---

## 9. Tier specifications

| Tier | Particles | Simulation | Formation | FBO cost | GPU budget (proposed) |
|---|---|---|---|---|---|
| **Tier3** | **2 200** | GPGPU fused 1 pass (velocity+position) | full detail (Jin/Lars/etc.), full lighting, max filaments | 1 pass | **≤ 5.0 ms** |
| **Tier2** | **1 100** | GPGPU fused, reduced curl (1-octave) | same silhouette, fewer filaments (Jin 4, Victor 1 ring), lighter sparks | 1 pass | **≤ 4.0 ms** |
| **Tier1** | **450** | optional GPGPU **or analytic lerp fallback** | formation-lite: single spine filament per formation (Jin helix scaled to 1 filament; Claudio 1 ring; Dragunov plane sparse; Victor 1 spoke+hex; Lars main arc) | ≤ 1 pass, else analytic | **≤ 3.0 ms** |
| **Tier0** | 0 | none | none | none | CSS-only, `prefers-reduced-motion` / `?fx=off` |

**[Proposed]** Tier2 runs **full** simulation with reduced constants (`uCurl`, `k_spring` unchanged for fidelity); Tier1 **validates** formation-lite; if Tier1 does not hold ≥ 55 fps on the test iGPU (or `EXT_color_buffer_float` absent), Tier1 degrades to the existing trig-analytic drift of the current renderer (tinted, no formation) — explicit, honest fallback, never silent.

**[Assumption]** Tier1 GPGPU at 450 particles on a modern iGPU will hold 60 fps; this is unverified and is Tier1's acceptance test. If it fails → existing fallback. **No claim is made that formation-lite is viable until measured.**

**Selection logic (unchanged philosophy):** coarse pointer → Tier1; `hardwareConcurrency < 4` → Tier1; `?fx=low` → Tier1; `?fx=0`/`?fx=off` → Tier0; otherwise Tier3 (≥ 8 cores) / Tier2 (4–7). Governor identical to current. `?fx=high` pins Tier3.

---

## 10. Instrumentation plan

Probe-based (no external library), page-local. Panel lists, each labeled measured vs target:

| Metric | Source | Notes |
|---|---|---|
| FPS (rAF) | rAF delta ring | smoothed |
| Frame median / p95 | rAF deltas, 90-frame window | CPU pacing, **not GPU** |
| **GPU pass ms** | `EXT_disjoint_timer_query_webgl2` on the particle pass | only if `GPU_DISJOINT_EXT` false and `QUERY_RESULT_AVAILABLE` true; otherwise `null` with reason (e.g., `unsupported`, `disjoint`) |
| Particle count | uniform | per tier |
| Sim resolution | `gl.getParameter(gl.VIEWPORT)` or constant | 64×64 |
| Active tier | label | set by selector or governor |
| Draw calls / frame | pass counters | atmosphere+gpgpu+particles |
| GPGPU allocation | constant string | e.g., `Position 2×32 KB + Velocity 2×32 KB = 128 KB` |
| Feature support | `gl.getExtension('EXT_color_buffer_float')`, `gl.getParameter(gl.MAX_TEXTURE_SIZE)` | exposed in panel (PASS/FAIL) |
| Env name / formation | label | current formation |
| Recovery time | rAF delta from pointer-leave to `vel < 0.05` threshold; printed once per interaction | **proposed metric** |
| Disjoint | `getParameter(GPU_DISJOINT_EXT)` | measurement discarded when true |

Disjoint handling: if `GPU_DISJOINT_EXT` true ⇒ entire sample batch discarded (logged, never shown as GPU ms). Frame-time p95 is presented separately from GPU ms; the panel labels them `"frame (CPU)"` and `"GPU pass (GPU)"` with a caption "two different clocks".

---

## 11. Performance validation plan

**Targets in this plan are provisional; they must be proven on-site before integration sign-off.**

| Test | Conditions | Pass condition (proposed) |
|---|---|---|
| Device matrix | iGPU (owner's AMD Radeon shared), dGPU (if available), mobile tablets, old iPad | Tier1 holds 55+ fps or fallback path wins |
| Viewport 390×844 / 768×1024 / 1440×900 / 2560×1440 | dpr 1.0 / 1.2 / 1.5; `?art=on` irrelevant (no mask in prototype) | target Tier3 ≤ 5.0 ms GPU pass; no layout shift |
| Art-off vs art-on comparison | after integration only | within Tier3 ≤ 6.0 ms existing production target |
| Context loss | `WEBGL_lose_context` ext, lose/restore ×3 | no GPU-state leak; formation re-seeds; page → CSS fallback |
| Reduced motion | `(prefers-reduced-motion: reduce)` | Tier0, no context created |
| Tier selection | `?fx=off/low/high`, coarse pointer detection | Tier0/Tier1/Tier3 correct |
| Sustained load | 5-minute run at 2560×1440 | p95 medians stable (no progressive drift) |
| Cross-char charge | switch Jin→Claudio→Dragunov→Victor→Lars→Jin | no shader recompile stall > 100 ms (programs cached) |

**Measurement protocol:** 9 s capture after 2.5 s warm-up, drop first 120 samples, report median/p95/max; DPR locked per run; viewport locked; harness = `EXT_disjoint_timer_query_webgl2` + rAF deltas; report DPR, browser, GPU (via `WEBGL_debug_renderer_info`), viewport, backing size, tier.

**Deciding gates (M2 prototype acceptance):** Tier3 ≤ 5.0 ms; Tier2 ≤ 4.0 ms; Tier1 either formation-lite ≥ 45 fps or deterministic fallback (no silent degrade); p95 within 20 % of median on iGPU.

---

## 12. Branch and file isolation strategy

**[Proposed]** Branch `experiment/r2-graphics-lab` from `f12e84164da863c16d7d6f86932311ce1234bf01` (the approved local migration commit — **not** `origin/main`). Created **after** owner sign-off of this R2.2 brief — **not** in this milestone.

**Allowed in the branch:**
- `/motion-lab/index.html` + `/motion-lab/main.js` + `/motion-lab/renderer/*` + `/motion-lab/shaders/*`
- `/motion-lab/README.md` (how to run: open static file, or `npx serve .`)
- No changes anywhere else. No `index.html`, `src/`, `public/`, `css/`, `docs/spec.md`, `package.json`.

**Forbidden in the branch:** dependencies (npm/node_modules never enter), character artwork/overlays/text, production navigation, reuse of the React app, moving files around, `vite.config.ts`.

**Serving during development:** static file server (python/http.server or `npx serve`) — prototype must work with `file://` too (no fetch of shaders as separate module files; shaders inline in JS).

**Merge path:** never merged to `main` directly; if accepted, integration is a new milestone (R2.3+).

---

## 13. Risks and unresolved technical questions

| # | Question / risk | Resolution path |
|---|---|---|
| 1 | iOS half-float only: RGBA16F ok; does `EXT_float_blend` absence break anything? | Use no blending in GPGPU passes (design already); verify on iOS 17+ device |
| 2 | iGPU FP16 throughput poor? | measure Tier1 analytic vs GPGPU on owner machine; drop to analytic if slower |
| 3 | 64² texture underutilization vs 32×32 full: shader/texel cost identical; occupancy irrelevant (few hundred particles) — keep 64² for simplicity | resolved by design |
| 4 | Spring system oscillates / rings? | `dt` sub-stepping; clamp |vel|; tune `k_spring`/`k_damp`; on-site |
| 5 | Formation reads as "blob" for Claudio at low counts (450)? | scale down lateral spread at T1; validate |
| 6 | Curl noise cost hurts iGPU? | analytic gradient fallback or 1-octave @ T2; measure |
| 7 | Disturbance doesn't feel "fluid" | add tangential `B` and local viscosity `uDampLocal`; increase viscosity; if still flat, add single expanding disturbance ring (never a grid solver) |
| 8 | Velocity clamp kills recovery? | clamp ≥ 2.0; spring force dominates at range |
| 9 | Prototype scope creep (5 formations before Stage A gate) | Stage A delivers Jin only; Stage C adds rest; gate each stage |
| 10 | Owner wants integration anyway after Stage A? | Integration is R2.3; R2.2 stays isolated |
| 11 | Will rAF shim / occluded window make measurements meaningless? | document `rafshim` shim in measurement protocol; pair with `setQuality` pinning during capture; validate at real display refresh rate when window visible |
| 12 | Prototype page accidentally committed to production bundle? | isolated branch; `git status --ignored` review before merge |
| 13 | `?test=1`-style hooks reopened in production? | prototype has no query params except `?formation=`/`?count=`; not an env-marker |
| 14 | Owner expects newer artwork at "Apex/quality" level? | no new artwork is authorized anywhere in R2.2 |

### 13.1 Owner items still requiring approval before R2.2 implementation

1. **UB validation window:** which hardware/viewport set is canonical for the acceptance gate (owner iGPU only, or also mobile?). If iGPU-only: say so; mobile is validated best-effort.
2. **Stage gating sign-off order:** Jin first (Stage A) or all five at Stage A? (Plan is Jin-only Stage A.)
3. **Branch name** `experiment/r2-graphics-lab` confirmed (or alternative).
4. **Panel language:** expose Tier/target labels in English (current design) or Japanese?
5. **`?formation=` vs button selector:** proposed button panel (primary) + optional query param; confirm acceptable.
6. **Performance acceptance:** is the 5.0 ms Tier3 target (vs 6.0 ms production ceiling) acceptable, or must integration hit 6.0 only?
7. **是否按 Tier1 直接尝试 GPGPU** (formation-lite) 还是先做 Tier2/3 再补 Tier1 — confirm order.
8. **是否把原型收入实验分支后再考虑是否保留**还是**一次性原型用后删除** — retention policy after evaluation.
9. **是否允许 Stage B 的 panel 默认显示 GPU 计时**（否则 panel 只在 devtools 可见）— default visibility of GPU timer (some browsers don't expose; panel must show `n/a` not `0.0 ms`).
10. **Production 集成是否也须保持 `?art=on` 仍是唯一激活 mask 的方式** — confirm art gate stays exactly as-is.

---

## 14. Staged implementation checklist

**Stage A — Jin Ember Pillar (complete before Stage B):**
- [ ] `/motion-lab/` scaffold (`index.html`, `main.js`, renderer modules, no deps)
- [ ] WebGL2 context creation + error path (Tier0 CSS message fallback in panel)
- [ ] GPGPU FBO/texture creation (RGBA16F ping-pong) + `EXT_color_buffer_float` check + analytic-fallback switch
- [ ] Atmosphere backplate (neutral, no fbm octaves>2)
- [ ] Jin `F_jin(λ,t)` — helix spine, 2 filaments + accent sparks
- [ ] Velocity/position compute shaders (spring + damping + analytic curl)
- [ ] Instanced-quad sprite render (round disc fallback; Jin streak shape)
- [ ] Pointer → world mapping; bounded gaussian + tangential force (§6 params)
- [ ] Spring recovery verified: formation re-forms ≤ 500 ms after pointer leaves
- [ ] Depth layering (`vDepth` fog mix) + brightness clip

**Stage B — Instrumentation:**
- [ ] `EXT_disjoint_timer_query_webgl2` GPU pass ms (with disjoint discard)
- [ ] Frame median/p95 (90-frame), FPS smoothed
- [ ] Panel: count, resolution, tier, draw calls, passes, GPGPU allocation (string)
- [ ] Particle-count control (450 / 1 100 / 2 200 buttons) + resolution scale (0.25 / 0.5 / 0.75 / 1.0) + DPR cap
- [ ] Feature support readout (`EXT_color_buffer_float`, `MAX_TEXTURE_SIZE`, renderer string)
- [ ] No dependency added; page works offline from `file://`

**Stage C — Remaining formations:**
- [ ] Claudio Radiant Orbit (3 rings + crown)
- [ ] Dragunov Frost Curtain (warped plane + drift)
- [ ] Victor Precision Dial (spokes/rings, stepped rotation)
- [ ] Lars Bolt Filament (arc + branches + flare)
- [ ] Formation selector (Jin default; Claudio…Lars); `uMorph` field reserved; λ re-seed on switch (no re-sim from zero)

**Stage D — Quality & failure handling:**
- [ ] Tier selector mirrors `?fx=off|low|high` semantics (Tier0 CSS, Tier1/T2/T3)
- [ ] Tier1 formation-lite validation → documented PASS/FAIL on owner iGPU
- [ ] Context-loss handler in prototype (restore → reseed, never crash)
- [ ] Reduced-motion path (panel-only notice, no context)
- [ ] Fallback chain verified: no `EXT_color_buffer_float` → analytic Tier1; no WebGL2 → panel message
- [ ] Final measurement run documented: DPR, browser, GPU string, viewport, tier, median/p95/max

**Per stage:** no file changes outside `/motion-lab/`; no new dependencies; no production app files touched; `git status` reviewed before each stage marker; work stays on `experiment/r2-graphics-lab`; nothing is committed unless owner approves commit-per-stage.

---

## References

- MDN — WebGL2RenderingContext (instancing fundamentals): https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
- MDN — EXT_color_buffer_float (WebGL2 float render targets; iOS caveat via WebKit): https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
- WebKit 247240 — iOS lacks EXT_float_blend; RGBA16F path is the safe target: https://bugs.webkit.org/show_bug.cgi?id=247240
- Can I use — WebGL2 97.29%: https://caniuse.com/webgl2 · EXT_color_buffer_float 97.13% (Baseline widely since 2024-03): https://caniuse.com/wf-ext-color-buffer-float
- GPU Gems Ch. 38 — Fast Fluid Dynamics on the GPU: https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu
- Stam — Stable Fluids: https://www.dgp.toronto.edu/~stam/reality/Research/pdf/GDC03.pdf
- three.js GPUComputationRenderer (ping-pong pattern; not used): https://threejs.org/docs/pages/GPUComputationRenderer.html
- Repository file references (at `f12e841`): `src/graphics/{engine,shaders,particles,environments,fallback}.js|ts`, `src/app/App.tsx`, `docs/spec.md`, `docs/r2-graphics-technical-design.md` (R2.1)

**Document status:** proposed design. Not an implementation commitment. All decisions above marked [Proposed] require owner sign-off before Stage A begins.
