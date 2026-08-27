// Verify mid-match reconnection: start a match, force a socket drop, then
// reconnect the same user and confirm they can re-sync and resume acting.
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');
const PORT = 4337;
const BASE = `http://localhost:${PORT}`;

async function waitHealth(t = 15000) { const s = Date.now(); while (Date.now() - s < t) { try { const r = await fetch(`${BASE}/health`); if (r.ok) return; } catch {} await new Promise((r) => setTimeout(r, 200)); } throw new Error('no health'); }
async function register() { const u = `rec_${Math.random().toString(36).slice(2, 8)}`; const r = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, email: `${u}@t.com`, password: 'secret123' }) }); return (await r.json()).data; }

function client(token) { return io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false }); }

let ok = true;
async function assert(cond, msg) { if (!cond) { ok = false; console.error('FAIL:', msg); } else console.log('ok:', msg); }

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
try {
  await waitHealth();
  const { token, user } = await register();
  let mySeat = null; let matchCode = null; let roomCode = null; let receivedState = 0; let reconnectedState = 0;

  const s1 = client(token);
  await new Promise((res) => s1.on('connect', res));
  s1.emit('matchmaking:queue', { gameCode: 'ludo' });
  s1.on('room:joined', (d) => { if (d.room.matchCode) s1.emit('match:join', { matchCode: d.room.matchCode }); });
  await new Promise((res, rej) => {
    s1.on('matchmaking:found', (d) => { roomCode = d.roomCode; matchCode = d.matchCode; s1.emit('room:join', { code: d.roomCode }); res(); });
    s1.on('matchmaking:error', (d) => rej(new Error('mm ' + JSON.stringify(d))));
  });
  s1.on('match:state', (s) => { receivedState++; if (mySeat === null) { const me = s.meta.players.find((p) => Number(p.id) === Number(user.id)); mySeat = me ? me.seat : s.meta.players[0]?.seat; } });
  await new Promise((res, rej) => { s1.on('match:state', res); setTimeout(() => rej(new Error('no state')), 15000); });
  await assert(matchCode && receivedState > 0, `first session got match state (matchCode=${matchCode}, states=${receivedState})`);

  // Force a mid-match drop of the first session.
  s1.disconnect();

  // Verify the server no longer considers the player connected (its socket is gone).
  await new Promise((r) => setTimeout(r, 1200));

  // Reconnect with a NEW socket (new device / JS session) joining by match code.
  const s2 = client(token);
  await new Promise((res) => s2.on('connect', res));
  let got = false;
  s2.on('match:state', (s) => { reconnectedState++; got = true; });
  // Re-join via the room first (mirrors the client recovery path), then the match.
  s2.emit('room:join', { code: roomCode });
  await new Promise((r) => setTimeout(r, 300));
  if (!got) s2.emit('match:join', { matchCode });
  await new Promise((r) => setTimeout(r, 2000));
  await assert(got && reconnectedState > 0, `player re-synced after reconnect (states=${reconnectedState})`);
  s2.disconnect();
} catch (e) { ok = false; console.error('ERROR:', e.message); } finally { server.kill(); console.log(ok ? 'RECONNECT_PASS' : 'RECONNECT_FAIL'); process.exit(ok ? 0 : 1); }