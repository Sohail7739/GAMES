// Verify the friend-invite feature end to end:
// spawn server -> register two users -> become friends -> create a room ->
// send an invite -> the invitee receives an 'invite' notification with the room code.
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');
const PORT = 4336;
const BASE = `http://localhost:${PORT}`;

async function waitHealth(t = 15000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('no health');
}
async function call(path, method = 'GET', body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(j)}`);
  return j.data;
}
async function register(prefix) {
  return call('/api/auth/register', 'POST', { username: `${prefix}${Math.random().toString(36).slice(2, 8)}`, email: `${prefix}${Date.now()}@t.com`, password: 'secret123' });
}

let ok = true;
async function assert(cond, msg) { if (!cond) { ok = false; console.error('FAIL:', msg); } else console.log('ok:', msg); }

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
try {
  await waitHealth();
  const a = await register('inviteA');
  const b = await register('inviteB');
  const aTok = a.token, bTok = b.token;

  // B sends friend request to A (B adds A) -> A accepts
  await call('/api/users/me/friends', 'POST', { userId: a.user.id }, bTok);
  await call(`/api/users/me/friends/${b.user.id}`, 'PATCH', { accept: true }, aTok);

  // A creates a room
  const room = await call('/api/rooms', 'POST', { gameCode: 'ludo', name: 'Test Room', isPrivate: false }, aTok);
  await assert(room.room && room.room.code, `room created code=${room.room.code}`);

  // A invites B
  const inv = await call(`/api/rooms/${room.room.code}/invite/${b.user.id}`, 'POST', null, aTok);
  await assert(inv.invited === true, 'invite accepted');

  // B lists notifications -> should contain the invite
  const list = await call('/api/notifications', 'GET', null, bTok);
  const inviteNotif = (list.notifications || []).find((n) => n.type === 'invite');
  await assert(!!inviteNotif, 'B received an invite notification');
  if (inviteNotif) {
    const data = typeof inviteNotif.data === 'string' ? JSON.parse(inviteNotif.data) : inviteNotif.data;
    await assert(data.roomCode === room.room.code, `notification has roomCode ${data.roomCode}`);
    console.log('invite notif:', inviteNotif.title);
  }
} catch (e) {
  ok = false;
  console.error('ERROR:', e.message);
} finally {
  server.kill();
  console.log(ok ? 'INVITE_PASS' : 'INVITE_FAIL');
  process.exit(ok ? 0 : 1);
}