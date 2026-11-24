# Phase 1.8 — Original Formation Discovery Audit (Stage A)

**Repository:** `C:\Tekken mains\MyTekken8Mains-main\MyTekken8Mains-main`
**Branch:** `experiment/r2-graphics-lab`
**HEAD at audit:** `321a38308370c9b82b573d00f9735838b2140d42`
**Mode:** Read-only discovery. No implementation changes were made before this audit.

---

## 1. Discovery result

All five original formations were located. No original is missing.

| Character | Original formation | Exact original source file(s) | Original found? | Current production implementation | Restoration approach |
|---|---|---|---|---|---|
| Jin | Ember Pillar | `src/features/motion-lab/engine/shaders.ts` (`labJinHome`, `LAB_FORMATION_GLSL`, analytic particle main); `src/features/motion-lab/engine/formations.ts` (`jinHome`, registry, `TIER_CONFIG`); historical commit `74588ed` | **Yes** | `src/graphics/shaders.ts` has no Jin geometry branch. All non-Lars ids fall through to one generic drifting field. Route/label are Jin, geometry is generic. | Port `labJinHome` + its component/tier treatment into the production particle shader. Keep one renderer/context/canvas/RAF. |
| Claudio | Radiant Orbit | `src/features/motion-lab/engine/shaders.ts` (`claudioComponent`, `claudioHome`, per-component gain/alpha/tint); `src/features/motion-lab/engine/formations.ts` (`claudioHome` mirror); historical commit `2bf61b4` | **Yes** | Same generic non-Lars field. Label and env select Claudio, shader does not. | Port the six-component orbital system, crown halo, focal star, inclinations, rates, size/gain/tint treatment. |
| Dragunov | Frost Curtain | `src/features/motion-lab/engine/shaders.ts` (`dragunovSheetOf`, `dragunovColsFor`, `dragunovColumnBounds`, `dragunovColumnIndex`, `dragunovColumnHash`, `dragunovHome`, crystal pulse); `src/features/motion-lab/engine/formations.ts` (`dragunovHome`, sheet config); historical commit `ba5d328` | **Yes** | Same generic non-Lars field. Current label reads Frost Curtain but no sheet/column geometry exists. | Port the three depth sheets, stable columns, fall/dissolve, warp, glints, per-column crystal pulse and fog/steel/frost tint. |
| Victor | Precision Dial | `src/features/motion-lab/engine/shaders.ts` (`victorComponent`, `victorSizeScale`, `victorDialPhase`, `victorClunkEnvelope`, `victorHome`, diamond glyph); `src/features/motion-lab/engine/formations.ts` (`victorHome` mirror); historical commit `de2bc9d` | **Yes** | Same generic non-Lars field. Current label reads Precision Dial but no dial geometry exists. | Port the counter-rotating dial, 30° clunk, six spokes, hex chord rim, orbiter bands, iris, diamond glyph and violet/cyan treatment. |
| Lars | Bolt Filament | `src/features/motion-lab/engine/shaders.ts` (`larsComponent`, `larsHome`, etc.); production `src/graphics/shaders.ts` `larsHome`/Lars branches; historical commits `d96c900`, `321a383` | **Yes** | Production already implements Lars geometry, pulse, sockets, barbs, and colors. This is the protected Phase 1.6 implementation. | **Preserve unchanged.** Do not refactor the Lars branch for consistency. Regression-test before/after. |

### Why the Motion Lab is the authoritative original

- `motion-lab/README.md` records Jin as the approved R2.4 reference and Claudio/Dragunov/Victor/Lars as implemented R2.5 formations, with their actual identities (helix, nested orbits, layered sheets, quantised dial, directional cable).
- `docs/r2-5-five-character-formation-design.md` contains the design and verification record for the same five formations.
- Git history contains the implementation commits: Jin `74588ed`, Claudio `2bf61b4`, Dragunov `ba5d328`, Victor `de2bc9d`, Lars `d96c900`, Lars refinement `321a383`.
- The lab source contains complete GLSL geometry, component partitions, motion functions, tier rules and palettes. The production graphics source does not contain equivalents for Jin/Claudio/Dragunov/Victor.

---

## 2. Recovered implementation characteristics

### Jin — Ember Pillar

