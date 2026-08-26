/**
 * Bot strategies. Each function returns a valid action for the given game
 * state, or null if nothing sensible can be played (the driver then passes).
 */
export function botAction(gameCode, payload) {
  try {
    switch (gameCode) {
      case 'ludo':
        return ludoMove(payload);
      case 'carrom':
        return carromMove(payload);
      case 'jackaroo':
        return jackarooMove(payload);
      case 'baloot':
        return balootMove(payload);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function ludoMove(payload) {
  const state = payload.state;
  if (state.phase === 'waiting_roll') return { type: 'roll' };
  if (state.phase === 'waiting_move') {
    const seat = payload.meta.currentSeat;
    const movable = state.tokens[seat]
      .map((t, i) => ({ steps: t.steps, i }))
      .filter((t) => t.steps >= 0)
      .sort((a, b) => b.steps - a.steps);
    const fromBase = state.tokens[seat]
      .map((t, i) => ({ steps: t.steps, i }))
      .filter((t) => t.steps === -1);
    if (state.dice === 6 && fromBase.length > 0) return { type: 'move', token: fromBase[0].i };
    if (movable.length) return { type: 'move', token: movable[0].i };
    return null;
  }
  return null;
}

function carromMove(payload) {
  const state = payload.state;
  if (state.phase !== 'aim') return null;
  const seat = payload.meta.currentSeat;
  const team = state.teams[0].includes(seat) ? 0 : state.teams[1].includes(seat) ? 1 : 0;
  const color = team === 0 ? 'white' : 'black';
  const targets = state.coins[color].filter((c) => !c.pocketed);
  if (!targets.length) return null;
  // aim at nearest own coin from striker, offset to nudge it toward board center
  const t = targets.reduce((a, b) => (Math.hypot(a.x - state.striker.x, a.y - state.striker.y) < Math.hypot(b.x - state.striker.x, b.y - state.striker.y) ? a : b));
  const angle = Math.atan2(t.y - state.striker.y, t.x - state.striker.x);
  const power = 0.5 + Math.random() * 0.4;
  return { type: 'shoot', power, angle };
}

function jackarooMove(payload) {
  const state = payload.state;
  const seat = payload.meta.currentSeat;
  const hand = state.hands[seat];
  const pawns = state.pawns[seat];
  const nums = hand.filter((c) => /^[1-5]$/.test(c)).map(Number);
  const best = Math.max(...pawns);
  if (nums.length) {
    const v = Math.max(...nums);
    const pawn = pawns.indexOf(best);
    return { type: 'play', card: String(v), pawn: pawn >= 0 ? pawn : 0 };
  }
  if (hand.includes('K')) return { type: 'play', card: 'K', pawn: pawns.indexOf(best) >= 0 ? pawns.indexOf(best) : 0 };
  if (hand.includes('Q')) return { type: 'play', card: 'Q', pawn: pawns.indexOf(best) >= 0 ? pawns.indexOf(best) : 0 };
  if (hand.includes('J')) return { type: 'play', card: 'J', mode: 'move', pawn: pawns.indexOf(best) >= 0 ? pawns.indexOf(best) : 0 };
  if (hand.includes('A')) return { type: 'play', card: 'A', pawn: 0 };
  return null;
}

function handStrength(hand) {
  let s = 0;
  for (const c of hand) {
    if (c.rank === 'A') s += 11;
    if (c.rank === '10') s += 10;
    if (c.rank === 'K') s += 4;
    if (c.rank === 'Q') s += 2;
    if (c.rank === 'J') s += 3;
  }
  return s;
}

function balootMove(payload) {
  const state = payload.state;
  const seat = payload.meta.currentSeat;
  const hand = state.hands[seat];

  if (state.phase === 'bidding') {
    // bid lowest suit if strong hand, else pass
    const strong = handStrength(hand) >= 30;
    if (!strong) return { type: 'bid', value: 'pass' };
    if (state.highestBid?.sun) return { type: 'bid', value: 'pass' };
    const ordered = ['spades', 'clubs', 'hearts', 'diamonds'];
    const current = state.highestBid ? state.highestBid.suit : null;
    for (const suit of ordered) {
      if (!current || ordered.indexOf(suit) > ordered.indexOf(current)) {
        return { type: 'bid', value: suit };
      }
    }
    return { type: 'bid', value: 'pass' };
  }

  if (state.phase === 'playing') {
    const led = state.ledSuit;
    const suited = hand.filter((c) => c.suit === led);
    if (suited.length) {
      // play lowest of led suit
      const order = { A: 14, K: 13, Q: 12, J: 11, 10: 10, 9: 9, 8: 8, 7: 7 };
      const pick = suited.reduce((a, b) => (order[a.rank] < order[b.rank] ? a : b));
      return { type: 'play', card: pick };
    }
    // void: play a trump if available, else lowest card
    if (state.trump) {
      const trumps = hand.filter((c) => c.suit === state.trump);
      if (trumps.length) {
        const order = { A: 14, K: 13, Q: 12, J: 11, 10: 10, 9: 9, 8: 8, 7: 7 };
        const pick = trumps.reduce((a, b) => (order[a.rank] > order[b.rank] ? a : b));
        return { type: 'play', card: pick };
      }
    }
    const order = { A: 14, K: 13, Q: 12, J: 11, 10: 10, 9: 9, 8: 8, 7: 7 };
    const pick = hand.reduce((a, b) => (order[a.rank] < order[b.rank] ? a : b));
    return { type: 'play', card: pick };
  }
  return null;
}
