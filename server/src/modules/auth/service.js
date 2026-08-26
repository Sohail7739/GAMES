import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db, now } from '../../db/index.js';
import { signToken } from '../../lib/jwt.js';
import { BadRequest, Conflict, Unauthorized, NotFound } from '../../lib/errors.js';
import { getPublicUser, getUserProfile } from '../../lib/dao.js';
import { config } from '../../config/index.js';

const normalizeIdentity = (value) => String(value || '').trim().toLowerCase();

function findUserByIdentity(identity) {
  const email = normalizeIdentity(identity);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  if (/^[0-9+\-() ]{6,}$/.test(identity)) {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(identity.trim());
  }
  return db.prepare('SELECT * FROM users WHERE username = ?').get(identity.trim());
}

export const authService = {
  async register({ username, email, phone, password }) {
    if (!username || !password) throw new BadRequest('Username and password are required');
    if (password.length < 6) throw new BadRequest('Password must be at least 6 characters');
    username = String(username).trim().replace(/\s+/g, '_');
    if (username.length < 3) throw new BadRequest('Username must be at least 3 characters');
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      throw new Conflict('Username already taken');
    }
    if (email) {
      const e = normalizeIdentity(email);
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(e)) throw new Conflict('Email already registered');
      email = e;
    }
    if (phone) {
      const p = phone.trim();
      if (db.prepare('SELECT id FROM users WHERE phone = ?').get(p)) throw new Conflict('Phone already registered');
      phone = p;
    }
    if (!email && !phone) throw new BadRequest('Email or phone is required');
    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const avatar = ['🦁', '🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🦉'][Math.floor(Math.random() * 8)];
    const info = db
      .prepare('INSERT INTO users (username, email, phone, password_hash, avatar, status) VALUES (?,?,?,?,?,?)')
      .run(username, email, phone, hash, avatar, 'online');
    return { user: getUserProfile(info.lastInsertRowid), token: signToken(getPublicUser(info.lastInsertRowid)) };
  },

  async login({ identity, password }) {
    if (!identity || !password) throw new BadRequest('Identity and password are required');
    const user = findUserByIdentity(identity);
    if (!user) throw new Unauthorized('Invalid credentials');
    if (user.banned) throw new Unauthorized('Account is banned');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new Unauthorized('Invalid credentials');
    db.prepare('UPDATE users SET status=\'online\', last_seen_at=? WHERE id=?').run(now(), user.id);
    return { user: getUserProfile(user.id), token: signToken(user) };
  },

  requestVerificationCode(target) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + config.verificationCodeTtlMs).toISOString();
    db.prepare('UPDATE verification_codes SET used=1 WHERE target=? AND used=0').run(target);
    db.prepare(
      'INSERT INTO verification_codes (target, code, purpose, expires_at) VALUES (?,?,?,?)'
    ).run(target, code, 'verify', expires);
    return code;
  },

  verifyCode(target, code) {
    const row = db
      .prepare(
        `SELECT * FROM verification_codes WHERE target=? AND code=? AND used=0 AND expires_at > datetime('now')`
      )
      .get(target, String(code).trim());
    if (!row) throw new Unauthorized('Invalid or expired code');
    db.prepare('UPDATE verification_codes SET used=1 WHERE id=?').run(row.id);
    return true;
  },

  async guestLogin(username) {
    const clean = String(username || '').trim().replace(/\s+/g, '_') || `Guest${randomBytes(3).toString('hex')}`;
    const hash = await bcrypt.hash(randomBytes(12).toString('hex'), 8);
    const avatar = ['🤖', '👾', '🎲', '🎯'][Math.floor(Math.random() * 4)];
    const info = db
      .prepare('INSERT INTO users (username, password_hash, avatar, status, is_bot) VALUES (?,?,?,?,0)')
      .run(clean, hash, avatar, 'online');
    const user = getPublicUser(info.lastInsertRowid);
    return { user: getUserProfile(user.id), token: signToken(user), guest: true };
  },

  getMe(userId) {
    return getUserProfile(userId);
  },

  logout(userId) {
    db.prepare('UPDATE users SET status=\'offline\', last_seen_at=? WHERE id=?').run(now(), userId);
  },
};

export { NotFound };
