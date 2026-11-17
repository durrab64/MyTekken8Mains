# R2.1 — Graphics Research & Technical Design

**Milestone:** R2.1 (research & design only)
**Project:** SLEDGE — My Tekken 8 Mains
**Branch / base:** `migration/react-typescript` at `f12e84164da863c16d7d6f86932311ce1234bf01` (parent `33bb202038a146406b64eded753e46ea0e397465`)
**Status:** Specification. No graphics code, dependency change, asset change, implementation, commit, push or deploy is authorized by this document.

## Legend — confidence of every claim in this document

| Tag | Meaning |
|---|---|
| **[Repo]** | Confirmed fact, verified in the working tree at `f12e841` (committed state). |
| **[Ext]** | External, documented capability or measurement (linked in §14). |
| **[Proposed]** | Design decision proposed for R2.2+; not implemented; requires owner sign-off. |
| **[Assumption]** | Unverified claim / estimate; explicitly not a measurement; must be validated in the prototype. |

---

## 1. Executive summary

**[Repo]** The current graphics system renders a fullscreen procedural atmosphere (per-character `deep`/`fog`/`glow`/`vein` "mode" shaders + hash-based fbm), layered with a single instanced-draw, trig-only particle system, into one fullscreen WebGL2 canvas owned by an isolated renderer (`src/graphics/engine.ts`). It is fast (GPU pass ≈ 1.8–3.0 ms p95 at 1152×648 on the owner's shared AMD iGPU, measured via `EXT_disjoint_timer_query_webgl2`), tiny (≈ 58 KB gzip total JS), and functionally complete (tiers, context loss, art masks, fallbacks).

**[Repo]** Its weakness is deliberate: particles are stateless, share one soft-radial sprite, distribute as a uniform cloud, have no formations, no temporal persistence, no depth, and no fluid interaction. The owner's brief is a more sculpted, cinematic, interactive GPU particle environment ("AXON-inspired"), while keeping the five-character identity and all existing behavior.

**[Proposed]** The recommended architecture keeps the custom WebGL2 engine and adds a minimal GPGPU simulation (ping-pong position/velocity textures) plus parametric, SDF-derived **formations** (one per character) driven to their slots by formation targets, held together by spring physics, and disturbed by the cursor through a bounded force with natural recovery. No third-party rendering dependency is added. Estimated complexity: moderate; estimated GPU-state increase: ≤ 4 MB beyond the existing art texture; estimated frame cost: target ≤ 5.0 ms Tier3, with a cheaper formation-free fallback at Tier1.

**[Proposed]** The current `?art=on` silhouette halo (four taps at LOD3) remains the sole interaction between WebGL and artwork; formations never replace or occlude the DOM artwork. Tier0/reduced-motion remain CSS-only with no context created.

**[Proposed]** Before integration, an isolated prototype (`motion-lab` style, not shipped, not in this milestone) validates one sculpted formation (proposed: Jin's ember pillar), cursor disturbance, recovery, depth layering and a performance panel — on the owner's own hardware.

**Explicit owner decisions required** are listed in §13: architecture choice, budget ceilings, performance targets vs. current measured headroom, five formation art directions, prototype cadence, and integration timing.

---

## 2. Existing renderer audit

All items in this section are **[Repo]** unless flagged.

### 2.1 Files and sizes (committed state, `f12e841`)

| File | Purpose | Lines (approx.) |
|---|---|---|
| `src/graphics/engine.ts` | `createRenderer()` — WebGL2 boot, tiers, loop, governor, context lifecycle, React-facing `Renderer` interface | 663 |
| `src/graphics/shaders.ts` | `ART` flag; atmosphere vertex/fragment GLSL (modes 0–4 + art halo); particle vertex/fragment GLSL | 10 (one huge literal each) |
| `src/graphics/particles.ts` | Particle program, compile, `applyParticleEnv`, instanced draw | 82 |
| `src/graphics/environments.ts` | Typed `EnvironmentConfig` ×5 (colors, mode, origin/dir/swirl/size/sharp/tints) | 24 |
| `src/graphics/fallback.ts` | `CSS_ENVIRONMENTS`, `normalizeEnvironment`, `isReducedMotion`, `activateCssFallback` | 19 |

### 2.2 Rendering pipeline (as shipped)

```
requestAnimationFrame(frame)
        │
        ├─ frameDeltas (90-entry ring) → governor (step down > 24 ms, step up < 12 ms; 900 ms cooldown)
        ├─ wipe: 380 ms ease-out-cubic color/mode crossfade on environment change
        ├─ pointer smoothing (ptrW) → uPointer eased exponentially
        └─ heroVisible gate (IntersectionObserver on <main>)
                 │
                 ├─ atmosphere: gl.drawArrays(TRIANGLES, 0, 3)   [fullscreen fbm + mode + art halo]
                 └─ particles:  gl.drawArraysInstanced(TRIANGLES, 0, 6, count)
                                   └─ blend: SRC_ALPHA, ONE (additive), no depth writes
```

### 2.3 Atmosphere fragment shader (per character, `uMode`)

All modes share the same skeleton: `hash21`/value-noise fbm (`uOctaves` 3/4/5 by tier), `col = mix(uDeep, uFog, …) → mix(uGlow*0.55, …) → mix(uVein, …)`, pointer rim `uGlow*0.045*pl`, `uWipe` sweep, `col*` 1.0−edge vignette, then per-mode composed features:

- mode 0 **Jin** — ember pillar: `pil` (wide `exp(-pow((p.x-0.62)*4.3,2))` band) + `cr` (thin hot core `*11.0`) with `pu = 0.72+0.28*sin(uTime*0.85)` flicker; `fl` downward-fading rim light; corner graze `ke`.
- mode 1 **Claudio** — light rays: `ry` (pow-attenuated vertical-ish rays `*fm(p*3.0+vec2(0.0,t*0.4))`), `bd` horizon band.
- mode 2 **Dragunov** — low sun: `sn` (`exp(-pow((p.y+0.74)*6.0,2)) * exp(-pow((p.x+0.72)*2.4,2))`), `uFog*0.5` cool grade bottom.
- mode 3 **Victor** — blade: `bl` (horizontal band `exp(-pow((p.y-0.55-0.18*sin(t*0.24))*7.0,2)) * exp(-pow(abs(p.x)*2.1,2))` vein), `sp` central spine glow.
- mode 4 **Lars** — storm: `bd` top band × `jg` (`fm(p*vec2(9.0,26.0)+vec2(t*3.2,0.0))` streaks) × `ev` (flashing `0.5+0.5*sin(uTime*1.7+floor(t*2.0))`).

**[Repo]** All of this is one 2D, fullscreen `48`-pixel smoothness — high visual cost is dominated by fbm cost, not by particles.

### 2.4 Particle system (as shipped)

**[Repo]** Stateless; no temporal persistence; positions are analytic functions of time:

```
sd   = gl_InstanceID*13.37 + uSeed*91.7
r152 = h11(sd+1.0), r232 = h11(sd+2.0), r3 = h11(sd+3.0)
lf   = fract(uTime/(9.0 + r3*7.0) + r2)            # per-particle life phase
pos  = uOrigin + vec2((r1-0.5)*0.82, (r2-0.5)*0.2) + uDir*lf
pos.x += sin(uTime*0.9 + sd*6.1 + lf*9.4)*uSwirl*0.055
pos.y += cos(uTime*0.65+ sd*3.7 + lf*7.9)*uSwirl*0.04
dp   = pos - (uPointer*2.0-1.0); dp.x *= uAspect  # pointer refraction
inf  = 1.0 - smoothstep(0.0, 0.42, dl)             # broad repel halo
size = mix(0.008, 0.026, r3)*uSize*(1.0-lf*0.55)
vFade= smoothstep(0.0,0.14,lf)*(1.0-smoothstep(0.72,1.0,lf))
vSpark= 0.08 + 0.92*pow(r1, uSharp) + inf*0.22
vTint= mix(uTintA, uTintB, r3*r3*0.75)*(0.65+0.5*r2)
gl_Position = pos + vQuad*size*2.0                 # soft round sprite
```
Fragment: `a = exp(-d*d*9.0)*vFade*(0.07+0.6*vSpark); outColor = vec4(vTint, a);` additive blend.

**[Repo]** Consequences: a uniform cloud, not a formation; no two moments share a topology; cursor interaction is a passive repel, not a fluid exchange; no particle-particle coupling; no bounce/bounce-like dynamics; no recovery (particles never "remember"); `uSeed` changes per environment-switch (via `Math.random()*1000`), so all particles jump on every character change; counts 450/1100/2200 by tier.

### 2.5 Contexts, canvases, lifecycle

**[Repo]** One `<canvas id="fx">`, one `webgl2` context (`antialias:false, depth:false, stencil:false, alpha:false, powerPreference:'high-performance', failIfMajorPerformanceCaveat:false`), two live programs (atmosphere + particles), one instanced draw per frame for particles + one fullscreen triangle for the atmosphere. No `EXT_color_buffer_float` is queried; no FBO ping-pong exists. Only `EXT_disjoint_timer_query_webgl2` is queried (GPU timer, used by the harness for measurement). Context loss/restore hooks Tear-down (`teardownGl(1)` skips deletes, disposes, CSS fallback) and restore (`bootBackend('restored')` re-compiles, re-uploads, re-hooks).

### 2.6 Quality tiers (measured)

**[Repo]**

| Tier | Entry heuristic | resScale | dprCap | octaves | particles | art | measured Tier3-ish backing |
|---|---|---|---|---|---|---|---|
| Tier1 | coarse pointer (mobile) / `<4` cores | 0.25 | 1.25 | 3 | 450 | 0 | 576×324 @ dpr 1.2 |
| Tier2 | 4–7 cores | 0.5 | 1.25 | 4 | 1100 | 1 | 1152×648 @ dpr 1.2 |
| Tier3 | ≥8 cores / `?fx=high` | 0.5 | 1.5 | 5 | 2200 | 1 | 1152×648 @ dpr 1.2 |

**[Repo, GPU pass, iGPU Radeon, dpr 1.2, window occluded, `rafshim=1`]** Jin art-off GPU pass median 2.014 ms / p95 2.335 ms; art-on 2.051 / 2.344; Claudio ≈ 2.6–2.8 / 3.1–3.3; Dragunov ≈ 1.8–2.0 / 2.1–2.5; Victor ≈ 2.3–2.7 / 2.6–3.9; Lars ≈ 2.26 / 2.5. All comfortably under the 6.0 ms Tier3 target (non-CPU-pacing numbers; the desktop window was occluded during measurement).

**[Repo]** GPU loads measured with `EXT_disjoint_timer_query_webgl2` (same class of timer the engine already walks). Deleting art mipmaps/restore re-init measured: programs 2→4, mipmaps 2→4, draws resume without errors — recovery works.

### 2.7 Test hooks and harness

**[Repo]** `?test=1` exposes `window.__renderer` and `window.__shaders` for the external browser harness (inert otherwise; verified: production page exposes neither without the flag). Harness (probe, mask-injector, rAF shim, corner test) lives outside the repo.

### 2.8 Ceilings and adjacent constraints

**[Repo]** JS bundle: **179.79 kB unminified / 58.49 kB gzip** (`index-D78yxA1R.js`), 23.61 kB CSS (5.75 kB gzip), 1.77 kB index.html. GPU-state: atmosphere program only + optional 800×941 art texture (≈ 2.85 MB RGBA8 + mipmaps) + 1×1 placeholder. No depth buffer. `docs/spec.md` §8.1 authorizes the five-character art-mask exception; no other custom textures permitted; no new assets; no new dependencies authorized by R1.x; the 40,960-byte ceiling was retired at migration (R2.x has no byte ceiling, but bundle discipline still matters for a portfolio site).

### 2.9 Opportunities identified for reuse vs. replacement

**Reuse as-is:** renderer factory, context lifecycle (incl. lost/restore), tier governor, wipe, `IntersectionObserver` gating, art-mask pipeline (upload/LOD3 halo/rect), `?art=on` gating, React isolation, test harness (`?test=1`), fallback.
**Replace:** particle vertex/fragment model (stateless trig → simulated), shared soft sprite (→ per-formation sprites or shaded quads), uniform distribution (→ formation slots), passive repel (→ bounded disturbance + recovery), uniform seed re-roll on env change (→ morph/stagger).
**Add:** GPGPU position/velocity ping-pong, formation SDF functions per character, spring physics, per-particle depth/brightness, formation wipe-in stagger, disturbance field, optional advection layer — all optional/tiered.

---

## 3. Visual direction and five-character treatment

**[Proposed]** The five characters keep the approved 2026 palettes (§ environments.ts); R2.2 adds *sculpted form* and *interaction*, not new content. No new lore, quotes or claims are introduced. Each formation is expressed as a parametric equation `F_char(t, λ_i)` over a scalar `λ_i ∈ [0,1)` (fraction along the formation path) plus a lateral offset for beam/ribbon width.

| Character | Mode (existing) | Formation name | Geometry (proposed) | Motion | Palette from existing env |
|---|---|---|---|---|---|
| **Jin** | 0 ember pillar | **Ember Pillar** | vertical helix of ~40 filaments; particles with `θ = λ*TAU*3.0`, `r = baseR*(0.25+0.75*sin(λ*π*1.0))`, `y = mix(-1.3, 1.2, λ)`, wind shear `pos.x *= (1.0+0.6*(y*2.0))` | rising, flicker, pillar anchor | `#F2561A/#FFB84D` on near-black |
| **Claudio** | 1 rays | **Radiant Orbit** | three nested tilted rings + a vertical crown arc; ring `r ∈ {0.22, 0.4, 0.62}`, ellipse with inclination `sin(t*0.2)`, slow precession | slow orbit, mote shimmer | `#62A0F0/#F7E6B3` |
| **Dragunov** | 2 low sun | **Frost Curtain** | a warped plane `z = f(x,y)` of sparse ash filaments, with horizontal drift shear and vertical jitter — "snow/ash curtain" | slow lateral drift, restrained | `#566,#78A0C0` steel/frost |
| **Victor** | 3 blade | **Precision Dial** | hexagonal lattice: particles on `60°` incremental spokes + inner hexagon edges; precision clockwork rotation | snappy, mechanical 1/4-step | `#7A3DD1/#29CFDE` |
| **Lars** | 4 storm | **Bolt Filament** | a jagged lightning polyline field: filament `z_i` along `y` sampled from fbm, displaced by `sin` + curl; periodic flashes | fast diagonal streaks | `#28A0F7/#FFD54A` |

**Depth & lighting language (all five):** particles emit no real light; the art texture and their tints carry the image. Depth is conveyed by per-particle `vDepth ∈ [0,1]` → size/alpha/blur modulation + fog mix toward the atmosphere `uFog`. Back-to-front additive layering avoids sorting. A "body glow" from the art mask (the existing four-tap halo) stays the sole contact with the silhouette — formations never overlap legibility of content.

**Composition rules:** formations anchor right-of-center (desktop), center (mobile), never cover the stage name/copy; no screen-wide bloom; no fullscreen post-processing (§5).

---

## 4. Architecture comparison

**[Ext] Facts** (three.js r187 released 2026-10-30; WebGL2-only since r163; bundlephobia measured `three@0.187.0` = **742 KB unminified / ~186 KB gzip**; minimal-tree-shaken build ≈ 103 KB gzip; WebGL2 global support = **97.29%** (StatCounter, Oct 2026); `EXT_color_buffer_float` = widely available, WebGL2-only.)

| Criterion | **Option A — custom WebGL2 (current renderer, extended)** | **Option B — Three.js r187** | **Option C — hybrid (Three.js particles + existing atmosphere)** |
|---|---|---|---|
| GPU simulation | Yes — via FBO ping-pong `RGBA16F/RGBA32F` with `EXT_color_buffer_float` (wide) | Yes — `GPUComputationRenderer` (example) or hand-written GPGPU | Yes — same as A/B, but two render paths |
| Particle counts (memory) | 2200 particles in one 64×64 RGBA32F texture = trivial; up to 65 536 in 512² | Same physics (texture-bound), identical limits | Same |
| Render passes | Atmosphere (1) → GPGPU vel (1) → pos (1) → particles (1) = 4 | GPGPU → particles → atmosphere-like pass = 3–4 (+ EffectComposer pass) | 4+ |
| Mobile | Native; matches Tier1/Tier0 ladder | Native; heavier parse/compile (~186 KB) | Heaviest |
| Browser compatibility | WebGL2 (97.3%) + existing Tier0 fallback for the rest | Same class as A, but r163+ global minimum; no WebGL1 path | Same class as B |
| Dev complexity | High (hand-written simulation) but small API surface | Low-ish (established); still hand-written shaders | Medium-high (dual lifecycle) |
| Bundle size | **0 KB added** (proposed shaders only) | **+ ~186 KB gzip** (full build) | **+ ~186 KB gzip** |
| Perf predictability | High (direct control, measured GPU pass 1.8–3.0 ms) | Medium (auto programs, caches, materials system) | Medium |
| Maintenance | One owner (us), one migration treadmill | ~7–11 week release cadence; deprecation horizon 10 releases; r163 WebGL1 removal was a breaking-class event | Two systems to keep green |
| Interaction with art mask | Direct (existing pipeline) | Rebuild (or duplicate) halo path in Three materials | Rebuild |
| Context-loss recovery | Already proven (restore → re-init) | Renderer own `isContextLost` + needs handling | Both paths |
| Testability | Existing probe/harness works on any custom context | Different harness needs | Mix |

**[Proposed]** Recommendation: **Option A**. Option B is rejected: it adds ~186 KB gzip and an upgrade treadmill for zero rendering benefit in a single-fullscreen-effect + instanced-particle case, and it cannot preserve the measured 2–3 ms GPU pass and the proven context-loss recovery without parallel engineering anyway. Option C is rejected: same cost without A's reuse of the existing wipe/governor/mask stack.

---

## 5. Recommended rendering architecture

**[Proposed]** **One custom WebGL2 renderer, one fullscreen atmosphere pass, one GPGPU-simulated particle pass, rendered by the existing instanced-quad path.** Everything else stays.

### Why not more render passes?

**[Proposed]** We add exactly **two** small FBO passes (velocity + position, or fused = 1). No post-processing, no bloom (geometry-based glow instead), no depth prepass. Total draws/frame stay ≤ 5 (3 today + 2). This is the lightest configuration that achieves motion quality.

### Why instanced quads (not `gl_PointSize`)?

**[Ext]** `ALIASED_POINT_SIZE_RANGE` is implementation-defined; many mobile GPUs clamp point sprites to small sizes; instanced quads scale to any size everywhere, the pattern already in use.

### Formation representation

**[Proposed]** Each particle caches `targetλ ∈ [0,1)` and `targetOffset ∈ vec2` once at seed time (per environment switch). Every frame:

```
home = F_char(λ, t_local)                      // parametric formation point
pos += vel*dt                                    // integrate
vel += (curlNoise(pos, t) * wind)*dt            // ambient motion
vel += (-(pos - home) * springK - vel*damp)*dt  // formation spring (recovery)
vel += pointerDisturb(pos, pointer, radius)*dt  // local disturbance
vel *= globalDamp
```

Formations switch by morphing `λ → λ'` with per-particle stagger (`hash_i`-based cubic-ease morph over ~900–1200 ms), concurrently with the existing 380 ms `uWipe`. No second simulation is run.

---

## 6. Simulation and rendering pipeline diagram

**[Proposed]** (Character selection flows through the existing `setEnvironment` path unchanged.)

```
┌─ React App (hash → active character) ─────────────────────────────────┐
│  App.useEffect: renderer.setEnvironment(id)                           │
│  document.body.dataset.env = id                                       │
│  hashchange listener (unchanged)                                      │
└──────────────┬────────────────────────────────────────────────────────┘
               ▼
┌─ engine.setEnvironment(id) ────────────────────────────────────────────┐
│  env = normalizeEnvironment(id)          (unchanged)                   │
│  wipe.from = disp snapshot;  wipe.to = environments[id]   (unchanged)  │
│  uWipe = 0 … 380 ms crossfade                                (unchanged) │
│  uMorph = 0 → staggered cubic over ~1.0 s  (NEW, proposed)              │
│  artImg/artState reset                    (unchanged)                   │
└──────────────┬────────────────────────────────────────────────────────┘
               ▼ per frame
┌─ GPU SIMULATION (GPGPU, 64² for 4k particles) ─────────────────────────┐
│  PASS 1 (velocity):                                                     │
│    vel' = vel + curl(pos,t)·wind·dt                                     │
│         + (home(pos) − pos)·springK·dt                                  │
│         − vel·damp·dt                                                   │
│         + pointerForce(pos, uv→world, radius, strength)·dt              │
│  PASS 2 (position): pos' = pos + vel·dt                                 │
│     ping-pong: read (pos,vel)A → write (pos,vel)B; then swap            │
│     [requires EXT_color_buffer_float for RGBA16F/32F targets]          │
└──────────────┬─────────────────────────────────────────────────────────┘
               ▼
┌─ RENDER ───────────────────────────────────────────────────────────────┐
│  PASS A  atmosphere (unchanged): fullscreen fbm + mode + art halo       │
│  PASS B  particles (INSTANCED QUADS):                                   │
│           vPos  ← texture(posTex, uvCell)                               │
│           vVel  ← texture(velTex, uvCell)                               │
│           vDepth← length(vel) … shading: falloff, fog mix, size, alpha  │
│           additive blend (SRC_ALPHA, ONE) (unchanged)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

*Point sprite vs instanced quad: instanced quad (reuses current VAO + instanced draw2)*
*Particle attribute budget: zero custom attributes required — cell index from `gl_InstanceID`*

---

## 7. GPU memory and performance budgets

**Proposed targets (not measurements; validate on owner hardware in prototype).**

### 7.1 Memory (beyond existing art texture ≈ 2.85 MB)

| Resource | Size | Notes |
|---|---|---|
| Position ping-pong | 2 × 64² × RGBA16F = 64 KB | 4 096 particles slots (covers 2 200 + headroom) |
| Velocity ping-pong | 2 × 64² × RGBA16F = 64 KB | RG16F sufficient if packing needed |
| Formation LUT (optional) | 0 (analytic) or 256² R16F = 128 KB | prefer analytic `F_char()` |
| Atmosphere | unchanged | renders to canvas directly |
| SDF/formation SDF | 0 (analytic) | no texture |
| **Proposed ceiling (soft)** | **< 8 MB added** | existing: art ≈ 2.85 MB + atmosphere ≈ 0 |

### 7.2 Frame budget (proposed; measure in prototype)

| Device | Class | Target Tier3 GPU pass | Target Tier2 | Tier1 |
|---|---|---|---|---|
| iGPU (owner's AMD shared, dpr 1.2, 1152×648) | integrated | **≤ 5.0 ms** (currently 1.8–3.0) | ≤ 4.0 | ≤ 3.0 |
| dGPU / desktop discrete | discrete | ≤ 3.0 ms | ≤ 2.5 | ≤ 2.0 |
| Low-end mobile (Tier1 fallback) | mobile | — | — | ≤ 3.0 |

**[Assumption]** The atoms above are plausible: current atmosphere already costs the bulk of 1.8–3.0 ms; GPGPU sim of 2 200 texels is ~free; the risk is particle fill cost (overdraw), mitigated by smaller formation spread + discard-tight sprite.

### 7.3 Pass/count budget

| Tier | Particles | GPGPU passes | Draws | Notes |
|---|---|---|---|---|
| Tier3 | 2 200 | 2 (or 1 fused) | 4 | full formations (all 5) |
| Tier2 | 1 100 | 2 | 4 | formation spring, simplified noise |
| Tier1 | 450 | 0 (analytic drift fallback) | 2 | formation-lite / fallback no-GPGPU |
| Tier0 | 0 | 0 | 0 | CSS-only (unchanged) |

### 7.4 Quality governor (unchanged + extension)

Keep the existing `avg>24 → step down / avg<12 → step up` 90-frame rule; add a **hard quality floor** that refuses to step below Tier1 while `?fx=high` (art flag) is on, so the artwork halo is never silently dropped by the governor. `setQuality` remains a test/pinning hook. (Art-only floor existed implicitly via `art:0` on Tier1 — now explicit at Tier2/3.)

### 7.5 Thermal & sustained load

**[Proposed]** With the window occluded, rAF throttling already reduces load; sustained-load behavior can only be validated on-device. Budgets above intentionally keep Tier3 well under the 6.0 ms owner ceiling so even a thermal-throttled iGPU (≈ 50 % clock) stays ≥ 60 fps.

---

## 8. Quality-tier design

**[Proposed]** One simulation core, three expression levels (no capability splits by quality except shader cost):

| Tier | Formation | GPGPU | Curl noise | Spring recovery | Packet |
|---|---|---|---|---|---|
| Tier1 | one lobe / fallback | no (analytic, current formula, formation-slot lerp) | no | no | 450 soft dots |
| Tier2 | full formation, reduced filaments | yes (fused pass) | low (2-octave) | yes (heavier damping) | 1 100 |
| Tier3 | full formation, full filaments/crests | yes (2 passes) | yes (3-octave) | yes | 2 200 |

**Invariants across tiers:**
- Formation *identity* is constant — Tier1 still sees the same formation (dimmer, sparser), just cheaper to compute.
- **Tier1 art gate:** `uArtRect = (0,0,0,0)`; no art upload; unchanged from today.
- **Reduced motion:** Tier0; no context; unchanged.
- **Context lost:** Tier0 CSS until restored; formations rebuild from seed on restore.
- **Wipe:** unchanged (380 ms) + `uMorph` staggered alongside (proposed).
- `?art=on`: only art gate changes (Tier2/3) — formation loads independently of art.

---

## 9. Interaction and transition design

### 9.1 Cursordisturbance model

**[Proposed]** One disturbance field, one update function (no grid solving — a point force in a particle sim):

```
d = pos - pointerWorld                (aspect-corrected)
fall = exp(-|d|² / r²)                (gaussian radius, r ≈ 0.18 – 0.32 tier-scaled)
vel -= normalize(d) * strength * fall * dt   (radial push, negative = repel)
vel += perp(d) * curl * fall * dt            (tangential swirl)
vel *= (1.0 - fall * damping)                (local viscosity)
```

- **Radius** `0.18` Tier3 / `0.24` Tier2 / `0.32` Tier1 × of viewport height.
- **Strength** `3.0` (normal) adjustable via `?debug` for prototype calibration.
- **Recovery:** spring `k = 2.2`/s, damping `ζ = 0.85`; typical recovery to 90 % of formation ≈ 250–350 ms (proposed).
- **Propagation:** purely through the velocity field; no separate grid. If prototype needs longer shockwave, add a single shared "disturbance ring" uniform animated 0.5 s (optional).
- **Pointer never writes art**; only formation force.

### 9.2 Transitions

| Event | Behavior |
|---|---|
| Character change (hash) | `uWipe` 380 ms crossfade (unchanged) **+** `uMorph 0→1` staggered particle morph over 900–1 200 ms (proposed) |
| Party same env (same id) | No transition; morph not retriggered |
| `setQuality` change (Tier) | No morph retrigger; same formation, fewer/more particles (reseed diff) |
| Context restore | Full sim state rebuilt from seed; `uWipe` completes; `uMorph` instant |
| Reduced motion flip | No formation at all (Tier0) |

**[Proposed]** Keep the existing wipe exactly as-is; the formation morph rides on top as a secondary phase so content remains readable during transitions.

---

## 10. Failure handling and accessibility

**Failures → fallbacks (unchanged pattern, extended):**

| Failure | Detection | Fallback |
|---|---|---|
| WebGL2 unavailable | `getContext('webgl2')` fails | Tier0 CSS (existing) |
| `EXT_color_buffer_float` missing | `gl.getExtension()` → null | Formation-lite (analytic trig, no GPGPU) → Tier1-ish path |
| Shader compile/link error | existing `try` block in boot | Tier0 `'shader-error'` (existing) |
| Context lost | `hookContext` | teardown → CSS `'context-lost'`; restore → re-init (existing) |
| `?fx=off` / `reduced-motion` | existing | Tier0, no context |
| Art image fails 404 | `naturalWidth === 0` | `artState = -1`; mask zeros (existing) |

**Accessibility:**
- Canvas `aria-hidden="true"` (unchanged).
- `prefers-reduced-motion: reduce` → Tier0; no animation — unchanged.
- Focus ring order, skip link, roster arrow keys — unaffected; the wipe never receives focus.
- Content contrast: formations avoid the left/right text column regions on desktop; CSS positions formations via `--pdx/--pdy` subject to the existing stacking rule (canvas `z-index: 0`, stage `z-index: 1`).
- **[Proposed]** formations must never cover `<h2>` stage titles or the roster grid on any viewport; orientation constraint encoded in formation functions (Jan: right third; Victor: center; etc.).

---

## 11. Prototype scope (isolated, before integration)

**[Proposed]** A separate, disposable page (e.g. `motion-lab/` or a stand-alone `prototypes/ember-pillar.html`, **not** committed to the app bundle) demonstrating:

1. One sculpted formation — Jin "Ember Pillar" (helix of filaments, anchor right-of-center).
2. Cursor-disturbance + recovery (visible formation "breathing" back).
3. Depth layering (near/far size + fog falloff).
4. Adjustable: particle count (450…4 400), resolution scale (0.25…1.0), DPR cap, spring k/damping, disturbance radius/strength.
5. **Performance panel:** live `EXT_disjoint_timer_query_webgl2` GPU pass ms (min/max/median/p95), rAF delta, fps, frame-time histogram, draw calls, tier label, live note that numbers are GPU-pass, not CPU pacing.
6. Formation switcher (one alternates to a second character's formation with the `uMorph` path — proves morph before integration).

**Explicitly out of scope for the prototype:** five formations, art mask, React, routing, artwork, text content; this is an engine testbed only.

**Prototype definition of done (proposed):** formation visibly holds shape; cursor disturbance reads as fluid; recovery ≤ 400 ms; no rectangular seams; p95 frame time measured on owner iGPU at Tier3-equivalent settings ≤ 5.5 ms (proposed target); works at 0.25 scale (Tier1 fallback).

**This milestone (R2.1) does not build any of the above — it is the design contract for R2.2.**

---

## 12. Integration strategy

**[Proposed]** Phases after R2.2 prototype sign-off (sequence subject to owner decisions in §13):

| Phase | Scope | Artifact |
|---|---|---|
| R2.2 | Prototype of one formation (above) | standalone demo + perf panel |
| R2.3 | Integrate GPGPU + Jin formation; flag `?formation=1` (net-new param; default `formation=1` post-sign-off) | `src/graphics/sim/*.ts` |
| R2.4 | Cláudio/Victor/Dragunov/Lars formations + morph transitions | environments form per env |
| R2.5 | Tier1 analytic fallback + Tier2 reduced — new `?fx=safecontrols`? no new params | T1/T2 tiers |
| R2.6 | Art-mask re-render/halo sync test + all existing viewport/tier/context-loss tests | regression suite |

**Integration order constraints:**
- **Do not** touch `src/data/characters.ts` `environments` content (approved copy) — clay only art colors into formation tints if owner approves.
- **Do not** ship a protocol violation: new assets (no), new dependencies (needs §13), no artwork replacement.
- **Do not** change `?fx=off` behavior: Tier0 path first; any change to fallback order (WebGL failure → CSS) must be owner-approved.
- Keep `?test=1` hook surface; extend harness with `formation` flag if needed.
- Keep `ART` / art mask unchanged (i.e., don't let formation shaders sample the art texture except via existing uArtRect path).
- Preserve LF, `tsc`, `vite build`, ≤ current bundle discipline, and the tier governor.
- Preserve React Strict-Mode compatibility (one context after settle) — GPGPU FBOs are per-renderer; disposability through `teardownGl`.

---

## 13. Risks, trade-offs and unresolved owner decisions

### 13.1 Unresolved owner decisions (blocking R2.2)

1. **Architecture:** approve Option A (extension of custom renderer; no deps) over B/C? Decision needed before prototype.
2. **Dependencies:** may the prototype remain dependency-free (author's recommendation) or does the owner want Three.js evaluated in-prototype first anyway?
3. **Performance targets:** are the §7.2 targets acceptable on the owner's iGPU, or must P95 headroom be larger given the visible vanilla tab sharing the GPU?
4. **Formation art direction sign-off** — each character's **formation** must be approved before build (Jin/Claudio/Dragunov/Victor/Lars). Any direction may be overridden here.
5. **Interaction feel:** strength/radius/recovery target; should the disturbance feel "water-like" (heavy inertia) or "spark-like" (loose)?
6. **Transition approach:** is a 1.0–1.2 s formation morph on character change acceptable, or must the 380 ms wipe carry everything?
7. **Tier1 fallback depth:** does the owner accept formation-less Tier1 (current behavior, just tints) or require visibly simplified formation?
8. **Art-mask interaction:** may formations *slightly* sample the mask silhouette alpha for depth cueing (position particles just behind silhouette edges), or is art texture reserved exclusively for the mask halo?
9. **Prototype cadence/scope:** one or two formations in prototype; whether prototype exists as untracked local file or in a branch off `migration/react-typescript`.
10. **Any GPU-state budget beyond art texture:** is the ~4 MB added GPGPU footprint acceptable, or must formations be analytic (no GPGPU) to stay within ~2.85 MB?
11. **AXON inspiration level:** how closely may we reference "AXON motion research hub" (explicit brand borrowing vs. generic "sculpted particle" direction) — brand/legal review needed if pixels/type from that hub would be reused; current plan borrows nothing from it.

### 13.2 Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Prototype shows formation too "screen-door"/sparse at 450 particles | Medium | tier-slot morph with wraparound |
| GPGPU path unimplemented on some mobile drivers | Low | analytic Tier1 path (forced always Tier1 on `pointer: coarse`) |
| iGPU thermal throttle under formations | Medium | pin Tier2 after 10+ governor step-downs; governor already present |
| Overdraw cost grows with formation coherence | Medium | discard-tight sprite, cap filament count |
| morph staggering looks jarring vs. existing wipe | Low | match easings, drive from same uMorph envelope |
| Prototype scope creep (five formations before sign-off) | Medium | prototype = Jin only, per §11 |
| Owner expects a visible "fluid" but we ship spring recovery | Low | label recovery as spring; full grid advection only if prototype shows it necessary (optional variant, not default) |
| If owner prefers Three.js after all | Medium | none — needs separate evaluation, not this doc |

### 13.3 Cost estimate (information only, not a commitment)

**[Assumption]** Prototype: 4–7 working days including perf panel. Integration (Jin only): 3–5 days; remaining characters: ~2 days each; art/Halo re-verification + regression: 2 days. Not part of R2.1.

### 13.4 Explicit non-goals (this milestone)

- No graphics code in `src/`; no changes to renderer files; no dependencies (no install); no `package.json`/lockfile changes; no new assets; no content changes; `docs/spec.md` untouched; no artifacts outside `docs/r2-graphics-technical-design.md`.

---

## 14. References and source links

Authoritative / documented capabilities and measurements:

- **WebGL 2 availability** — 97.29% global usage (StatCounter, Oct 2026): https://caniuse.com/webgl2
- **MDN — WebGL2RenderingContext** (instancing, `gl.VertexID`/`gl.instanceID` fundamentals): https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
- **MDN — EXT_color_buffer_float** (WebGL2 float render targets, "widely available", WebGL2-only): https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
- **MDN — EXT_float_blend** (float blending for GPGPU accumulation): https://developer.mozilla.org/en-US/docs/Web/API/EXT_float_blend
- **MDN — ALIASED_POINT_SIZE_RANGE / getParameter constants** (point-size limits; basis for instanced quads): https://developer.mozilla.org/en-US/docs/Web/API/WebGLConstants
- **GPU Gems — Fast Fluid Dynamics Simulation on the GPU (Harris)**: https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu
- **Stam, "Stable Fluids" (SIGGRAPH 1999)**: https://www.dgp.toronto.edu/~stam/reality/Research/pdf/GDC03.pdf
- **Three.js r163 release notes** (WebGL1 removal): https://github.com/mrdoob/three.js/releases/tag/r163
- **Three.js Migration Guide** (cadence/deprecation 10-release policy): https://github.com/mrdoob/three.js/wiki/Migration-Guide
- **Three.js r187 (latest, 2026-10-30)**: https://github.com/mrdoob/three.js/releases/tag/r187
- **Three.js GPUComputationRenderer** (ping-pong texture pattern, example): https://threejs.org/docs/pages/GPUComputationRenderer.html
- **three.js bundle size** (`three@0.187.0`, 742 KB / ~186 KB gzip), Bundlephobia: https://bundlephobia.com/package/three@0.187.0
- **Codrops — GPGPU interactive particles with Three.js** (practical pattern reference): https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/
- **EXT_disjoint_timer_query_webgl2** (existing measurement hook in harness): https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_webgl2

Repository-verified measurements (this codebase, shared AMD Radeon iGPU, `rafshim=1`, occluded desktop window, home harness): Jin 2.014/2.335 ms median/p95; Claudio ≈ 2.6–2.8/3.1–3.3; Dragunov ≈ 1.8–2.0/2.1–2.5; Victor ≈ 2.3–2.7/2.6–3.9; Lars ≈ 2.26/2.5 (GPU pass; not CPU pacing). 125 Hz context loss/restore cycles clean.

Repo file references (all at `f12e841`):

- `src/graphics/engine.ts` — renderer factory (663 lines); tier caps; governor; context lifecycle; art pipeline
- `src/graphics/shaders.ts` — atmosphere modes 0–4; art halo (4 tap LOD3); particle shaders (soft radial sprite, trig-only)
- `src/graphics/particles.ts` — instanced triangular sprite draw; `uSharp`; additive blend
- `src/graphics/environments.ts` — approved palettes + motion config ×5
- `src/graphics/fallback.ts` — CSS env list, reduced-motion, Tier0
- `src/app/App.tsx` — canvas lifecycle; hash routing; `?test=1` hooks
- `docs/spec.md` §8.1 — five-character art mask exception; zero custom textures for other effects
