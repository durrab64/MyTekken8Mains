/**
 * SLEDGE — brand & filter configuration (spec Rev 3 §5).
 * Facet definitions live here only. Adding a facet = one entry
 * in filterFacets + matching data attributes in the markup.
 * No other file needs to change.
 */

export const filterFacets = [
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    options: [
      { value: 'main', label: 'Main' },
      { value: 'secondary', label: 'Secondary' },
      { value: 'lab', label: 'Lab' },
    ],
  },
  {
    id: 'playstyle',
    label: 'Playstyle',
    param: 'ps',
    options: [
      { value: 'aggressive', label: 'Aggressive' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'defensive', label: 'Defensive' },
    ],
  },
  {
    id: 'difficulty',
    label: 'Difficulty',
    param: 'df',
    options: [
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    id: 'execution',
    label: 'Execution',
    param: 'ex',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    id: 'signature',
    label: 'Signature',
    param: 'sg',
    options: [
      { value: 'all-rounder', label: 'All-rounder' },
      { value: 'easy-pressure', label: 'Easy pressure' },
      { value: 'damage', label: 'Damage' },
      { value: 'mixup-wall', label: 'Mix-up & wall carry' },
    ],
  },
];

export const sortOptions = [
  { value: 'default', label: 'Default' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'difficulty', label: 'Difficulty' },
];
