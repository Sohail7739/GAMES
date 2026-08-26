import { Server } from 'socket.io';
import { db } from '../../db/index.js';
import { randomCode } from '../../lib/ids.js';
import { verifyToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { presenceHub } from '../presence/hub.js';
import { notificationsService } from '../notifications/service.js';
import { RoomSession } from '../rooms/session.js';
import { gamesService } from '../games/service.js';
import { MatchmakingService } from '../matchmaking/service.js';

export class RealtimeHub {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 25000,
      pingInterval: 10000,
    });
    this.rooms = new Map(); // roomCode -> RoomSession
    this.matchmaking = new MatchmakingService(this);
    presenceHub.injectEmitter(this.io);
    notificationsService.injectEmitter(this.io);
    this.setupAuth();
    this.io.on('connection', (socket) => this.onConnection(socket));
    logger.info('Realtime hub ready');
  }

  setupAuth() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('AUTH_REQUIRED'));
      try {
        const payload = verifyToken(token);
        const user = db.prepare('SELECT id, username, role, avatar, banned FROM users WHERE id=?').get(Number(payload.sub));
        if (!user || user.banned) return next(new Error('INVALID_USER'));
        socket.data.user = user;
        next();
      } catch {
        next(new Error('INVALID_TOKEN'));
      }
    });
  }

  onConnection(socket) {
    const user = socket.data.user;
    presenceHub.addSocket(user.id, socket);
    socket.join(`user:${user.id}`);

    socket.on('room:join', (payload) => this.handleRoomJoin(socket, payload));
    socket.on('room:leave', () => this.handleRoomLeave(socket));
    socket.on('room:ready', (payload) => this.handleRoomReady(socket, payload));
    socket.on('room:start', () => this.handleRoomStart(socket));
    socket.on('room:addBot', () => this.handleAddBot(socket));
    socket.on('room:settings', (payload) => this.handleRoomSettings(socket, payload));
    socket.on('room:chat', (payload) => this.handleRoomChat(socket, payload));
    socket.on('match:join', (payload) => this.handleMatchJoin(socket, payload));
    socket.on('match:action', (payload) => this.handleMatchAction(socket, payload));
    socket.on('matchmaking:queue', (payload) => this.handleMatchmakingQueue(socket, payload));
    socket.on('matchmaking:cancel', () => this.handleMatchmakingCancel(socket));

    socket.on('disconnect', () => {
      presenceHub.removeSocket(user.id, socket);
      const room = this.roomForSocket(socket);
      if (room) {
        room.removeSocket(socket);
        if (room.status === 'playing' && room.match) room.match.removeSocket(socket);
      }
    });
  }

  roomForSocket(socket) {
    return this.rooms.get(socket.data.roomCode) || null;
  }

  ensureRoomSession(code) {
    if (this.rooms.has(code)) return this.rooms.get(code);
    const row = db
      .prepare('SELECT r.*, g.code game_code FROM rooms r JOIN games g ON g.id = r.game_id WHERE r.code = ?')
      .get(code);
    if (!row) return null;
    const session = new RoomSession({
      id: row.id,
      code: row.code,
      gameCode: row.game_code,
      name: row.name,
      isPrivate: !!row.is_private,
      password: row.password || '',
      hostId: row.host_id,
      settings: JSON.parse(row.settings || '{}'),
      io: this.io,
    });
    this.rooms.set(code, session);
    return session;
  }

  createMatchRoom({ gameCode, host }) {
    const game = gamesService.getGame(gameCode);
    const code = randomCode(5);
    const name = `${game.name} Match`;
    const info = db
      .prepare(`INSERT INTO rooms (code, game_id, name, is_private, host_id, status, settings) SELECT ?, id, ?, 1, ?, 'waiting', ? FROM games WHERE code = ?`)
      .run(code, name, host.id, JSON.stringify(game.config || {}), gameCode);
    db.prepare('INSERT INTO room_players (room_id, user_id, seat, is_ready) VALUES (?,?,0,1)').run(info.lastInsertRowid, host.id);
    const session = new RoomSession({
      id: info.lastInsertRowid,
      code,
      gameCode,
      name,
      isPrivate: true,
      password: '',
      hostId: host.id,
      settings: game.config || {},
      io: this.io,
    });
    this.rooms.set(code, session);
    return session;
  }

  // Handlers -------------------------------------------------------------
  handleRoomJoin(socket, { code, password } = {}) {
    try {
      const room = this.ensureRoomSession(code);
      if (!room) return socket.emit('room:error', { message: 'ROOM_NOT_FOUND' });
      const user = { id: socket.data.user.id, username: socket.data.user.username, avatar: socket.data.user.avatar, is_bot: false };
      room.addSocket(socket);
      if (room.status === 'playing') {
        socket.emit('room:joined', { room: room.snapshot() });
        return;
      }
      room.join(user, { password });
      socket.emit('room:joined', { room: room.snapshot() });
      room.pushUpdate();
    } catch (err) {
      socket.emit('room:error', { message: err.message || 'JOIN_FAILED' });
    }
  }

  handleRoomLeave(socket) {
    const room = this.roomForSocket(socket);
    if (!room) return;
    const userId = socket.data.user.id;
    room.removeSocket(socket);
    socket.leave(`room:${room.code}`);
    socket.data.roomCode = null;
    if (room.status === 'waiting') {
      room.leave(userId);
      if (this.rooms.get(room.code)) room.pushUpdate();
    }
    socket.emit('room:left', { code: room.code });
  }

  handleRoomReady(socket, { ready }) {
    const room = this.roomForSocket(socket);
    if (!room) return;
    room.setReady(socket.data.user.id, !!ready);
  }

  handleRoomStart(socket) {
    const room = this.roomForSocket(socket);
    if (!room) return;
    try {
      room.startMatch(socket.data.user.id);
    } catch (err) {
      socket.emit('room:error', { message: err.message || 'START_FAILED' });
    }
  }

  handleAddBot(socket) {
    const room = this.roomForSocket(socket);
    if (!room || room.status !== 'waiting') return;
    if (socket.data.user.id !== room.hostId) return socket.emit('room:error', { message: 'NOT_HOST' });
    try {
      room.joinBot();
    } catch (err) {
      socket.emit('room:error', { message: err.message || 'BOT_FAILED' });
    }
  }

  handleRoomSettings(socket, { settings }) {
    const room = this.roomForSocket(socket);
    if (!room) return;
    try {
      room.setSettings(socket.data.user.id, settings || {});
    } catch (err) {
      socket.emit('room:error', { message: err.message || 'SETTINGS_FAILED' });
    }
  }

  handleRoomChat(socket, { message } = {}) {
    const room = this.roomForSocket(socket);
    if (!room || typeof message !== 'string' || !message.trim()) return;
    room.broadcast('room:chat', {
      user: { id: socket.data.user.id, username: socket.data.user.username, avatar: socket.data.user.avatar },
      message: message.slice(0, 300),
      at: Date.now(),
    });
  }

  handleMatchJoin(socket, { matchCode } = {}) {
    let found = null;
    for (const room of this.rooms.values()) {
      if (room.match && room.match.code === matchCode) {
        found = room;
        break;
      }
    }
    if (!found) return socket.emit('room:error', { message: 'MATCH_NOT_FOUND' });
    socket.join(`match:${matchCode}`);
    found.match.addSocket(socket);
    socket.emit('match:state', found.match.engine.serialize());
  }

  handleMatchAction(socket, action = {}) {
    const room = this.roomForSocket(socket);
    if (!room || room.status !== 'playing' || !room.match) return;
    const res = room.onMatchAction(socket.data.user.id, action);
    if (res && !res.ok) socket.emit('room:error', { message: res.error || 'INVALID_ACTION' });
  }

  handleMatchmakingQueue(socket, { gameCode } = {}) {
    const res = this.matchmaking.queueUser({
      user: { id: socket.data.user.id, username: socket.data.user.username, avatar: socket.data.user.avatar, is_bot: false },
      socket,
      gameCode,
    });
    if (res && res.error) socket.emit('matchmaking:error', { message: res.error });
  }

  handleMatchmakingCancel(socket) {
    this.matchmaking.cancel(socket.data.user.id);
    socket.emit('matchmaking:cancelled', {});
  }
}
