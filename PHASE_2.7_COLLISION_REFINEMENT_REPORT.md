# Phase 2.7 — Character Deck Collision Refinement Report

**Repository:** `C:\Tekken mains\MyTekken8Mains-main\MyTekken8Mains-main`
**Branch:** `experiment/r2-graphics-lab`
**HEAD:** `430b37a`
**Mode:** Local implementation and evidence only. No commits, pushes, merges, deployments, resets, installs, or cleanup were performed.
**Status:** Awaiting owner visual review.

---

## 1. Objective and outcome

Refine the five-character landing-page fan so that:

- no card collides with the hero copy;
- all five cards are individually recognizable in the expanded state;
- all five remain independently hoverable/focusable;
- only one card is emphasized at a time;
- the fan stays centered and inside the viewport at 1920×1080, 1440×900, 768×1024, and 390×844;
- the Phase 2.6 persistent ordering and input model is preserved.

The expanded fan now uses scaled cards, a wider center-to-center spread, reduced rotation, inverse-scaled labels, and one deterministic hover state. At 1440×900 the fan starts at **x = 736.2**, which is **38.6 px clear** of the hero copy ending at **x = 697.6**. The largest expanded card bounding box is **257.4 × 314.6 px**, down from **603 × 727 px**. Neutral expanded labels have **zero pairwise overlaps** at all four target sizes, and **20/20** sequential hover targets resolved to the requested card with exactly one hovered card at a time.

The collapsed stack still uses the existing Phase 2.6 ordering and interaction behavior.

---

## 2. Root cause

The Phase 2.6 fan kept every expanded card at its full **460 × 613 px** box and only translated/rotated it:

- Spread was **96 px** center-to-center, less than a quarter of the card width. Cards therefore overlapped by roughly 80%, hiding nearly all of each neighbour.
- Rotated full-size bounding boxes grew to **603 × 727 px**. The left-most card reached **x = 513**, overlapping the hero copy by **184.6 px**. The right-most card reached **x = 1617**, overflowing the 1425 px scrollport by **192 px** and clipping the outer card.
- Labels stayed full-size while cards overlapped every 96 px, producing label-on-label collisions.
- Two hover systems competed: the JS nearest-center calculation drove `.is-hovered`, while CSS `:hover` also applied z-index/scale to whatever card was painted under the pointer. Both used z-index 20. The 1440 before capture showed Dragunov (`.is-hovered`) and Jin (`:hover`) emphasized simultaneously.
- Pointer centres of covered cards fell on the top card, so nearest-centre hit-testing still failed to reach some cards.

The collision was therefore not a spacing-only problem. It required smaller expanded cards, a deterministic hit model, and a single source of hover emphasis.

---

## 3. Implementation

### 3.1 Expanded-fan geometry

Cards remain absolutely positioned inside the existing deck box, so expanding still causes no layout shift. The expanded transform is:

```css
translate(
  calc((var(--i) - 2) * var(--fan-spread)),
  calc(abs(var(--i) - 2) * var(--fan-arc) - var(--fan-lift))
)
rotate(calc((var(--i) - 2) * var(--fan-rot)))
scale(var(--fan-scale))
```

`transform-origin` is `50% 100%` (bottom centre), which keeps the fan anchored while cards shrink and lift.

| Target | Card scale | Spread | Rotation / step | Arc / step | Fan lift | Hover lift | Deck box |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1920×1080 | 0.46 | 92 px | 5° | 14 px | 27% | 16 px | 460 × 613 px |
| 1440×900 | 0.46 | 92 px | 5° | 14 px | 27% | 16 px | 460 × 613 px |
| 768×1024 | 0.56 | 112 px | 5° | 12 px | 22% | 14 px | 360 × 450 px |
| 390×844 | 0.40 | 52 px | 3° | 8 px | 32% | 10 px | 300 × 400 px |

Additional intermediate overrides remain for 1200–1439 px and 901–1199 px so the fan does not jump between the four reviewed targets.

Hover adds `--fan-hover-lift` vertically and multiplies scale by `1.035`. Resting expanded z-index is `10 + index`; hovered z-index is `30`. Collapsed z-index remains `5 - abs(index - 2)`.

Labels are compensated for the card scale:

