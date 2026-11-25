/**
 * Generic formation registry for the production renderer.
 *
 * This file defines the formation type system, configuration, and registry
 * used by the production WebGL renderer. It is intentionally generic: it
 * describes *which* formations exist and their execution characteristics,
 * but contains no character-specific GLSL geometry functions, no pulse
 * formula values, and no per-character shader implementation.
 *
 * Character-specific formation integration (Shades A–G in the roadmap) is
 * handled by per-character stages that consume this registry.
 *
 * Lars pulse values (envelope 0.18λ / ridge 0.05λ) are NOT defined here.
 * They remain exclusively in the laboratory shader source pending Stage C.
 */

export type FormationId = 'jin' | 'claudio' | 'dragunov' | 'victor' | 'lars';

export type FormationDetail = 'tier1' | 'tier2' | 'tier3';

export type FormationDepth = 'helix' | 'rings' | 'sheets' | 'dial' | 'trunk';

export type FormationExecution = 'analytic' | 'gpgpu';

/**
 * Character-specific animation metadata describing optional effect
 * capabilities for a formation.
 */
export interface FormationEffectCapabilities {
  /** Whether this formation uses per-particle pulse modulation. */
  requiresPulse: boolean;
  /** Pulse period in seconds (0 = no pulse). */
  pulsePeriod: number;
}

/**
 * Formation configuration describing execution characteristics and tier
 * mapping for a single character formation.
 */
export interface FormationConfig {
  id: FormationId;
  character: string;
  depth: FormationDepth;
  pulsePeriod: number;
  executionStrategy: FormationExecution;
  tierDetail: Record<FormationDetail, number>;
  requiresPulse: boolean;
}

/**
 * A registered formation entry, combining identity with configuration.
 */
export interface FormationEntry {
  id: FormationId;
  config: FormationConfig;
}

/**
 * Registry of all known formations. Each entry describes the execution
 * strategy, tier detail mapping, and effect capabilities for one character.
 *
 * No GLSL geometry functions or pulse formula values are stored here.
 * Those are supplied by per-character integration stages.
 */
export const FORMATION_REGISTRY: Record<FormationId, FormationEntry> = {
  jin: {
    id: 'jin',
    config: {
      id: 'jin',
      character: 'Jin Kazama',
      depth: 'helix',
      pulsePeriod: 0,
      executionStrategy: 'analytic',
      tierDetail: { tier1: 1, tier2: 4, tier3: 6 },
      requiresPulse: false,
    },
  },
  claudio: {
    id: 'claudio',
    config: {
      id: 'claudio',
      character: 'Claudio Serafino',
      depth: 'rings',
      pulsePeriod: 0,
      executionStrategy: 'analytic',
      tierDetail: { tier1: 1, tier2: 4, tier3: 6 },
      requiresPulse: false,
    },
  },
  dragunov: {
    id: 'dragunov',
    config: {
      id: 'dragunov',
      character: 'Sergei Dragunov',
      depth: 'sheets',
      pulsePeriod: 0,
      executionStrategy: 'analytic',
      tierDetail: { tier1: 1, tier2: 3, tier3: 9 },
      requiresPulse: false,
    },
  },
  victor: {
    id: 'victor',
    config: {
      id: 'victor',
      character: 'Victor Chevalier',
      depth: 'dial',
      pulsePeriod: 0,
      executionStrategy: 'analytic',
      tierDetail: { tier1: 1, tier2: 6, tier3: 12 },
      requiresPulse: false,
    },
  },
  lars: {
    id: 'lars',
    config: {
      id: 'lars',
      character: 'Lars Alexandersson',
      depth: 'trunk',
      pulsePeriod: 2.2,
      executionStrategy: 'analytic',
      tierDetail: { tier1: 2, tier2: 6, tier3: 10 },
      requiresPulse: true,
    },
  },
} as const;

/**
 * Shader-side formation indices. Used to set the `uFormation` uniform.
 */
export const FORMATION_INDEX: Record<FormationId, number> = {
  jin: 0,
  claudio: 1,
  dragunov: 2,
  victor: 3,
  lars: 4,
} as const;

/**
 * Map a character environment ID to its registered formation entry.
 * Throws for unknown IDs (should never happen when used with normalizeEnvironment).
 */
export function formationForEnvironment(
  id: FormationId,
): FormationEntry {
  const entry = FORMATION_REGISTRY[id];
  if (!entry) {
    throw new Error(`Unknown formation id: ${id}`);
  }
  return entry;
}

/**
 * Map a CapTier string to a FormationDetail level.
 */
export function tierToFormationDetail(tier: 'tier1' | 'tier2' | 'tier3'): FormationDetail {
  return tier as FormationDetail;
}

/**
 * Get the tier detail value for a formation at a given tier.
 */
export function formationDetailValue(
  entry: FormationEntry,
  tier: 'tier1' | 'tier2' | 'tier3',
): number {
  return entry.config.tierDetail[tier];
}
