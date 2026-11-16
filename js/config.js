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
export const environments = {
jin: { deep:[.05,.024,.02], fog:[.13,.05,.038], glow:[.7,.11,.055], vein:[.95,.3,.12], mode:0, origin:[.62,-.82], dir:[0,1.05], swirl:.7, size:1.15, tintA:[.95,.34,.1], tintB:[1,.68,.3] },
claudio: { deep:[.012,.035,.07], fog:[.05,.12,.21], glow:[.2,.52,.8], vein:[.75,.58,.24], mode:1, origin:[0,.1], dir:[.05,.28], swirl:.95, size:.8, tintA:[.22,.5,.9], tintB:[.82,.72,.45] },
dragunov: { deep:[.045,.05,.042], fog:[.13,.15,.115], glow:[.34,.42,.26], vein:[.6,.63,.46], mode:2, origin:[-1.1,-.28],dir:[1.35,.12],swirl:.4, size:.8, tintA:[.36,.4,.28],tintB:[.52,.55,.42] },
victor: { deep:[.045,.038,.03], fog:[.17,.15,.11], glow:[.6,.52,.36], vein:[.85,.7,.4], mode:3, origin:[0,.9], dir:[0,-.5], swirl:.5, size:.7, tintA:[.68,.54,.3],tintB:[.82,.71,.44] },
lars: { deep:[.014,.042,.06], fog:[.055,.17,.21], glow:[.2,.62,.68], vein:[.58,.9,.95], mode:4, origin:[-1.1,.4], dir:[1.15,-.18],swirl:1.15,size:.9, tintA:[.18,.62,.8], tintB:[.55,.8,.88] },
};