```css
left: calc(var(--label-inset) / var(--fan-scale));
bottom: calc(var(--label-inset) / var(--fan-scale));
transform: scale(calc(1 / var(--fan-scale)));
```

This keeps names legible while the card artwork shrinks. All four breakpoints measured zero label overlaps in the neutral expanded state.

### 3.2 Single hover model and band hit-testing

- Removed the CSS `:hover` card emphasis. No `.landing-card:hover` or `.landing-deck:hover` rules remain; `.is-hovered` is the only expanded emphasis state.
- Replaced nearest-centre detection with contiguous pointer bands across the fan. Each band starts at its card's left translated edge and is one `--fan-spread` wide. Its display index selects the card from `deckOrder`.
- A vertical guard ignores pointer positions above or below the fan (10 px tolerance), so entering the empty part of the deck expands it without immediately stealing a card. This produces a neutral expanded state.
- Because every card is a child of the deck, pointer movement over exposed artwork outside the deck box still bubbles to the deck's `onMouseMove`.
- A hover-away from a covered card now switches emphasis to the band under the pointer. The previously hovered card drops back to its resting state.

This decouples hit-testing from paint order: a card can be visually covered yet still own its exposed band, and the hovered card cannot permanently consume a neighbour's usable band.

### 3.3 Preserved Phase 2.6 behavior

- `deckOrder` remains React state, initialized to `['dragunov', 'claudio', 'jin', 'lars', 'victor']`.
- Cards render from `deckOrder`; `--i` follows the current display index.
- Hovering alone does not reorder. The last hovered/focused card is committed to the front on pointer leave, focus blur outside the deck, or toggle close.
- Remaining cards keep their relative order. Re-expanding persists the updated order.
- Per-card hover border, accent glow, brightness, scale, and lift are retained.
- Keyboard focus expands the deck; Tab moves between cards and updates emphasis; leaving focus commits and collapses.
- Touch keeps reveal-first behavior: first tap expands and highlights, second tap on the highlighted card navigates.
- Reduced-motion rules still snap transforms with no effective transition.

### 3.4 Touch layout exception

The base `.landing-visual` is a flex row. When the Phase 2.6 touch toggle became visible, it became a second flex item, squeezing the 390 px deck from 300 px to **197 px** and placing the toggle beside the deck. In the Phase 2.7 deck section, under `(hover: none), (pointer: coarse)`, `.landing-visual` is now `flex-direction: column`, so the toggle sits below the deck and the deck keeps its intended 300 px width.

This is the only non-card layout declaration changed in this phase. It is scoped to coarse-pointer devices and explained here as the permitted exception.

### 3.5 Files changed

- `src/components/Landing.tsx` — band hit-testing, vertical guard, preserved ordering and touch logic. This file remains untracked in the working tree from an earlier phase.
- `src/styles/global.css` — consolidated Phase 2.7 deck section replacing the Phase 2.1–2.6 deck-only tail; deck geometry, labels, responsive overrides, coarse-pointer toggle layout, reduced motion.

No Phase 2.7 changes were made to `Hero.tsx`, shaders, formations, artwork, character pages, routing, or rendering infrastructure. The large `global.css` diff is the replacement of the earlier uncommitted deck tail, not a site-wide stylesheet rewrite.

---

## 4. Measurements

### 4.1 1440×900 before vs after

| Metric | Before (Phase 2.6) | After (Phase 2.7) |
|---|---:|---:|
| Deck box | 460 × 613 at x=843.4 | 460 × 613.3 at x=843.4 |
| Fan horizontal span | x=513.0 → 1617.0 (1104 px) | x=736.2 → 1410.6 (674.4 px) |
| Largest card bounding box | 603 × 727 px | 257.4 × 314.6 px |
| Hero copy right edge | 697.6 px | 697.6 px |
| Copy/fan relationship | 184.6 px overlap | 38.6 px clear |
| Neutral label overlaps | Multiple | 0 |
| Simultaneous hover emphasis | 2 cards at z-index 20 | 1 card at z-index 30 |
| Right edge vs scrollport | 192 px overflow (1617 → 1425) | 14.4 px inside (1410.6 → 1425) |

The right margin is intentionally smaller than before because the fan is wider than the 460 px deck and centred in the visual column; both the left-side copy collision and the right-side viewport overflow are eliminated.

### 4.2 Final neutral expanded geometry

