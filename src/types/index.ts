import type { CharacterId } from '../graphics/fallback';

export type { CharacterId };
export type Status = 'main' | 'secondary' | 'lab';
export type Playstyle = 'balanced' | 'aggressive' | 'defensive';
export type Difficulty = 'medium' | 'hard';
export type Execution = 'low' | 'medium' | 'high';
export type Signature = 'all-rounder' | 'easy-pressure' | 'damage' | 'mixup-wall';
export type SortKey = 'default' | 'name-asc' | 'name-desc' | 'difficulty';

export interface Character {
  id: CharacterId;
  name: string;
  first: string;
  last: string;
  order: number;
  index: string;
  status: Status;
  statusLabel: string;
  playstyle: Playstyle;
  playstyleLabel: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  execution: Execution;
  executionLabel: string;
  signature: Signature;
  signatureLabel: string;
  why: string;
  flip: boolean;
  prev: CharacterId;
  next: CharacterId;
  prevLabel: string;
  nextLabel: string;
  image: string;
  imageAlt: string;
}