- **Source:** `shaders.ts` lines ~60–121 (`labJinHome`), lines ~1393–1403 and ~1570–1596 (per-formation color/size), `formations.ts` lines ~63–86 and 241–244 (registry, radius, tier config).
- **Geometry/topology:** vertical 2.2-turn ribbed helix. Adjacent filaments are paired into ribbons: 1 filament at Tier 1 (single ribbon), 4 at Tier 2 (double helix), 6 at Tier 3 (triple helix). Ribbon phase = `(ribbon / ribbonCount) * TAU + (edge - 0.5) * 0.09`.
- **Profile:** `0.30 + 0.70 * sin(pi*lambda)^1.5`, modulated by a secondary sine and a crown taper above `lambda=0.72`. The column is wide through the lower-middle, restrained at the waist, tapered at the crown.
- **Particle generation:** `formationLambda()` warp; stable per-particle radial/angular jitter; ~12% of particles (`seed >= 0.88`) peel outward along the tangent and pulse on a 1.35 Hz sine. No random re-seeding per frame.
- **Motion:** helix angle advances with `lambda * TAU * 2.2 + time * 0.35`, plus ribbon phase; gentle vertical breathing `0.016*sin(time*0.7 + seed*9)`; small rightward belly sway `0.055*sin(lambda*pi*1.2 - 0.35)`.
- **Scale:** `radius = 0.34`; vertical span `[-1.18, 1.18]`; z compressed by `0.58`.
- **Color/lighting:** heat mix from `tintA` to `tintB`, driven by `lambda` and spark; ember core. Alpha floor is higher than the other formations (`0.22 + 0.32*hash`). Spark sprites are slightly smaller and brighter.
- **Tiering:** tier particle counts 450/1100/2200 and filament counts 1/4/6. The analytic path derives rows from `uCount / uFilaments`; no extra allocation.
- **Dependencies:** `uFormationRadius`, `uFilaments`, `uTime`, `uFormation`, `uFormationDetail`, tint uniforms, sprite size/stretch.

### Claudio — Radiant Orbit

- **Source:** `shaders.ts` lines ~123–220 (`claudioComponent`, `claudioHome`), lines ~1395–1403 and ~1571–1603; `formations.ts` lines ~90–112 and 611–718.
- **Geometry/topology:** six components in a seed partition:
  1. focal star — compact comet-like cluster near centre;
  2. ring A — radius 0.22, inclined +22°, counter-clockwise;
  3. ring B — radius 0.42, face-on, phase 2.1;
  4. ring C — radius 0.68, inclined −22°, slow;
  5. crown halo — radius 0.46, narrow vertical/azimuthal plane at 62°, z offset −0.05;
  6. Tier-3 counter-rotating orbiter — radius 0.56, 4° inclination, negative rate.
- **Motion:** constant angular rates (inner faster, Kepler-like); each ring's angle = `TAU*lambda + phase + rate*time + jitter`; bounded vertical bob `0.018*sin(time*0.8 + seed*6)`; z inclination from sine.
- **Particle generation:** stable radial/angular/z jitter; component partition changes with tier (T1 = star + ring A; T2 = star + three rings + crown; T3 adds the orbiter). The focal star is a treatment of existing budget particles, not extra particles.
- **Scale:** outer orbit radius 0.68; crown radius 0.46; star radius ~0.058.
- **Color/lighting:** component hierarchy — star brightest/warm-white, ring A bright cyan-blue, ring B cyan, ring C cooler, crown dim gold/blue mix, orbiter dim. Per-component gain and alpha (star 2.0/2.4, ring A 1.35/2.1, ring B 1.25/1.9, ring C 1.1/1.4, crown 0.85/1.0, orbiter 0.95/1.4). Spark glints.
- **Tiering:** T1/T2/T3 component partitions; counts 450/1100/2200.
- **Dependencies:** `uFormationDetail` for component partition; tint/fog uniforms; per-formation radius is not used for the orbit radii (they are hard-coded in the home function), but the registered envelope radius is 0.63.

### Dragunov — Frost Curtain

