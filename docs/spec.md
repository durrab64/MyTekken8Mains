# SLEDGE — My Tekken 8 Mains
## Design & Content Specification (Phase 1, Rev 3 — owner decisions applied)

Status: **Specification for review — implementation has not started.**
Rev 3 applies the owner's Rev 3 decisions (§11 checklist). HTML/CSS/vanilla JS remain the foundation; no build pipeline; no rendering/animation dependencies; no deployment configuration. Identity, roster, filters, navigation, art direction B, typography, palette and sound defaults are unchanged.

---

## 1. Identity

- **Wordmark:** SLEDGE. Real name never displayed.
- **Title:** `SLEDGE — My Tekken 8 Mains`.
- **Visitor impression (approved):** "A Tekken 8 devotee whose five-character roster spans the whole game — the disciplined all-rounder (Jin), the radiant aggressor (Claudio), the relentless commando (Dragunov), the cerebral tactician (Victor), and the electrifying rebel (Lars)."
- **Zero competitive statistics anywhere** — no ranks, placements, win rates, tier claims. Hard rule.
- **Roster tallies/counters:** none. A small `01/05` stage indicator is permitted **only** as a prev/next navigation affordance (current stage position), never styled or worded as a statistic.

---

## 2. Roster (approved — unchanged)

| # | Character | Status | Playstyle | Difficulty | Execution | Signature strength |
|---|-----------|--------|-----------|------------|-----------|--------------------|
| 1 | Jin Kazama | Main | Balanced | Medium | Medium | All-rounder |
| 2 | Claudio Serafino | Secondary | Aggressive | Medium | Low | Easy pressure |
| 3 | Sergei Dragunov | Lab | Aggressive | Hard | High | Damage |
| 4 | Victor Chevalier | Lab | Balanced | Hard | High | Mix-up & wall carry |
| 5 | Lars Alexandersson | Secondary | Aggressive | Medium | Medium | Mix-up & wall carry |

Default order = table order.

---

## 3. Art direction & visual engine — OWNER-APPROVED ARCHITECTURE

Art direction: **B — cinematic fighting game**. The renderer is a coordinator of atmosphere and motion — never of content or navigation.

### 3.1 Engine decision (APPROVED)

| Decision | Status |
|---|---|
| Primary engine: **raw WebGL2 + GLSL ES 3.0**, hand-written | **APPROVED** |
| Three.js / GSAP / regl / PicoGL / any rendering or animation dependency | **REJECTED** |
| WebGPU | **Future optional backend** (post-launch consideration), hidden behind the engine interface — not a launch requirement |
| No build pipeline; static ES modules; shaders as ES-module template literals | **APPROVED** |

Rationale (recorded): the design needs fullscreen shader passes + one GPU particle system, not a scene graph. Zero dependencies, zero transpile, zero supply-chain risk, served as plain static files. WebGPU slots in later behind the same interface (`initialize` / `setEnvironment` / `setPointer` / `setQuality` / `dispose`) without touching content code.

### 3.2 The three layers (one clock, coordinated uniforms)

**Layer A — Atmosphere pass (fullscreen fragment shader, half resolution).**
Domain-warped FBM (4–5 octaves): molten haze, drifting energy veins, volumetric light shafts, floor-glow horizon. Palette-driven per character via environment uniforms (`uDeep`, `uGlow`, `uVein`, `uFog`).

**Layer B — GPU particles (one draw call, stateless).**
Positions computed in the vertex shader from hash-seeded seeds + curl-noise advection. Additive blending; procedural sprite (no image assets). Behavior parameterized per environment (rise speed, swirl, size falloff, color ramp).

**Layer C — Composition.**
Vignette + hash-noise film grain (~3%, dithered) + anamorphic streak toward the artwork. **Mouse-reactive:** lerped pointer uniform drives particle repulsion, a small radial UV refraction of the atmosphere near the cursor, and artwork rim-glow intensity (CSS `drop-shadow` modulated from JS). **Parallax:** three strata — far atmosphere (canvas), artwork (CSS transform, ≤ 12 px), foreground ember sprites (DOM/canvas overlay above artwork).

### 3.3 Hero (ring removed per owner decision)

Full-viewport near-black arena. Behind "SLEDGE" (Anton caps, ivory→crimson vertical gradient + 1 px crimson keyline): a **rising crimson ember storm** advected through domain-warped noise, with an **atmospheric energy pillar** anchoring the composition (a slow vertical column of brighter haze the embers rise through). Eyebrow `TEKKEN 8 · PERSONAL ROSTER`; approved impression line in Barlow 400; CTA `VIEW THE ROSTER ↓`; ghost link `MEET MY MAIN`. Pointer movement makes the stage breathe toward the cursor. Reduced-motion shows the same composition statically (Tier 0). Film grain + vignette over everything. 1.2 s reveal on load: embers ignite, type rises with clip. **No stats, no counters, no ring geometry.**

