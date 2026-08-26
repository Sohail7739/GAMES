import { LudoEngine } from './engine.js';

export const ludoModule = {
  meta: {
    code: 'ludo',
    name: 'Ludo Star',
    nameAr: 'لودو ستار',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: LudoEngine.meta.defaultConfig,
  },
  createEngine: (config) => new LudoEngine(config),
};
