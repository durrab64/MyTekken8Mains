/**
 * SLEDGE — visual engine (Phase 5.1)
 * =================================
 * ISOLATION CONTRACT (spec Rev 3 §8.2)
 * The renderer owns: the #fx canvas, its GL resources and uniforms.
 * The renderer NEVER owns: page content, navigation, focus order,
 * history, or accessibility semantics. Content lives in index.html;
 * navigation lives in js/stage.js; the roster lives in js/roster.js.
 *
 * P5.1 STATUS: WebGL2 is deliberately NOT implemented. The backend is
 * a no-op that engages the CSS fallback (Tier 0). This file defines the
 * final interface now so P5.2 (atmosphere), P5.3 (particles) and P5.4
 * (composition + wipe) slot in without touching call sites.
 *
 * Tier nomenclature (spec Rev 3 §8.3, final):
 *   Tier 0 — CSS-only fallback (no WebGL). Also the success state here.
 *   Tier 1 — low WebGL (~450 particles, quarter-resolution).
 *   Tier 2 — medium WebGL (~1,100 particles).
 *   Tier 3 — high WebGL (~2,200 particles).
 * WebGL init failure or context loss ⇒ Tier 0. Never Tier 1.
 */

import {
  activateCssFallback,
  isReducedMotion,
  normalizeEnvironment,
} from './fallback.js';

const QUALITY_VALUES = ['auto', 'tier0', 'tier1', 'tier2', 'tier3'];

const state = {
  initialized: false,
  environment: normalizeEnvironment(document.body?.dataset.env),
  quality: 'auto',
  pointer: { x: 0.5, y: 0.5 },
};

const listeners = {
  tierchange: new Set(),
  error: new Set(),
};

function emit(type, payload) {
  for (const cb of listeners[type] ?? []) {
    try {
      cb(payload);
    } catch (error) {
      // Listeners must never break the renderer.
      console.error('fx listener error', error);
    }
  }
}

/**
 * Deterministic environment switch. In P5.2+ this crossfades shader
 * uniforms; in P5.1 it only reroutes the CSS atmosphere.
 * @param {string} id jin | claudio | dragunov | victor | lars
 */
function setEnvironment(id) {
  const env = normalizeEnvironment(id);
  state.environment = env;
  document.body.dataset.env = env;
  return env;
}

/** Pointer in normalized [0..1] coordinates. Engine lerps internally (P5.4). */
function setPointer(xNorm, yNorm) {
  state.pointer.x = clamp01(xNorm);
  state.pointer.y = clamp01(yNorm);
}

function setQuality(tier) {
  state.quality = QUALITY_VALUES.includes(tier) ? tier : 'auto';
}

function resize() {
  // No-op in Tier 0. P5.2: DPR-capped re-buffer.
}

/**
 * One-time initialization. Safe to call more than once.
 * In P5.1, always resolves to Tier 0. P5.2 attempts WebGL2 first and
 * falls back to Tier 0 on any failure.
 * @param {HTMLCanvasElement | null} canvas
 * @returns {Promise<{ ok: boolean, tier: 'tier0', reason: string }>}
 */
async function initialize(canvas) {
  if (state.initialized) {
    return { ok: true, tier: 'tier0', reason: 'already-initialized' };
  }

  const reduced = isReducedMotion();
  // P5.1: the shader backend does not exist yet — WebGL availability
  // changes nothing visible, so we don't probe for it (saves a context).
  // P5.2 attempts WebGL2 first and falls back on any failure.
  const reason = reduced ? 'reduced-motion' : 'p5.1-scaffold';
  const result = activateCssFallback(reason);

  state.initialized = true;
  setEnvironment(state.environment); // route CSS atmosphere from markup default
  emit('tierchange', { tier: 'tier0', reason });

  void canvas; // canvas reserved for the P5.2 backend
  return result;
}

function dispose() {
  state.initialized = false;
  listeners.tierchange.clear();
  listeners.error.clear();
}

/**
 * Subscribe to engine events.
 * @param {'tierchange' | 'error'} event
 * @param {(payload: any) => void} callback
 * @returns {() => void} unsubscribe
 */
function on(event, callback) {
  const bucket = listeners[event];
  if (!bucket) return () => {};
  bucket.add(callback);
  return () => bucket.delete(callback);
}

/** @returns snapshot for diagnostics — never consumption-critical. */
function inspect() {
  return { ...state, pointer: { ...state.pointer } };
}

function clamp01(value) {
  if (Number.isNaN(Number(value))) return 0.5;
  return Math.min(1, Math.max(0, Number(value)));
}

const renderer = Object.freeze({
  initialize,
  setEnvironment,
  setPointer,
  setQuality,
  resize,
  dispose,
  on,
  inspect,
});

export { renderer, createRenderer };

function createRenderer() {
  return renderer;
}

/* ----------------------------------------------------------------
 * P5.1 boot: engage Tier 0 on module evaluation. `<canvas id="fx">`
 * is present but inert until the WebGL backend lands in P5.2.
 * ---------------------------------------------------------------- */
const boot = () => {
  const canvas = document.getElementById('fx');
  initialize(canvas).catch((error) => {
    // Even a broken engine must never block the page.
    console.error('fx initialize failed; engaging Tier 0', error);
    activateCssFallback('initialize-error');
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
