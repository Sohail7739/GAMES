import { BalootEngine } from './engine.js';

export const balootModule = {
  meta: {
    code: 'baloot',
    name: 'Baloot',
    nameAr: 'بلوت',
    category: 'card',
    minPlayers: 4,
    maxPlayers: 4,
    defaultConfig: BalootEngine.meta.defaultConfig,
  },
  createEngine: (config) => new BalootEngine(config),
};
