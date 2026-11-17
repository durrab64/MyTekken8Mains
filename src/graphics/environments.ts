import type { CharacterId } from './fallback';

export interface EnvironmentConfig {
  deep: [number, number, number];
  fog: [number, number, number];
  glow: [number, number, number];
  vein: [number, number, number];
  mode: number;
  origin: [number, number];
  dir: [number, number];
  swirl: number;
  size: number;
  tintA: [number, number, number];
  tintB: [number, number, number];
  sharp: number;
}

export const environments: Record<CharacterId, EnvironmentConfig> = {
  jin: {deep:[.05,.024,.02],fog:[.13,.05,.038],glow:[.7,.11,.055],vein:[.95,.3,.12],mode:0,origin:[.62,-.82],dir:[0,1.05],swirl:.9,size:.8,tintA:[.95,.34,.1],tintB:[1,.72,.3],sharp:6},
  claudio: {deep:[.014,.028,.055],fog:[.085,.12,.2],glow:[.5,.68,.88],vein:[.95,.83,.48],mode:1,origin:[0,.08],dir:[.05,.22],swirl:.3,size:1.35,tintA:[.38,.62,.92],tintB:[.97,.9,.6],sharp:2.6},
  dragunov:{deep:[.018,.026,.04],fog:[.065,.1,.15],glow:[.3,.42,.55],vein:[.75,.85,.94],mode:2,origin:[-1.1,-.28],dir:[1.15,.12],swirl:.25,size:.5,tintA:[.34,.42,.54],tintB:[.78,.86,.94],sharp:11},
  victor: {deep:[.026,.016,.05],fog:[.085,.055,.15],glow:[.42,.22,.72],vein:[.18,.78,.85],mode:3,origin:[0,.9],dir:[0,-.55],swirl:.5,size:.5,tintA:[.48,.25,.82],tintB:[.16,.8,.86],sharp:8},
  lars:    {deep:[.006,.022,.055],fog:[.03,.09,.2],glow:[.18,.55,.95],vein:[.95,.8,.28],mode:4,origin:[-1.1,.4],dir:[1.25,-.22],swirl:1.25,size:.75,tintA:[.2,.62,.95],tintB:[.95,.78,.22],sharp:3.4},
};
