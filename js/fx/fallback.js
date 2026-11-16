export const CSS_ENVIRONMENTS = ['jin', 'claudio', 'dragunov', 'victor', 'lars'];
const FALLBACK_ENV = 'jin';
export function normalizeEnvironment(id) {
return CSS_ENVIRONMENTS.includes(id) ? id : FALLBACK_ENV;
}
export function isReducedMotion() {
try {
return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch {
return false;
}
}
export function activateCssFallback(reason = 'fallback') {
document.body.dataset.fx = 'css';
document.body.dataset.fxReason = reason;
return { ok: true, tier: 'tier0', reason };
}