- **Source:** `shaders.ts` lines ~222–297 (`dragunovSheetOf`, `dragunovColsFor`, `dragunovColumnBounds`, `dragunovColumnIndex`, `dragunovColumnHash`, `dragunovHome`), lines ~1404–1418, ~1486–1503 and ~1604–1609; `formations.ts` lines ~113–134 and 315–420.
- **Geometry/topology:** three depth-layered sheets at `z = -0.19 / 0.0 / +0.19`; each sheet is a set of vertical columns. Column counts: 6 far, 7 mid, 7 near; Tier 3 subdivides to 9 columns per sheet and adds drifting fragments.
- **Particle generation:** stable `sheet` from seed; stable `columnIndex = floor(hash(seed*13.7 + sheet*91 + 7) * cols)`; stable per-column hash for jitter/length. Particles cycle within columns top-to-bottom from `fract(lambda + phase + time*fallRate*0.5)`.
- **Motion:** linear fall with per-particle rate 0.16–0.24; gentle sheet warp in x and z; lateral sine; T3 fragments drift off-sheet.
- **Scale:** x spans −1.15..1.15 (far), −1.25..1.25 (mid), −1.35..1.35 (near); y 0.98..−1.08; registered radius 1.25.
- **Color/lighting:** fog-drenched far sheet, steel mid, frost-tipped near; `spark` glints mix toward white. Alpha fades in at the crown and dissolves at the base per particle (`spawnFade`, `dissolve`).
- **Tiering:** T1 = mid sheet only; T2 = three sheets; T3 = 9 columns/sheet + fragments. Counts 450/1100/2200.
- **Crystal pulse:** one column at a time fires a bright front down its length. Period 1.8 s (T2) / 1.3 s (T3); sheet = `mod(floor(time/period), 3)`; target column derived from the same stable column hash; Gaussian in y; gain ×(1+1.5·pulse), alpha ×(1+1.1·pulse), spark forced above threshold.

### Victor — Precision Dial

- **Source:** `shaders.ts` lines ~299–427 (`victorComponent`, `victorSizeScale`, `victorDialPhase`, `victorClunkEnvelope`, `victorHome`), lines ~1458–1480, ~1571–1578, ~1589–1601, ~1620–1628; `formations.ts` lines ~136–158 and 422–558.
- **Geometry/topology:** seven components:
  1. outer rim — radius 0.5, z +0.18;
  2. inner ring — radius 0.24, z −0.15, continuous counter-rotation at half the outer average rate;
  3. six spokes — rigid with the outer clunk;
  4. hexagon rim — six chord edges at radius 0.13, rigid with the outer phase;
  5. two free-running orbiter bands — radii 0.37/0.56, opposing half-revolution per 12 s;
  6. iris — tight Gaussian core at centre;
  7. Tier-3 shimmer ring — radius 0.44, counter-phase.
- **Motion:** outer dial uses `victorDialPhase(t)`: 30° step every 1.1 s with cubic ease-out inside each interval, wrapped to 12 steps. Inner ring counter-rotates continuously. Spokes/hex are rigid with the outer phase. Orbiters are the only smooth opposed motion. Iris breathes slowly.
- **Particle generation:** stable radial/angular jitter; component partition by detail. Diamond sprite contour (`|q.x|+|q.y|`) for Victor only, via `vGlyph = 1`.
- **Scale:** outer radius 0.5; rim raised in z; inner ring recessed.
- **Color/lighting:** violet outer rim (`tintA`), cyan inner ring (`tintB`), mixed spokes, white-tinted hex, faint orbiters, bright cyan-white iris. Outer rim flares on each clunk; iris breathes.
- **Tiering:** T1 = outer/inner/iris; T2 adds spokes/hex/orbiters; T3 adds shimmer ring. Counts 450/1100/2200.

### Lars — Bolt Filament (protected)

- **Source:** lab `shaders.ts` `larsComponent`, `larsHome`, pulse/size/glyph; production `graphics/shaders.ts` `larsHome`, `larsComponent`, Lars vertex/fragment branches.
- **Status:** Production already implements the approved Bolt Filament: six-segment trunk, two forks, barbs/sockets, 2.2 s root-to-tip pulse, ice-white junction glints, electric blue body, tier differentiation. This audit does not authorize changing it.

---

## 3. Original versus current production implementation

