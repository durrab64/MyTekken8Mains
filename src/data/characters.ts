import type { Character } from '../types';
import type { Difficulty } from '../types';

export const characters: Character[] = [
  {
    id: 'jin', name: 'Jin Kazama', first: 'Jin', last: 'Kazama', order: 1, index: '01',
    status: 'main', statusLabel: 'Main', playstyle: 'balanced', playstyleLabel: 'Balanced',
    difficulty: 'medium', difficultyLabel: 'Medium', execution: 'medium', executionLabel: 'Medium',
    signature: 'all-rounder', signatureLabel: 'All-rounder',
    why: 'Jin is my main. I enjoy his balance between aggressive and defensive gameplay.',
    flip: false, prev: 'lars', next: 'claudio', prevLabel: 'Lars', nextLabel: 'Claudio',
    image: '/assets/images/fullbody/jin_fullbody.png',
    imageAlt: 'Jin Kazama, full-body Tekken 8 render',
  },
  {
    id: 'claudio', name: 'Claudio Serafino', first: 'Claudio', last: 'Serafino', order: 2, index: '02',
    status: 'secondary', statusLabel: 'Secondary', playstyle: 'aggressive', playstyleLabel: 'Aggressive',
    difficulty: 'medium', difficultyLabel: 'Medium', execution: 'low', executionLabel: 'Low',
    signature: 'easy-pressure', signatureLabel: 'Easy pressure',
    why: "Claudio is my secondary. I like that he's good and easy to use.",
    flip: true, prev: 'jin', next: 'dragunov', prevLabel: 'Jin', nextLabel: 'Dragunov',
    image: '/assets/images/fullbody/claudio_fullbody.png',
    imageAlt: 'Claudio Serafino, full-body Tekken 8 render',
  },
  {
    id: 'dragunov', name: 'Sergei Dragunov', first: 'Sergei', last: 'Dragunov', order: 3, index: '03',
    status: 'lab', statusLabel: 'Lab', playstyle: 'aggressive', playstyleLabel: 'Aggressive',
    difficulty: 'hard', difficultyLabel: 'Hard', execution: 'high', executionLabel: 'High',
    signature: 'damage', signatureLabel: 'Damage',
    why: 'I like Dragunov because he requires skill to use effectively and offers high damage.',
    flip: false, prev: 'claudio', next: 'victor', prevLabel: 'Claudio', nextLabel: 'Victor',
    image: '/assets/images/fullbody/dragunov_fullbody.png',
    imageAlt: 'Sergei Dragunov, full-body Tekken 8 render',
  },
  {
    id: 'victor', name: 'Victor Chevalier', first: 'Victor', last: 'Chevalier', order: 4, index: '04',
    status: 'lab', statusLabel: 'Lab', playstyle: 'balanced', playstyleLabel: 'Balanced',
    difficulty: 'hard', difficultyLabel: 'Hard', execution: 'high', executionLabel: 'High',
    signature: 'mixup-wall', signatureLabel: 'Mix-up & wall carry',
    why: "I enjoy Victor's damage, wall carry and mix-up options.",
    flip: true, prev: 'dragunov', next: 'lars', prevLabel: 'Dragunov', nextLabel: 'Lars',
    image: '/assets/images/fullbody/victor_fullbody.png',
    imageAlt: 'Victor Chevalier, full-body Tekken 8 render',
  },
  {
    id: 'lars', name: 'Lars Alexandersson', first: 'Lars', last: 'Alexandersson', order: 5, index: '05',
    status: 'secondary', statusLabel: 'Secondary', playstyle: 'aggressive', playstyleLabel: 'Aggressive',
    difficulty: 'medium', difficultyLabel: 'Medium', execution: 'medium', executionLabel: 'Medium',
    signature: 'mixup-wall', signatureLabel: 'Mix-up & wall carry',
    why: "I enjoy Lars's mix-ups, damage and wall carry.",
    flip: false, prev: 'victor', next: 'jin', prevLabel: 'Victor', nextLabel: 'Jin',
    image: '/assets/images/fullbody/lars_fullbody.png',
    imageAlt: 'Lars Alexandersson, full-body Tekken 8 render',
  },
];

export const difficultyRank: Record<Difficulty, number> = { medium: 1, hard: 2 };
export const defaultOrder = (a: Character, b: Character): number => a.order - b.order;
