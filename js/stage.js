/** SLEDGE — stage navigation: hash routing + focus management (spec §3.4).
Environment routing flows through js/fx/engine.js (single owner of body[data-env]). */
import { renderer } from './fx/engine.js';
const stages = new Map(
[...document.querySelectorAll('.stage')].map((el) => [el.id, el]),
);
const stageGen = new WeakMap();
function stageFromHash() {
const id = window.location.hash.replace(/^#/, '');
return stages.has(id) ? id : null;
}
function activate(id, { focus = true } = {}) {
const stage = stages.get(id);
if (!stage) return;
const my = (stageGen.get(stage) || 0) + 1;
stageGen.set(stage, my); // per-stage generation — latest activation wins
renderer.setEnvironment(id); // 380ms env crossfade + midpoint particle reseed (P5.4)
stage.classList.remove('is-entering');
void stage.offsetWidth; // deterministic reflow — restarts the animation
stage.classList.add('is-entering');
clearTimeout(stage.__flareTimer);
stage.__flareTimer = setTimeout(() => {
// remove regardless of animation clock state (headless/frozen timelines)
if (stageGen.get(stage) === my) stage.classList.remove('is-entering');
}, 400);
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
