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
  gain?: number;
}

export const environments: Record<CharacterId, EnvironmentConfig> = {
  jin: {deep:[.045,.008,.01],fog:[.14,.026,.028],glow:[.62,.06,.05],vein:[.9,.12,.1],mode:0,origin:[0,-1],dir:[.1,1.6],swirl:.5,size:.95,tintA:[.92,.1,.07],tintB:[1,.38,.24],sharp:7,gain:1.65},
  claudio: {deep:[.008,.03,.06],fog:[.04,.11,.19],glow:[.32,.68,.9],vein:[.55,.88,1],mode:1,origin:[0,-.55],dir:[.04,1.05],swirl:.42,size:1,tintA:[.32,.7,.95],tintB:[.82,.96,1],sharp:3.4,gain:1.5},
  dragunov:{deep:[.014,.022,.034],fog:[.05,.082,.12],glow:[.26,.38,.5],vein:[.62,.78,.9],mode:2,origin:[-.35,-.95],dir:[.7,1.7],swirl:.2,size:.82,tintA:[.56,.68,.8],tintB:[.9,.96,1],sharp:9,gain:1.85},
  victor: {deep:[.03,.008,.06],fog:[.075,.035,.15],glow:[.46,.2,.82],vein:[.55,.28,1],mode:3,origin:[0,1],dir:[0,-1.75],swirl:.22,size:.66,tintA:[.58,.3,.95],tintB:[.86,.78,1],sharp:9,gain:1.8},
  lars:    {deep:[.006,.022,.055],fog:[.02,.06,.14],glow:[.12,.42,.78],vein:[.16,.46,.78],mode:4,origin:[-1.1,.4],dir:[1.25,-.22],swirl:1.25,size:.75,tintA:[.2,.62,.95],tintB:[.72,.90,1],sharp:3.4},
};
