import { db, now } from '../../db/index.js';
import { BadRequest, NotFound, Conflict, Forbidden } from '../../lib/errors.js';
import { randomCode } from '../../lib/ids.js';
import { getPublicUser } from '../../lib/dao.js';
import { gamesService } from '../games/service.js';

export const roomsService = {
  createRoom(user, { gameCode, name, isPrivate, password, settings }) {
    const game = gamesService.getGame(gameCode);
    if (!game.enabled) throw new Forbidden('Game is disabled');
    const code = randomCode(5);
    const roomName = name || `${game.name} Room`;
    const info = db
      .prepare(
        `INSERT INTO rooms (code, game_id, name, is_private, password, host_id, settings, status)
         SELECT ?, id, ?, ?, ?, ?, ?, 'waiting' FROM games WHERE code = ?`
      )
      .run(code, roomName, isPrivate ? 1 : 0, password || '', user.id, JSON.stringify(settings || game.config || {}), gameCode);
    db.prepare('INSERT INTO room_players (room_id, user_id, seat, is_ready) VALUES (?,?,0,1)').run(info.lastInsertRowid, user.id);
    return this.getRoomByCode(code);
  },

  getRoom(idOrCode) {
    const row = db
      .prepare('SELECT r.*, g.code game_code, g.name game_name, g.name_ar game_name_ar, g.icon, g.color, g.min_players, g.max_players FROM rooms r JOIN games g ON g.id = r.game_id WHERE r.code = ? OR r.id = ?')
      .get(idOrCode, idOrCode);
    if (!row) throw new NotFound('Room not found');
    const players = db
      .prepare(
        `SELECT rp.seat, rp.team, rp.is_ready ready, u.id, u.username, u.avatar, u.level, u.is_bot, u.status
         FROM room_players rp JOIN users u ON u.id = rp.user_id WHERE rp.room_id = ? ORDER BY rp.seat`
      )
      .all(row.id);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      gameCode: row.game_code,
      gameName: row.game_name,
      gameNameAr: row.game_name_ar,
      gameIcon: row.icon,
      gameColor: row.color,
      isPrivate: !!row.is_private,
      hasPassword: !!row.password,
      hostId: row.host_id,
      status: row.status,
      minPlayers: row.min_players,
      maxPlayers: row.max_players,
      settings: JSON.parse(row.settings || '{}'),
      players,
      createdAt: row.created_at,
    };
  },

  getRoomByCode(code) {
    return this.getRoom(code);
  },

  listPublic() {
    const rows = db
      .prepare(
        `SELECT r.*, g.code game_code, g.name game_name, g.name_ar game_name_ar, g.icon, g.color, g.min_players, g.max_players,
                (SELECT COUNT(*) FROM room_players rp WHERE rp.room_id = r.id) player_count
         FROM rooms r JOIN games g ON g.id = r.game_id
         WHERE r.is_private = 0 AND r.status = 'waiting'
         ORDER BY r.id DESC LIMIT 50`
      )
      .all();
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      gameCode: r.game_code,
      gameName: r.game_name,
      gameNameAr: r.game_name_ar,
      gameIcon: r.icon,
      gameColor: r.color,
      isPrivate: false,
      status: r.status,
      minPlayers: r.min_players,
      maxPlayers: r.max_players,
      players: r.player_count,
      createdAt: r.created_at,
    }));
  },

  joinRoomDb(userId, code, password) {
    const row = db
      .prepare('SELECT r.* FROM rooms r WHERE r.code = ?')
      .get(code);
    if (!row) throw new NotFound('Room not found');
    if (row.status !== 'waiting') throw new Conflict('Room already started');
    if (row.password && row.password !== password) throw new Forbidden('Incorrect room password');
    const count = db.prepare('SELECT COUNT(*) c FROM room_players WHERE room_id=?').get(row.id).c;
    const maxPlayers = db.prepare('SELECT max_players FROM games WHERE id=?').get(row.game_id).max_players;
    if (count >= maxPlayers) throw new Conflict('Room is full');
    const exists = db.prepare('SELECT 1 FROM room_players WHERE room_id=? AND user_id=?').get(row.id, userId);
    if (exists) return this.getRoom(row.code);
    const seat = count;
    const team = ['baloot', 'carrom'].includes(db.prepare('SELECT code FROM games WHERE id=?').get(row.game_id).code) && maxPlayers === 4 ? (seat % 2) : 0;
    db.prepare('INSERT INTO room_players (room_id, user_id, seat, team, is_ready) VALUES (?,?,?,?,1)').run(
      row.id,
      userId,
      seat,
      team
    );
    return this.getRoom(row.code);
  },

  leaveRoomDb(userId, code) {
    const row = db.prepare('SELECT r.* FROM rooms r WHERE r.code = ?').get(code);
    if (!row) throw new NotFound('Room not found');
    const info = db
      .prepare('DELETE FROM room_players WHERE room_id=? AND user_id=?')
      .run(row.id, userId);
    if (info.changes === 0) return false;
    const remaining = db.prepare('SELECT COUNT(*) c FROM room_players WHERE room_id=?').get(row.id).c;
    if (remaining === 0) {
      db.prepare('DELETE FROM rooms WHERE id=?').run(row.id);
    } else if (row.host_id === userId) {
      const next = db.prepare('SELECT user_id FROM room_players WHERE room_id=? ORDER BY seat LIMIT 1').get(row.id);
      if (next) db.prepare('UPDATE rooms SET host_id=? WHERE id=?').run(next.user_id, row.id);
    }
    return true;
  },
};
