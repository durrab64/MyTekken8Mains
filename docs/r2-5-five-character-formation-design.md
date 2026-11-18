# R2.5 — Five-Character Formation System: Design and Technical Research

**Milestone:** R2.5 — five-character formation system, design and technical research only
**Project:** SLEDGE — My Tekken 8 Mains
**Repository baseline (verified before writing this document):** branch `experiment/r2-graphics-lab`, HEAD `74588ed7ce1ed750c06f34287fe6d08a1140045c` (`feat: refine Jin ember pillar motion lab`), parent `f12e84164da863c16d7d6f86932311ce1234bf01` (`feat: migrate SLEDGE to React and TypeScript`). Working tree clean. All claims tagged **[Repo]** reflect the committed tree at `74588ed`, inspected directly — not prior reports.

**Status:** Research and design only. No formation, shader, UI, renderer, asset, dependency, or production change is authorized or made by this milestone. **[Scope]**

**Confidence legend** (inline tags):
- **[Repo]** — confirmed in the working tree / committed state at `74588ed`.
- **[Repo, measured]** — measured in the R2.4 lab session and recorded there; see §16.1 caveats.
- **[Ext]** — externally documented capability or fact (R2.1/R2.2 references still apply).
- **[Proposed]** — design decision proposed for implementation; requires owner sign-off.
- **[Assumption]** — unverified claim; must be validated before being relied on.
- **[Estimate]** — calculation or extrapolation, not a measurement.
- **[Decision — approved]** — previously approved owner decision (R2.x); not reopened here.

---

## 1. Executive summary

**[Repo, approved]** The isolated Motion Lab at `74588ed` already renders Jin's "Ember Pillar" as a verified, visually approved formation: a DNA-like double helix of warm embers, GPU-simulated ping-pong RGBA16F, cursor-disturbable with spring recovery, at stable performance (Tier 2 medians ≈ 0.41 ms). Tier 2 is the canonical artistic baseline and must not regress.

**[Proposed]** The five-character system generalizes the Jin architecture — one WebGL2 context, one GPGPU ping-pong sim, one instanced-quad sprite pass, one atmosphere pass — from one formation to five, selected per character. Formation identity comes from geometry math + palette + motion language + depth, not from palette swaps. The five approved concepts map cleanly onto the existing pipeline; none requires new render passes, new dependencies, or persistent particle state beyond what Jin uses today.

**[Repo]** Headroom is large: the measured Tier 2 GPU cost (~0.41 ms) is ~10× under the provisional 4 ms budget, and the formation math for the four new formations is comparable to or cheaper than Jin's (Claudio/Victor are pure trigonometric; Dragunov/Lars are fbm-bound but still analytic and once per texel, 64×64).

**[Estimate]** Expected Tier 2 cost order: Jin ≈ measured; Claudio ≈ Jin or lower; Dragunov ≈ Jin ± 10%; Victor < Jin (no fbm in the home function); Lars ≈ Jin + 5–15% (fbm trunk + branch join costs). None is expected to approach 4 ms on the owner's iGPU, but **no performance claim should be made until measured** (§13).

**[Proposed]** Implementation is staged: shared formation infrastructure first, then one formation per stage, with Jin as the regression gate at every stage. Production integration (`src/graphics/*`) is out of scope for R2.5 and is a separate milestone.

**Key owner decisions required** (§14): transition strategy on formation switch, per-formation atmosphere scope, Tier 1 reduced-geometry approval, lab selector design, and the measurement/acceptance protocol.

---

## 2. Existing renderer audit (committed state, `74588ed`)

All items are **[Repo]** unless flagged. File paths relative to repo root.

### 2.1 Repository and isolation model

- Branch `experiment/r2-graphics-lab` carries the isolated SLEDGE Motion Lab. The production renderer (`src/graphics/`, production components, styles, assets, `docs/spec.md`) is untouched by R2.3/R2.4. **[Repo]**
- Isolated entry: `motion-lab/index.html` (+ `motion-lab/harness.html` for measurement), built by `vite.motion-lab.config.ts` to `dist-motion-lab` (gitignored). **[Repo]**
- Lab source: `src/features/motion-lab/` — `MotionLab.tsx`, `main.tsx`, `lab.css`, `types.ts`, `harness.ts`, `engine/{MotionLabEngine.ts, formations.ts, shaders.ts, gl.ts, instrumentation.ts}`. **[Repo]**
- The lab page renders a live instrumentation panel (FPS, CPU frame median/p95, GPU timer readback, tier, counts, allocation, capability flags, pause/reset, render scale). **[Repo]**

### 2.2 Pipeline (per frame)

```
frame → resize check (CSS box vs viewport) → dt clamp (≤ 1/30 s)
      → GPGPU velocity pass   (64×64 RGBA16F FBO, reads P/V A, writes V B)
      → GPGPU position pass   (reads P A + V B, writes P B; clamp ±2.0 / ±1.45 / ±0.45)
      → atmosphere pass       (fullscreen triangle, direct to canvas, uMode fixed to Jin-style ember column)
      → sprite pass           (instanced quads, SRC_ALPHA/ONE additive, no depth)
      → GPGPU A/B swap
```

**Draws per frame: 4** (atmosphere + 2 GPGPU + particles). No depth buffer; additive blending only on the sprite pass; nothing else blurs/composites. **[Repo]**

### 2.3 GPGPU simulation

- 64×64 RGBA16F ping-pong, two slots (position + velocity each own their FBO to avoid feedback-loop attachment). **[Repo]**
- GPGPU allocation: **128 KB** (4 × 64² × 8 B). `EXT_color_buffer_float` queried; float targets are readback-verified before being trusted; on absence/failure the lab falls back to the analytic path (ParticlesFormation-lite). **[Repo]**
- Per texel: `P.w` = stable seed; `V.w` = formation coordinate `lambda`. Identity never re-rolled. **[Repo]**
- Velocity pass: `home = labJinHome(lambda, seed, filament, t)` (analytic formation target re-derived per frame); spring `(home − pos) · uSpring`; exponential damping `uDamping + uLocalDamping · falloff`; bounded gaussian pointer force (`exp(-d²/r²) · (strength·dir + swirl·perp) + pointerVelocity·fall·0.45`); ambient curl (`labCurl` of value-noise fbm, scaled `uCurl · 0.115`); upward wind `0.03`; max-speed clamp 2.5; `dt` clamp ≤ 1/30 s. **[Repo]**
- Jin formation (as committed, R2.4): 2.2 turns; `jinLambda` arc-length warp (`base + 0.05·sin(TAU·base)`) with half-row stagger on odd filaments; paired adjacent filaments into ribbons (Tier 2 = double helix); per-particle radial/angular jitter (±0.10 hash); 12% spark population (`seed ≥ 0.88`) with tight tangent peel; profile `0.30 + 0.70·sin(πλ)^1.5` with 10% lower-middle bulge and 10% crown taper; centred sway `0.055·sin(πλ·1.2 − 0.35)`; z scale 0.58; z depth mapping `2.1d + 0.5`; fog mix 0.34 with depth; sprite size 1.7–4.0 px, baseline tangent stretch 1.18, spark boost; brightness/alpha flatter with depth for separation. **[Repo]**
- Spring/damping: `uSpring 2.6`, `uDamping 1.6` (UI-adjustable within `PARAM_LIMITS`); pointer radius tier-scaled (0.30/0.24/0.20); `uCurl 0.45` (ambient; particle coherence retained since ambient frequency/amplitude were reduced in R2.4). **[Repo]**

### 2.4 Tier configuration

| Tier | Particles | Filaments | Octaves | Pointer radius | GPGPU |
|---|---|---|---|---|---|
| 1 | 450 | 1 | 3 | 0.30 | yes (verified) |
| 2 | **1 100** | 4 | 4 | 0.24 | yes (verified) |
| 3 | 2 200 | 6 | 5 | 0.20 | yes (verified) |

Tier 0 = CSS-only static fallback: no canvas, no WebGL context. `prefers-reduced-motion: reduce` → Tier 0. **[Repo]**

### 2.5 Lifecycle, fallback, and instrumentation

- Context loss → `forgetGlResources` (no deletes), loop stops, panel shows lost; restore → full re-init + `applyTier` + float readback re-verification. Verified end-to-end in the harness (lose/restore; finite readback after restore). **[Repo]**
- `?nofloat` forces the analytic fallback path; `?notimer` hides GPU timing as "unavailable"; `?rafshim` shims rAF for occluded windows; `?test=1` exposes `window.__motionLab` (`getStats`, `getParticleState`, `setTier`, `setResolutionScale`, `reset`, `loseContextForTest`, …). **[Repo]**
- Instrumentation: `FrameMeter` (rAF deltas, median/p95) and `GpuTimer` (`EXT_disjoint_timer_query_webgl2`, one query in flight, disjoint samples discarded, median of last ≤15). GPU timer covers **all** draws (atmosphere + GPGPU + sprites), not just sprites. Panel explicitly labels CPU vs GPU clocks. **[Repo]**
- Pause → 2 draws; render scale 0.25/0.5/1.0; reset re-seeds. **[Repo]**
- Tier 2 GPU medians (R2.4, 1440×900): 0.411–0.420 ms; 768×1024: 0.315–0.322 ms; 390×844: 0.181–0.213 ms. Pointer disturbance: mean displacement 0.0615→0.0993 at 1440 (+62%), 0.0614→0.1266 at 390; recovered ≈ 0.051. **[Repo, measured]** Measurement caveats: ANGLE/D3D11 timer excludes compositing; CPU frame is rAF-pace limited (~17 ms), not GPU; viewports rendered through harness iframe; p95 noisy (1.0–1.28 ms Tier 2). **[Repo, measured]**

### 2.6 Constraints held by the lab (do-not-break list)

