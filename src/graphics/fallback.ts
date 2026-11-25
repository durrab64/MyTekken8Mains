export const CSS_ENVIRONMENTS = ['jin', 'claudio', 'dragunov', 'victor', 'lars'] as const;
export type CharacterId = (typeof CSS_ENVIRONMENTS)[number];
const FALLBACK_ENV: CharacterId = 'jin';
export function normalizeEnvironment(id: string | null | undefined): CharacterId {
  const value = id ?? '';
  return (CSS_ENVIRONMENTS as readonly string[]).includes(value) ? (value as CharacterId) : FALLBACK_ENV;
}
export function isReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
export function activateCssFallback(reason = 'fallback') {
  document.body.dataset.fx = 'css';
  document.body.dataset.fxReason = reason;
  return { ok: true as const, tier: 'tier0' as const, reason };
}
