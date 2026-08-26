import { GameEngine } from '../../engine/GameEngine.js';

const TRACK_SIZE = 26;
const PAWNS_PER_PLAYER = 3;
const HOME = 100;

function buildDeck() {
  const deck = [];
  for (const v of ['1', '2', '3', '4', '5']) {
    for (let i = 0; i < 4; i++) deck.push(v);
  }
  for (let i = 0; i < 4; i++) deck.push('J');
  for (let i = 0; i < 4; i++) deck.push('A');
  for (let i = 0; i < 4; i++) deck.push('K');
  for (let i = 0; i < 4; i++) deck.push('Q');
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (card === 'A') return null;
  if (card === 'J') return 3;
  if (card === 'K') return 10;
  if (card === 'Q') return 5;
  return Number(card);
}

export class JackarooEngine extends GameEngine {
  static meta = {
    code: 'jackaroo',
    name: 'Jackaroo',
    nameAr: 'جاكارو',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 4,
    defaultConfig: {
      handSize: 5,
      trackSize: TRACK_SIZE,
    },
  };

  onStart() {
    this.deck = buildDeck();
    this.discard = [];
    this.pawns = {};
    this.hands = {};
    for (const p of this.players) {
      this.pawns[p.seat] = Array.from({ length: PAWNS_PER_PLAYER }, (_, i) => i); // start cells 0,1,2
      this.hands[p.seat] = this.drawCards(this.config.handSize);
    }
    this.lastAction = null;
    this.winners = [];
    this.setCurrent(this.players[0].seat);
  }

  drawCards(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        this.deck = this.discard.length ? this.discard.splice(0) : buildDeck();
      }
      out.push(this.deck.pop());
    }
    return out;
  }

  validateAction(playerId, action) {
    const seat = this.playerById(playerId)?.seat;
    if (seat === undefined) return 'Not a player';
    if (this.status !== 'running') return 'Match not running';
    if (seat !== this.currentSeat) return 'Not your turn';
    if (action.type !== 'play') return 'You must play a card';
    const card = action.card;
    if (!this.hands[seat].includes(card)) return 'Card not in hand';
    if (action.pawn === undefined) return 'Pawn required';
    if (action.pawn < 0 || action.pawn >= PAWNS_PER_PLAYER) return 'Invalid pawn';
    if (card === 'A') return null; // swap any
    if (card === 'J') return null; // move or knock
    const val = cardValue(card);
    if (val !== null) {
      const pawnPos = this.pawns[seat][action.pawn];
      if (pawnPos === HOME) return 'Pawn already home';
    }
    return null;
  }

  pawnCell(seat, idx) {
    return this.pawns[seat][idx];
  }

  onAction(playerId, action) {
    const seat = this.playerById(playerId).seat;
    const { card, pawn } = action;
    const hand = this.hands[seat];
    const cardIndex = hand.indexOf(card);
    if (cardIndex !== -1) hand.splice(cardIndex, 1);
    this.discard.push(card);

    const events = [];
    const before = this.pawns[seat].slice();

    const land = (s, p, target) => {
      const clamped = Math.min(target, TRACK_SIZE);
      if (target >= TRACK_SIZE) {
        this.pawns[s][p] = HOME;
        events.push({ type: 'home', seat: s, pawn: p });
      } else {
        this.pawns[s][p] = clamped;
        // capture opponents
        for (const op of this.players) {
          if (op.seat === s) continue;
          for (let i = 0; i < PAWNS_PER_PLAYER; i++) {
            if (this.pawns[op.seat][i] === clamped && clamped > 0 && clamped < TRACK_SIZE) {
              this.pawns[op.seat][i] = 0;
              events.push({ type: 'capture', target: op.seat, pawn: i, at: clamped });
            }
          }
        }
      }
    };

    if (card === 'A') {
      // swap with opponent pawn
      const opSeat = action.targetSeat;
      const opPawn = action.targetPawn;
      if (opSeat !== undefined && this.playerAt(opSeat)) {
        const tmp = this.pawns[seat][pawn];
        this.pawns[seat][pawn] = this.pawns[opSeat][opPawn];
        this.pawns[opSeat][opPawn] = tmp;
        events.push({ type: 'swap', seat, pawn, opSeat, opPawn });
      } else {
        // no target: move 5
        land(seat, pawn, this.pawns[seat][pawn] + 5);
        events.push({ type: 'move', seat, pawn, card });
      }
    } else if (card === 'J') {
      if (action.mode === 'knock' && action.targetSeat !== undefined) {
        this.pawns[action.targetSeat][action.targetPawn ?? 0] = 0;
        events.push({ type: 'knock', target: action.targetSeat, pawn: action.targetPawn ?? 0 });
      } else {
        land(seat, pawn, this.pawns[seat][pawn] + 3);
        events.push({ type: 'move', seat, pawn, card, steps: 3 });
      }
    } else {
      const val = cardValue(card);
      land(seat, pawn, this.pawns[seat][pawn] + val);
      events.push({ type: 'move', seat, pawn, card, steps: val });
    }

    // draw back to hand size
    const drawn = this.drawCards(this.config.handSize - hand.length);
    hand.push(...drawn);

    this.lastAction = { seat, card, pawn, events, before, after: this.pawns[seat].slice() };
    this.recordLog('played', { seat, card, pawn, events });

    this.emit('match:play', { seat, card, pawn, events, drawnCount: drawn.length });

    const finished = this.pawns[seat].filter((p) => p === HOME).length;
    if (finished === PAWNS_PER_PLAYER && !this.winners.includes(seat)) {
      this.winners.push(seat);
      if (this.winners.length === this.players.length || this.winners.length === 1) {
        // End when someone wins (all pawns home); rank others by progress
        const results = this.players.map((p) => {
          const fin = this.pawns[p.seat].filter((x) => x === HOME).length;
          const progress = this.pawns[p.seat].reduce((s, x) => s + (x === HOME ? TRACK_SIZE : x), 0);
          return { seat: p.seat, score: fin * 1000 + progress, stats: { finished: fin } };
        });
        return { finished: true, results };
      }
    }

    this.nextTurn((s) => true);
    return {};
  }

  getState() {
    return {
      phase: 'playing',
      trackSize: TRACK_SIZE,
      pawnsPerPlayer: PAWNS_PER_PLAYER,
      pawns: this.pawns,
      hands: this.hands,
      deckCount: this.deck.length,
      discardCount: this.discard.length,
      winners: this.winners,
      lastAction: this.lastAction
        ? {
            seat: this.lastAction.seat,
            card: this.lastAction.card,
            pawn: this.lastAction.pawn,
            events: this.lastAction.events,
          }
        : null,
    };
  }
}
