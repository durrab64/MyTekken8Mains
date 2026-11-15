/**
 * SLEDGE — hero ember field (Phase 2)
 * Progressive enhancement only: the hero is fully readable with this
 * file missing. Embers never spawn when reduced motion is requested.
 * The WebGL2 engine (Phase 5) replaces this visual; the DOM it targets
 * (<div class="ember-field">) is unchanged.
 */

const field = document.querySelector('.ember-field');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const densityFor = () => (window.innerWidth <= 640 ? 10 : window.innerWidth <= 1080 ? 16 : 22);

function clearField() {
  if (field) field.replaceChildren();
}

function spawnEmbers() {
  if (!field) return;
  clearField();

  const count = densityFor();
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i += 1) {
    const ember = document.createElement('span');
    ember.className = 'ember';
    const size = (Math.random() * 3.4 + 2.2).toFixed(2);
    ember.style.setProperty('--x', `${(50 + Math.random() * 44).toFixed(2)}%`); // weighted toward the pillar
    ember.style.setProperty('--s', `${size}px`);
    ember.style.setProperty('--t', `${(Math.random() * 6 + 7).toFixed(2)}s`);   // 7–13s rise
    ember.style.setProperty('--d', `${(Math.random() * -13).toFixed(2)}s`);     // pre-staggered mid-flight
    ember.style.setProperty('--drift', `${(Math.random() * 22 - 11).toFixed(2)}rem`);
    fragment.appendChild(ember);
  }

  field.appendChild(fragment);
}

function sync() {
  if (reduceMotion.matches) {
    clearField();
  } else {
    spawnEmbers();
  }
}

if (field) {
  reduceMotion.addEventListener('change', sync);

  // Re-density only when crossing a breakpoint band.
  let band = densityFor();
  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const next = densityFor();
      if (next !== band) {
        band = next;
        if (!reduceMotion.matches) spawnEmbers();
      }
    }, 200);
  });

  sync();
}
