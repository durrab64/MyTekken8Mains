# Motion Lab — isolated WebGL2 formation lab

This page is a development sandbox for the SLEDGE formation system. It is
**not** part of the production app and is never shipped to the site bundle.

- Entry: `motion-lab/index.html`
- Build: `npx vite build --config vite.motion-lab.config.ts` → `dist-motion-lab/` (gitignored)
- Run: dev server, `http://localhost:5174/motion-lab/`
- Measurement harness: `motion-lab/harness.html` (local only; not linked from the lab)

## Architecture at a glance

One WebGL2 context, one canvas, custom GLSL ES 3.0. Per frame: GPGPU
velocity → GPGPU position (64×64 RGBA16F ping-pong, 128 KB) → atmosphere
fullscreen triangle → instanced-quad sprite pass. Four draws. Additive
blending only on the sprite pass; no depth buffer, no post-processing.

## Implemented formations (R2.5)

| Formation | Status | Identity |
|---|---|---|
| Jin — Ember Pillar | Approved reference (R2.4) | 2.2-turn DNA-like double helix; warm ember; spring 2.6 |
| Claudio — Radiant Orbit | Implemented R2.5-1 | Nested inclined orbits; restrained vertical crown halo; luminous focal star; Kepler-like hierarchy |
| Dragunov — Frost Curtain | **Implemented R2.5-2** | Three depth-layered sheets (z = −0.19 / 0.0 / +0.19) of vertical columns; controlled dissolution; crystal-glint sparks; pulse travels one column at a time |
| Victor — Precision Dial | **Implemented R2.5-3** | Counter-rotating dial: quantised 30° clunks, six rigid spokes, recessed hex/iris, free-running orbiter bands; deep violet/cyan |
| Lars — Bolt Filament | **Implemented R2.5-4** | Directional charged cable: one FBM trunk, two forks, gold junction socket glints, travelling root-to-tip charge pulse |

### Claudio — Radiant Orbit (R2.5-1)

Nested orbital system, distinctly different from Jin's helix:
- **Components** (seed-range partition, no extra allocation; total = tier budget):
  - T2 canonical: star 8% (≈0.058 radius gaussian cluster, comet-like arc sweeping the inner orbit at λ spread ±0.45), Ring A 26% (r 0.22, +22° inclination, rate 0.10 rad·s⁻¹), Ring B 36% (r 0.42, face-on, 0.07), Ring C 20% (r 0.68, −22°, 0.045), crown 10% (vertical hoop, r 0.46, azimuth 62° about y, z-offset −0.05, rate 0.03).
  - T1 lite (450 particles): star + Ring A only (star 22%).
  - T3 high (2 200): star 7% / A 23% / B 30% / C 16% / crown 12% / faint counter-rotating orbiter band at r 0.56 (rate −0.055).
- **Depth:** inclination separates ring planes in z (sin 22° × r → Δz ≈ ±0.25 for C); the shared depth law (`2.1d + 0.5`) applies. Crown sits behind the star plane; far side fogged per shared fog rule.
- **Component shading** (sprite pass): star = hot pale-gold toward white, tiny sprites (size scale 0.80), bright; Ring A/B = steel blue with gold-ward mix for A; Ring C = gold-ward, fog-dimmed; crown = pale faint, alpha 0.50; orbiter = faint two-tone. Sparks (star + hash > 0.94) = glint cores (`vHard`).
- **Motion:** constant angular rates, inner faster (Kepler-like); orbits rise/fall in z per inclination; bounded vertical bob (±0.018) instead of unbounded drift; **no wind ascent, no helix**. Resting displacement ≈ 0.02 (Jin ≈ 0.06) — orbits hold their shape tighter at rest.
- **Interaction:** the shared gaussian disturbance pushes particles tangentially along orbits; recovery is circular — disturbed particles re-seat into rings in ~300–450 ms (measured mean displacement 0.026 → 0.109/0.164 during, recovered to 0.023/0.028).
- **Atmosphere (mode 1):** near-black indigo void, tight star glow (`exp(-r2·3.4)·0.115`), broad halo (`·0.055`), faint horizontal cross glint, fbm haze. Jin's mode 0 output unchanged.

