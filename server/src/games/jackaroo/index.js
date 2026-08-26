import { JackarooEngine } from './engine.js';

export const jackarooModule = {
  meta: {
    code: 'jackaroo',
    name: 'Jackaroo',
    nameAr: 'جاكارو',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: JackarooEngine.meta.defaultConfig,
  },
  createEngine: (config) => new JackarooEngine(config),
};
