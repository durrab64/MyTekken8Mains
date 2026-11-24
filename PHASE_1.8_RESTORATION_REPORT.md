# Phase 1.8 — Original Formation Restoration & Integration Report

**Repository:** `C:\Tekken mains\MyTekken8Mains-main\MyTekken8Mains-main`
**Branch:** `experiment/r2-graphics-lab`
**HEAD at completion:** `321a38308370c9b82b573d00f9735838b2140d42`
**Mode:** Local implementation only. No commits, pushes, merges, deployments, or package changes were made.

---

## 1. Original source discovery results

All five requested formations were recovered from the Motion Lab source and git history. No original was missing.

| Character | Original formation | Exact original source | Found? | Current production implementation before Stage B | Restoration result |
|---|---|---|---|---|---|
| Jin | Ember Pillar | `src/features/motion-lab/engine/shaders.ts` (`labJinHome`, `formationLambda`, helpers); `formations.ts` (`jinHome`, registry, `TIER_CONFIG`); commit `74588ed` | Yes | Generic non-Lars particle field | Restored |
| Claudio | Radiant Orbit | `shaders.ts` (`claudioComponent`, `claudioHome`, crown/orbiter logic); `formations.ts` (`claudioHome`, registry, tiers); commit `2bf61b4` | Yes | Same generic non-Lars field | Restored |
| Dragunov | Frost Curtain | `shaders.ts` (`dragunovSheetOf`, `dragunovColsFor`, `dragunovColumnBounds`, `dragunovColumnIndex`, `dragunovColumnHash`, `dragunovHome`, crystal pulse); `formations.ts` (`dragunovHome`, sheet config); commit `ba5d328` | Yes | Same generic non-Lars field | Restored |
| Victor | Precision Dial | `shaders.ts` (`victorComponent`, `victorSizeScale`, `victorDialPhase`, `victorClunkEnvelope`, `victorHome`, diamond glyph); `formations.ts` (`victorHome`, registry, tiers); commit `de2bc9d` | Yes | Same generic non-Lars field | Restored |
| Lars | Bolt Filament | `shaders.ts` (`larsComponent`, `larsHome`, pulse/size/glyph); production `src/graphics/shaders.ts` Lars branch; commits `d96c900`, `321a383` | Yes | Approved production implementation | Not modified |

The Motion Lab analytic particle vertex shader is the authoritative original. It evaluates `formationHome()` directly per frame. Production was missing that integration for ids 0–3; its shader branched only for `uFormation == 4`.

Full details are in `PHASE_1.8_ORIGINAL_FORMATION_AUDIT.md`.

---

## 2. Exact files modified

Modified or created in this phase:

- `src/graphics/shaders.ts` — replaced the generic non-Lars particle vertex path with ports of the lab analytic formations (`labJinHome`, `claudioHome`, `dragunovHome`, `victorHome`, component/size/pulse helpers, `restoredHome`), restored the non-Lars fragment soft/core/glyph treatment, and added `uCount`/`uFog` plumbing. The `uFormation == 4` Lars branch remains byte-identical.
- `src/graphics/particles.ts` — added `uCount` and `uFog` uniform lookups, added `uCount` assignment in `drawParticles`, and extended `applyParticleEnv` with an optional recovered palette/size/gain override.
- `src/graphics/engine.ts` — corrected formation plumbing: `uFormationRadius` now receives the lab radius, `uFilaments` now receives the lab tier filament count (`1/4/6`), and non-Lars particle tint/fog/size/gain now use recovered formation palettes. Lars remains on the approved production environment.
- `src/graphics/formationRestoration.ts` — new file carrying the recovered formation radii, tier filament counts, and original Motion Lab particle palettes without overwriting the owner-authored `src/graphics/formation.ts`.
- `PHASE_1.8_ORIGINAL_FORMATION_AUDIT.md` — Stage A audit.

No historical/source files, owner work, reports, checkpoints, or evidence were overwritten.

---

## 3. Original versus restored implementation comparison

The restored non-Lars formations now use the original:

- Geometry and topology: Jin's 2.2-turn ribbed helix with ribbon pairing; Claudio's six-component nested rings, crown, and focal star; Dragunov's three depth-layered vertical column sheets; Victor's counter-rotating dial, six spokes, hex rim, orbiters, and iris.
- Particle generation: stable per-particle seeds and component partitions, tier-aware partitions, no random re-seeding.
- Motion: helix advance and breathing; Kepler-like orbital rates and vertical bob; column fall/dissolve and sheet warp; 30° clunk, continuous inner-ring counter-rotation, and opposed orbiter motion.
- Tier behavior: Tier 1/2/3 component and column partitions and particle counts (`450/1100/2200`).
- Color and lighting: recovered per-formation palettes and per-component gain/alpha laws.
- Scale/position: lab radii (`Jin .34`, `Claudio .63`, `Dragunov 1.25`, `Victor .5`) and stage-scale transform.
- Crystal pulse, Victor clunk flare, and iris breathing are restored.
- Pointer interaction now uses the lab defaults (`radius .22`, `strength 4.2`, `swirl 2.1`).

