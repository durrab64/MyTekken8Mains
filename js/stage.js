/**
 * SLEDGE — character stage navigation (spec Rev 3 §3.4 / §4).
 * CSS-fade v1: hash routing + focus management with a ~350–400ms
 * fade/slide. The WebGL energy-wipe arrives in Phase 5 and will
 * reuse this DOM contract — stages remain plain sections.
 *
 * P5.1: environment routing flows through the (Tier 0) renderer —
 * js/fx/engine.js is the single owner of body[data-env].
 */

import { renderer } from './fx/engine.js';

const stages = new Map(
  [...document.querySelectorAll('.stage')].map((el) => [el.id, el]),
);

function stageFromHash() {
  const id = window.location.hash.replace(/^#/, '');
  return stages.has(id) ? id : null;
}

function activate(id, { focus = true } = {}) {
  const stage = stages.get(id);
  if (!stage) return;

  renderer.setEnvironment(id); // reroutes the CSS atmosphere (P5.1) / shader envs (P5.3+)

  stage.classList.remove('is-entering');
  void stage.offsetWidth; // deterministic reflow — restarts the animation
  stage.classList.add('is-entering');
  stage.addEventListener('animationend', () => stage.classList.remove('is-entering'), { once: true });

  const heading = stage.querySelector('h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    if (focus) heading.focus({ preventScroll: true });
  }
}

window.addEventListener('hashchange', () => {
  const id = stageFromHash();
  if (id) activate(id, { focus: true });
});

window.addEventListener('load', () => {
  // Deep links land on the stage without stealing focus on first paint.
  const id = stageFromHash();
  if (id) activate(id, { focus: false });
});
