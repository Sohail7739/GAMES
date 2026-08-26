import { verifyToken } from '../lib/jwt.js';
import { Unauthorized, Forbidden } from '../lib/errors.js';
import { db } from '../db/index.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new Unauthorized('Missing token'));
  try {
    const payload = verifyToken(token);
    const user = db.prepare('SELECT id, username, role, banned FROM users WHERE id=?').get(Number(payload.sub));
    if (!user) return next(new Unauthorized('User not found'));
    if (user.banned) return next(new Unauthorized('Account is banned'));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function adminRequired(req, res, next) {
  if (!req.user) return next(new Unauthorized('Missing token'));
  if (req.user.role !== 'admin') return next(new Forbidden('Admin access required'));
  next();
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = db.prepare('SELECT id, username, role, banned FROM users WHERE id=?').get(Number(payload.sub));
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}
