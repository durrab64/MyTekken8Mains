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
| Victor — Precision Dial | Reserved (schema only) | — |
| Lars — Bolt Filament | Reserved (schema only) | — |

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

### Engine and lifecycle
- `setFormation(id)`: registry validation → deterministic re-seed at current `simTime` → float-target re-verify. Switching rides the approved 380 ms wipe; **no cross-blend**, no long morph.
- Jin ↔ Claudio switching verified repeatedly both directions, while paused, under tier round-trips (T1↔T3), under context loss/restore (formation preserved), and reset while Claudio is active. The DOM formation row follows (`aria-pressed`), and `LabStats.formation` / `LabStats.formationName` report the active formation.
- Context loss abandons everything; restore re-compiles, re-uploads shaders in the active formation's mode, re-seeds it, and re-verifies float targets.

### Fallback behaviour

- `?nofloat` → analytic formation-lite per formation (Jin reproduces its geometry; **Claudio reproduces its nested-orbit geometry** — capture `r251-claudio-analytic-1440.png`). Both verified in-canvas; invalid ids → invisible sentinel + explicit panel error.
- `?notimer` → GPU timing hidden as "unavailable", 4 draws unchanged.
- Reduced motion → Tier 0 CSS, no context (formation selector disabled).
- Cross-formation glyph law, pulse envelopes and per-formation stiffness classes remain schema fields, not active behaviour, except Claudio's component partition (implemented).

### Measured performance (this machine, same session, medians; GPU timer covers all 4 draws)

| Cell | Jin (baseline) | Claudio | Dragunov |
|---|---|---|---|
| 1440×900 T1 / T2 / T3 | 0.407 / 0.497 / 0.552 → post-change 0.405 / 0.408 / 0.594 (repeats 0.445–0.527; noise) | 0.444–0.480 / 0.416 / 0.426 | 0.456 / 0.526 / 0.604 (n=80) |
| 768×1024 T1 / T2 / T3 | 0.339 / 0.370 / 0.392 → post 0.341 / 0.315 / 0.451 (repeats 0.335–0.339) | 0.289 / 0.306 / 0.321 | 0.923 / 0.972 / 1.024 (n=80) |
| 390×844 T1 / T2 / T3 | 0.179 / 0.238 / 0.167 → post 0.146 / 0.167 / 0.165 | 0.190 / 0.149 / 0.232 | 0.138 / 0.213 / 0.164 (repeats) |

Jin and Claudio remain within the ±10% median gate throughout. Dragunov's home moves along the y axis at ~0.08 y·s⁻¹ (plus crystal pulses), so mean displacement is dominated by the fall — ≈ 0.27–0.30 versus Jin's ≈ 0.05 and Claudio's ≈ 0.02. CPU frame time is rAF-pacing limited (~17 ms under `?rafshim`); GPU medians are the reported metric. All measurements noise-flagged; this session's absolute timings were uniformly ~2.5× the r252-base baseline (driver-level shift affecting all formations equally).
| Allocation | 128 KB | 128 KB |

Jin remained within the ±10% median gate throughout (worst transient T3 cell ±15% at one sample, verified as noise by repeats). CPU frame time is rAF-pacing limited (~17 ms under `?rafshim`); GPU medians are the reported metric. All measurements noise-flagged.

### Known limitations

- Only Jin, Claudio and Dragunov are functional; Victor and Lars remain inert schema entries.
- The crown halo is an azimuth-rotated vertical ellipse (not a literal y–z plane ring, which would be edge-on and invisible); documented deviation from the R2.5 sketch, same intent and restraint.
- Inclination is ±22° (with radii 0.22 / 0.42 / 0.68), not the sketch's ±14° — the approved render at ±14° was illegible at 1,100 particles; the wider spread keeps planes visually distinct.
- The star is comet-arc distributed (λ spread ±0.45) for directional readability, not a radial lamp — derived from the existing budget per the owner's approved amendment.
- Motes' tangential stretch (Claudio: base 1.32, speed 0.9) is mild and deliberate; Jin's law unchanged.
- Dragunov's fall cycle is `fract(λ + phase + t·fallRate)` with fall rate 0.08–0.12 λ·s⁻¹ — particles recycle by fading at the extremes; the CPU readback metric is dominated by the fall's spring lag (~0.27), not by drift or a defects.
- Dragunov's analytic fallback identity verified in-canvas; invalid ids park invisible (sentinel) + explicit error.
- GPU p95 values are noisy on this machine; treat medians as the gate.
- `motion-lab/index.html` metadata updated to R2.5 Stage 0 in the housekeeping milestone.