### Dragunov — Frost Curtain (R2.5-2)

Layered frozen-curtain, structurally distinct from Jin's helix and Claudio's rings:
- **Sheets:** three depth-separated sheets (far z = −0.19, mid 0.0, near +0.19) with per-sheet x span (−1.15/1.15, −1.25/1.25, −1.35/1.35) and column counts (6/7/7 at T1/T2/T3). T1 = mid sheet only; T3 adds 9-column subdivision and ~8 % drifting fragments.
- **Columns:** hash-assigned per particle (`floor(hash11(seed·13.7 + sheet·91 + 7) · cols)`), the span is hash-jittered ±0.05 per column and cross-sectioned with a tight gaussian (≈ ±0.022 + 0.005·sheet index).
- **Motion:** λ lives in a linear sawtooth fall — home y descends from +0.98 → −1.08 over ≈ 8–12 s; a bounded vertical bob (±0.018) reads as sway; a crystal pulse (0.45 – 0.77 Hz, never near ≈ 3 Hz) travels down one column at a time, only on the far/mid/near sheet rotating round-robin.
- **Dissolution:** α fades in at the crown and fades out at the base as `fract(λ + phase + t·fallRate)` goes 0 → 1, so every column recycles invisibly; per-column `lengthMul` (0.78 – 1.0) shortens columns at random, controlled, localized fashion.
- **Shading:** chips read tight (size scale 0.80 glints / 0.92); far sheet is fog-steel, mid is steel-blue, near is steel with frost tint; ~6 % of chips are frost-white glint cores (`spark`). α per sheet: far ≈ 0.7, mid ≈ 0.95, near ≈ 1.15.
- **Depth:** far sheet carries the strongest fog-mix and slowest size falloff; near sheet is largest and clearest; shared depth law unchanged.
- **Atmosphere (mode 2):** steel-cold void with a faint low "low-sun" slit at the base, vertical fbm streak haze, subtle vignette. Jin mode 0 and Claudio mode 1 unchanged.
- **Interaction:** same shared gaussian disturbance; fall dominates mean displacement (expected ≈ 0.25–0.3; jin ≈ 0.05 since it barely moves). Cursor leaves a coherent swirled cavity that springs back with the column intact.
- **Analytic fallback (`?nofloat`):** same geometry, verified identical visuals (capture `r252-dragunov-analytic-1440.png`); formation switching and reset work.

### Victor — Precision Dial (R2.5-3)

A quantised mechanical dial, structurally distinct from the helix, the orbits and the curtain:
- **Components** (seed-range partition; total = tier budget, no extra allocation):
  - T2 canonical: outer rim 28% (r 0.50, z +0.18, violet), inner ring 28% (r 0.24, z −0.15, cyan), spokes 24% (r 0.24→0.50, six at 60°), hex rim 12% (chord perimeter at r 0.13), orbiters 5% (bands at 0.37/+0.05 and 0.56/−0.05), iris 3% (σ ≈ 0.018 gaussian core).
  - T1 lite (450): outer 47.5% + inner 47.5% + iris 5% — the rings-and-iris identity holds; quantisation is retained.
  - T3 (2 200): outer 26% / inner 26% / spokes 22% / hex 11% / orbiters 6% / counter-phase shimmer ring 6% (r 0.44) / iris 3%. Detail, not density or glow, is added.
