import { db, now } from '../../db/index.js';
import { randomCode } from '../../lib/ids.js';
import { getPublicUser } from '../../lib/dao.js';
import { MatchSession } from '../../engine/MatchSession.js';
import { gameRegistry } from '../../games/registry.js';
import { botAction } from '../../lib/bots.js';
import { logger } from '../../lib/logger.js';
import { roomsService } from './service.js';
import { gamesService } from '../games/service.js';

export class RoomSession {
  constructor({ id, code, gameCode, name, isPrivate, password, hostId, status, settings, io, onClose }) {
    this.id = id;
    this.code = code;
    this.gameCode = gameCode;
    this.name = name;
    this.isPrivate = isPrivate;
    this.password = password || '';
    this.hostId = hostId;
    this.settings = settings || {};
    this.io = io;
    this.onClose = onClose;
    this.status = status || 'waiting'; // waiting | playing | finished
    this.players = new Map(); // userId -> { seat, team, ready, user }
    this.match = null;
    this.sockets = new Map(); // socketId -> userId
    this.loadPersistedPlayers();
  }

  loadPersistedPlayers() {
    const rows = db
      .prepare('SELECT rp.*, u.username, u.avatar, u.is_bot FROM room_players rp JOIN users u ON u.id = rp.user_id WHERE rp.room_id = ? ORDER BY rp.seat')
      .all(this.id);
    for (const r of rows) {
      this.players.set(String(r.user_id), {
        seat: r.seat,
        team: r.team,
        ready: !!r.is_ready,
        user: { id: r.user_id, username: r.username, avatar: r.avatar, is_bot: !!r.is_bot },
      });
    }
  }

  meta() {
    const game = gamesService.getGame(this.gameCode);
    return { id: game.id, code: game.code, name: game.name, nameAr: game.name_ar, minPlayers: game.min_players, maxPlayers: game.max_players };
  }

  broadcast(event, payload) {
    if (!this.io) return;
    this.io.to(`room:${this.code}`).emit(event, payload);
  }

