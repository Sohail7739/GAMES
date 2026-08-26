import { balootModule } from './baloot/index.js';
import { jackarooModule } from './jackaroo/index.js';
import { carromModule } from './carrom/index.js';
import { ludoModule } from './ludo/index.js';

/**
 * Game module registry.
 * Each module exports:
 *   meta        — { code, name, nameAr, category, minPlayers, maxPlayers,
 *                   defaultConfig, dbGameId }
 *   createEngine(config) -> GameEngine
 *
 * Adding a new game = add the import + entry here. Nothing else changes.
 */
class GameRegistry {
  constructor() {
    this.modules = new Map();
  }

  register(module) {
    this.modules.set(module.meta.code, module);
  }

  get(code) {
    return this.modules.get(code);
  }

  has(code) {
    return this.modules.has(code);
  }

  list() {
    return [...this.modules.values()].map((m) => m.meta);
  }

  createEngine(code, config) {
    const mod = this.modules.get(code);
    if (!mod) throw new Error(`Unknown game module: ${code}`);
    return mod.createEngine(config);
  }
}

export const gameRegistry = new GameRegistry();

export function registerGames() {
  gameRegistry.register(balootModule);
  gameRegistry.register(jackarooModule);
  gameRegistry.register(carromModule);
  gameRegistry.register(ludoModule);
}
