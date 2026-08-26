import { TurnManager } from './TurnManager.js';

let actionSeq = 0;

/**
 * GameEngine — base class for all pluggable game modules.
 *
 * Subclasses implement pure server-side rules. The engine knows nothing
 * about HTTP/Socket.IO/DB; it communicates through `this.session` hooks:
 *   this.emit(event, payload)   -> broadcast to room
 *   this.finish(results)        -> end match with results
 *
 * Lifecycle: construct -> addPlayers -> start -> handleAction ... -> finish
 */
export class GameEngine {
  static meta = {
    code: 'base',
    name: 'Base',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: {},
  };

  constructor(config = {}) {
    this.config = { ...this.constructor.meta.defaultConfig, ...config };
    this.players = []; // [{ seat, user: {id, username, avatar} }]
    this.status = 'idle'; // idle | running | finished
    this.turn = new TurnManager();
    this.currentSeat = null;
    this.history = []; // applied actions
    this.log = [];
    this.session = null;
  }

  attachSession(session) {
    this.session = session;
  }

  emit(event, payload) {
    if (this.session) this.session.broadcast(event, payload);
  }

  addPlayer(seat, user) {
    this.players.push({ seat, user });
    this.players.sort((a, b) => a.seat - b.seat);
  }

  seats() {
    return this.players.map((p) => p.seat);
  }

  playerAt(seat) {
    return this.players.find((p) => p.seat === seat);
  }

  playerById(userId) {
    return this.players.find((p) => p.user.id === userId);
  }

  start() {
    this.status = 'running';
    this.turn = new TurnManager({ seats: this.seats() });
    this.currentSeat = this.turn.current();
    this.logRound('match_started');
    this.onStart();
    this.emit('match:state', this.serialize());
  }

  // Subclass hooks -------------------------------------------------------
  onStart() {}
  onAction(playerId, action) {} // implemented by subclass
  onDisconnect(playerId) {}
  onReconnect(playerId) {}
  validateAction(playerId, action) {
    return null;
  }

  // Framework API --------------------------------------------------------
  handleAction(playerId, action) {
    const err = this.validateAction(playerId, action);
    if (err) return { ok: false, error: err };
    const applied = this.applyAction(playerId, action);
    this.recordAction(playerId, action);
    return applied;
  }

  applyAction(playerId, action) {
    const result = this.onAction(playerId, action) || {};
    this.emit('match:state', this.serialize());
    if (result.finished) {
      this.finishMatch(result.results);
    }
    return { ok: true, result };
  }

  recordAction(playerId, action) {
    this.history.push({ seq: ++actionSeq, playerId, action });
    if (this.session) this.session.persistAction(playerId, action);
  }

  recordLog(message, meta = {}) {
    this.log.push({ at: Date.now(), message, ...meta });
  }

  logRound(message, meta = {}) {
    this.recordLog(message, meta);
  }

  nextTurn(predicate) {
    const next = this.turn.advance(predicate);
    if (next !== this.currentSeat) {
      this.currentSeat = next;
      this.emit('match:turn', { seat: next });
    }
    return next;
  }

  setCurrent(seat) {
    this.currentSeat = seat;
    this.emit('match:turn', { seat });
  }

  finishMatch(results) {
    if (this.status === 'finished') return;
    this.status = 'finished';
    if (this.session) this.session.finalize(results);
  }

  serialize() {
    return {
      meta: {
        code: this.constructor.meta.code,
        config: this.config,
        status: this.status,
        currentSeat: this.currentSeat,
        players: this.players.map((p) => ({ seat: p.seat, id: p.user.id, username: p.user.username, avatar: p.user.avatar })),
      },
      state: this.getState(),
    };
  }

  getState() {
    return {};
  }
}
