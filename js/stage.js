/** SLEDGE — stage navigation: hash routing + focus management (spec §3.4).
    Environment routing flows through js/fx/engine.js (single owner of body[data-env]). */

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
