export type FacetId = 'status' | 'playstyle' | 'difficulty' | 'execution' | 'signature';

export interface FacetOption {
  value: string;
  label: string;
}
export interface Facet {
  id: FacetId;
  label: string;
  param: string;
  options: FacetOption[];
}

export const filterFacets: Facet[] = [
  {
    id: 'status', label: 'Status', param: 'status',
    options: [
      { value: 'main', label: 'Main' },
      { value: 'secondary', label: 'Secondary' },
      { value: 'lab', label: 'Lab' },
    ],
  },
  {
    id: 'playstyle', label: 'Playstyle', param: 'ps',
    options: [
      { value: 'aggressive', label: 'Aggressive' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'defensive', label: 'Defensive' },
    ],
  },
  {
    id: 'difficulty', label: 'Difficulty', param: 'df',
    options: [
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    id: 'execution', label: 'Execution', param: 'ex',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    id: 'signature', label: 'Signature', param: 'sg',
    options: [
      { value: 'all-rounder', label: 'All-rounder' },
      { value: 'easy-pressure', label: 'Easy pressure' },
      { value: 'damage', label: 'Damage' },
      { value: 'mixup-wall', label: 'Mix-up & wall carry' },
    ],
  },
];

export type SortValue = 'default' | 'name-asc' | 'name-desc' | 'difficulty';

export interface SortOption {
  value: SortValue;
  label: string;
}
export const sortOptions: SortOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'difficulty', label: 'Difficulty' },
];