Custom WebGL2 + GLSL ES 3.0 only; no dependencies; `docs/spec.md` untouched; no Jin artwork-mask sampling; formation is never a fullscreen pass; sprite pass is the only blended pass; no depth prepass; one context; ping-pong never runs double simulations; float readback verification is mandatory before the GPGPU path is reported usable. **[Repo]**

### 2.7 What the committed lab does *not* yet do

- Only Jin's formation exists. Atmosphere is Jin-specific (ember column + base/core glow). Palette/tints are baked from `JIN_FORMATION`. **[Repo]**
- Formation switching does not exist: no `setFormation`, no cross-fade between silhouettes. **[Repo]**
- The analytic fallback replicates only Jin (`labJinHome`), not the formation system. **[Repo]**
- `?test=1` hooks are lab-only; no production exposure. **[Repo]**
- GPU timer and readback cost is fine for verification, but GPU timing on a busy machine is noisy (see §16). **[Repo]**

---

## 3. Five formation design specifications

Design goals shared by all five (in priority order): (1) an unmistakable silhouette and motion language per character — **geometry and motion carry identity, not tint**; (2) restrained, atmospheric intensity (warm ember reference, never white-out); (3) convincing at rest and under cursor disturbance; (4) shared simulation physics so interaction feel is uniform; (5) formation must survive Tier 1 reduction without identity loss.

Jin is the approved reference and is not redesigned here. **[Decision — approved]**

### 3.1 Jin — Ember Pillar (approved reference; regression baseline)

- **Resting geometry:** 2.2-turn DNA-like double helix; vertical pillar silhouette; wide lower-middle, restrained upper waist, tapered crown; two parallel ribbons; subtle spark halo. **[Repo]**
- **Why it works:** pairing + arc-length spacing + controlled halo gave a deliberate, continuous read at 1 100 particles. **[Repo]**
- **Regression rule:** any shared-architecture change that alters Jin's visual output, GPU medians, or recovery behaviour beyond measurement variance is a regression, regardless of the other four formations. **[Proposed]**

### 3.2 Claudio Serafino — Radiant Orbit

**Concept: celestial clockwork halo — three nested inclined rings + a vertical "crown" halo ring + a small central "star". Elegant circular motion; multiple orbital layers with controlled depth; strong central focal point.**

- **Resting geometry (Tier 2 default):**
  - Ring A (inner): radius 0.27, inclination +14° about the x-axis, 30% of particles.
  - Ring B (mid): radius 0.44, inclination 0°, 40% of particles.
  - Ring C (outer): radius 0.63, inclination −14°, 22% of particles.
  - Crown arc: a vertical ring in the y–z plane, radius 0.52, centred on the focal point, 8% of particles; reads as a halo standing behind the star, never as a sphere (rings stay mutually orthogonal — 3 flat + 1 vertical, no random 3-D cloud).
  - Star core: ~12% of particles pinned to a gaussian ball of radius ≤ 0.045 with high brightness and tiny size; continuous slow twinkle; this is the single anchor the eye lands on.
  - Depth: z from inclination (front/back halves of the rings separate in depth) ± halo offset; far halves fogged more (see 3.6).
- **Motion language:** constant-angular-velocity orbits, inner faster than outer (0.10 / 0.07 / 0.045 rad·s⁻¹) — Kepler-like hierarchy, not "generic spinning sphere"; crown precession ≤ 0.05 rad·s⁻¹ (almost static majesty); motes drift upward 0.018 units·s⁻¹; twinkle 0.65+0.35·sin(t·2.3 + i·1.7) per particle. **[Proposed]**
- **What makes it read as Claudio (not a generic ring):** the vertical halo + restrained upward drift + gold/steel two-tone ring population (outer ring biased pale-gold, inner two rings steel-blue) + a single bright focal star. **[Proposed]**
- **Negative space:** large quiet ring gaps (0.27→0.44→0.63 spacing is deliberately wide); never more than thin filament paths visible. **[Proposed]**
- **Cursor interaction:** identical gaussian disturbance to Jin, but particles are displaced *along* the orbit; because homes sit on ellipses, disturbed particles slide along arcs and re-seat into the ring with visible circular recovery — feels celestial, not snappy. **[Proposed]**
- **Tier 1 lite:** Ring A only + star (drop B/C/crown); same ellipse equations, fewer particles; still reads as "orbit", not "blob". **[Proposed]**
- **Tier 3:** + crown arc and an extra faint orbiter band at 0.56 (10% of particles). **[Proposed]**

### 3.3 Sergei Dragunov — Frost Curtain

**Concept: a dense, imposing curtain of cold vertical streams — layered hanging sheets, restrained downward drift, sharp crystalline accents. Not a snowstorm.**

- **Resting geometry (Tier 2):**
  - Three sheets of "hanging gauze" at z = −0.18 / 0.0 / +0.18 (far → near), each spanning x ∈ [−1.25, +1.25], y ∈ [+0.95, −1.05].
  - Each sheet is organised into ~7 vertical columns/streams (hash-placed x with a strict minimum separation), giving visible structure — a curtain, not a cloud. Per-column gaussian cross-section σ ≈ 0.035.
  - In-plane jitter ±0.03 (small; streams stay legible); sheet warp `z += 0.06·fbm(x·2.1, y·1.6, t·0.3)` shared per sheet.
  - Columns terminate in a subtle bottom dissolution (alpha ramp downward) — "the curtain ends, the cold remains".
- **Motion language:** particles cycle within columns along λ ∈ [0,1) (top → bottom) with per-column fall-speed variance (0.16–0.24 units·s⁻¹); lateral shear 0.05–0.08 (never a diagonal storm); sheet sway 0.02–0.04 slowly; a faint "crystallize" pulse travels down one column every ~1.8 s (single-column glint, not a flash). **[Proposed]**
- **Depth:** far sheet alpha 0.55, mid 0.80, near 1.0 (both via vAlpha scale and fog mix); near sheet slightly larger sprites; fog strongest on far sheet. **[Proposed]**
- **What makes it read as Dragunov:** three depth layers + vertical columns + cold steel/frost palette + gravity-dominant motion + near-silent restraint. **[Proposed]**
- **Negative space:** dark gaps between the ~21 columns (7 × 3) — imposing *because it is structured*, not because of particle count. **[Proposed]**
- **Cursor interaction:** curtain *parts* — radial push x-only bias (repel normalised to screen vertical plane), local viscosity 1.4× Jin (snow piling behind a plough), spring 2.4 (measured, heavy stillness); recovery ~15% slower than Jin, deliberately — reads as mass, not as lag. **[Proposed]**
- **Tier 1 lite:** single sheet (z = 0), 5 columns, ~450 particles in columns only; dissolution and sway retained. **[Proposed]**
- **Tier 3:** third sheet + full crystal pulse + wider span (x ∈ [−1.4, 1.4]). **[Proposed]**

### 3.4 Victor Chevalier — Precision Dial

**Concept: a machine that *snaps* — concentric dial + six spokes + a core iris; quantised outer rotation, magnetic lattice rigidity, directional transitions. Technology, not a clock UI.**

- **Resting geometry (Tier 2):**
  - Outer dial ring: radius 0.50, z = +0.18 (raised rim), violet population.
  - Inner ring: radius 0.24, z = −0.15 (recessed), cyan, counter-rotating.
  - Six spokes at 60° intervals connecting inner→outer ring, z = 0.
  - Inner hexagon rim: radius 0.13, cyan, 6 vertices; a tiny bright core (~3% of particles) at the centre — the "iris".
  - Orbiters: one faint band at radius 0.37, z = +0.05; one counter-band at 0.56, z = −0.05; 5% of particles total.
  - Assignment: outer ring 28%, inner ring 28%, spokes 24% (uniform along radius), hex 12%, orbiters 5%, iris 3%.
- **Motion language:**
  - Outer dial: **stepped rotation** — phase quantised to 30° steps every ~1.1 s, cubic ease ("clunk"), not 30°·sin smooth drift.
  - Inner ring: continuous counter-rotation at −0.5× the outer step rate (mechanical opposition).
  - Orbiters: continuous, opposite signs, 0.5 rev per 12 s (the only continuously smooth element, threading calm between the clunks).
  - Iris: slow breathing twinkle only.
  - Spokes/hex: rigid with the outer phase — no independent wobble.
- **Rigidity model:** lattice particles (ring/spoke/hex) use spring 3.2 + low ambient curl (0.18); orbiters spring 2.2 + normal curl. Two stiffness classes packed into the seed byte range (see §7.4) — **zero** extra texture storage. **[Proposed]**
- **What makes it read as Victor:** quantisation + magnetic snapping recovery + two counter-rotating regimes + strict 6-fold symmetry + asymmetric lamp (atmosphere upper-left, §6.4) + deep violet/cyan. **[Proposed]**
- **Negative space:** the gaps between the six spokes and the two rings are the design — symmetry at low density, never cluttered. **[Proposed]**
- **Cursor interaction:** lattice members are pushed but snap back hard (spring-dominant); orbiters take the swirl more gracefully. A small cursor disturbance here reads as "the machine resists being bumped" — mechanically distinct from Jin's fluidity. **[Proposed]**
- **Tier 1 lite:** outer ring + inner ring + iris (drop spokes/hex/orbiters); lattice motion quantisation retained (it is the identity). **[Proposed]**
- **Tier 3:** + orbiters, + counter-phase shimmer ring at 0.44 (very faint). **[Proposed]**

### 3.5 Lars Alexandersson — Bolt Filament

**Concept: a single directional energy trunk with two forks — rapid propagation of a charge pulse from root to tip, branching structure, gold junction flares. Lightning, but *characterful*: arcing but never generic.**

