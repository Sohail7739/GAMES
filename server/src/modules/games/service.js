import { db } from '../../db/index.js';
import { NotFound } from '../../lib/errors.js';

function rowToGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.name_ar,
    description: row.description,
    descriptionAr: row.description_ar,
    category: row.category,
    icon: row.icon,
    color: row.color,
    enabled: !!row.enabled,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    config: JSON.parse(row.config || '{}'),
    sortOrder: row.sort_order,
    online: 0,
  };
}

export const gamesService = {
  listGames() {
    return db.prepare('SELECT * FROM games ORDER BY sort_order').all().map(rowToGame);
  },

  listEnabled() {
    return db.prepare('SELECT * FROM games WHERE enabled=1 ORDER BY sort_order').all().map(rowToGame);
  },

  getGame(code) {
    const g = rowToGame(db.prepare('SELECT * FROM games WHERE code=?').get(code));
    if (!g) throw new NotFound('Game not found');
    return g;
  },

  getById(id) {
    return rowToGame(db.prepare('SELECT * FROM games WHERE id=?').get(id));
  },

  isEnabled(code) {
    const row = db.prepare('SELECT enabled FROM games WHERE code=?').get(code);
    return row ? !!row.enabled : false;
  },

  onlineCount(code) {
    return db.prepare('SELECT COUNT(*) c FROM users WHERE status=\'online\'').get().c;
  },
};
