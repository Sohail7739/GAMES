import { CarromEngine } from './engine.js';

export const carromModule = {
  meta: {
    code: 'carrom',
    name: 'Carrom',
    nameAr: 'كاروم',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: CarromEngine.meta.defaultConfig,
  },
  createEngine: (config) => new CarromEngine(config),
};
