/** SLEDGE — Tier 0 (CSS-only) fallback manager: reduced-motion/WebGL2
    detection, CSS atmosphere routing via body[data-env], debug marker body[data-fx="css"]. */

export const CSS_ENVIRONMENTS = ['jin', 'claudio', 'dragunov', 'victor', 'lars'];
const FALLBACK_ENV = 'jin';

export function normalizeEnvironment(id) {
  return CSS_ENVIRONMENTS.includes(id) ? id : FALLBACK_ENV;
}

/** True when the user asked the OS for reduced motion. */
export function isReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when a WebGL2 context can be created. Never throws. */
export function hasWebGL2() {
  try {
    if (!window.WebGL2RenderingContext) return false;
    const probe = document.createElement('canvas');
    return !!probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  } catch {
    return false;
  }
}

/**
 * Engage Tier 0. Always safe to call, any number of times.
 * @param {string} reason debug-trace reason, surfaced as data-fx-reason
 * @returns {{ ok: true, tier: 'tier0', reason: string }}
 */
export function activateCssFallback(reason = 'fallback') {
  document.body.dataset.fx = 'css';
  document.body.dataset.fxReason = reason;
  return { ok: true, tier: 'tier0', reason };
}