- **Motion:** `victorDialPhase(t) = mod(segment, 12)·30° + easeOutCubic(fract)·30°` every 1.1 s — a stepped clunk, not a smooth drift. The inner ring counter-rotates continuously at −0.5× the outer average step rate; spokes and hex stay rigid with the outer phase; the two orbiter bands are the only smooth element (±0.5 rev / 12 s); iris position is static with a slow breathing twinkle. Only the rim flares on the clunk.
- **Stiffness:** lattice members (rings/spokes/hex/shimmer/iris) run at spring 3.2 and curl 0.18 through per-particle multipliers on the authoritative panel spring (default 2.6) and the registry `curlScale` 0.4; orbiters run at spring 2.2 and normal curl (per-particle ×2.5). The class is derived from the existing seed byte — no texture or storage growth.
- **Shading/glyph:** diamond sprite contour (`|q.x|+|q.y|`) for Victor only, carried by a new `vGlyph` varying; violet rim, cyan inner/hex, mixed spokes, faint orbiters, hot cyan-white iris. Every other formation keeps its exact sprite path (`vGlyph` = 0).
- **Atmosphere (mode 3):** deep plum module, one hard upper-left lamp at (−0.55, 0.60), faint horizontal datum lines (≤ 2% alpha), subtle chromatic fringe at the lamp edge, vertical plum→fog gradient. No bloom and no Jin sampling.
- **Interaction:** the machine resists — lattice particles push and snap back hard; orbiters take the swirl more gracefully. Measured mean displacement 0.088 → 0.135 during a two-orbit sweep, recovered to 0.042 at the quiescent tail of a step. The rim shears briefly during each ease (spring lag), then re-seats; symmetry and quantisation survive the disturbance.
- **Analytic fallback (`?nofloat`):** the dial geometry is reproduced (capture `r253-victor-t2-1440-nofloat.png`); switching and reset are intact. `?notimer`, reduced motion, resize and render-scale changes also pass with Victor active.

### Lars — Bolt Filament (R2.5-4)

A directional charged cable, structurally distinct from the helix, the orbits, the curtain and the dial:
- **Components** (seed-range partition; total = tier budget, no extra allocation):
  - T2 canonical: trunk 60% (two interleaved strands, y ∈ [−1.18, +1.18]), fork A 18% (forks at y = +0.35, diverges right), fork B 18% (forks at y = −0.30, diverges left), socket A 2% + socket B 2% (~22 particles each at 1,100; persistent bright junction points).
  - T1 lite (450): trunk 72% / fork A 12% / fork B 12% / sockets 2% each — simplified but still a trunk-and-fork silhouette; no sub-branches. See the deviations below: this supersedes the design doc's "trunk only" drop list, per the stage brief's Tier 1 requirement.
  - T3 (2 200): trunk 54% / fork A 15% / fork B 15% / four sub-branches 3% each (A1/A2 on fork A at parent f = 0.22/0.52; B1/B2 mirrored) / sockets 2% each. Detail, not density or glow.
