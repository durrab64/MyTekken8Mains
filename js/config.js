// SLEDGE — brand, filters & environment registry (spec Rev 3 §3.5, §5).
// Five approved environments. Adding a character = one entry here + markup.
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
/** ENVIRONMENTS — approved identities (spec §3.5). mode: 0 jin pillar · 1 claudio rays · 2 dragunov low sun · 3 victor blade · 4 lars storm */
export const environments = {
jin: { deep:[.078,.043,.043], fog:[.24,.088,.074], glow:[.863,.149,.149], vein:[1,.6,.42], mode:0, origin:[.62,-.82], dir:[0,1.05], swirl:.7, size:1.15, tintA:[1,.52,.26], tintB:[1,.93,.82] },
claudio: { deep:[.02,.055,.105], fog:[.075,.19,.31], glow:[.34,.74,.95], vein:[.96,.83,.45], mode:1, origin:[0,.1], dir:[.05,.28], swirl:.95, size:.8, tintA:[.55,.8,1], tintB:[1,.95,.72] },
dragunov: { deep:[.078,.082,.075], fog:[.25,.28,.225], glow:[.55,.63,.47], vein:[.82,.83,.7], mode:2, origin:[-1.1,-.28],dir:[1.35,.12],swirl:.4, size:.9, tintA:[.74,.77,.67],tintB:[.93,.94,.88] },
victor: { deep:[.07,.064,.054], fog:[.31,.28,.22], glow:[.78,.72,.57], vein:[1,.9,.65], mode:3, origin:[0,.9], dir:[0,-.5], swirl:.5, size:.7, tintA:[.94,.86,.66],tintB:[1,.98,.9] },
lars: { deep:[.028,.075,.098], fog:[.1,.31,.38], glow:[.34,.9,.92], vein:[.78,.98,1], mode:4, origin:[-1.1,.4], dir:[1.15,-.18],swirl:1.15,size:1.0, tintA:[.45,.95,1], tintB:[1,1,1] },
};