| Aspect | Original Motion Lab | Current production | Consequence |
|---|---|---|---|
| Non-Lars geometry | `formationHome()` dispatches `labJinHome`, `claudioHome`, `dragunovHome`, `victorHome` | `particleVertexSource` branches only on `uFormation==4` (Lars). Ids 0–3 fall through to the generic drifting block. | Jin/Claudio/Dragunov/Victor render as generic fields. |
| Lars geometry | `larsHome` | Production `larsHome`, with production-specific micro-detail and simplified component partition. | Protected and visually present; not to be refactored. |
| Particle primitives | Instanced quad sprites with velocity-driven stretch, per-formation size scale, glyph contour, core tint, alpha floor, depth tint | Instanced quad sprites, round soft alpha, `vTint` directly, `uFormationGain`; no glyph, no per-formation size scale, no velocity stretch | Restored formations need the lab glyph/size/tint treatment, or they will read as generic dots. |
| Formation radius | `FORMATIONS[id].radius` (Jin .34, Claudio .63, Dragunov 1.25, Victor .5, Lars 1.2), passed as `uFormationRadius` | `applyParticleFormation` passes `formation.detailValue` for both radius and filaments (`graphics/engine.ts:172`; `applyFormationUniforms` repeats it at lines 179–180). | Even with geometry branches, radius/filament values would be wrong. Must plumb the lab values. |
| Filaments | `TIER_CONFIG[tier].filaments` = 1/4/6 | `uFilaments` receives `formation.detailValue` (Jin/Claudio 1/4/6, Dragunov 1/3/9, Victor 1/6/12, Lars 2/6/10) | Jin's strand/ribbon count would be wrong at T2/T3 if the detail values were used. Must use 1/4/6. |
| Tier detail | `uFormationDetail` = 0/1/2; component partitions and pulse periods use it | Same 0/1/2 mapping is plumbed correctly. `tierDetail` values are detail counts, not particle counts. | Keep `uFormationDetail`; do not confuse it with radius/filaments. |
| Palettes | Per-formation palettes in `formations.ts` (Jin warm ember; Claudio blue + gold star; Dragunov steel/frost; Victor violet/cyan; Lars blue/ice) | `environments.ts` Phase 1.7 palettes are more saturated per-character and include `gain`; atmosphere uses them | Particle tint should use the recovered formation palettes for non-Lars. Atmosphere can remain the Phase 1.7 per-character treatment. Lars keeps its current particle colors. |
| Pipeline | Lab can run GPGPU spring simulation or analytic fallback; the analytic fallback evaluates `formationHome` directly every frame. | One analytic instanced-quad pass; no GPGPU textures, no spring. | Restore the original *geometry/motion/shading* analytically. Do not add a second renderer or GPGPU pipeline. Pointer behavior remains the production interaction. |
| Stage scale | `STAGE_SCALE = 0.82`; clip = `vec2(pos.x/aspect, pos.y) * 0.82` | Lars uses `vec2(pos.x/uAspect, pos.y) * 0.82` | Same transform; direct port is safe. |
| Canvas/viewport | Lab canvas is its own stage | One full-bleed canvas with scissor/viewport clipping to `[data-fx-region="hero"]` | Preserve the production clipping; do not add canvases. |

### Shader-level confirmation of the gap

Production `src/graphics/shaders.ts` `particleVertexSource` has exactly one formation branch:

```glsl
if (uFormation == 4) {
  // Lars geometry
  ...
  return;
}
// generic drifting field for every other uFormation value
float size = mix(0.008, 0.026, r3) * uSize * (1.0 - lf * 0.55);
vec2 pos = uOrigin + ...;
...
```

There is no `uFormation == 0/1/2/3` branch. The declared `uFormationRadius` and `uFilaments` uniforms are unused outside the Lars path. This is a missing implementation, not a wrong palette or a viewport bug.

---

## 4. Claudio issue — root cause and reproduction

**Reported symptom:** selecting Claudio shows the correct character and the “Radiant Orbit” label, but the formation does not look like Claudio's original nested-orbit system.

**Determination:** the route, environment, label, and formation index are synchronized. The shader does not implement Claudio's geometry.

Evidence:

1. Direct load `http://localhost:5173/?fx=high#claudio` with the renderer at tier 2:
   - `location.hash = "#claudio"`;
   - `document.body.dataset.env = "claudio"`;
   - hero label = `"Radiant Orbit"`;
   - formation viewport is present;
   - the rendered field is a diffuse drifting particle cluster, not nested rings.