Scrollport widths exclude the 15 px headless-desktop scrollbar: 1920 → 1905, 1440 → 1425, 768 → 753, 390 → 375.

| Viewport | Fan bounding box | Horizontal margins | Copy relationship | Max card bbox | Neutral label overlaps |
|---|---|---|---|---:|---:|---:|
| 1920×1080 | 994.5 → 1668.8; 338.9 → 667.4 | 994.5 / 236.2 | copy right 906.5; **88.0 px clear** | 257.4 × 314.6 | 0 |
| 1440×900 | 736.2 → 1410.6; 248.9 → 577.4 | 736.2 / 14.4 | copy right 697.6; **38.6 px clear** | 257.4 × 314.6 | 0 |
| 768×1024 | 9.5 → 743.5; 123.0 → 416.5 | 9.5 / 9.5 | copy top 512.4; **95.9 px below fan** | 242.3 × 283.2 | 0 |
| 390×844 | 7.1 → 367.9; 136.0 → 318.3 | 7.1 / 7.1 | copy top 456.0; **137.7 px below fan** | 136.1 × 171.7 | 0 |

At 768 and 390 the layout stacks the visual above the copy, so clearance is measured vertically. The 1440 fan is 38.6 px clear of the copy and 14.4 px inside the right scrollport edge. The 390 fan is symmetric with 7.1 px margins on both sides.

### 4.3 Touch layout (390×844, coarse pointer)

- Deck: 300 × 400 at x=45 (restored from the 197 px row-squeezed width).
- Toggle: **213.6 × 39.6**, positioned at y=440, below the deck bottom at y=424.
- Expanded fan: x=14.6 → 375.4, y=136.0 → 318.3; inside the 390 px viewport.
- Copy begins at y=511.6: 32 px below the toggle and 193.3 px below the fan.
- No horizontal overflow.

---

## 5. Verification results

### Build

`npm run build` passes with TypeScript and Vite:

- `dist/assets/index-Obz18u4n.css` — 39.75 kB
- `dist/assets/index-DOGUFaex.js` — 210.88 kB

### Hover-target matrix

At each of the four target viewports, all five cards were targeted sequentially by their display-order band:

| Viewport | Requested/resolved | Active hover count | Hover z-index |
|---|---:|---:|---:|
| 1920×1080 | 5/5 | 1 | 30 |
| 1440×900 | 5/5 | 1 | 30 |
| 768×1024 | 5/5 | 1 | 30 |
| 390×844 | 5/5 | 1 | 30 |

Border accents resolved per character (Dragunov `#A8C0D4`, Claudio `#7DD3FC`, Jin `#DC2626`, Lars `#38BDF8`, Victor `#A78BFA`). Individual hover screenshots exist for all five cards at all four targets (20 total); each sequence kept the deck expanded and ended with one hovered card at z-index 30.

### Ordering and persistence

| Step | Action | Resulting order |
|---|---|---|
| 0 | Initial | `dragunov → claudio → jin → lars → victor` |
| 1 | Hover Dragunov, do not leave | unchanged |
| 2 | Leave after Dragunov | `dragunov → claudio → jin → lars → victor` |
| 3 | Leave after Claudio | `claudio → dragunov → jin → lars → victor` |
| 4 | Leave after Jin | `jin → claudio → dragunov → lars → victor` |
| 5 | Hover Lars, then Victor, then leave | `victor → jin → claudio → dragunov → lars` |
| 6 | Re-expand | `victor → jin → claudio → dragunov → lars` (persisted) |
| 7 | Hover Jin, then Dragunov, then leave | `dragunov → victor → jin → claudio → lars` |

All sequences matched the expected results exactly. No reorder occurs during a hover-only pass, and the other cards retain their relative order.

### Keyboard

- Focus first card: deck expanded, Dragunov hovered.
- Tab: Claudio focused and hovered.
- Focus moved outside deck: deck collapsed, no hovered card, Claudio committed to front.

### Reduced motion

- `prefers-reduced-motion: reduce` matched.
- Card computed transition duration: **1e-05 s** (effectively none) in collapsed and expanded states.
- Expanded transforms still applied; no transition-dependent state was required.
- Evidence: `final-1440-reduced-expanded.png`.

### Touch