- **Resting geometry (Tier 2):**
  - Trunk: y from −1.18 (root) to +1.18 (tip); `x(y,t) = 0.30·fbm(y·2.6 + t·0.8) + 0.16·sin(y·4.3 + t·3.1) + 0.05·sway`; 2 interleaved strands (±0.045 z offset ± 0.035 in-plane offset) — a "fat" energy cable.
  - Two forks: branch A forks from y ≈ +0.35 (diverges right, span y ∈ [+0.35, +1.18]), branch B from y ≈ −0.30 (diverges left, span y ∈ [−0.30, +1.18] mirrored); each is a shorter fbm filament, amplitude 0.20.
  - Junction nodes: at the two fork points, a small persistent bright point (~1–2% of particles each) — the "spark sockets".
  - Charge pulse: every ~2.2 s, a pulse travels root→tip along trunk then out along both branches; brightness boost follows `fract(t/2.2 − λ)` with width 0.18 in λ; pulse frequency ≈ 0.45 Hz — **far below** the 3 Hz flash threshold; no strobing.
- **Motion language:** structure is *mostly stable*; the drama is the propagating pulse and high-frequency arc jitter (per-strand x jitter ±0.02 at 8–9 Hz — shimmer without flicker); trunk sway amplitude 0.05 at 0.3 Hz; per-particle micro-jitter keeps filaments electric rather than glassy. **[Proposed]**
- **Reconnection semantics:** at cycle boundary the pulse dissipates into the tip (brief brighten + fade), never a hard deficit — energy "recharges" at the root; no "bolted" disappearance of particles. **[Proposed]**
- **What makes it read as Lars:** one dominant diagonal energy path + 2 forks + travelling pulse + high contrast against negative corners + gold sockets. **[Proposed]**
- **Negative space:** the corners opposite the trunk — bold diagonal composition, largest quiet area of the five. **[Proposed]**
- **Cursor interaction:** trunk is spring-stiff (3.0) so it *bends* like a cable when pushed — high-stiffness flex, immediate snap-back; branches sway freely (2.2); swirl strength unchanged (interaction is the one shared constant). **[Proposed]**
- **Tier 1 lite:** trunk only (drop forks), pulse retained — identity survives. **[Proposed]**
- **Tier 3:** + two sub-branches per fork + junction flare popping (one random socket flash per pulse, ≤ 0.5 Hz). **[Proposed]**

### 3.6 Shared depth language

All five formations use the same z-depth → alpha/size/fog mapping committed in R2.4 (z ∈ [−0.45, +0.45]; `d = clamp(z·2.1 + 0.5)`; sprite alpha ×(0.60+0.44·d); brightness ×(0.90+0.52·d); fog mix ×(1−d)·0.34). Formations differ only in their *own* z layout (inclinations, sheet offsets, rim heights, strand offsets). This is deliberate: depth separation is infrastructure, not per-formation art direction. **[Repo][Proposed]**

---

## 4. Geometry and mathematical approaches

Common notation: λ ∈ [0,1) is the formation coordinate (seeded per particle at birth and warped by `jinLambda` or equivalent); μ ∈ [0,1) is a secondary lateral coordinate (seed-derived) for cross-plane placement; t = uTime; world units are viewport-height normalized with the lab's `STAGE_SCALE = 0.82` projection. **[Repo]**

### 4.1 Shared primitives (reused as-is)

- `jinLambda`-style arc-length warp: `base + 0.05·sin(TAU·base)` — replace "jin" naming with `formationLambda` in shared GLSL; used by Jin/Claudio (ring arc), Lars (arc length), Dragunov (column fall cycle), Victor (spoke/rim arc). **[Repo][Proposed]**
- `hash11`, `hash21`, `labNoise`, `labFbm2`, `labFbmOctaves`, `labCurl` — unchanged; octaves remain tier-driven (3/4/5). **[Repo]**
- `smoothstep`, depth map, sprite stretch/size law, brightness clip — unchanged. **[Repo]**

### 4.2 Formation target functions `home(λ, μ, seed, t)`

| Formation | Home function sketch | Cost class |
|---|---|---|
| Jin (approved) | helix ribbons; see §2.3 | current |
| Claudio | `θ = TAU·λ + ringPhase + orbitRate·t`; `x = r·cos θ`; `y' = r·sin θ · sin(inc)`; `z = r·sin θ · cos(inc)`; crown: re-project onto y–z plane swapped sign; star: `pos = gaussian(μ,ν)·0.045` (2 seeds) | trig only |
| Dragunov | column assignment `c = hash → x_c = mix(−1.25, +1.25, c)`; column cross-section `x = x_c + gaussian(μ)·0.035`; `y = mix(+0.95, −1.05, fract(λ + t·fallRate + φ_c))`; sheet `z = zSheet + 0.06·fbm(x·2.1, y·1.6, t·0.3)`; dissolution alpha from y | 1 fbm call per particle (octaves tier-driven, 2–4) — comparable to Jin's curl evaluation |
| Victor | outer/inner: `θ = TAU·λ + dialPhase(t)`; rings at `r = 0.50 / 0.24`; `z = ±0.15`; spokes (λ along radius): `r = mix(0.24, 0.50, λ)`; `θ = spokeIndex·60° + dialPhase`; hex: θ snapped to 60° lattice at r=0.13; iris: gaussian core | trig only |
| Lars | trunk: `s = λ (−1.18→+1.18)`; `x = 0.30·fbm(s·2.6 + t·0.8) + 0.16·sin(s·4.3 + t·3.1) + sway(t)`; branches: fork parameter `f` selects branch/terminal; branch `λ` renormalised; z = strand offset ±0.09 | 2 fbm calls (trunk fbm + curl-independent sway) — heaviest new cost, still ≤ Jin's fbm amortised |

All functions are vectorisable, branch-free except for component selection (ring vs spoke vs iris) which is uniform-coherent per particle and never divergent across the 64² texture in any way that matters. **[Estimate][Proposed]**

### 4.3 Seeding and packing

No extra GPGPU storage is required:

- **Component id** is packed into the seed byte-range: e.g. `seed'` ranges [0.00–0.28] outer ring, [0.28–0.56] inner ring, …; `step()` thresholds recover class for shading and stiffness. Jin's single `step(0.88, seed)` spark test generalises to per-formation spark ranges. **[Proposed]**
- **Velocity.w** remains `lambda`; position.w remains seed. Component selection, depth offsets, and stiffness all derive from seed ranges → **zero** extra state; 128 KB allocation unchanged. **[Proposed]**
- `buildInitialState` generalises to `buildInitialState(size, count, formationId, time)`; per-formation seeds stay deterministic (index-derived) so particle identity is stable across switches with the *staggered λ re-map* described in §8 and §11. **[Proposed]**

### 4.4 Inclined-ellipse Claudio (derivation, for the implementer)

For a ring of radius r, inclined by `inc` about the x-axis:

```
cos θ, sin θ = circle parameter λ·TAU
x = r·cos θ
y = r·sin θ · sin(inc)        // screen-y compression = ellipse
z = r·sin θ · cos(inc)        // depth lobe front/back
```

Inclination ±14° gives depth separation Δz ≈ ±0.10 (r=0.63) — visible but subtle; at Δinc 0° the ring is flat edge-on (catastrophically readable), hence the ±14° tilt choice. The crown vertical ring re-projects: `y = r·cos θ`, `z = r·sin θ`, `x = 0` — a perfect vertical halo tangent to the star plane. **[Proposed]**

### 4.5 Angular distribution and arc-length spacing

Jin's near-uniform arc-length spacing is reused everywhere: ellipse circumference is flat in θ (constant radius per ring) so no warp is required for Claudio; the λ warp matters for Lars (arc length along a wiggly trunk) and Victor (spokes vs rings have different physical lengths from one λ space — allocate λ-bands proportional to component length; e.g. outer ring gets the largest band because its circumference is largest). **[Proposed]**

### 4.6 Victor quantised dial (functional spec)

```
t = uTime
stepInterval = 1.1                    // s per 30° clunk
raw   = t / stepInterval
seg   = floor(raw)
frac  = fract(raw)
segPhase = mix(easeOutCubic(frac), 1.0, step(1.0, frac))   // hold at full for the rest of the interval
phase = seg * radians(30°) + segPhase * radians(30°)
```

`phase` feeds outer ring/spokes/hex only; inner ring rotates at ‑½ of the continuous rate; orbiters free-run. Chopping behaviour is deterministic; at exactly the switch instant the phase is discontinuous in *acceleration*, not position — no visual pop, just the ease. **[Proposed]**

---

## 5. Motion and interaction specifications

### 5.1 Shared physics (unchanged from committed lab)

Spring `uSpring`, damping `uDamping + uLocalDamping·fall`, gaussian pointer force (strength + swirl + pointerVelocity coupling), ambient curl, max-speed clamp 2.5, semi-implicit Euler, `dt` ≤ 1/30. **[Repo]**

**The interaction contract is identical for all five formations** — the user's pointer feel must not change character with the formation. Variation lives in (a) `uSpring` per formation (natural frequency), (b) lattice vs orbiter stiffness classes (Victor/Lars), (c) local viscosity multiplier (Dragunov), (d) z layout (affects perceived depth under displacement). **[Proposed]**

### 5.2 Per-formation motion signatures (identity matrix)

| Formation | Rate | Dominant motion | Secondary motion | Feel |
|---|---|---|---|---|
| Jin | 0.35 rad·s⁻¹ ascent | slow rise | flicker + sway | fluid, warm, alive at rest |
| Claudio | 0.045–0.10 rad·s⁻¹ orbits | nested orbit | twinkle, halo drift, mote rise | celestial, calm, ceremonial |
| Dragunov | 0.16–0.24 y·s⁻¹ fall cycle | vertical fall | sway 0.02–0.04, crystal pulses | heavy, cold, imposed |
| Victor | 30° per 1.1 s (stepped) | clunk rotation | inner counter-rotate, orbiter free-spin | precise, mechanical, terse |
| Lars | pulse 0.45 Hz | pulse propagation | arc jitter 8–9 Hz (±0.02), trunk sway | tense, directional, electric |

