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
stageGen.set(stage, my);
renderer.setEnvironment(id);
stage.classList.remove('is-entering');
void stage.offsetWidth;
stage.classList.add('is-entering');
clearTimeout(stage.__flareTimer);
stage.__flareTimer = setTimeout(() => {
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
const id = stageFromHash();
if (id) activate(id, { focus: false });
});
