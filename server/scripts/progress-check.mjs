// Diagnostic: confirm live multiplayer games actually progress — turns advance,
// tokens/cards/pieces move — rather than stalling. Runs each game for a window,
// appending results to a log file so they are visible while running.
// Usage: node scripts/progress-check.mjs [game] [runMs] [logFile]
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4335);
const BASE = `http://localhost:${PORT}`;
const GAMES = process.argv[2] ? [process.argv[2]] : ['ludo', 'carrom', 'jackaroo', 'baloot'];
const RUN_MS = Number(process.argv[3] || 14000);
const LOG = process.argv[4] || path.join(__dirname, 'progress.log');

const out = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

async function waitForHealth(t = 15000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('no health');
}
async function register() {
  const u = `prog_${Math.random().toString(36).slice(2, 8)}`;
  const r = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, email: `${u}@t.com`, password: 'secret123' }) });
  return (await r.json()).data;
}

function actionFor(game, s, mySeat) {
  const st = s.state;
  if (game === 'ludo') {
    if (st.phase === 'waiting_roll') return { type: 'roll' };
    if (st.phase === 'waiting_move') { const t = st.tokens[mySeat].findIndex((x) => x.steps >= 0); return { type: 'move', token: t >= 0 ? t : 0 }; }
  }
  if (game === 'carrom') { if (st.phase === 'aim') return { type: 'shoot', power: 0.85, angle: Math.PI / 4 + 0.1 }; }
  if (game === 'jackaroo') { const h = s.state.hands[mySeat]; const n = h.find((c) => /^[1-5]$/.test(c)); return { type: 'play', card: n || h[0], pawn: 0 }; }
  if (game === 'baloot') {
    if (st.phase === 'bidding') return { type: 'bid', value: 'pass' };
    if (st.phase === 'playing') { const led = st.ledSuit; const h = st.hands[mySeat]; const c = (led && h.find((x) => x.suit === led)) || h[0]; return { type: 'play', card: c }; }
  }
  return null;
}

function play(game, token, user) {
  return new Promise((resolve) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    let mySeat = null; let stateCount = 0; let actionCount = 0; const turns = {}; const seats = new Set();
    socket.on('connect', () => socket.emit('matchmaking:queue', { gameCode: game }));
    socket.on('matchmaking:found', (d) => socket.emit('room:join', { code: d.roomCode }));
    socket.on('room:joined', (d) => { if (d.room.matchCode) socket.emit('match:join', { matchCode: d.room.matchCode }); });
    socket.on('room:started', (d) => socket.emit('match:join', { matchCode: d.matchCode }));
    socket.on('match:state', (s) => {
      stateCount++;
      if (mySeat === null) { const me = s.meta.players.find((p) => Number(p.id) === Number(user.id)); mySeat = me ? me.seat : s.meta.players[0]?.seat; }
      const cs = s.meta.currentSeat;
      if (cs !== undefined && cs !== null) { turns[cs] = (turns[cs] || 0) + 1; seats.add(cs); }
      if (s.meta.currentSeat === mySeat && s.meta.status === 'running' && actionCount < 25) {
        const act = actionFor(game, s, mySeat);
        if (act) { actionCount++; setTimeout(() => socket.emit('match:action', act), 150); }
      }
    });
    setTimeout(() => { socket.disconnect(); resolve({ game, stateCount, actionCount, turns, seats: seats.size }); }, RUN_MS);
  });
}

async function main() {
  if (fs.existsSync(LOG)) fs.unlinkSync(LOG);
  const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  try {
    await waitForHealth();
    const { token, user } = await register();
    out(`[boot] registered user ${user.id}`);
    let allOk = true;
    for (const game of GAMES) {
      const r = await play(game, token, user);
      const ok = r.stateCount > 3 && r.seats >= 2;
      if (!ok) allOk = false;
      out(`[${game}] states=${r.stateCount} humanActions=${r.actionCount} seatsWithTurns=${r.seats} turns=${JSON.stringify(r.turns)} -> ${ok ? 'PROGRESS_OK' : 'PROGRESS_STALLED'}`);
    }
    out(allOk ? 'ALL_PROGRESS_OK' : 'SOME_PROGRESS_STALLED');
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    out('FAIL: ' + e.message);
    process.exit(1);
  } finally {
    server.kill();
  }
}
main();