All formations are below 3 Hz in *flash* frequency; Victor's step rate (≤ 0.91 steps·s⁻¹) is the highest-familiarity transition and is a movement transition, not a light flash. **[Proposed]**

### 5.3 Disturbance response (cursor interaction)

- **Entry:** gaussian fall `exp(-d²/r²)·uPointerActive` unchanged; particles inside fall > 0.15 receive displaced velocity + swirl; edge particles get angular drag via `perp` term. **[Repo]**
- **Propagation:** coherence emerges from the shared field + spring; no grid solver (approved architecture). **[Repo][Decision — approved, R2.2 §6.5]**
- **Recovery:** spring-dominance at distance; organic return; the R2.4 baseline re-forms in ~300–450 ms; per-formation changes only via `uSpring` (never < 2.2) and `uLocalDamping`. **[Repo][Proposed]**
- **No formation may exceed Jin's accumulated ambient turbulence at rest** (curl stays 0.45 max; Victor/Lars may go lower). High curl is what would make any formation read as "wind" — a shared failure mode. **[Proposed]**
- **Measurement hook:** `sampleParticleState()` works unchanged because homes are re-derivable per formation; the harness must call the per-formation mirror (generalise `jinHome` → `formationHome`) and report the same displacement statistics. **[Proposed]**

### 5.4 Spring recovery per formation

| Formation | Spring (lattice/default) | Local damping | Recovery character |
|---|---|---|---|
| Jin | 2.6 (approved default) | 1.2 | soft, fluid |
| Claudio | 2.6 | 1.2 | circular — falls back into arcs |
| Dragunov | 2.4 | 1.7 | heavy curtain, slow settle |
| Victor | 3.2 (lattice) / 2.2 (orbiters) | 1.1 | magnetic snap |
| Lars | 3.0 (trunk) / 2.2 (branches) | 1.2 | elastic cable snap |

Defaults are starting points, all clamped to `PARAM_LIMITS` (spring 1.5–4.0, local damping 0.5–2.0) — UI sliders never invalidated. **[Proposed]**

### 5.5 Character-switch transition requirements

- The approved **380 ms wipe** is the transition baseline. No long (≥ 1 s) formation morph will be introduced; any future morph proposal needs a separate visual + technical justification and owner approval. **[Decision — approved, R2.x]**
- **[Proposed]** switch flow (inside the lab): `setFormation(id)` → build new per-formation home map → reseed GPGPU textures with new homes (deterministic λ mapping, staggered by index so the reseed is symmetric top-to-bottom) → wipe interference hides the snap → formation IS the new identity after the wipe. Total added cost ≪ 1 frame outside the wipe; no extra draws; no new passes.
- During the wipe, both palettes crossfade through the existing `uWipe`-like envelope (lab currently has no `uWipe`; simplest faithful behaviour: fade formation alpha through the wipe via the panel tone — see §11 for the two concrete options).
- Context restore after switch: re-init already re-runs `applyTier`, which re-seeds; with formations, re-init must also re-seed the *active* formation. **[Proposed]**

---

## 6. Color and lighting direction

Jin's approved palette is not modified. **[Decision — approved]** Palettes below are the **committed production `environments.ts` values** (hex shown for convenience), reused in full — no new hues are introduced, so R2.5 stays consistent with the owner's approved colour system.

### 6.1 Palette table (committed values, verbatim)

| Character | deep | fog | glow | vein | tintA | tintB | vein hex ≈ |
|---|---|---|---|---|---|---|---|
| Jin [Repo] | .05,.024,.02 | .13,.05,.038 | .7,.11,.055 | .95,.3,.12 | .95,.34,.1 | 1,.72,.3 | `#F24D1F` |
| Claudio | .014,.028,.055 | .085,.12,.2 | .5,.68,.88 | .95,.83,.48 | .38,.62,.92 | .97,.9,.6 | `#F2D47A` |
| Dragunov | .018,.026,.04 | .065,.1,.15 | .3,.42,.55 | .75,.85,.94 | .34,.42,.54 | .78,.86,.94 | `#BFD9F0` |
| Victor | .026,.016,.05 | .085,.055,.15 | .42,.22,.72 | .18,.78,.85 | .48,.25,.82 | .16,.8,.86 | `#2EC7D9` |
| Lars | .006,.022,.055 | .03,.09,.2 | .18,.55,.95 | .95,.8,.28 | .2,.62,.95 | .95,.78,.22 | `#F2CC46` |

### 6.2 Lighting direction (per formation)

| Formation | Key/fill model | Grain/vignette note | Background voice |
|---|---|---|---|
| Jin (approved) | single warm source below-right; flicker emissive | film grain (uTime-scrolled), soft column vignette | ember column on deep maroon-black |
| Claudio | frontal "star" key (self-luminous core), fill = fog | radial glow + mild vignette; no rays (avoid "godray spam") | deep indigo, horizon haze faintly warmer at centre |
| Dragunov | one low warm slit at the base (low sun reference), everything else cold | cool fog grade; vignette slightly stronger; optional faint horizontal streak haze | steel-navy, oppressive but quiet |
| Victor | single hard lamp upper-left (asymmetric highlight on the rim) | subtle horizontal datum lines (≤ 2 % alpha), chromatic fringe on rim only at specular peaks | deep plum, module-lit not lit-from-ambient |
| Lars | source travels with the pulse (moving key); scene flashes micro-lift at arrival | near-black indigo; pulse-synced background lift (uPulse) ≤ 8 % luminance | storm-grey void, diagonal structure |

### 6.3 Sprite/glow rules

- Jin: soft round-ember streaks (approved). **[Repo]**
- Claudio: round motes; spark glyph = **4-point glint** (two crossed anisotropic falloffs), capped vAlpha ≤ Jin spark levels. **[Proposed]**
- Dragunov: **vertical chip streaks** (stretch along velocity — fall direction ⇒ vertical chips); crystal glints = tiny hard core, high `vHard`; no rain slant. **[Proposed]**
- Victor: **diamond** sprite (rotated-square falloff: `|q.x|+|q.y|` contour); specular cyan core; outer ring stays dim violet — luminance ladder inner < outer at rest, inverted only during clunk ease (rim flares on the step). **[Proposed]**
- Lars: **long streaks** (vStretch ×1.3 vs Jin) + white-hot core; gold spark glyph at junctions; trunk strands slightly larger. **[Proposed]**
- All formations keep additive blending and the brightness clip (no white-out). Formation layers may never read as a fullscreen wash. **[Repo]**

### 6.4 Atmosphere coupling (scoped proposal)

The committed lab atmosphere is Jin-specific. R2.5 proposes **no new atmosphere artwork** and **no Jin-art-derived sampling**; instead, the existing fullscreen triangle gains a small uniform block, e.g.:

```
uniform int   uAtmosMode     // 0 Jin (current) · 1 Claudio · 2 Dragunov · 3 Victor · 4 Lars
uniform vec2  uAtmosAnchor   // key-light position in p-space (Victor upper-left, Dragunov low slit)
uniform float uAtmosBand     // band width multiplier (Dragunov base slit, Claudio centre radial)
uniform float uPulse         // Lars pulse envelope (0..1), Victor clunk envelope ignored here
```

Each block is 4–8 extra ALU ops over today's ember column; the pass remains a single branchless-ish mode switch (uniform branch). If register pressure or mode-count creep makes this ugly, fall back to five small compiled atmosphere programs (still one draw each, cached at boot, zero switch cost beyond a useProgram). **No atmosphere change is approved outside this scope.** **[Proposed]**

### 6.5 Negative space rules (all formations)