- **Geometry:** trunk `x(y,t) = 0.30·signedFbm(y·2.6 + t·0.8) + 0.16·sin(y·4.3 + t·3.1) + 0.05·sway(t) + 0.30·y` over y ∈ [−1.18, +1.18], two interleaved strands (±0.035 in-plane, ±0.045 z; filament parity `fi % 2`). Forks start at their trunk junction (`x = larsTrunkX(junctionY, t)`) and diverge outward monotonically, `x = join + side·(0.70·f) + side·0.12·smoothstep(0.82,1,f) + 0.20·fbm(y·3.6 + t·1.2 + side·4.7)·f`, f ∈ [0,1] over y ∈ [junction, +1.18] — junction-to-tip by construction, with an end-of-fork tip flick. Sub-branches leave the parent fork at f = 0.18–0.52 and fan outward (spread 0.30–0.42, end y 0.88–1.12, fbm amplitude ±0.16). The whole formation leans 0.30 over its height (the brief's "dominant diagonal energy path").
- **Motion:** the structure is mostly stable — the drama is the pulse. A 2.2 s root-to-tip charge front (≈0.45 Hz) travels as a brightness envelope `fract(t/2.2 − λ)` with λ-width 0.18: on the trunk/sockets from root to tip, on forks/sub-branches from junction to tip. Shading-only, never a force term; the spring never sees it. Tier 3 alternates one socket pop per pulse (0.45 Hz maximum, in the ≤0.5 Hz rule); T3's sockets are capped per junction (`vAlpha ≤ 2.30`) against additive blow-out; the shared brightness clip applies.
- **Interaction:** the cable bends like a cable. Trunk/sockets run spring 3.0 (per-particle ×1.1538 on the panel spring), forks/sub-branches spring 2.2 (×0.8462), curl scale 0.7 (registry) — the disturbance sweeps the cable into coherent arcs and it snaps back. Measured mean displacement 0.104 → 0.242 during a two-orbit sweep, back to 0.100 after 1.6 s (baseline ≈ 0.10 in this scene). Resting displacement ≈ 0.05–0.10 dominated by fbm/wave drift.
- **Shading/glyph:** blue-white cable (uTintA → uTintB shallow mix); gold is reserved to the socket glints (persistent) and the travelling charge front (temporary). Sockets render as a custom four-point gold glint carried by `vGlyph = 2` inside the existing sprite quad — no new program, no new glyph enum; Victor's `vGlyph = 1` diamond path is untouched. Per-socket alpha cap 2.30 before the shared brightness clip.
- **Atmosphere (mode 4):** storm-grey diagonal void, two fbm band layers drifting with t, a key light that travels root-to-tip with the pulse, a faint diagonal path glow, and an arrival micro-lift at the tip (+ root afterglow) through `uAtmosPulse` — total pulse contribution capped at `uGlow × 0.052`, far below the 8% luminance ceiling. Other formations keep `uAtmosPulse = 0`.
- **Analytic fallback (`?nofloat`):** same geometry (capture `r254-lars-analytic-1440.png`); Lars sprites align to the filament tangent instead of the resting velocity (which is degenerate on a mostly-static formation — every other formation keeps the shared velocity-orientation path). Grainier than GPGPU (no integration) but recognizable and correct; switching, reset and rejection paths verified. `?notimer`, reduced motion, resize and render-scale pass.

### Engine and lifecycle
- `setFormation(id)`: registry validation → deterministic re-seed at current `simTime` → float-target re-verify. Switching rides the approved 380 ms wipe; **no cross-blend**, no long morph.
- Jin ↔ Claudio ↔ Dragunov ↔ Victor ↔ Lars switching verified repeatedly in all directions, while paused, under tier round-trips (T1 ↔ T2 ↔ T3), under context loss/restore (formation preserved), and reset. The DOM formation row follows (`aria-pressed`), the hero copy is formation-aware, and `LabStats.formation` / `LabStats.formationName` report the active formation.
- Context loss abandons everything; restore re-compiles, re-uploads shaders in the active formation's mode, re-seeds it, and re-verifies float targets.

### Fallback behaviour

- `?nofloat` → analytic formation-lite per formation (Jin reproduces its geometry; **Claudio reproduces its nested-orbit geometry** — capture `r251-claudio-analytic-1440.png`; **Victor reproduces the dial** — capture `r253-victor-t2-1440-nofloat.png`; **Lars reproduces the cable family** — capture `r254-lars-analytic-1440.png`). Verified in-canvas; invalid ids → invisible sentinel + explicit panel error.
- `?notimer` → GPU timing hidden as "unavailable", 4 draws unchanged.
- Reduced motion → Tier 0 CSS, no context (formation selector disabled).
- Cross-formation glyph law, per-formation stiffness classes and the Lars pulse envelope are implemented as documented; other formations' paths are unchanged.

### Measured performance (this machine, same session, medians; GPU timer covers all 4 draws)

| Cell | Jin (baseline) | Claudio | Dragunov |
|---|---|---|---|
| 1440×900 T1 / T2 / T3 | 0.407 / 0.497 / 0.552 → post-change 0.405 / 0.408 / 0.594 (repeats 0.445–0.527; noise) | 0.444–0.480 / 0.416 / 0.426 | 0.456 / 0.526 / 0.604 (n=80) |
| 768×1024 T1 / T2 / T3 | 0.339 / 0.370 / 0.392 → post 0.341 / 0.315 / 0.451 (repeats 0.335–0.339) | 0.289 / 0.306 / 0.321 | 0.923 / 0.972 / 1.024 (n=80) |
| 390×844 T1 / T2 / T3 | 0.179 / 0.238 / 0.167 → post 0.146 / 0.167 / 0.165 | 0.190 / 0.149 / 0.232 | 0.138 / 0.213 / 0.164 (repeats) |

Jin and Claudio remain within the ±10% median gate throughout. Dragunov's home moves along the y axis at ~0.08 y·s⁻¹ (plus crystal pulses), so mean displacement is dominated by the fall — ≈ 0.27–0.30 versus Jin's ≈ 0.05 and Claudio's ≈ 0.02. CPU frame time is rAF-pacing limited (~17 ms under `?rafshim`); GPU medians are the reported metric. All measurements noise-flagged; this session's absolute timings were uniformly ~2.5× the r252-base baseline (driver-level shift affecting all formations equally).
| Allocation | 128 KB | 128 KB |

Jin remained within the ±10% median gate throughout (worst transient T3 cell ±15% at one sample, verified as noise by repeats). CPU frame time is rAF-pacing limited (~17 ms under `?rafshim`); GPU medians are the reported metric. All measurements noise-flagged.

### R2.5-3 measurements (this machine, same session, GPU timer over all 4 draws, medians)

| Cell | Victor | Jin (same-session anchor) | Claudio | Dragunov |
|---|---|---|---|---|
| 1440×900 T1 / T2 / T3 | 0.603 / 0.636 / 0.683 ms | 1.035 / 1.066 / 1.113 ms | 1.023 ms (T2) | 1.065 ms (T2) |
| 768×1024 T2 | 0.495 ms | — | — | — |
| 390×844 T2 | 0.309 ms | — | — | — |

Victor is below Jin in every measured cell and far under the T1/T2/T3 budgets (3 / 4 / 5 ms). A direct A/B against the pre-Victor commit (`ba5d328`) in the same session measured Jin T1/T2/T3 at 1.036 / 1.060 / 1.175 ms baseline versus 1.030 / 1.066 / 1.112 ms current (−0.6% / +0.6% / −5.3%), inside the ±10% gate. The absolute shift versus the earlier tables (~2.5×) affected every formation equally. CPU frame medians were ~24 ms across all cells under `?rafshim` (rAF-pacing limited, reported separately from the GPU timer). GPU p95 remains noisy; medians are the gate.

### R2.5-4 measurements (this machine, same session, GPU timer over all 4 draws, medians; ANGLE D3D11, Radeon)

| Cell | Lars | Jin (same-session anchor) | Claudio | Dragunov | Victor |
|---|---|---|---|---|---|
| 1440×900 T1 / T2 / T3 | 1.092 / 1.144 / 1.307 ms | 1.067 ms (T2) | 1.046 ms (T2) | 1.115 ms (T2) | 0.635 ms (T2) |
| 1440×900 T2 (repeat) | 1.144 ms | 1.082 ms | — | — | — |
| 768×1024 T2 / 390×844 T1 | not timed separately this stage (same draws as the timed cells) | — | — | — | — |

Lars T1/T2/T3 are far under the T1/T2/T3 budgets (3 / 4 / 5 ms). A direct A/B against the pre-Lars commit (`de2bc9d`) in the same session and identical rafshim-iframe protocol measured Jin T1/T2/T3 at 1.045 / 1.070 / 1.118 ms baseline versus 1.048 / 1.082 / 1.131 ms current (+0.3% / +1.1% / +1.2%), inside the ±10% gate. The absolute shift versus the r253-era tables (~2.5×) affected every formation equally; this machine is currently in a slow-timer regime. CPU frame medians were ~17 ms across all cells under `?rafshim` (rAF-pacing limited, reported separately from the GPU timer). GPU p95 remains noisy; medians are the gate.

### Known limitations

- All five formations are implemented and selectable; no formation is reserved in the build.
- Lars Tier 1 keeps simplified forks + sockets (per the stage brief); at 390×844 the outer fork tips crop slightly at the frame edges and one fork may exit the portrait width.
- Lars gold sockets read as white-hot points with a warm fringe rather than a saturated gold dot — deliberate restraint; gold dominates only the charge front at higher gain.
- Lars Tier 3 sub-branches are intentionally fine and dimmer than the forks (detail, not density); they are subtle at small viewports and read best at desktop sizes.
- Lars branch B (lower fork) is the longer fork by construction (spec: spans y = −0.30 → +1.18); the asymmetry is the design, not a bug.
- The analytic fallback is grainier for Lars than GPGPU (no integration, sprite orientation aligned to the filament tangent); geometry and identity hold.
- Lars's trunk adds a 0.30·y diagonal lean not literally present in the design sketch (which prescribes only fbm + sin + sway); it makes the documented "dominant diagonal energy path" readable at 1,100 particles. Documented deviation.
- Lars's forks grow from zero divergence at the junction (they would otherwise float); the spec's fork positions, spans and the 0.20 fbm amplitude are unchanged. Documented deviation.
- The crown halo is an azimuth-rotated vertical ellipse (not a literal y–z plane ring, which would be edge-on and invisible); documented deviation from the R2.5 sketch, same intent and restraint.
- Inclination is ±22° (with radii 0.22 / 0.42 / 0.68), not the sketch's ±14° — the approved render at ±14° was illegible at 1,100 particles; the wider spread keeps planes visually distinct.
- The star is comet-arc distributed (λ spread ±0.45) for directional readability, not a radial lamp — derived from the existing budget per the owner's approved amendment.
- Motes' tangential stretch (Claudio: base 1.32, speed 0.9) is mild and deliberate; Jin's law unchanged.
- Dragunov's fall cycle is `fract(λ + phase + t·fallRate)` with fall rate 0.08–0.12 λ·s⁻¹ — particles recycle by fading at the extremes; the CPU readback metric is dominated by the fall's spring lag (~0.27), not by drift or a defects.
- Dragunov's analytic fallback identity verified in-canvas; invalid ids park invisible (sentinel) + explicit error.
- Victor's hex is drawn as a chord perimeter between the six 60° vertices, not as six isolated dots — at 1,100 particles the isolated-vertex version read as generic points; the perimeter keeps the 6-fold rim legible. Documented deviation from the §3.4 "hexagon rim / 6 vertices" sketch, same intent.
- Victor's chromatic fringe is a faint lamp-edge ring in the atmosphere, not a rim-locked specular effect; this keeps the sprite pass unchanged and the effect restrained. Documented deviation from §6.4.
- Victor's rim visibly shears during each 30° ease and re-seats before the next step — that is the intended mechanical "clunk" (spring lag on a quantised home), not a defect. The recovered capture is taken at the quiescent tail of an interval (`r253-victor-t2-1440-recovered.png`).
- Victor T1 intentionally drops spokes/hex/orbiters (rings + iris only, per §3.4); it reads as a two-ring dial rather than the full six-spoke instrument. T3 adds the shimmer ring/orbiters instead of density.
- Victor's timing was measured with the GPU timer over all four draws; the separate CPU frame medians (~24 ms under `?rafshim`) are pacing-limited and not a formation cost.
- GPU p95 values are noisy on this machine; treat medians as the gate.
- `motion-lab/index.html` metadata updated to R2.5 Stage 0 in the housekeeping milestone.