### 3.4 Character selection transition (APPROVED timing: 350–400 ms)

Standard character transition target: **350–400 ms end-to-end.** The dramatic shader distortion and synchronized reveal are preserved; navigation stays instant-feeling.

Sequence (per selection; from roster, keyboard, prev/next, or hash deep-link):

1. **Energy wipe — 350–400 ms:** a radial distortion sweep from the selected card's position (center on deep-link). Outgoing atmosphere smears with a white-hot front tinted to the incoming accent; chromatic fringe at the wipe edge; `uWipe` driven by a single eased tween (cubic-bezier-out). No holds longer than one frame.
2. **Environment cross-fade** — over the same 350–400 ms envelope (not after it): deep color, vein hue, fog density lerp; particles re-seed into the incoming behavior set at the midpoint.
3. **Artwork reveal** — synced to wipe midpoint (~175–200 ms in): clip/slide-in with a rim-light flare; outgoing artwork exits with slight motion-blur slide.
4. **Content stagger** — badges → name → sections, ~25–40 ms staggers, fully settled by ~400 ms.
5. **Navigation affordance only:** stage index `01/05` in the stage nav row (prev · index · next). It never pulses like a HUD beat and is never described as a stat.

Reduced-motion path: instant content swap, zero shader motion, atmosphere static.

### 3.5 Character environments (APPROVED)

Shared cinematic art direction; per-character palette + particle signature + light rig:

| Character | Environment | Particle signature | Light |
|---|---|---|---|
| Jin | Molten crimson haze, rising heat-shimmer veins | Embers + white-hot spark pops | Hard top-down key, red bounce |
| Claudio | Deep azure void, orbiting star glints, faint gold nebula band | Slow gold motes, starburst glints | Soft celestial backlight, god rays |
| Dragunov | Desaturated sage-grey steppe, horizontal ash stream, hard horizon glow | Lateral ash/snow streaks | Cold low sun, long shadows |
| Victor | Champagne-black study, drifting dust, single sweeping light blade | Slow-falling champagne motes | Single overhead spot, dust shaft |
| Lars | Teal-white stormfront, electric arc flicker in upper third | Lateral teal arcs + white sparks | Flickering arc light, teal rim |

### 3.6 Design restraint (binding)

Type stays crisp; body contrast ≥ 4.5:1; motion is calm between beats; no HUD spam; no glow-everything; every shader exists to make the character the brightest thing in the room.

---

## 4. Roster, filters, navigation

Hero → interactive archive (eyebrow `THE ARCHIVE`; search; 5 facet groups; AND logic; search matches name + playstyle + signature (case-insensitive substring); sort Default / Name A–Z / Name Z–A / Difficulty; **Clear all**; `aria-live` result count; URL query sync `?status=…&ps=…`; arrow-key browsing; random-pick among visible results) → five in-page character stages (`#jin`… `#lars`) → About Sledge (short paragraph, interview material only) → footer. `character.html` → redirect stub to `/#id`, preserving old links.

---

## 5. Filter taxonomy (approved — unchanged)

Facets: status (Main/Secondary/Lab) · playstyle (Aggressive/Balanced/Defensive) · difficulty (Medium/Hard) · execution (Low/Medium/High) · signature strength. AND across groups, exact match within a group. Config-driven (`filterFacets`); adding a facet never requires component changes.

---

## 6. Character content — UNAPPROVED DRAFT (owner review required per character)

**Nothing in this section is approved.** First-person opinions, struggles, strengths and weaknesses are **the owner's words or are not shipped**. The section layout is approved; the copy is not.