- Never fill a fullscreen rect of light; the atmosphere anchors one focal region only.
- Formation silhouette must occupy ≤ ~45% of the canvas height-weighted area at Tier 2 (Jin reference ≈ pillar, fits).
- Text/content zones are never overlapped by formation geometry core (the lab currently has no text-over-canvas requirement; the production rule of thumb stays: formation behind content, never across it).
- Halo radius never exceeds ~0.72 of viewport height (Jin's `uStageScale` mapping already bounds this). **[Repo][Proposed]**

---

## 7. Shared architecture proposal

### 7.1 To reuse unchanged (verified facts)

One WebGL2 context; one canvas; RGBA16F ping-pong (128 KB); velocity → position pass order; `buildInitialState` (generalised by formation id); spring/damping/blowout physics; JS↔GLSL `hash11`/`jinLambda` mirrors; `FrameMeter` + `GpuTimer`; float readback verification (`verifyFloatSimulation`); analytic fallback (generalised); context-loss forget/rebuild; harness instrumentation; lab UI skeleton (panel, tier row, controls). **[Repo]**

### 7.2 To generalise (mechanical, low design risk)

| Item | Change | Risk |
|---|---|---|
| `formations.ts` | `JIN_FORMATION` → `FORMATIONS: Record<FormationId, FormationDefinition>`; export `buildInitialState(…, formationId, …)` | low |
| `shaders.ts` | `JIN_GLSL` → `FORMATION_GLSL` exporting `formationHome()`; `ATMOSPHERE_FS` gains `uAtmos*`; sprite VS gains glyph uniform | medium |
| `MotionLabEngine.ts` | `setFormation()`; palette uniforms re-uploaded; `applyTier` re-seeds active formation; `jinHome` readback mirror → `formationHome` mirror | medium |
| `harness.ts`/`harness.html` | per-formation measurement helpers; no new dependency | low |
| Panel copy | formation selector buttons (Tier-row pattern) | low |

### 7.3 Formation definition schema (data-driven, proposed)

```ts
export interface FormationDefinition {
  id: 'jin' | 'claudio' | 'dragunov' | 'victor' | 'lars';
  name: string;
  anchor: number;            // focal x-offset in stage units (all near 0 today)
  radius: number;            // formation envelope scale (Jin 0.34, others as designed)
  components: FormationComponent[];   // see 7.4 — drives seed ranges and shading
  spring: number; dampingMul: number; localDampingMul: number;
  curlScale: number;         // multiplier on uCurl (Victor 0.4, Lars 0.7, others 1)
  glyph: 'streak' | 'chip' | 'diamond' | 'glint';
  pulsePeriod?: number; pulseWidth?: number;  // Lars; 0 elsewhere
  palette: { deep, fog, glow, vein, tintA, tintB };
  atmos: { mode, anchorX, anchorY, band, wake };
  zLayout: 'pillar' | 'flat' | 'dial' | 'sheet';
}
```

Constants live in one committed module; shaders receive only `uFormation` (index) + small scalars. No formation-specific uniform *count explosion* — the schema exists at build time, the shader stays lean. **[Proposed]**

### 7.4 Formation GLSL `home()` strategy

- **Recommended:** one `FORMATION_GLSL` include with `if (uFormation == k) { … }` blocks (k = 0..4), each a compact block (≤ 20 lines). Uniform branching across 4096 texels is negligible; divergence cost is nil for these branch sizes. Simpler maintenance, single program. **[Proposed]**
- **Alternative (owner call):** five compiled variants of the GPGPU/sprite programs cached at boot (`programs[5]`), selected by mode switch — zero branch cost, ~5× program objects, identical draws/frame; use only if profiling shows the switch costs > 0.05 ms or if the owner prefers hard separation over shared code. **[Proposed]**
- Shared: `formationLambda`, `hash*`, `smoothstep`, `depthMap`, `spriteLaw` live in `NOISE_GLSL`-adjacent shared block. Formation-specific: the `home` block + component shading adjustments (spark ranges, `vHard`, palette tint mix, ring bias). **[Proposed]**

### 7.5 Particle component allocation

Implemented as **seed-range partitions**, e.g. Victor: outer ring seeds [0, 0.28), inner ring [0.28, 0.56), spokes [0.56, 0.80), hex [0.80, 0.92), orbiters [0.92, 0.97), iris [0.97, 1.0). Shading reads the same ranges to set `vHard`, tint bias, and (for lattice) a `stiff` flag. Jin already demonstrates the pattern (spark = seed ≥ 0.88). **[Proposed]**

### 7.6 The analytic fallback

Generalises to `formationHomeAnalytic(formationId, fi, t, …)` mirroring GPGPU exactly (same math, CPU-side identity seeding). Fallback behaviour per formation is defined and tested per tier; if a formation cannot hold its visual identity analytically (see Tier 1 review §8), the Tier 1 fallback drops to *existing* analytic Jin-like drift with the formation's palette — an explicit, visible degradation, never a silent one (same rule as `?nofloat` today). **[Repo][Proposed]**

### 7.7 No-go list

No new render passes; no new programs at switch time (all cached/compiled at boot); no textures beyond the four GPGPU targets; no custom framebuffers for atmosphere (it renders direct, as today); no post-processing; no second canvas; no context duplication; no five renderers; no shader re-compile on switch; `?test=1` hooks remain inert in production; `docs/spec.md` never edited. **[Proposed]**

---

## 8. Tier 1 / 2 / 3 behavior

Tier counts stay **450 / 1100 / 2200**. **[Decision — approved]** Particle counts are *not* raised for spectacle; only component *layouts* change.

| Tier | Jin (approved) | Claudio | Dragunov | Victor | Lars |
|---|---|---|---|---|---|
| **Tier 1 — lite, still in-identity** | 1 ribbon (current T1 works — verified) | Ring A + star (drop B/C/crown; same ellipse law) | 1 sheet, 5 columns, same fall/sway/dissolve | Outer ring + inner ring + iris (drop spokes/hex/orbiters); clunk rotation retained (it *is* the identity) | Trunk only + pulse (no forks) |
| **Tier 2 — canonical** | Approved R2.4 build | 3 rings + crown + star; inclination depth | 3 sheets × 7 columns + crystal pulse | Full dial: rings, 6 spokes, hex, 2 orbiter bands, iris | Trunk + 2 forks + sockets + pulse |
| **Tier 3 — high detail, optional** | Current (T3 triple-ribbon triple-helix, unplanned target but verified) | + orbiter band 0.56 | wider span (±1.4) + sub-columns | + counter-phase shimmer ring at 0.44 + faint orbiter sparks | + 4 sub-branches + socket pop flashes |

**[Repo]** Tier 1/2/3 currently all use the same simulation path; Tier 3 gains octaves + particles only.

### 8.1 Simulation stability

- All formations are spring-bound ⇒ unconditionally stable at dt ≤ 1/60 with the current semi-implicit integration (validated at 1440/768/390). Victor's quantised phase injects impulsive angular acceleration only through the *home* term; spring-limiting keeps it bounded; no external force is discontinuous. **[Assumption — to validate per stage]**
- Lars's pulse injects brightness (vertex/fragment only), not force ⇒ no stability impact. **[Proposed]**
- Pulse/flash rates ≤ 0.91 Hz (Victor) and ≤ 0.45 Hz (Lars): no seizure trigger. **[Proposed]**

### 8.2 Visual readability

| Viewport | Risk | Mitigation |
|---|---|---|
| 390×844 | Dense formations lose column structure | Tier-appropriate counts; Dragunov/Victor rely on *structure* not density — verified legible corridors at 507×635 backing |
| 768×1024 | Balance of column width vs gaps | `uStageScale` unchanged; formation envelope ≤ pillar width where applicable |
| 1440×900 | Halos can whisper-white under additive stacking | existing brightness clip + per-formation vAlpha caps; Jin's approved curve reused |

**[Repo, measured]** 390/768 captures exist for Jin and held identity. **[Proposed]** same capture protocol applied per formation.

### 8.3 GPU timing and memory (targets; not measurements)

- Tier 1 ≤ 3.0 ms, Tier 2 ≤ 4.0 ms, Tier 3 ≤ 5.0 ms — **provisional owner-accepted targets, not guarantees.** **[Decision — approved]**
- Memory: **128 KB** GPGPU (unchanged) + no LUTs + no artwork textures. Worst case = Jin's current footprint. **[Repo][Proposed]**
- Estimated formation-switch cost: one texture re-upload of 2×128 KB (512 texels × 4 targets, Float16) ≈ negligible; worst-case single-frame hitch measured against 100 ms budget in the verification protocol. **[Estimate]**

### 8.4 Graceful failure ladder (per formation)

GPGPU verified → GPGPU used. `EXT_color_buffer_float` missing/rejected → analytic formation-lite (same home math, no state). Shader error → Tier 0 CSS with Jin-styled static fallback (existing pattern). Reduced motion → Tier 0. **[Repo][Proposed]**

---

## 9. Performance and memory estimates

### 9.1 Expected GPU cost per formation (estimates; measurement required)

Basis: Jin measured (1440, dpr 1.5) ≈ 0.41 ms; atmosphere dominates; GPGPU is 4096 texels and is effectively free; sprite pass dominates variance.

| Formation | Estimate vs Jin | Reasoning |
|---|---|---|
| Claudio | **lower** | trig-only homes; no fbm in home; twinkle cheap; atmosphere block is radial (no band) |
| Dragunov | **± Jin** | one fbm per particle in home (sheets) ≈ Jin's fbm in velocity pass; atmosphere slightly cheaper (no pillar band) |
| Victor | **lower** | no fbm at all in home; lattice = branchy but branchless selection via seed ranges; atmosphere is symmetric, cheap |
| Lars | **slightly higher** | trunk fbm evaluated twice (home + jitter), branch fbm partial; atmosphere adds one pulse uniform multiply only |

All four are expected ≪ 4 ms Tier 2 on the owner iGPU by the Jin measurement margin; **none of this is a claim — it is a hypothesis to be falsified per stage.** **[Estimate][Assumption]**

### 9.2 Shared vs formation-specific work

- Shared (≥ 90% of instructions): noise/fbm/curl library, depth mapping, sprite shading law, brightness clip, GPGPU loop skeleton, pointer physics, tint-mix, fog. **[Proposed]**
- Formation-specific (≤ 10–20 lines per formation): `home()` block (~≤ 20 lines), component seed ranges, stiffness class, pulse envelope (Lars), glyph law (Victor diamond is ~4 lines; Claudio glint ~3 lines). **[Proposed]**

### 9.3 Shader branching

- GPGPU: `if (uFormation == n)` — uniform branch; executed coherently across 64²; no divergence cost of note; texture fetches unchanged. **[Estimate]**
- Sprite VS: component-class *shading* is fine as ranges (no branches, math only) except glyph type — glyph is 3 `if`s on a uniform; pixel cost of diamond vs round ≈ +2 ops. **[Estimate]**
- Atmosphere FS: one uniform branch per fragment; block sizes ≤ today's ember column; cost delta ≤ 5–10% for any mode vs Jin. **[Estimate]**

### 9.4 Mobile limitations

- 390×844 Jin T2 measured 0.18–0.21 ms; small canvas keeps all formations far under mobile frame budgets, provided DPR cap stays 1.5 and render scale stays available. **[Repo, measured]**
- iOS: no `EXT_float_blend` (irrelevant — sprite pass is additive `SRC_ALPHA/ONE` which needs no blend extension); RGBA16F FBs supported on Safari 15+; the lab already passes `?nofloat` and reduced-motion paths, and context-loss restore is verified. **[Repo][Ext]**
- Coarse pointer: `pointerup`/`pointercancel` zero `uPointerActive`; no stale force on touch end (verified in current code). **[Repo]**

### 9.5 Worst-case formation-switch cost

One re-seed (2 × `texImage2D` of 128 KB) + a uniform rebind; worst case bounded by driver upload latency; no compile stall; no FBO re-creation (textures are re-uploaded, not reallocated). **[Estimate]** — validated by harness (`reset()`/`applyTier` re-seed path exists and is cheap today; formations add the same cost once).

### 9.6 Budgets vs targets

Tier 3 ≤ 5.0 ms provisional is nearly a non-constraint for this architecture; the meaningful gate is **Tier 2 ≤ 4.0 ms with visual identity intact**, and **no regression of Jin's 0.41 ms band**. **[Repo][Decision — approved][Estimate]**

---

## 10. Mobile and accessibility considerations

### 10.1 Mobile

- 390×844 capture exists for Jin; four more formations must clear the same legibility bar (§8.2) — the risk is Victor (radial symmetry at low contrast) and Dragunov (column structure at small size), both addressed by structure-over-density Tier 1 design. **[Proposed]**
- Touch: pointer disturbance works via the same gaussian field; touch does not hover — taps produce a brief pushed ripple and recover (desired touch feel; verified path in current code). **[Repo]**
- Coarse-pointer + `prefers-reduced-motion` → Tier 0 (unchanged). **[Repo]**
- Context loss on mobile GPU pressure: restore path verified; formation re-seed after restore is a new requirement to add in Stage 6. **[Repo][Proposed]**

### 10.2 Accessibility

- Canvas `aria-hidden="true"`; decorative only; all content in DOM. **[Repo, lab CSS/markup]**
- Reduced motion → Tier 0 static composition (Jin ember motif via CSS, no context) — unchanged. **[Repo]**
- Flash rates ≤ 0.91 Hz globally (Victor steps; Lars pulses 0.45 Hz; Jin flicker is continuous noise, not a periodic flash). **[Assumption — to verify with a stroboscope checklist before Tier 2 approval]**
- Contrast: formation remains behind all text (lab has no copy conflict; production integration keeps the formation behind content). **[Repo]**
- Focus management: formation selector buttons must be reachable and operable like the tier row (`aria-pressed`, visible focus ring) — the lab already has this pattern re-used. **[Repo]**
- No new audio, no new haptics, no new animation outside the canvas. **[Proposed]**

---

## 11. Character-switch transition strategy

### 11.1 Approved baseline (restated)

The **380 ms wipe** is the transition baseline. **No 1.0–1.2 s formation morph will be introduced in R2.5.** Any morph requires a separate visual + technical justification and explicit owner approval. **[Decision — approved]**

### 11.2 Proposed switch behaviour (lab)

1. `setFormation(newId)` called from panel button.
2. Engine builds new home map via `buildInitialState(…, formationId, time=now)` — identity is index-deterministic: particle *i* swaps its home from Jin's helix to the new formation with the same index; staggered top→bottom by index for a wipe-like sweep feel (pure CSS-independent ordering, no new draws).
3. Textures re-uploaded (as `reset()` does today); `simTime` is **not** zeroed (time continuity preserved).
4. Atmosphere fades via the wipe: on switch, the panel-toned overlay (`.lab-stage` + tone) crossfades its alpha through a 380 ms envelope with the existing easing family; underneath, the new formation fades in un-occluded. Atmosphere uniforms switch immediately at wipe start.
5. Post-switch readback check (`sampleParticleState`) must report finite, formation-local displacement ≈ rest state within 1–2 s — harness asserts this.

**Cost:** one re-upload + uniforms; no extra frames; no shader recompile; no FBO churn. **[Proposed]**

### 11.3 Why not a long morph

- Formation homes live in incompatible topologies (helix vs rings vs sheets vs dial vs trunk) — a morph would require per-particle path planning or spring chaos; visual fidelity is unverifiable without shipping it.
- The 380 ms wipe already solves identity continuity for the *site*; the lab inherits the same contract.
- The owner approved the wipe as the baseline; R2.1/R2.2's optional `uMorph` is reserved, not scheduled. **[Decision — approved]**

### 11.4 Open question for owner

Two faithful variants of the wipe envelope are acceptable:
- **A (simplest):** palette crossfade via atmosphere uniforms + 130 ms formation fade — total ≤ 380 ms, zero new GL state.
- **B (richer):** A + one-cycle ease on a per-formation `uSwitch` envelope that also scales sprite alpha 0→1 staggered — still ≤ 380 ms end-to-end, +1 uniform.

Recommend **A** for R2.5 unless the owner prefers B's polish. **[Proposed]**

---

## 12. Implementation sequence

**[Proposed]** Each stage ships independently; Jin is the regression gate at every stage; nothing integrates into production until a separate milestone.

| Stage | Scope | Exit criteria |
|---|---|---|
| **R2.5-0** | Formation infrastructure in lab (schema, `setFormation`, atmos uniforms, render scale unchanged, Jin re-baselined bit-identical) | Jin GPU medians and visuals Δ ≤ measurement variance; all existing harness tests green |
| **R2.5-1** | Claudio formation (3 rings + crown + star; glyph glint optional), harness + captures | captures undisturbed/disturbed/recovered; readback clean; GPU median < Jin's band +20%; owner visual sign-off |
| **R2.5-2** | Dragunov (3 sheets × 7 columns; dissolution; crystal pulse) | same protocol; tier-1 lite validated |
| **R2.5-3** | Victor (rings, spokes, hex, iris, orbiters; quantised phase; stiffness classes) | clunk QA at slow framerate (dt clamp path), lattice recovery verified |
| **R2.5-4** | Lars (trunk + forks + sockets; pulse; longest glyphs) | pulse cadence ≤ 0.45 Hz verified; atmosphere pulse uniform ≤ 8 % lift |
| **R2.5-5** | Tier 1 identity pass across all five (drop lists verified visually) | every formation reads at 450 particles; Tier 0 untouched |
| **R2.5-6** | Verification hardening: per-formation harness matrix (viewport × tier × state), report, regression artifacts archive | owner review of all five at Tier 2 before any integration discussion |

**[Decision — approved]** Jin must remain bit-identical through Stage R2.5-0; any infrastructure change that shifts Jin's output blocks the stage.

**[Proposed]** One commit per stage (or per owner-approved batch), never bundled with production, never merged/pushed without owner instruction. (R2.4 owner instruction: single checkpoint commit after approval.)

---

## 13. Verification strategy

### 13.1 Per-formation matrix (after every stage)

| Check | Protocol |
|---|---|
| TypeScript + lab build | `npx tsc --noEmit`; `npx vite build --config vite.motion-lab.config.ts` |
| Tier GPU timing | `window.measureTier` × {1440×900, 768×1024, 390×844} × {T1,T2,T3}; medians reported; p95 flagged noisy |
| Tier 2 undisturbed / disturbed / recovered captures | harness `pointerTest` + `captureCanvas`; compare against Jin's three-state artifact set |
| Cursor disturbance & recovery readback | `sampleParticleState()`; expect meanDisplacement sin/oscillation < Jin's disturbed band; recovery < 500 ms |
| Float readback verification | `verifyFloatSimulation` path on formation switch and restore |
| Context loss/restore ×2 | active → lost → active; GPGPU restored; finite readback; no GL errors |
| Resize | 1440×900 → 768×1024 backing scale; no errors |
| Reduced motion | Tier 0 CSS, zero canvases |
| `?nofloat` | analytic path per formation; reason string explicit; no GL errors |
| `?notimer` | GPU "unavailable"; draws still 4 |
| Pause/reset/render scale | pause 2 draws; reset re-seeds; 0.25/0.5/1.0 scales clean |
| Tier switching | T1↔T2↔T3 without leaving page; reseed verified; stats sane |
| Console/WebGL errors | none, all runs |

### 13.2 Jin regression gate

At each stage: Jin medians must remain within ±10% of the `74588ed` band (0.411–0.420 ms at 1440×900); Jin's three approved screenshots (undisturbed/disturbed/recovered) re-captured and compared for: helix legibility, no white-out, no silhouette drift. **Any visual drift of Jin fails the stage.** **[Repo][Proposed]**

### 13.3 Measurement protocol

Median over ≥ 90 timer samples after 1.5–3 s warm-up; same machine, same ANGLE/D3D11 path; DPR/scale pinned; timer covers all draws; GPU time reported separately from CPU pacing; p95 reported with a noise disclaimer; comparisons only within one session or with variance reported. **[Repo, measured caveats]**

### 13.4 Visual acceptance (owner)

Five Tier 2 contact sheets (undisturbed/disturbed/recovered at 1440×900; one 390×844) archived in `dist-motion-lab/verification/` (gitignored) and attached to the owner review. **[Proposed]**

---

## 14. Risks, trade-offs, and unresolved owner decisions

### 14.1 Risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Victor's quantised phase + spring creates visible jitter at clunk instant | Medium | ease overshoot clamped to ≤ 5%; ambient curl 0.18; test at 24 fps clamp |
| 2 | Dragunov reads as "smoke" instead of "curtain" at 390 px | Medium | 7 columns with hard minima; dissolution bottom fade; verify on capture |
| 3 | Claudio reads as "generic 3D ring" if crown omitted | High | crown arc mandatory at Tier 2; glint glyph vs round sprite distinguishes |
| 4 | Additive stacking at fork junctions (Lars) blows out | Medium | per-junction vAlpha cap; brightness clip unchanged; measure luminance histogram |
| 5 | Formation switch re-seeds into a visible snap | Medium | 380 ms wipe hides it; staggered index remap; owner chooses A/B envelope (§11.4) |
| 6 | One shared shader accumulates modes and becomes unmaintainable | Low | ≤ 20-line homes; 5-program split fallback documented; flagged if > ~600 lines |
| 7 | Measurement noise hides a real GPU regression on p95 | Medium | median-based gates; repeat runs; owner gets both |
| 8 | Formation identity dilutes under shared dice (all "filaments") | High | per-formation glyph law + component ranges + distinct z layout; visual review gates |
| 9 | Analytic fallback diverges from GPGPU per formation | Medium | mirror GLSL in TS exactly (Jin does this); tests compare displacement stats |
| 10 | Lars flash on pulse could trigger motion-sensitivity | Low | 0.45 Hz ≤ threshold; luminance cap 8%; noted in a11y checklist |
| 11 | Scope creep into production integration | High | hard milestone boundary; new approval required for `src/graphics/*` |
| 12 | R2.1/R2.2 contradictions discovered during research | Low | R2.5 supersedes lab-scoped parts; docs left untouched; deltas listed in §17 |

### 14.2 Unresolved owner decisions (blocking implementation)

1. **Transition:** approve instant-reseed-in-wipe (A or B envelope, §11.4) — or request a justified morph evaluation as a separate milestone?
2. **Atmosphere scope:** approve the small `uAtmosMode` block (§6.4) for the four non-Jin formations, or require Jin's atmosphere untouched for all five (formation-only identity)?
3. **Tier 1 designs** (§8 table): approved as stated, or does the owner want Jin-like "reduced but full" Tier 1 rather than per-formation lite?
4. **Glyph system:** approve 4 glyph laws (streak/chip/diamond/glint) — or constrain to Jin's single sprite to minimise risk?
5. **Selector placement:** formation buttons in the existing tier-row pattern (recommended), or a new "character" row in the instrumentation panel?
6. **Verification protocol:** accept "median ±10% of Jin band + capture set" as the per-stage regression gate?
7. **Integration appetite:** is any production integration authorized at this milestone (answer expected: no), or is R2.5 lab-only until separate sign-off?
8. **Victor lamp placement** (upper-left vs centred): owner's Jin-side preference?
9. **Lars sub-branches at Tier 3**: include or omit to keep the silhouette single-minded?
10. **Commit policy per stage**: one commit per stage (recommended) or batched single checkpoint after all five are approved?

### 14.3 Explicit non-goals (R2.5)

No production renderer/styles/components/assets changes; no `docs/spec.md` edits; no new dependencies; no Three.js/GSAP/etc.; no Jin artwork-mask sampling anywhere; no new artwork; no longer than approved transition; no pushing/merging/deploying; no npm-audit changes. **[Scope]**

---

## 15. Repository state after this milestone

**[Repo, post-write]** The only file added by R2.5 is this document: `docs/r2-5-five-character-formation-design.md`.

- Existing documents (`docs/r2-graphics-technical-design.md`, `docs/r2-2-prototype-brief.md`, `docs/spec.md`) were **not modified**.
- No renderer, shader, lab, build, or asset files were modified or added.
- HEAD remains `74588ed7ce1ed750c06f34287fe6d08a1140045c`; branch `experiment/r2-graphics-lab`.
- Verification (final, recorded below): branch/HEAD/clean tree re-checked; trailing-whitespace scan of this document; `git diff --check` clean.

---

## 16. Facts, estimates, and caveats (explicit labelling)

### 16.1 What is measured (R2.4 session, `74588ed`)

- Jin GPU medians at 1440/768/390 (§2.5); pointer disturbance/recovery stats; 128 KB allocation; 4 draws; canvas backing sizes; float verification; context-loss restore; resize; reduced-motion; `?nofloat`; `?notimer`. Recorded in the R2.4 report and archived captures under `dist-motion-lab/verification/` (gitignored). **[Repo, measured]**

### 16.2 What is estimated (must be re-measured)

- Per-formation GPU cost ordering (§9.1); switch cost (§9.5); sprite/glyph ALU deltas; readback/verify cost at switch time.
- Tier 1 visual viability at 450 particles — flagged as the highest-risk assumption in the brief history (R2.2 §9); each formation must demonstrate it or degrade honestly.
- Flash/strobe safety at the specified cadences (0.45–0.91 Hz) — engineering-trivial, but requires the a11y QA checklist (§13), not assumption.

### 16.3 What is unknown

- Any of the five formations' actual on-device cost beyond Jin (only Jin has been run).
- Victor's behaviour at exactly the dt = 1/30 clamp (spring overshoot under quantised forcing) — flagged for stage validation, mitigations in place.
- Whether Tilted Claudio at Δz ±0.10 separates clearly on the owner's sRGB panel (likely fine; confirm with capture).

### 16.4 Known documentation deltas vs R2.1/R2.2 (not edits)

- R2.2 proposed 6 Claudio filaments via rings/inclinations + a 4th "crown" arc — R2.5 adopts crown as vertical halo ring (same intent, made explicit).
- R2.2 proposed Victor "1 ring" at Tier 2; R2.5 keeps both rings (identity requires the counter-rotating regime) — counts unchanged, only layout.
- R2.2 proposed 12% spark white-hot for Jin; unchanged for Jin; spark ranges re-purposed per formation (Victor iris 3%, Dragunov crystal 8%, Lars sockets ~4%).
- R2.2's optional `uMorph` is explicitly **not scheduled**; the approved 380 ms wipe carries transitions (§11).
- R2.2's "Stage C adds the rest" gate is superseded by this R2.5 sequenced plan (R2.5-0 … R2.5-6).

---

## 17. Immediate next step (for owner review)

This milestone delivers only this document. Proposed next action: owner review of §14.2 decision list, then authorisation of R2.5-0 (infrastructure + Jin re-baseline) as a stand-alone stage. No formation code exists and none may be written until that approval.

*Stopping for owner review.*

---

## 18. Implementation status (R2.5-1, recorded after implementation)

**What shipped:** Jin (approved reference) + **Claudio — Radiant Orbit** are implemented and selectable in the isolated lab. Dragunov, Victor and Lars remain inert schema entries (`implemented: false`).

**Delivered behaviour vs this document:**
- Nested inclined orbits at **±22°** (not the sketch's ±14° — the approved look was illegible at 1,100 particles; radii 0.22 / 0.42 / 0.68 keep planes distinct). [Deviation — owner flag required]
- The **crown** hangs as an **azimuth-rotated vertical ellipse** (~62° about y, z-offset −0.05), not a literal y–z plane ring (edge-on, invisible). Same intent, restrained visibility. [Deviation — owner flag required]
- The **focal star is a treatment of existing particles** (comet-like λ spread ±0.45, gaussian radius σ≈0.02, 8% of the budget) — no extra allocation, per the owner's approved amendment. [Approved amendment]
- **Component partition** (T2): star 8% / Ring A 26% / Ring B 36% / Ring C 20% / crown 10%. T1: star 22% + Ring A only. T3: star 7% / A 23% / B 30% / C 16% / crown 12% / counter-rotating orbiter r 0.56 (−0.055 rad·s⁻¹).
- **Kepler-like hierarchy**: star 0.16 / A 0.10 / B 0.07 / C 0.045 / crown 0.03 rad·s⁻¹, all CCW. Claudio **rests tighter than Jin** (bounded bob ±0.018, no ascent); disturbance and recovery are clean and circular (measured: 0.026 → 0.109 during, recovered ≈ 0.023 at 1440×900).
- **Analytic fallback** reproduces Claudio's nested orbits (`?nofloat` verified in-canvas); switching/reset intact; instrumentation reports the active formation.
- **Measured** (same session, GPU medians): 1440×900 Claudio T2 ≈ 0.416 ms (Jin band), 768 ≈ 0.306, 390 ≈ 0.149; 128 KB allocation, 4 draws; Jin stayed within the ±10% median gate throughout.

**Still pending:** Dragunov Frost Curtain, Victor Precision Dial, Lars Bolt Filament (R2.5-2…R2.5-4); per-formation glyph law beyond the shared streak sprite; pulse envelopes; full Tier 1 identity audit for non-implemented formations; Tier 2 owner visual sign-off of Claudio.

*R2.5-1 verification: tsc, isolated build, tier matrix, fallbacks, switching, context loss/restore, resize, reduced motion — all pass; Jin regression within gate; captures stored under `artifacts/motion-lab/verification/` (local only, gitignored).*

---

## 19. Implementation status (R2.5-2, recorded after implementation)

**What shipped:** Jin (approved reference) + **Claudio — Radiant Orbit** (R2.5-1, committed) + **Dragunov — Frost Curtain** are implemented and selectable in the isolated lab. Victor and Lars remain inert schema entries (`implemented: false`).

**Delivered behaviour vs this document:**
- **Three depth-layered sheets** (far z = −0.19 with 6-column span ±1.15, mid z = 0.0 with 7-column span ±1.25, near z = +0.19 with 7-column span ±1.35). Per-sheet fog depth, column jitter (±0.05), and cross-section gaussian per sheet (σ ≈ 0.022 + 0.005·sheet index) keep the streams distinct without a snowstorm. [Matches §3.3 / §4.2 / §5.4 of this document.]
- **Column assignment** is hash-derived per particle (`floor(hash11(seed·13.7 + sheet·91 + 7) · cols)`) — deterministic from the existing seed — using the same hash family as Jin/Claudio; no new random sources. Columns spread uniformly over the span (hash-clustered, no overlap).
- **Motion:** vertical sawtooth fall (`fract(λ + phase + t·fallRate)` with fallRate ≈ 0.08–0.12 λ·s⁻¹) — home moves through y ∈ (−1.08, +0.98), governed by a **bounded sway** instead of the document's original "lateral shear 0.05–0.08" (the sway is ±0.025); **dissolution** fades chips in at the crown (u < 0.14) and out at the base (u > 0.82), and a crystal pulse travels down one column at a time (≥1.8 s intervals; T3 uses 1.3 s).
- **Spring behaviour:** the shared gaussian disturbance splits the curtain; swirling interaction cuts a visible cavity and it springs back with the columns intact. The fall dominates mean displacement (≈ 0.27), meaning the metric is no longer comparable to Jin/Claudio — nausea of that reading is a fingerprint of Dragunov, not a defect. [Verified.]
- **Tier behaviour:** T1 → single mid sheet, 6 columns, 450 particles. T2 → 3 sheets × 6/7/7 columns (canonical). T3 → 9-column subdivision + 8 % drifting fragments + T1-style sub-columns. Tier counts unchanged (450 / 1100 / 2200).
- **Atmosphere (mode 2):** steel void with a faint low "low-sun" slit at the base, vertical fbm streak haze, subtle vignette. Jin mode 0 and Claudio mode 1 unchanged.
- **Implementation defect found and fixed during R2.5-2 (before commit):** the JS ↔ GLSL mirror mismatch (seed/lambda were stored in RGBA16F, but JS/uSeb JS mirror computed home with the full-precision float64 values rather than the half-float-stored values, flipping sheet/column assignments via hash amplification). Fix: JS mirror switched to bit-exact float32 (`Math.fround`) via the shader-registries hash functions, and the seeder rounds lambda and seed through the same half-precision the textures use, via `Float16Array` round-trip. Displacement at rest dropped from ≈ 0.87 → ≈ 0.01 (Jin/Claudio baseline intact).
- **Deviation from sketch (§3.3/§6.1):** the fall cycle replaces the document's original "triangle wave" intermediate iteration — continuous-downward sawtooth with dissolution fade instead 0.02 in-axis — the same spec the document describes as "particles cycle top → bottom along λ ∈ [0,1)" [Matches]; the triangle-wave intermediate was unsuitable (piles at extremes).

**Measured (same session, GPU medians, 128 KB allocation, 4 draws):** Dragunov T2 ≈ 0.53 ms at 390×844, ≈ 0.97 ms at 1440×900 (environment shifted ~2.5× across all formations this session, so relative standing is what matters; Jin and Claudio never exceeded the ±10 % gate). Analytic fallback verified in-canvas (`?nofloat`).

**Still pending:** Victor Precision Dial, Lars Bolt Filament (R2.5-3…R2.5-4); per-formation glyph system beyond the shared chip sprite; Tier 2 owner visual sign-off of Dragunov.

*R2.5-2 verification: tsc, isolated build, tier matrix across three viewports, fallbacks (`?nofloat`, `?notimer`, reduced motion), switching (Jin↔Claudio↔Dragunov repeatedly, while paused, reset with Dragunov active, tier round-trips with Dragunov active), context loss/restore with Dragunov active (formation preserved, float verified, 4 draws), GPU/CPU timing recorded separately, zero console/GL errors; Jin and Claudio untouched and within gate; captures stored under `artifacts/motion-lab/verification/` (local only, gitignored).*

---

## 20. Implementation status (R2.5-3, recorded after implementation)

**What shipped:** Jin (approved reference), **Claudio — Radiant Orbit** (R2.5-1), **Dragunov — Frost Curtain** (R2.5-2) and **Victor — Precision Dial** are implemented and selectable in the isolated lab. Lars remains an inert schema entry (`implemented: false`).

**Delivered behaviour vs this document:**
- **Geometry and component partition** follow §3.4/§4.2/§7.5 with the document's seed ranges: T2 outer rim `[0, 0.28)` at r 0.50 / z +0.18 (violet), inner ring `[0.28, 0.56)` at r 0.24 / z −0.15 (cyan), six spokes `[0.56, 0.80)` with `r = mix(0.24, 0.50, λ)` and `θ = spokeIndex·60° + phase`, hex rim `[0.80, 0.92)` at r 0.13, orbiters `[0.92, 0.97)` on bands 0.37 / +0.05 and 0.56 / −0.05, iris `[0.97, 1.0]`. T1: outer `[0, 0.475)` + inner `[0.475, 0.95)` + iris `[0.95, 1.0]` (47.5 / 47.5 / 5). T3: outer 26 / inner 26 / spokes 22 / hex 11 / orbiters 6 / shimmer ring 6 / iris 3.
- **Quantised motion** implements §4.6: `seg = floor(t / 1.1)`, `frac = fract(t / 1.1)`, `phase = mod(seg, 12)·30° + (1 − (1 − frac)³)·30°`. The `mod(seg, 12)` wrap is an implementation detail (a full turn repeats the 6-fold dial exactly) and prevents float drift over long runs. Only the rim receives the clunk flare (`(1 − frac)⁷`); the inner ring counter-rotates continuously at −0.5× the outer average step rate. Spokes and hex are rigid with the outer phase; orbiters run at ±0.5 rev / 12 s; iris position is fixed with a slow breath.
- **Rigidity classes** are packed into the existing seed byte as §3.4/§7.4 propose: lattice members use spring 3.2 and curl 0.18, orbiters spring 2.2 and normal curl. The panel spring remains authoritative (default 2.6), so the shader applies per-particle multipliers (1.230769 lattice / 0.846154 orbiters) and the registry `curlScale` 0.4 is restored to 1.0 for orbiters by a 2.5× per-particle multiplier. No new textures, passes, draws or allocations; 128 KB ping-pong and 4 draws unchanged.
- **Depth:** rim +0.18, inner −0.15, spokes 0, hex +0.03, orbiters ±0.05, iris +0.06, shimmer 0; the shared `2.1d + 0.5` depth law is unchanged. The dial reads as a raised rim around a recessed core at 1440, 768 and 390.
- **Glyph:** Victor is the first formation to use the documented **diamond** contour (`|q.x|+|q.y|`), carried by a new `vGlyph` varying and a soft/core falloff tuned only for that branch. Every other formation keeps `vGlyph = 0` and its exact previous sprite math (Jin's round/streak, Claudio's streak and Dragunov's chip path are unreached changes in effect).
- **Atmosphere (mode 3):** deep plum module, one hard upper-left lamp at p = (−0.55, 0.60), gaussian core + halo, faint horizontal datum lines (≤ 2% alpha), and a subtle chromatic fringe at the lamp edge. No bloom, no post-process, no Jin sampling. Modes 0–2 are untouched.
- **Interaction:** the lattice resists and snaps back hard; orbiters take the swirl. A two-orbit pointer sweep raised mean displacement 0.088 → 0.135 (max 0.159 → 0.285); it recovered to 0.042 at the quiescent tail of a step, below the pre-disturbance reading. The rim shears during the ease and re-seats before the next step — the intended "clunk", not a defect.
- **UI scope note:** the lab's hero kicker/title/lede were hardcoded to Jin ("Planned / Precision Dial" and "Ember Pillar" for every selection). They are now formation-aware for all ids, so Victor's panel is truthful. This is a narrow lab-only UI fix; production, renderer, dependencies and assets remain untouched.
- **Deviations from this document [owner flag required]:**
  - The hex is drawn as a chord perimeter between the six 60° vertices, not as six isolated vertex clusters. At 1,100 particles the isolated-vertex version read as generic dots; the perimeter preserves the 6-fold rim. Same intent as §3.4's "hexagon rim".
  - The chromatic fringe is a faint lamp-edge ring in the atmosphere, not a rim-locked specular effect. This avoids per-sprite cost and keeps the effect at the documented subtle level; §6.4's "on rim only" is therefore not literal.
  - T1 deliberately omits spokes/hex/orbiters as §3.4 specifies, so it reads as a two-ring dial plus iris rather than the full instrument; quantisation is retained.
  - T3 keeps the two orbiter bands and adds the counter-phase shimmer ring at r 0.44 within the fixed budget; it does not add density or glow compensation.
  - The diamond contour is applied to every Victor component (rim, spokes, hex, orbiters, iris), consistent with §6.4's formation-wide sprite treatment.
- **No R2.5-2 defect recurred:** seeds and lambdas remain half-float-rounded and the JS `victorHome` mirror is bit-exact float32 via `hash11`/`Math.fround`; the analytic and GPGPU captures align.

**Measured (same session, GPU timer over all 4 draws, medians):** Victor 1440×900 T1/T2/T3 = 0.603 / 0.636 / 0.683 ms (budgets 3 / 4 / 5 ms); 768×1024 T2 = 0.495 ms; 390×844 T2 = 0.309 ms. Same-session anchors: Jin 1.030 / 1.066 / 1.112 ms, Claudio T2 1.023 ms, Dragunov T2 1.065 ms. Victor is below Jin in every cell. A direct A/B against the pre-Victor commit (`ba5d328`, temporary worktree, same machine and session) measured Jin T1/T2/T3 at 1.036 / 1.060 / 1.175 ms baseline versus 1.030 / 1.066 / 1.112 ms current (−0.6% / +0.6% / −5.3%), inside the ±10% gate. Absolute timings are ~2.5× the r252-base session for every formation (uniform driver shift). CPU frame medians ≈ 24 ms under `?rafshim` are pacing-limited and reported separately. GPU p95 is noisy; medians are the gate.

**Still pending:** Lars Bolt Filament (R2.5-4); owner visual sign-off of Victor T2; the general per-formation glyph system beyond Victor's diamond branch; Lars pulse envelope.

*R2.5-3 verification: tsc; production build; isolated lab build; shader compile exercised by all four formations in-canvas; tier matrix at 390×844, 768×1024 and 1440×900; required captures (Victor T1 390, T2 1440, T2 768, T3 1440) plus disturbed/recovered, analytic and notimer; four-way switching repeatedly in all directions, while paused, under tier round-trips, with reset determinism (mean Δ 0.005 at sim-time Δ 0.018 s), rejection of `lars` and unknown ids with explicit errors, context loss/restore with Victor preserved and float re-verified, resize 1440→768, render scale 0.75→1.0, reduced motion; zero console/GL errors; Jin, Claudio and Dragunov recaptured and visually unchanged, Jin within the ±10% gate in a direct A/B against `ba5d328`; all captures under `artifacts/motion-lab/verification/` (local only, gitignored).*
