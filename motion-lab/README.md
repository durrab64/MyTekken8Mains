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

## R2.5-0 shared formation infrastructure

The lab now has the shared infrastructure the five-character formation system
is built on (see `docs/r2-5-five-character-formation-design.md`).

**Formation registry** (`src/features/motion-lab/engine/formations.ts`)

- `FORMATIONS`: data-driven definitions keyed by `FormationId`
  (`jin | claudio | dragunov | victor | lars`). Each carries identity,
  palette, glyph, radius, spring/curl defaults, depth descriptor and
  atmosphere plumbing. **Only `jin` has `implemented: true`.** The remaining
  ids are reserved schema entries with planned palettes — they have no
  geometry, shading, atmosphere or fallback and are not selectable.
- `TIER_CONFIG`: tier → particle counts (450 / 1100 / 2200), filaments, pointer
  radius, octaves. Unchanged.

**Shader architecture** (`engine/shaders.ts`)

- One shared `LAB_FORMATION_GLSL` include with `formationHome()` dispatch and
  an `uFormation` uniform. Jin's branch is the committed R2.4 equation set,
  unchanged. Any other id parks particles at the clamp ceiling and zeroes
  sprite alpha via `formationVisibility()` — nothing is fabricated.
- No per-formation programs are compiled; no recompilation on switch.
- The atmosphere pass has `uAtmosMode / uAtmosAnchor / uAtmosBand / uAtmosPulse`.
  Mode 0 (Jin) renders the existing ember column exactly as before; modes
  1–4 are reserved and intentionally render the neutral backplate only — no
  effects exist for them yet.

**Engine** (`engine/MotionLabEngine.ts`)

- `setFormation(id)`: validates against the registry, re-seeds the GPGPU
  state deterministically at the current `simTime`, and verifies float
  targets again. A refusal leaves the running formation untouched and
  surfaces an explicit error in the panel (`runtimeError`).
- `reset()`, tier switching, context-loss restoration and the analytic
  fallback all re-seed through the same `buildInitialState(..., formationId)`
  path, so the active formation survives every re-init.
- Formation identity is carried in `LabStats.formation` /
  `LabStats.formationName` and in the `__motionLab` test hooks
  (`?test=1&rafshim=1`).

**Selector & switching**

- Formation selector in the controls panel, following the tier-row pattern.
  Only Jin is selectable; the other four appear disabled as "planned".
- Switching performs the approved 380 ms wipe: the stage fades opaque, the
  engine swaps state at midpoint, the stage fades back. There is no
  cross-blend and no long morph. For R2.5-0 the only reachable target is Jin,
  which must re-seed deterministically.

**Analytic fallback**

- Generalized to the formation interface, but only Jin's analytic path is
  implemented and verified. No reduced-identity claim is made for any other
  formation.

## What is *not* implemented (R2.5-0 scope)

- Claudio Radiant Orbit, Dragunov Frost Curtain, Victor Precision Dial,
  Lars Bolt Filament — none of these exist in any form.
- Atmosphere modes for non-Jin formations (neutral backplate only).
- Cross-formation glyph system, per-formation spring/damping classes and
  pulse envelopes are schema fields, not active behaviour.
- Production integration (`src/graphics/*`) is out of scope and untouched.

## Verification

- `npx tsc --noEmit`
- `npx vite build --config vite.motion-lab.config.ts`
- Harness: `motion-lab/harness.html` — `measureTier`, `pointerTest`,
  `formationTest`, `resizeTest`, `contextTest`, `reducedMotionTest`,
  `capabilityTest` (via `window.*`).
- Jin is the regression reference; the approved ±10% GPU-median gate and the
  visual capture set apply before any later formation stage.