**Objectively verifiable (approved in Rev 1):** identity, difficulty, execution, status, facet tags, "01/05" indexing — stand.
**Personal (pending owner review, per character):** "Why I play him" (owner's Rev 1 words, light polish only), "Gameplay identity", "Strengths", "Weaknesses", "The honest take".

Owner per-character review request — reply per character with **APPROVE** or rewrites:

- **Jin** — Why: "Jin is my main, so I play him because he's aggressive and defensive." Draft identity/strengths/weaknesses/honest take (all-rounder; precise-input demand; consistency gap).
- **Claudio** — Why: "My second main — it's good and easy to use." Draft identity/strengths/weaknesses/honest take (easy pressure; momentum-dependent; defense is not his wall).
- **Dragunov** — Why: "Requires skill but more damage." Draft identity/strengths/weaknesses/honest take (the hammer; execution-gated damage; lab work required).
- **Victor** — Why: "He has good damage and wall carry and good mixups." Draft identity/strengths/weaknesses/honest take (tactician's toolbox; steep learning curve; thinner knowledge base).
- **Lars** — Why: "Same reason — mixup and damage and wall carry." Draft identity/strengths/weaknesses/honest take (electric rushdown; pattern-readable; patience is the discipline).

---

## 7. Extra interactions

- **Sound** — toggle, default OFF. Two Web Audio cues (hover tick ~2 kHz/30 ms; selection impact low thud/120 ms). No audio assets.
- **In-page stages** — hash routing (`#jin`…), 350–400 ms transition system, prev/next navigation with `01/05` positional affordance (navigation only — §1).
- **Random pick, arrow-key browsing, reduced-motion toggle** (in addition to OS setting) — approved flourishes. The roster "count/tally" flourish is **removed** per Rev 3.
- **`?fx=off|low|high`** — undocumented manual override for the governor (§8.3); documented in README only.
- **No matchups, no socials, no stats — ever.**

---

## 8. Engineering architecture — static ES modules, no build

### 8.1 No build pipeline (APPROVED, unchanged)

Shaders in ES-module template literals; ES2019+ output; static relative imports over HTTP/2; zero custom textures (procedural sprite) ⇒ no texture-compression pipeline needed. **Decision recorded: no bundler, no transpiler, no compiler.** If profiling ever justifies otherwise, raised as a spec amendment first.

### 8.2 Isolated renderer interface (owner-mandated)

The renderer (`js/fx/engine.js`) is an **isolated visual backend** with the following contract:

```js
const fx = createRenderer();          // cached singleton
fx.initialize(canvas, environments);  // compile programs, create buffers, start clock
fx.setEnvironment(id, opts);          // crossfade env uniforms + reseed particles (~incoming)
fx.setPointer(xNorm, yNorm);          // engine lerps internally
fx.setQuality(tier);                  // 'auto' | 'tier0' | 'tier1' | 'tier2' | 'tier3'
fx.resize();                          // DPR-capped resize handling
fx.dispose();                         // full teardown: cancel rAF, detach observers,
                                      // delete programs/buffers/textures, lose context
fx.on('tierchange' | 'error', cb);    // fallback notifications (error → Tier 0/1)
```

**The renderer never owns application content or navigation.** All copy, artwork elements, focus order, hash routing and history live in `index.html` + `js/stage.js` / `js/roster.js`. The renderer sees one `<canvas>` and numeric uniforms. Removing the engine leaves a fully readable, fully navigable site (§8.5).

### 8.3 Adaptive quality tiers (governor-driven, owner-mandated)

2,200 particles is a **desktop target, not a fixed requirement**. Auto-selected; overridable via `?fx=off|low|high` or `fx.setQuality`.

| Tier | Target hardware | Particles (target) | Atmosphere res | DPR cap | Noise octaves |
|---|---|---|---|---|---|
| Tier 3 — full | Desktop dGPU | **~2,200** (1,800–2,600) | 0.5× | 1.5 | 5 |
| Tier 2 — balanced | Integrated GPU / 768–1440p | ~1,100 | 0.5× | 1.25 | 4 |
| Tier 1 — low | Mobile / coarse pointer | ~450 | 0.25–0.5× | 1.25 | 3 |
| Tier 0 — fallback | Any (or reduced motion) | 0 | CSS only | — | — |

**Governor:** rolling 90-frame delta sample; > 24 ms/frame for 45 frames ⇒ step down one tier; < 12 ms/frame for 120 frames ⇒ step up; hysteresis prevents oscillation. Entry tier chosen by `devicePixelRatio`, viewport width, `matchMedia('(pointer: coarse)')`, and `navigator.hardwareConcurrency` heuristics. `webglcontextlost` → immediate Tier 0/1 (CSS atmosphere), no reload, recovery via `restored` → re-`initialize`.

### 8.4 File plan (Phase 2+)

```
index.html                 markup skeleton; all sections; noscript-readable
character.html             legacy redirect stub (?id=jin  →  /#jin)
css/tokens.css             type / color / spacing / motion custom properties
css/style.css              layout, components, stages, responsive, grain/vignette
js/config.js               brand + filter facets + environment registry (single source)
js/characters.js           roster data + narrative (post-§6-approval)
js/roster.js               search / filter / sort / URL sync / arrow keys / shuffle
js/stage.js                hash routing, transitions, focus management, parallax strata
js/toggles.js              sound + reduced-motion toggles (localStorage)
js/sfx.js                  Web Audio synth cues (default OFF)
js/fx/engine.js            WebGL2 context, program cache, passes, governor, ctx-loss
js/fx/shaders.js           GLSL ES 3.0 source (atmosphere, particles, wipe)
js/fx/particles.js         stateless GPU particle setup
js/fx/fallback.js          CSS-atmosphere fallback (body[data-env]) + detection
docs/spec.md               this file
README.md                  run / deploy notes (Netlify *and* Vercel paths, no default chosen) / ?fx flags
```

### 8.5 Reduced motion, fallback, readability (owner-mandated, unchanged)

1. **Tier 0 (reduced motion, OS or toggle):** no canvas; CSS static atmosphere via `body[data-env]`; instant swaps; full content.
2. **Tier 1 (WebGL2 failure / context lost / shader error):** CSS atmosphere swapped in **live** on `webglcontextlost`; no reload; zero console errors; a `data-fx="css"` attribute traces the fallback for debugging.
3. **Content is never shader-rendered** — artwork, type and filters are DOM; removing the engine changes nothing structurally.
4. **Fully readable without WebGL** — every stage is real HTML; every control is a real `<button>`/`<a>`/`<input>`; focus-visible rings; `aria-live` results; ≥ 4.5:1 body contrast.

### 8.6 Performance budgets & verification

Budgets: atmosphere+particles ≤ 6 ms GPU/frame at 1080p (Tier 3); governor reachable to Tier 1 without layout shift; LCP < 1.8 s; blocking JS < 40 KB hand-written; Lighthouse perf ≥ 90 / a11y ≥ 95.
Verification matrix (Phase 7): four widths (390/768/1440/2560); keyboard-only; reduced-motion; forced Tier 1 via DevTools; `?debug=1` frame percentiles; console audit; final report includes measured frame times.

### 8.7 Artwork (unchanged)

Existing renders kept **provisionally** — no downloads, no replacements, no AI regeneration. Provenance/licensing question remains open; owner decision before any public deploy. Face crops stay out of the UI; full-body transparent renders carry the artwork.

### 8.8 Deployment — UNDECIDED (owner instruction)

Deployment target is **undecided**. **Do not** configure Netlify or Vercel; **do not** create `netlify.toml`, `vercel.json`, workflow files, project links or any deployment artifact. README (Phase 7) documents the generic static-deploy path and notes both options without choosing. No domain is assumed.

---

## 9. Implementation phases

- **Phase 2 — Foundation & static identity** — tokens, skeleton, nav/footer, hero DOM, five static stages (noscript-readable), all approved copy only. Review at four widths.
- **Phase 3 — Roster & stages** — data-driven grid, search/facets/sort/clear-all/URL sync, arrow keys, shuffle, hash routing, CSS-fade transition v1 (~350 ms), focus management.
- **Phase 4 — Storytelling** — narrative integrated only after per-character §6 approvals.
- **Phase 5 — Visual engine** — `js/fx/` behind a runtime flag: atmosphere pass, GPU particles, environment registry, pointer refraction + parallax, 350–400 ms energy-wipe, governor, context-loss handling, CSS fallbacks. **Tier 0/1 parity is a merge gate.**
- **Phase 6 — Polish** — sound + toggle, stage-nav `01/05`, scroll cues, micro-copy, responsive widths.
- **Phase 7 — QA** — §8.6 matrix, Lighthouse, fix regressions, honest final report, README.

---

## 10. Approval status

**Rev 3 — APPROVED by owner:**
1. Raw WebGL2 + GLSL ES 3.0 primary engine; no Three.js/GSAP/regl/PicoGL. ✔
2. WebGPU future-optional backend only. ✔
3. Hero = rising crimson ember storm + atmospheric energy pillar; **ring removed**. ✔
4. Five character environments approved. ✔
5. Roster tallies removed; `01/05` permitted as navigation affordance only. ✔
6. No-build static ES-module architecture. ✔
7. Standard transitions 350–400 ms, shader distortion preserved. ✔
8. ~2,200 particles as desktop target; adaptive tiers documented (§8.3). ✔
9. Isolated renderer interface (§8.2); renderer never owns content/navigation. ✔
10. Reduced-motion, CSS fallback, live context-loss recovery, fully readable content preserved. ✔
11. §6 copy unapproved until owner reviews exact wording; no invented opinions. ✔
12. Deployment undecided; no Netlify/Vercel configuration created. ✔

**Still pending owner action:**
- §6 per-character content approvals or rewrites (Jin / Claudio / Dragunov / Victor / Lars).
- Deployment target decision (deferred by owner — not blocking Phases 2–7).

Implementation begins only after the owner signals approval to start Phase 2.
