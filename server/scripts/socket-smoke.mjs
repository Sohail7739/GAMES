import { io } from 'socket.io-client';

const token = process.argv[2];
const game = process.argv[3] || 'ludo';
const socket = io('http://localhost:4000', { auth: { token } });

let mySeat = null;
let humanTurn = false;

const GAME_ACTIONS = {
  ludo: (s) => {
    if (!humanTurn) return null;
    const st = s.state;
    if (st.phase === 'waiting_roll') return { type: 'roll' };
    if (st.phase === 'waiting_move') {
      const tok = st.tokens[mySeat].findIndex((t) => t.steps >= 0);
      return { type: 'move', token: tok >= 0 ? tok : 0 };
    }
    return null;
  },
  carrom: (s) => {
    if (!humanTurn || s.state.phase !== 'aim') return null;
    return { type: 'shoot', power: 0.9, angle: 0.2 };
  },
  jackaroo: (s) => {
    if (!humanTurn) return null;
    const hand = s.state.hands[mySeat];
    const num = hand.find((c) => /^[1-5]$/.test(c));
    return { type: 'play', card: num || hand[0], pawn: 0 };
  },
  baloot: (s) => {
    if (!humanTurn) return null;
    const st = s.state;
    if (st.phase === 'bidding') return { type: 'bid', value: 'pass' };
    if (st.phase === 'playing') {
      const led = st.ledSuit;
      const hand = st.hands[mySeat];
      const card = (led && hand.find((c) => c.suit === led)) || hand[0];
      return { type: 'play', card };
    }
    return null;
  },
};

socket.on('connect', () => {
  socket.emit('matchmaking:queue', { gameCode: game });
  console.log('[queued]', game);
});
socket.on('matchmaking:found', (d) => {
  console.log('[found]', d.roomCode, d.matchCode);
  socket.emit('room:join', { code: d.roomCode });
});
socket.on('room:joined', (d) => {
  if (d.room.matchCode) socket.emit('match:join', { matchCode: d.room.matchCode });
});
socket.on('room:started', (d) => {
  socket.emit('match:join', { matchCode: d.matchCode });
});
socket.on('match:state', (s) => {
  if (mySeat === null) {
    const me = s.meta.players.find((p) => p.id === Number(JSON.parse(process.argv[4] || '0')));
    mySeat = me ? me.seat : s.meta.players[0].seat;
    console.log('[state]', s.meta.code, 'mySeat', mySeat, s.meta.status);
  }
  humanTurn = s.meta.currentSeat === mySeat && s.meta.status === 'running';
  const act = GAME_ACTIONS[game] && GAME_ACTIONS[game](s);
  if (act) setTimeout(() => socket.emit('match:action', act), 400);
});
socket.on('match:finished', (d) => {
  console.log('[FINISHED] winnerSeat', d.winnerSeat, JSON.stringify(d.results));
  process.exit(0);
});
socket.on('room:error', (d) => { console.log('[room-error]', d); process.exit(1); });
socket.on('matchmaking:error', (d) => { console.log('[mm-error]', d); process.exit(1); });
socket.on('matchmaking:waiting', () => {});
socket.on('match:announce', (d) => console.log('[announce]', d.text));

setTimeout(() => { console.log('[timeout]'); process.exit(2); }, 120000);
