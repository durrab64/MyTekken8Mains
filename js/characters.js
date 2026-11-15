/**
 * SLEDGE — roster data (factual metadata only, Rev 3 §2).
 * Single source of truth for identity-level facts. Narrative
 * content (why / identity / strengths / weaknesses / take) is
 * Phase 4 and lands only after owner approval.
 *
 * Facet values mirror the approved taxonomy (spec §5):
 * status: main | secondary | lab
 * playstyle: aggressive | balanced | defensive
 * difficulty: medium | hard
 * execution: low | medium | high
 * signature: all-rounder | easy-pressure | damage | mixup-wall
 */

export const characters = [
  {
    id: 'jin',
    name: 'Jin Kazama',
    order: 1,
    status: 'main',
    playstyle: 'balanced',
    difficulty: 'medium',
    execution: 'medium',
    signature: 'all-rounder',
  },
  {
    id: 'claudio',
    name: 'Claudio Serafino',
    order: 2,
    status: 'secondary',
    playstyle: 'aggressive',
    difficulty: 'medium',
    execution: 'low',
    signature: 'easy-pressure',
  },
  {
    id: 'dragunov',
    name: 'Sergei Dragunov',
    order: 3,
    status: 'lab',
    playstyle: 'aggressive',
    difficulty: 'hard',
    execution: 'high',
    signature: 'damage',
  },
  {
    id: 'victor',
    name: 'Victor Chevalier',
    order: 4,
    status: 'lab',
    playstyle: 'balanced',
    difficulty: 'hard',
    execution: 'high',
    signature: 'mixup-wall',
  },
  {
    id: 'lars',
    name: 'Lars Alexandersson',
    order: 5,
    status: 'secondary',
    playstyle: 'aggressive',
    difficulty: 'medium',
    execution: 'medium',
    signature: 'mixup-wall',
  },
];

export const charactersById = new Map(characters.map((c) => [c.id, c]));

export const difficultyRank = { medium: 1, hard: 2 };

export const defaultOrder = (a, b) => a.order - b.order;
