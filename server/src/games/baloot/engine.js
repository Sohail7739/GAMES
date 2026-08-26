import { GameEngine } from '../../engine/GameEngine.js';

const SUITS = ['spades', 'clubs', 'hearts', 'diamonds'];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
const BID_ORDER = { spades: 1, clubs: 2, hearts: 3, diamonds: 4 };
const POINTS = { A: 11, '10': 10, K: 4, Q: 2, J: 3, '9': 0, '8': 0, '7': 0 };
const RANK_ORDER = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7 };

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class BalootEngine extends GameEngine {
  static meta = {
    code: 'baloot',
    name: 'Baloot',
    nameAr: 'بلوت',
    category: 'card',
    minPlayers: 4,
    maxPlayers: 4,
    defaultConfig: {
      targetScore: 152,
      hokumTarget: 51,
      sunTarget: 41,
    },
  };

  teamOfSeat(seat) {
    return this.players.findIndex((p) => p.seat === seat) < 2 ? 0 : 1;
  }

  onStart() {
    this.scores = [0, 0];
    this.round = 0;
    this.dealer = this.players[0].seat;
    this.winnerTeam = null;
    this.startRound();
  }

  startRound() {
    this.round += 1;
    this.deck = buildDeck();
    this.hands = {};
    for (const p of this.players) this.hands[p.seat] = [];
    for (let i = 0; i < 32; i++) {
      const seat = this.players[i % 4].seat;
      this.hands[seat].push(this.deck.pop());
    }
    this.phase = 'bidding';
    this.highestBid = null; // { suit, seat } | { sun: true, seat }
    this.bids = [];
    const dealerIdx = this.players.findIndex((p) => p.seat === this.dealer);
    this.bidderIndex = (dealerIdx + 1) % 4;
    this.currentBidder = this.players[this.bidderIndex].seat;
    this.bidRoundDone = 0;
    this.trump = null;
    this.contract = null;
    this.table = [];
    this.ledSuit = null;
    this.tricksPlayed = 0;
    this.roundPoints = { 0: 0, 1: 0 };
    this.lastRound = null;
    this.emit('match:announce', { text: `Round ${this.round} — dealing...` });
    this.setCurrent(this.currentBidder);
    this.emit('match:round', { round: this.round, dealer: this.dealer });
  }

  validateAction(playerId, action) {
    const seat = this.playerById(playerId)?.seat;
    if (seat === undefined) return 'Not a player';
    if (this.status !== 'running') return 'Match not running';
    if (this.phase === 'bidding') {
      if (seat !== this.currentBidder) return 'Not your bid';
      if (action.type !== 'bid') return 'You must bid';
      const value = action.value;
      if (value === 'pass') return null;
      if (value === 'sun') return null;
      if (SUITS.includes(value)) {
        if (this.highestBid && !this.highestBid.sun && BID_ORDER[value] <= BID_ORDER[this.highestBid.suit]) {
          return 'Bid must be higher';
        }
        return null;
      }
      return 'Invalid bid';
    }
    if (this.phase === 'playing') {
      if (seat !== this.currentSeat) return 'Not your turn';
      if (action.type !== 'play') return 'You must play a card';
      const card = action.card;
      if (!this.hands[seat].some((c) => c.suit === card.suit && c.rank === card.rank)) return 'Card not in hand';
      if (this.table.length > 0 && this.ledSuit) {
        const hasSuit = this.hands[seat].some((c) => c.suit === this.ledSuit);
        if (hasSuit && card.suit !== this.ledSuit) return 'Must follow suit';
      }
      return null;
    }
    return 'Cannot act right now';
  }

  resolveBid(seat, value) {
    this.bids.push({ seat, value });
    if (value === 'sun') {
      this.highestBid = { sun: true, seat };
      this.finishBidding();
      return;
    }
    if (value !== 'pass') {
      if (this.highestBid && !this.highestBid.sun) {
        this.highestBid = { suit: value, seat };
      } else if (!this.highestBid) {
        this.highestBid = { suit: value, seat };
      }
    }
    // advance bidder
    this.bidderIndex = (this.bidderIndex + 1) % 4;
    this.bidRoundDone += 1;
    if (this.bidRoundDone >= 4) {
      this.finishBidding();
      return;
    }
    this.currentBidder = this.players[this.bidderIndex].seat;
    this.setCurrent(this.currentBidder);
  }

  finishBidding() {
    if (!this.highestBid) {
      // all passed -> redeal
      this.emit('match:announce', { text: 'Everyone passed — redealing' });
      this.dealer = this.players[(this.players.findIndex((p) => p.seat === this.dealer) + 1) % 4].seat;
      this.startRound();
      return;
    }
    const { seat, suit, sun } = this.highestBid;
    this.contract = sun ? { type: 'sun', seat } : { type: 'hokum', suit, seat };
    this.trump = sun ? null : suit;
    this.phase = 'playing';
    this.currentSeat = seat;
    this.leader = seat;
    this.emit('match:announce', { text: sun ? `Sun! ${this.playerAt(seat).user.username} plays solo` : `${this.playerAt(seat).user.username} calls ${suit}` });
    this.emit('match:contract', { contract: this.contract });
    this.setCurrent(seat);
  }

  playCard(seat, card) {
    const hand = this.hands[seat];
    const idx = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
    hand.splice(idx, 1);
    const played = { seat, card, byTeam: this.teamOfSeat(seat) };
    this.table.push(played);
    if (this.table.length === 1) this.ledSuit = card.suit;
    this.emit('match:card', { seat, card });

    if (this.table.length < 4) {
      // next player
      const cur = this.players.findIndex((p) => p.seat === seat);
      this.setCurrent(this.players[(cur + 1) % 4].seat);
      return null;
    }
    return this.resolveTrick();
  }

  resolveTrick() {
    const led = this.ledSuit;
    let winnerCard = this.table[0];
    for (const t of this.table) {
      const c = t.card;
      if (this.trump && c.suit === this.trump && winnerCard.card.suit !== this.trump) {
        winnerCard = t;
      } else if (this.trump && c.suit === this.trump && winnerCard.card.suit === this.trump) {
        if (RANK_ORDER[c.rank] > RANK_ORDER[winnerCard.card.rank]) winnerCard = t;
      } else if (c.suit === led && winnerCard.card.suit === led) {
        if (RANK_ORDER[c.rank] > RANK_ORDER[winnerCard.card.rank]) winnerCard = t;
      } else if (c.suit === led && winnerCard.card.suit !== this.trump) {
        winnerCard = t;
      }
    }

    const trickPoints = this.table.reduce((s, t) => s + POINTS[t.card.rank], 0);
    const winnerTeam = winnerCard.byTeam;
    this.roundPoints[winnerTeam] += trickPoints;
    this.tricksPlayed += 1;

    // last trick bonus
    if (this.tricksPlayed === 8) this.roundPoints[winnerTeam] += 10;

    // shyba: 7 of trump captured
    if (this.trump) {
      const shyba = this.table.find((t) => t.card.suit === this.trump && t.card.rank === '7');
      if (shyba) {
        this.roundPoints[shyba.byTeam] += 20;
        this.emit('match:announce', { text: `Shyba! +20 for team ${shyba.byTeam + 1}` });
      }
    }

    this.emit('match:trick', {
      winnerSeat: winnerCard.seat,
      team: winnerTeam,
      points: trickPoints,
      tricksPlayed: this.tricksPlayed,
      table: this.table.map((t) => ({ seat: t.seat, card: t.card })),
    });
    this.table = [];
    this.ledSuit = null;

    if (this.tricksPlayed === 8) {
      return this.endRound();
    }
    this.leader = winnerCard.seat;
    this.setCurrent(winnerCard.seat);
    return {};
  }

  endRound() {
    const { hokumTarget, sunTarget } = this.config;
    const contract = this.contract;
    let delta = { 0: 0, 1: 0 };
    let roundResult = null;

    if (contract.type === 'sun') {
      const soloTeam = this.teamOfSeat(contract.seat);
      const soloPts = this.roundPoints[soloTeam];
      if (soloPts >= sunTarget) {
        delta[soloTeam] = 150;
        roundResult = { winnerTeam: soloTeam, text: `Sun succeeded (${soloPts} pts)` };
      } else {
        const oppTeam = 1 - soloTeam;
        delta[oppTeam] = 150;
        roundResult = { winnerTeam: oppTeam, text: `Sun failed (${soloPts} pts)` };
      }
    } else {
      const biddingTeam = this.teamOfSeat(contract.seat);
      const oppTeam = 1 - biddingTeam;
      const bidPts = this.roundPoints[biddingTeam];
      if (bidPts >= hokumTarget) {
        delta[biddingTeam] = bidPts;
        delta[oppTeam] = this.roundPoints[oppTeam];
        roundResult = { winnerTeam: bidPts >= this.roundPoints[oppTeam] ? biddingTeam : oppTeam, text: `Hokum made (${bidPts} pts)` };
      } else {
        delta[oppTeam] = 150;
        delta[biddingTeam] = 0;
        roundResult = { winnerTeam: oppTeam, text: `Hokum failed (${bidPts} pts)` };
      }
    }

    this.scores[0] += delta[0];
    this.scores[1] += delta[1];
    this.lastRound = { delta, roundPoints: { ...this.roundPoints }, ...roundResult };
    this.phase = 'round_end';
    this.emit('match:roundEnd', {
      round: this.round,
      delta,
      roundPoints: this.roundPoints,
      scores: [...this.scores],
      ...roundResult,
    });

    const { targetScore } = this.config;
    let ended = false;
    if (this.scores[0] >= targetScore || this.scores[1] >= targetScore) {
      this.winnerTeam = this.scores[0] >= targetScore ? 0 : 1;
      ended = true;
    } else if (this.round >= 16) {
      this.winnerTeam = this.scores[0] >= this.scores[1] ? 0 : 1;
      ended = true;
    }

    if (ended) {
      const results = this.players.map((p) => {
        const team = this.teamOfSeat(p.seat);
        return {
          seat: p.seat,
          team,
          score: this.scores[team],
          result: team === this.winnerTeam ? 'win' : 'loss',
          winner: team === this.winnerTeam,
          stats: { team, roundScore: this.scores[team] },
        };
      });
      return { finished: true, results };
    }

    this.dealer = this.players[(this.players.findIndex((p) => p.seat === this.dealer) + 1) % 4].seat;
    setTimeout(() => this.startRound(), 1200);
    return {};
  }

  onAction(playerId, action) {
    const seat = this.playerById(playerId).seat;
    if (this.phase === 'bidding') {
      this.resolveBid(seat, action.value);
      return {};
    }
    if (this.phase === 'playing') {
      const result = this.playCard(seat, action.card);
      return result || {};
    }
    return {};
  }

  getState() {
    return {
      phase: this.phase,
      round: this.round,
      dealer: this.dealer,
      hands: this.hands,
      trump: this.trump,
      contract: this.contract,
      highestBid: this.highestBid,
      bids: this.bids,
      table: this.table.map((t) => ({ seat: t.seat, card: t.card })),
      ledSuit: this.ledSuit,
      tricksPlayed: this.tricksPlayed,
      roundPoints: this.roundPoints,
      scores: [...this.scores],
      targetScore: this.config.targetScore,
      lastRound: this.lastRound,
      teamOfSeat: Object.fromEntries(this.players.map((p) => [p.seat, this.teamOfSeat(p.seat)])),
      suits: SUITS,
    };
  }
}
