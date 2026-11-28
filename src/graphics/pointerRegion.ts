/**
 * Pointer geometry for the hero formation field.
 *
 * The WebGL canvas is full-bleed, but particle formations are drawn into the
 * element marked `data-fx-region="hero"`. Pointer influence therefore has to
 * be normalized against that element's rectangle, not the viewport, and has to
 * fall back to a neutral value whenever the pointer is outside the field.
 */

export interface PointerRegionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NormalizedPointer {
  x: number;
  y: number;
}

/**
 * Sentry value outside the normalized [0, 1] field. The shader's distance
 * falloff treats it as "no pointer nearby", so fragments relax when the
 * cursor leaves the formation.
 */
export const NEUTRAL_FORMATION_POINTER: Readonly<NormalizedPointer> = { x: 2, y: 2 };

/**
 * Convert viewport/client coordinates into WebGL-style normalized coordinates
 * relative to `rect` (origin bottom-left, y-up). Returns null when the point is
 * outside the rectangle or the rectangle has no usable area.
 */
export function normalizePointerToRegion(
  clientX: number,
  clientY: number,
  rect: PointerRegionRect | null | undefined,
): NormalizedPointer | null {
  if (!rect) return null;
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const x = (clientX - rect.left) / rect.width;
  const y = 1 - (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

/**
 * Resolve a pointer event to a formation pointer target. Points outside the
 * region (or a missing region) resolve to the neutral sentry, which keeps the
 * caller deterministic during rapid boundary crossings.
 */
export function resolveFormationPointer(
  clientX: number,
  clientY: number,
  rect: PointerRegionRect | null | undefined,
): NormalizedPointer {
  return normalizePointerToRegion(clientX, clientY, rect) ?? { ...NEUTRAL_FORMATION_POINTER };
}
