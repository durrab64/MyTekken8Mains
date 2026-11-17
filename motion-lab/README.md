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
| Claudio — Radiant Orbit | **Implemented R2.5-1** | Nested inclined orbits; restrained vertical crown halo; luminous focal star; Kepler-like hierarchy |
| Dragunov — Frost Curtain | Reserved (schema only, `implemented: false`) | — |
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

| Cell | Jin (baseline) | Claudio |
|---|---|---|
| 1440×900 T1 / T2 / T3 | 0.407 / 0.497 / 0.552 → post-change 0.405 / 0.408 / 0.594 (repeats 0.445–0.527; noise) | 0.444–0.480 / 0.416 / 0.426 |
| 768×1024 T1 / T2 / T3 | 0.339 / 0.370 / 0.392 (repeats 0.335–0.392) → post 0.341 / 0.315 / 0.451 (repeats 0.335–0.339) | 0.289 / 0.306 / 0.321 |
| 390×844 T1 / T2 / T3 | 0.179 / 0.238 / 0.167 → post 0.146 / 0.167 / 0.165 | 0.190 / 0.149 / 0.232 |
| Allocation | 128 KB | 128 KB |

Jin remained within the ±10% median gate throughout (worst transient T3 cell ±15% at one sample, verified as noise by repeats). CPU frame time is rAF-pacing limited (~17 ms under `?rafshim`); GPU medians are the reported metric. All measurements noise-flagged.

### Known limitations

- Only Jin and Claudio are functional; Dragunov/Victor/Lars remain inert schema entries.
- The crown halo is an azimuth-rotated vertical ellipse (not a literal y–z plane ring, which would be edge-on and invisible); documented deviation from the R2.5 sketch, same intent and restraint.
- Inclination is ±22° (with radii 0.22 / 0.42 / 0.68), not the sketch's ±14° — the approved render at ±14° was illegible at 1,100 particles; the wider spread keeps planes visually distinct.
- The star is comet-arc distributed (λ spread ±0.45) for directional readability, not a radial lamp — derived from the existing budget per the owner's approved amendment.
- Motes' tangential stretch (Claudio: base 1.32, speed 0.9) is mild and deliberate; Jin's law unchanged.
- GPU p95 values are noisy on this machine; treat medians as the gate.
- `motion-lab/index.html` metadata updated to R2.5 Stage 0 in the housekeeping milestone.
