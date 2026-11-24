import type { FormationId } from './formation';

/**
 * Stage B restoration data. These values are recovered from the original
 * Motion Lab formation registry and palettes; they are intentionally kept out
 * of the owner-authored production formation registry so that file remains
 * unchanged.
 */
export interface FormationParticlePalette {
  tintA: [number, number, number];
  tintB: [number, number, number];
  fog: [number, number, number];
}

/** Original formation envelope radius (stage units). */
export const FORMATION_RADIUS: Record<FormationId, number> = {
  jin: 0.34,
  claudio: 0.63,
  dragunov: 1.25,
  victor: 0.5,
  lars: 1.2,
};

/** Original lab filament counts per tier; only Jin consumes this directly. */
export const FORMATION_TIER_FILAMENTS: Record<'tier1' | 'tier2' | 'tier3', number> = {
  tier1: 1,
  tier2: 4,
  tier3: 6,
};

/**
 * Original Motion Lab particle palettes. Lars is listed for completeness but
 * its production particle colors remain driven by the approved environment.
 */
export const FORMATION_PARTICLE_PALETTE: Record<FormationId, FormationParticlePalette> = {
  jin: {
    tintA: [0.95, 0.34, 0.1],
    tintB: [1, 0.72, 0.3],
    fog: [0.13, 0.05, 0.038],
  },
  claudio: {
    tintA: [0.38, 0.62, 0.92],
    tintB: [0.97, 0.9, 0.6],
    fog: [0.085, 0.12, 0.2],
  },
  dragunov: {
    tintA: [0.34, 0.42, 0.54],
    tintB: [0.78, 0.86, 0.94],
    fog: [0.065, 0.1, 0.15],
  },
  victor: {
    tintA: [0.48, 0.25, 0.82],
    tintB: [0.16, 0.8, 0.86],
    fog: [0.085, 0.055, 0.15],
  },
  lars: {
    tintA: [0.15, 0.5, 1],
    tintB: [0.72, 0.9, 1],
    fog: [0.04, 0.15, 0.38],
  },
};
