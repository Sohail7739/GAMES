import { db } from '../../db/index.js';
import { gameRegistry } from '../../games/registry.js';
import { gamesService } from '../games/service.js';

/**
 * Matchmaking service. Queues players per game; forms a match when enough
 * human players are queued or after a short grace period, filling with bots.
 */
export class MatchmakingService {
  constructor(hub) {
    this.hub = hub;
    this.queue = new Map(); // gameCode -> [{ user, socket, queuedAt }]
    this.timers = new Map(); // gameCode -> timeout id
  }

  queueUser({ user, socket, gameCode }) {
    const meta = gameRegistry.get(gameCode)?.meta;
    if (!meta) return { error: 'UNKNOWN_GAME' };
    if (!gamesService.isEnabled(gameCode)) return { error: 'GAME_DISABLED' };
    if (!this.queue.has(gameCode)) this.queue.set(gameCode, []);
    const q = this.queue.get(gameCode);
    if (q.some((e) => String(e.user.id) === String(user.id))) return { error: 'ALREADY_QUEUED' };
    const entry = { user, socket, queuedAt: Date.now() };
    q.push(entry);
    socket.emit('matchmaking:waiting', { gameCode });
    this.scheduleFill(gameCode);
    this.tryForm(gameCode);
    return { ok: true };
  }

  cancel(userId) {
    for (const [gameCode, q] of this.queue) {
      const idx = q.findIndex((e) => String(e.user.id) === String(userId));
      if (idx !== -1) {
        q.splice(idx, 1);
        if (q.length === 0) this.clearTimer(gameCode);
      }
    }
  }

  clearTimer(gameCode) {
    if (this.timers.has(gameCode)) {
      clearTimeout(this.timers.get(gameCode));
      this.timers.delete(gameCode);
    }
  }

  scheduleFill(gameCode) {
    if (this.timers.has(gameCode)) return;
    const meta = gameRegistry.get(gameCode)?.meta;
    if (!meta) return;
    const timer = setTimeout(() => {
      this.timers.delete(gameCode);
      const q = this.queue.get(gameCode) || [];
      if (q.length > 0) this.formMatch(gameCode, q, true);
    }, 6000);
    this.timers.set(gameCode, timer);
  }

  tryForm(gameCode) {
    const meta = gameRegistry.get(gameCode)?.meta;
    if (!meta) return;
    const q = this.queue.get(gameCode) || [];
    if (q.length >= meta.minPlayers) this.formMatch(gameCode, q, false);
  }

  formMatch(gameCode, entrants, fillBots) {
    this.queue.delete(gameCode);
    this.clearTimer(gameCode);
    const meta = gameRegistry.get(gameCode)?.meta;
    const humans = entrants.slice(0, meta.maxPlayers);

    const room = this.hub.createMatchRoom({ gameCode, host: humans[0].user });
    for (const e of humans) {
      room.join({ ...e.user }, {});
    }
    // fill with bots up to min players for a full game
    let need = meta.minPlayers - room.players.size;
    while (need > 0) {
      room.joinBot();
      need--;
    }
    // if a 4-player game with fewer than 4, top up to max for a livelier match
    if (meta.maxPlayers === 4 && room.players.size < 4) {
      while (room.players.size < 4) room.joinBot();
    }

    room.startMatch(room.hostId);
    for (const e of humans) {
      if (e.socket?.connected) {
        e.socket.emit('matchmaking:found', { matchCode: room.match.code, roomCode: room.code });
      }
    }
  }
}
