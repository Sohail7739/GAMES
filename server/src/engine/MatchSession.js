import { db, now } from '../db/index.js';
import { recordMatchResult, addXp, checkAchievements, createNotification } from '../lib/dao.js';
import { systemLog } from '../lib/audit.js';
import { gameRegistry } from '../games/registry.js';
import { randomCode } from '../lib/ids.js';
import { botAction } from '../lib/bots.js';

/**
 * MatchSession — binds a GameEngine instance to a room, players, socket
 * broadcast and persistent match record. Created when a room starts.
 */
export class MatchSession {
  constructor({ room, players, config, io, roomSession }) {
    this.room = room;
    this.players = players; // [{ seat, team, user: {id, username, avatar, is_bot} }]
    this.config = config;
    this.io = io;
    this.roomSession = roomSession || null;
    this.engine = null;
    this.matchId = null;
    this.code = randomCode(6);
    this.connected = new Set(); // socket ids in match namespace
    this.playerConnections = new Map(); // userId -> Set<socketId>
    this.botTimer = null;
  }

  init() {
    const game = gameRegistry.get(this.room.game_code);
    this.engine = game.createEngine(this.config || {});
    this.engine.attachSession(this);
    for (const p of this.players) this.engine.addPlayer(p.seat, p.user);

    const info = db
      .prepare(
        `INSERT INTO matches (code, game_id, room_id, status, config, started_at)
         SELECT ?, g.id, ?, 'started', ?, datetime('now') FROM games g WHERE g.code = ?`
      )
      .run(this.code, this.room.id, JSON.stringify(this.config || {}), this.room.game_code);
    this.matchId = info.lastInsertRowid;

    const insert = db.prepare(
      'INSERT INTO match_participants (match_id, user_id, seat, team) VALUES (?,?,?,?)'
    );
    for (const p of this.players) insert.run(this.matchId, p.user.id, p.seat, p.team || 0);

    systemLog('info', 'match', `Match started ${this.code} (${this.room.game_code})`, { roomId: this.room.id, matchId: this.matchId });
    return this;
  }

  start() {
    this.engine.start();
    return this;
  }

  // Socket wiring -------------------------------------------------------
  addSocket(socket) {
    this.connected.add(socket.id);
    const uid = String(socket.data?.user?.id);
    if (uid) {
      if (!this.playerConnections.has(uid)) this.playerConnections.set(uid, new Set());
      this.playerConnections.get(uid).add(socket.id);
    }
  }

  removeSocket(socket) {
    this.connected.delete(socket.id);
    const uid = String(socket.data?.user?.id);
    if (uid) {
      const set = this.playerConnections.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0 && this.engine.status !== 'finished') {
          this.playerConnections.delete(uid);
          this.engine.onDisconnect(uid);
          this.broadcast('match:state', this.engine.serialize());
        }
      }
    }
  }

  reconnectPlayer(userId, socket) {
    this.addSocket(socket);
    const uid = String(userId);
    if (this.playerConnections.has(uid)) {
      // reconnect: notify engine + re-broadcast state to this socket
      this.engine.onReconnect(uid);
      this.emitTo(socket, 'match:state', this.engine.serialize());
    }
  }

  isPlayerConnected(userId) {
    const set = this.playerConnections.get(String(userId));
    return set ? set.size > 0 : false;
  }

  broadcast(event, payload) {
    if (!this.io) return;
    this.io.to(`match:${this.code}`).emit(event, payload);
  }

  emitTo(socket, event, payload) {
    if (socket.connected) socket.emit(event, payload);
  }

  handleAction(playerId, action) {
    const res = this.engine.handleAction(playerId, action);
    if (res.ok && res.result?.finished) {
      // finalize already triggered inside engine
    }
    return res;
  }

  driveBots() {
    if (!this.engine || this.engine.status !== 'running') return;
    const seat = this.engine.currentSeat;
    if (seat === undefined || seat === null) return;
    const player = this.players.find((p) => p.seat === seat);
    if (!player || !player.user.is_bot) return;
    if (this.botTimer) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const action = botAction(this.room.game_code, this.engine.serialize());
      if (action) {
        this.engine.handleAction(player.user.id, action);
        this.driveBots();
      }
    }, 650 + Math.random() * 900);
  }

  persistAction(playerId, action) {
    db.prepare('INSERT INTO match_actions (match_id, seq, player_id, type, payload) VALUES (?,?,?,?,?)').run(
      this.matchId,
      this.engine.history.length,
      playerId,
      action.type || 'action',
      JSON.stringify(action)
    );
  }

  // Finalize ------------------------------------------------------------
  finalize(results) {
    if (this.finalized) return;
    this.finalized = true;
    const scoreBySeat = new Map(results.map((r) => [r.seat, r]));

    const ranked = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
    const bestScore = ranked.length ? ranked[0].score : 0;
    const winnerSeat =
      (results.find((r) => r.winner)?.seat) ??
      (ranked.length && ranked[0].score > 0 ? ranked[0].seat : null);
    const winnerUser = this.players.find((p) => p.seat === winnerSeat);

    db.prepare('UPDATE matches SET status=\'finished\', finished_at=?, winner_id=? WHERE id=?').run(
      now(),
      winnerUser?.user.id || null,
      this.matchId
    );

    const update = db.prepare('UPDATE match_participants SET score=?, result=?, stats=? WHERE match_id=? AND user_id=?');
    const game = gameRegistry.get(this.room.game_code);
    const dbGameId = db.prepare('SELECT id FROM games WHERE code=?').get(this.room.game_code)?.id;

    for (const r of results) {
      const p = this.players.find((pp) => pp.seat === r.seat);
      if (!p) continue;
      const result = r.result || (r.score === bestScore && bestScore > 0 ? 'win' : r.score === bestScore ? 'draw' : 'loss');
      const isWin = result === 'win';
      const isDraw = result === 'draw';
      update.run(r.score || 0, result, JSON.stringify(r.stats || {}), this.matchId, p.user.id);

      const points = isWin ? 20 : isDraw ? 5 : 2;
      const ratingDelta = isWin ? 15 : isDraw ? 0 : -10;
      recordMatchResult(p.user.id, dbGameId, {
        win: isWin,
        draw: isDraw,
        points,
        ratingDelta,
      });
      addXp(p.user.id, isWin ? 40 : isDraw ? 20 : 5);
      checkAchievements(p.user.id);

      if (!p.user.is_bot) {
        createNotification(
          p.user.id,
          isWin ? 'success' : 'info',
          isWin ? 'Victory!' : 'Match finished',
          `Your ${game.meta.name} match ended with ${isWin ? 'a win' : isDraw ? 'a draw' : 'a loss'}`,
          { matchId: this.matchId, result }
        );
      }
    }

    if (winnerUser && !winnerUser.user.is_bot) {
      const unlocked = checkAchievements(winnerUser.user.id);
      if (unlocked.length) {
        createNotification(winnerUser.user.id, 'achievement', 'Achievement unlocked!', unlocked.map((a) => a.name).join(', '));
      }
    }

    systemLog('info', 'match', `Match finished ${this.code}`, { matchId: this.matchId, winnerSeat });
    this.broadcast('match:finished', {
      matchId: this.matchId,
      results: results.map((r) => ({ seat: r.seat, score: r.score || 0, result: r.result || (r.score === bestScore ? 'draw' : 'loss') })),
      winnerSeat,
    });
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.roomSession) this.roomSession.onMatchFinished();
  }

  destroy() {
    // cleanup placeholder
  }
}

export function createMatchSession(opts) {
  return new MatchSession(opts);
}