2. Switching `#lars` → `#claudio` updates the environment and label to Claudio immediately; the field remains the same generic field. There is no stale Lars cable and no wrong-character formation.
3. The uniform index is correct in source: `FORMATION_INDEX = { jin:0, claudio:1, dragunov:2, victor:3, lars:4 }`; `currentFormationState()` returns `index = FORMATION_INDEX[id]`; `applyParticleFormation()` passes that index to `uFormation`. The shader simply ignores values 0–3.
4. The production `applyParticleEnv` also receives `formation.detailValue` as both `formationRadius` and `filaments`, so the radius/filament plumbing is wrong. This is a secondary defect that would distort the restored formations even after adding branches.

**Conclusion:** the Claudio issue is **not** a selection desync and **not** another character's formation. It is the production shader's missing non-Lars geometry, compounded by incorrect radius/filament uniform plumbing. The fix is the Stage B port plus the plumbing correction, not a UI or routing change.

**Evidence files:**

- `evidence/phase-1.8/stage-a/prod-claudio-tier2.png` — production Claudio, tier 2: generic field.
- `evidence/phase-1.8/stage-a/lab-claudio-tier2.png` — lab Claudio, tier 2: nested rings + focal star.
- `evidence/phase-1.8/stage-a/prod-jin-tier2.png` / `lab-jin-tier2.png`
- `evidence/phase-1.8/stage-a/prod-dragunov-tier2.png` / `lab-dragunov-tier2.png`
- `evidence/phase-1.8/stage-a/prod-victor-tier2.png` / `lab-victor-tier2.png`
- `evidence/phase-1.8/stage-a/prod-lars-tier2.png` / `lab-lars-tier2.png`

The lab captures were taken with the Motion Lab at tier 2 (1100 particles) and the production captures with `?fx=high` followed by `setQuality('tier2')`, so the comparison is at the same canonical tier.

---

## 5. Missing or unrecoverable source

**None.** Every original requested formation is present in the working tree and in git history. The only gap is production integration: the production shader never received the non-Lars formation bodies.

No substitute geometry is authorized. The restoration must port the lab implementations, not invent new fields.

---

## 6. Proposed restoration plan

1. **Preserve the Lars branch.** Keep the production `uFormation==4` vertex and fragment paths byte-equivalent in behavior. Do not rewrite `larsHome`, its component partition, pulse, barbs, sockets, colors, or size law.
2. **Port the lab formation GLSL.** Add the shared helpers and the four non-Lars home functions (`labJinHome`, `claudioHome`, `dragunovHome`, `victorHome`) plus their component/size/pulse helpers to the production particle vertex shader.
3. **Add a non-Lars vertex branch.** For ids 0–3, derive `lambda`, `seed`, `filament`, `home`, motion, per-formation spark/gain/alpha/color, size and glyph exactly as the lab analytic path does. Keep the existing generic branch as an unreachable/defensive fallback only.
4. **Restore glyph/core shading for non-Lars.** Port the lab fragment's soft/core/glyph treatment (Victor diamond, Jin/Claudio/Dragunov soft sprites), while leaving the `uFormation==4` fragment path unchanged.
5. **Correct plumbing.** Pass the registered formation radius and `TIER_CONFIG` filament count (1/4/6) to `uFormationRadius`/`uFilaments`. Keep `uFormationDetail` as the 0/1/2 detail selector.
6. **Use recovered particle palettes for non-Lars.** Particle tint/fog should come from the lab formation palettes so Claudio's warm star, Dragunov's steel/frost, Victor's violet/cyan and Jin's ember read correctly. Page atmosphere remains the Phase 1.7 per-character treatment. Lars particle colors remain exactly as now.
7. **Keep architecture.** One renderer, one WebGL context, one canvas, one RAF, existing scissor/viewport, tier governor, fallback, reduced-motion, and context-loss behavior. No packages.
8. **Validate.** Stage E: all hashes, switching, refresh, 1440×900 / 1920×1080 / 768×1024 / 390×844, fallback, reduced motion, context loss, shader/console errors. Stage F: explicit Lars before/after comparison at Tier 2.

---

## 7. Stage A gate

The original source for every requested formation is identified, and no original is missing. Stage B may proceed. The production gap is documented above; it is a missing integration, not a reason to fabricate replacements.