Production remains a single analytic instanced-quad renderer. The original Motion Lab GPGPU spring simulation was not imported; the restoration reproduces the original analytic geometry, motion, tiering, and shading within the existing production pipeline.

---

## 4. Claudio issue root cause and fix

**Root cause:** Claudio selection, route, environment, label, and formation index were synchronized. The production particle shader simply had no Claudio geometry branch; all non-Lars ids fell through to the generic drifting field. The `uFormationRadius`/`uFilaments` plumbing was also wrong because `formation.detailValue` was passed for both.

**Fix:** Added the `claudioHome` branch and corrected the plumbing. Direct navigation to `#claudio`, switching into Claudio, and refresh now render Radiant Orbit in the dedicated right-side viewport. No route, renderer-state, or hash desynchronization was found.

---

## 5. Character-by-character restoration status

- **Jin — Ember Pillar:** RESTORED — VISUAL REVIEW REQUIRED
- **Claudio — Radiant Orbit:** RESTORED — VISUAL REVIEW REQUIRED
- **Dragunov — Frost Curtain:** RESTORED — VISUAL REVIEW REQUIRED
- **Victor — Precision Dial:** RESTORED — VISUAL REVIEW REQUIRED
- **Lars — Bolt Filament:** NOT MODIFIED

All four non-Lars formations now render their original geometry and identities. Owner visual approval has not been claimed.

---

## 6. Browser validation results

Validation was performed in the local browser at `http://localhost:5173/`.

Technical results:

- TypeScript: pass.
- Production build: pass.
- Shader compile/link: pass.
- WebGL errors: none (`gl.getError() === 0`).
- Console errors: none.
- Failed asset requests: none observed.
- Canvas/renderer/RAF count: one canvas, one renderer, one loop.
- Horizontal overflow: none observed.
- Reduced-motion: CSS fallback activated (`fxReason=reduced-motion`).
- WebGL context loss: CSS fallback activated (`fxReason=context-lost`), `gl.isContextLost() === true`.
- Direct hash loading: pass for all five characters.
- Refresh on `#claudio`: pass.
- Switching sequence Jin → Claudio → Dragunov → Victor → Lars → Jin: pass.
- Tier switching T1/T2/T3: pass; Jin shows single ribbon at T1 and triple helix at T3.
- Responsive validation: pass at 1440×900, 1920×1080, 768×1024, and 390×844.

Evidence is stored in:

- `evidence/phase-1.8/stage-a/` (original lab vs production before screenshots)
- `evidence/phase-1.8/stage-b/` (restored formation captures)
- `evidence/phase-1.8/stage-e/` (responsive, switching, tier, fallback, context-loss captures)
- `evidence/phase-1.8/stage-f/` (Lars before/after captures)

---

## 7. Lars regression comparison

Lars was protected and left unchanged.

Verification:

- The production Lars vertex branch is byte-identical before and after restoration.
- The production Lars fragment branch is byte-identical before and after restoration.
- Lars trunk, two forks, barbs, sockets, component partition, 2.2s pulse, tier behavior, colors, and placement remain unchanged.
- Before/after screenshots at the same 1440×900 tier-2 viewport show the same Bolt Filament identity.
- No shared change altered Lars rendering output.

Lars status: NOT MODIFIED.

---

## 8. Known limitations or unrecoverable originals

- No original formation was missing.
- The production renderer remains analytic; the Motion Lab's optional GPGPU spring simulation was intentionally not imported because production architecture must remain single-context/single-RAF and analytic.
- Formation particle sizes and pointer displacement were adapted to the production viewport coordinate system while preserving the recovered geometry and component laws.
- Final visual approval is left to the owner.

---

## 9. Changes intentionally not made

- No Git commits, pushes, merges, or deployments.
- No package installation.
- No Lars geometry, color, pulse, tier, or rendering changes.
- No overwrite of owner files, checkpoints, reports, or historical evidence.
- No destructive Git operations.
- No removal of Phase 1.7 atmosphere, CSS grading, or hero composition.
- No new dependencies.
- No fabrication of missing formations.

---

## Final statement

The original Jin, Claudio, Dragunov, and Victor formations have been restored into the approved Phase 1.6 hero composition using the recovered Motion Lab source. Lars remains unchanged. Technical validation passes; visual approval remains pending with the owner.