  snapshot() {
    const game = this.meta();
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      gameCode: this.gameCode,
      gameName: game.name,
      gameNameAr: game.nameAr,
      gameIcon: game.icon,
      gameColor: game.color,
      isPrivate: this.isPrivate,
      hasPassword: !!this.password,
      hostId: this.hostId,
      status: this.status,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      settings: this.settings,
      players: [...this.players.values()]
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({
          seat: p.seat,
          team: p.team,
          ready: p.ready,
          id: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          isBot: p.user.is_bot,
        })),
      matchCode: this.match ? this.match.code : null,
    };
  }

  persist() {
    db.prepare(
      `UPDATE rooms SET name=?, is_private=?, password=?, host_id=?, status=?, settings=? WHERE id=?`
    ).run(this.name, this.isPrivate ? 1 : 0, this.password, this.hostId, this.status, JSON.stringify(this.settings), this.id);
    db.prepare('DELETE FROM room_players WHERE room_id=?').run(this.id);
    const insert = db.prepare('INSERT INTO room_players (room_id, user_id, seat, team, is_ready) VALUES (?,?,?,?,?)');
    for (const p of this.players.values()) {
      insert.run(this.id, p.user.id, p.seat, p.team, p.ready ? 1 : 0);
    }
  }

  pushUpdate() {
    this.broadcast('room:update', { room: this.snapshot() });
  }

  // Socket wiring --------------------------------------------------------
  addSocket(socket) {
    this.sockets.set(socket.id, String(socket.data.user.id));
    socket.join(`room:${this.code}`);
    socket.data.roomCode = this.code;
  }

  removeSocket(socket) {
    this.sockets.delete(socket.id);
  }

  getPlayerSockets(userId) {
    const key = String(userId);
    const sockets = [];
    for (const [sid, uid] of this.sockets) {
      if (uid === key) sockets.push(sid);
    }
    return sockets;
  }

  // Player operations ----------------------------------------------------
  join(user, { password } = {}) {
    if (this.status === 'playing') throw new Error('ROOM_STARTED');
    if (this.isPrivate && this.password && this.password !== password) throw new Error('WRONG_PASSWORD');
    const game = this.meta();
    if (this.players.size >= game.maxPlayers) throw new Error('ROOM_FULL');
    if (this.players.has(String(user.id))) return;
    const seat = [...this.players.values()].reduce((max, p) => Math.max(max, p.seat), -1) + 1;
    const team = ['baloot'].includes(this.gameCode) ? (seat % 2) : this.gameCode === 'carrom' && game.maxPlayers === 4 ? (seat % 2) : 0;
    this.players.set(String(user.id), { seat, team, ready: true, user });
    this.persist();
    this.pushUpdate();
  }

  joinBot() {
    const game = this.meta();
    if (this.players.size >= game.maxPlayers) throw new Error('ROOM_FULL');
    const seat = [...this.players.values()].reduce((max, p) => Math.max(max, p.seat), -1) + 1;
    const existingIds = [...this.players.keys()].map((k) => Number(k));
    const placeholders = existingIds.length ? existingIds.map(() => '?').join(',') : 'NULL';
    const row = db
      .prepare(
        `SELECT id, username, avatar FROM users
         WHERE is_bot=1 AND id NOT IN (${placeholders})
         ORDER BY RANDOM() LIMIT 1`
      )
      .get(...existingIds);
    if (!row) {
      logger.error('No bots available for room', { roomCode: this.code, gameCode: this.gameCode });
      throw new Error('NO_BOTS_AVAILABLE');
    }
    const team = ['baloot'].includes(this.gameCode) ? (seat % 2) : this.gameCode === 'carrom' && game.maxPlayers === 4 ? (seat % 2) : 0;
    this.players.set(String(row.id), { seat, team, ready: true, user: { id: row.id, username: row.username, avatar: row.avatar, is_bot: true } });
    db.prepare('INSERT INTO room_players (room_id, user_id, seat, team, is_ready) VALUES (?,?,?,?,1)').run(this.id, row.id, seat, team);
    this.pushUpdate();
  }

  leave(userId) {
    if (this.status === 'playing') return; // keep seat during match
    const p = this.players.get(String(userId));
    if (!p) return;
    this.players.delete(String(userId));
    db.prepare('DELETE FROM room_players WHERE room_id=? AND user_id=?').run(this.id, userId);
    if (this.players.size === 0) {
      this.destroy();
      return;
    }
    if (this.hostId === userId) {
      const next = [...this.players.values()].sort((a, b) => a.seat - b.seat)[0];
      this.hostId = next.user.id;
      db.prepare('UPDATE rooms SET host_id=? WHERE id=?').run(this.hostId, this.id);
    }
    this.pushUpdate();
  }

  setReady(userId, ready) {
    const p = this.players.get(String(userId));
    if (p) {
      p.ready = ready;
      this.persist();
      this.pushUpdate();
    }
  }

  setSettings(hostId, settings) {
    if (hostId !== this.hostId) throw new Error('NOT_HOST');
    const game = this.meta();
    const defaults = gameRegistry.get(this.gameCode)?.meta.defaultConfig || {};
    const allowed = Object.keys(defaults);
    for (const k of allowed) {
      if (settings[k] !== undefined) this.settings[k] = settings[k];
    }
    this.persist();
    this.pushUpdate();
  }

  // Match flow -----------------------------------------------------------
  startMatch(hostId) {
    if (hostId !== this.hostId) throw new Error('NOT_HOST');
    if (this.status === 'playing') throw new Error('ALREADY_STARTED');
    const game = this.meta();
    if (this.players.size < game.minPlayers) throw new Error('NOT_ENOUGH_PLAYERS');
    if (this.players.size < game.maxPlayers && this.players.size < game.minPlayers) throw new Error('NOT_ENOUGH_PLAYERS');

    const matchPlayers = [...this.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({ seat: p.seat, team: p.team, user: p.user }));
    this.status = 'playing';
    this.persist();

    this.match = new MatchSession({
      room: { id: this.id, code: this.code, game_code: this.gameCode },
      players: matchPlayers,
      config: this.settings,
      io: this.io,
      roomSession: this,
    }).init();
    this.match.start();
    this.broadcast('room:started', { matchCode: this.match.code });
    this.pushUpdate();
    this.driveBots();
  }

  driveBots() {
    if (!this.match) return;
    this.match.driveBots();
  }

  onMatchAction(userId, action) {
    if (!this.match) return;
    const res = this.match.handleAction(userId, action);
    this.driveBots();
    return res;
  }

  onMatchFinished() {
    this.status = 'waiting';
    this.persist();
    for (const p of this.players.values()) p.ready = true;
    this.match = null;
    this.pushUpdate();
  }

  destroy() {
    db.prepare('DELETE FROM rooms WHERE id=?').run(this.id);
    this.io.to(`room:${this.code}`).emit('room:closed', { code: this.code });
    if (this.onClose) this.onClose(this.code);
    logger.info('Room destroyed', { code: this.code });
  }
}