- Toggle tap 1: expanded, no card selected; tap 2: collapsed again.
- First card tap: expanded, hash unchanged, Dragunov highlighted.
- Second tap on the highlighted Dragunov card: navigated to `#dragunov`; landing deck unmounted.
- Separate run: second tap on highlighted Victor navigated to `#victor`.
- Toggle visible and below the deck; no horizontal overflow.

### Routing, errors, overflow

- Hash routing to the character page succeeded (`#dragunov`, `#victor`).
- No console errors, warnings, or uncaught exceptions were captured in the final run.
- `documentElement.scrollWidth` never exceeded the viewport at any target.

### Evidence integrity note

The running Vite instance initially served a cached hybrid stylesheet after the final mobile override (new base values but stale 390 values). The dev server was restarted, the served CSS was checked for `--fan-spread: 52px`, and computed variables were re-read at every breakpoint before the final captures (`0.46 / 92px`, `0.56 / 112px`, `0.40 / 52px`). The final evidence reflects the current files, not the stale cache.

---

## 6. Screenshots and supporting data

All Phase 2.7 evidence is in `evidence/phase-2.7/`.

### Before

- `before-1440-collapsed.png`
- `before-1440-expanded.png`
- `before-1440-layout.json`

### Final

- 1920×1080: `final-1920-collapsed.png`, `final-1920-expanded.png`, `final-1920-hover-{dragunov,claudio,jin,lars,victor}.png`
- 1440×900: `final-1440-collapsed.png`, `final-1440-expanded.png`, `final-1440-hover-{dragunov,claudio,jin,lars,victor}.png`, `final-1440-reduced-expanded.png`
- 768×1024: `final-768-collapsed.png`, `final-768-expanded.png`, `final-768-hover-{dragunov,claudio,jin,lars,victor}.png`
- 390×844: `final-390-collapsed.png`, `final-390-expanded.png`, `final-390-hover-{dragunov,claudio,jin,lars,victor}.png`, `final-390-touch-expanded.png`, `final-390-touch-after-second.png`
- Raw geometry: `final-neutral-geometry.json`
- Raw interaction/validation: `final-validation.json`
- Raw per-card hover matrix: `final-hover-matrix.json`

Intermediate Phase 2.7 captures (`after-1440-*.png`, `debug-label-dragunov.png`) were retained rather than overwritten; they are not the final evidence set.

---

## 7. Remaining limitations

- The 390 expanded cards are necessarily small: 120 × 160 CSS px before rotation, with ~11 px names. All five are distinct in the capture, but this is the tightest presentation and needs owner judgment.
- A hovered card can visually overlap a neighbour's label/artwork because the fan still layers cards. The band model keeps the neighbour's hit area usable and restores it on hover-away; the neutral expanded state has no label overlaps.
- On touch, the first tap expands the fan under the finger. A second tap at the exact same pixel selects whichever card now occupies that point; the verified normal flow is to tap the highlighted card after expansion. This is inherent to reveal-first reflow.
- The 768 fan uses almost the full content width (9.5 px margins per side). It fits and passes containment, but there is little room for longer localized labels.
- The collapsed 390 stack extends about 1.3 px past the left scrollport edge (pre-existing stack behavior; clipped by `overflow-x: hidden`, no horizontal scroll). The expanded fan is fully inside at 7.1 px margins.
- Validation is Chromium-headless only; no physical touch device or Safari/Firefox run was performed.
- Final visual polish remains subject to owner review.

---

## 8. Statuses

- Card/copy collision: **RESOLVED AND VERIFIED**
- Card/card separation: **RESOLVED AND VERIFIED**
- Per-card hover targetability: **20/20 VERIFIED**
- Single simultaneous hover: **VERIFIED**
- Label collisions in neutral expanded state: **0 AT ALL TARGETS**
- Persistent ordering/relative order: **VERIFIED**
- Keyboard focus/Tab/blur: **VERIFIED**
- Touch reveal-first and second-tap navigation: **VERIFIED**
- Reduced motion: **VERIFIED**
- Fan containment and no horizontal overflow: **VERIFIED**
- Shaders, formations, artwork, character pages, rendering infrastructure: **NOT MODIFIED IN PHASE 2.7**
- Overall phase: **IMPLEMENTED — AWAITING OWNER VISUAL REVIEW**

No commit or deployment has been made. Work stops here for visual review.
