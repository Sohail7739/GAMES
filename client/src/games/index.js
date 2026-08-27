import ludo from './ludo/index.js';
import baloot from './baloot/index.js';
import jackaroo from './jackaroo/index.js';
import carrom from './carrom/index.js';

export const gameModules = {
  ludo,
  baloot,
  jackaroo,
  carrom,
};

export function getGameView(code) {
  const mod = gameModules[code];
  return mod ? mod.component : null;
}

export function getGameMeta(code) {
  const mod = gameModules[code];
  return mod ? mod.meta : null;
}
