import { GameEngine } from '../../engine/GameEngine.js';

const COLORS = ['red', 'green', 'yellow', 'blue'];
const STARTS = [0, 13, 26, 39];

export class LudoEngine extends GameEngine {
  static meta = {
    code: 'ludo',
    name: 'Ludo Star',
    nameAr: 'لودو ستار',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: {
      tokensPerPlayer: 4,
      safeCells: [0, 8, 13, 21, 26, 34, 39, 47],
      captureOnSix: false,
    },
  };

  onStart() {
    const n = this.players.length;
    this.colorIndex = n === 2 ? [0, 2] : COLORS.slice(0, n).map((_, i) => i);
    this.tokens = {};
    this.phase = 'waiting_roll';
    this.dice = 0;
    this.lastRollSeat = null;
    this.finished = [];
    for (const p of this.players) {
      this.tokens[p.seat] = Array.from({ length: this.config.tokensPerPlayer }, () => ({
        steps: -1, // -1 = in base, 0..57 = steps moved from start
      }));
    }
    this.startColor = this.colorIndex[0];
    this.setCurrent(this.players[0].seat);
  }

  colorFor(seat) {
    return COLORS[this.colorIndex[this.players.findIndex((p) => p.seat === seat)]];
  }

  startCellFor(seat) {
    return STARTS[this.colorIndex[this.players.findIndex((p) => p.seat === seat)]];
  }

  tokenState(seat, steps) {
    if (steps === -1) return { zone: 'base', cell: -1 };
    if (steps >= 57) return { zone: 'finished', cell: 99 };
    if (steps >= 52) return { zone: 'home', cell: steps - 52 };
    return { zone: 'track', cell: (this.startCellFor(seat) + steps) % 52 };
  }

  movableTokens(seat, dice) {
    const list = [];
    const toks = this.tokens[seat];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.steps === -1 && dice === 6) list.push(i);
      else if (t.steps >= 0 && t.steps + dice <= 57) list.push(i);
    }
    return list;
  }

  validateAction(playerId, action) {
    const seat = this.playerById(playerId)?.seat;
    if (seat === undefined) return 'Not a player';
    if (this.status !== 'running') return 'Match not running';
    if (seat !== this.currentSeat) return 'Not your turn';
    if (this.phase === 'waiting_roll' && action.type !== 'roll') return 'You must roll the dice';
    if (this.phase === 'waiting_move') {
      if (action.type !== 'move') return 'You must move a token';
      const movable = this.movableTokens(seat, this.dice);
      if (!movable.includes(action.token)) return 'Token cannot move';
    }
    return null;
  }

  rollDice() {
    return 1 + Math.floor(Math.random() * 6);
  }

  onAction(playerId, action) {
    const seat = this.playerById(playerId).seat;

    if (action.type === 'roll') {
      this.dice = this.rollDice();
      this.recordLog('rolled', { seat, dice: this.dice });
      const movable = this.movableTokens(seat, this.dice);
      if (movable.length === 0) {
        // no legal move: pass
        this.emit('match:announce', { seat, text: 'rolled but cannot move' });
        this.advanceTurn();
      } else {
        this.phase = 'waiting_move';
        this.emit('match:dice', { seat, dice: this.dice, movable });
      }
      return {};
    }

    if (action.type === 'move') {
      const idx = action.token;
      const tok = this.tokens[seat][idx];
      const captured = this.applyMove(seat, idx, tok, this.dice);
      const finishedCount = this.tokens[seat].filter((t) => t.steps === 57).length;
      this.recordLog('moved', { seat, token: idx, dice: this.dice, captured });
      this.emit('match:move', { seat, token: idx, captured, finishedCount });

      if (finishedCount === this.config.tokensPerPlayer) {
        this.finished.push(seat);
        this.emit('match:announce', { seat, text: 'finished all tokens' });
        const results = this.players.map((p) => {
          const fin = this.tokens[p.seat].filter((t) => t.steps === 57).length;
          const progress = this.tokens[p.seat].reduce((s, t) => s + Math.max(0, t.steps), 0);
          return { seat: p.seat, score: fin * 1000 + progress, stats: { finished: fin } };
        });
        return { finished: true, results };
      }

      // A roll of 6 grants another roll
      if (this.dice === 6) {
        this.phase = 'waiting_roll';
      } else {
        this.advanceTurn();
      }
      return {};
    }
    return {};
  }

  applyMove(seat, idx, tok, dice) {
    let captured = null;
    if (tok.steps === -1) {
      tok.steps = 0;
      return captured;
    }
    const newSteps = tok.steps + dice;
    const onTrack = newSteps < 52;
    if (onTrack) {
      const cell = (this.startCellFor(seat) + newSteps) % 52;
      const safe = this.config.safeCells.includes(cell);
      if (!safe) {
        for (const op of this.players) {
          if (op.seat === seat) continue;
          this.tokens[op.seat].forEach((ot) => {
            if (ot.steps >= 0 && ot.steps < 52) {
              const oCell = (this.startCellFor(op.seat) + ot.steps) % 52;
              if (oCell === cell) {
                ot.steps = -1;
                captured = captured ?? op.seat;
              }
            }
          });
        }
      }
    }
    tok.steps = newSteps;
    return captured;
  }

  advanceTurn() {
    this.phase = 'waiting_roll';
    this.dice = 0;
    this.nextTurn((seat) => this.tokens[seat].some((t) => t.steps < 57));
  }

  getState() {
    return {
      phase: this.phase,
      dice: this.dice,
      colors: Object.fromEntries(this.players.map((p) => [p.seat, this.colorFor(p.seat)])),
      starts: Object.fromEntries(this.players.map((p) => [p.seat, this.startCellFor(p.seat)])),
      tokens: this.tokens,
      safeCells: this.config.safeCells,
      finished: this.finished,
      boardSize: 52,
    };
  }
}
