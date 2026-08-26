import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Unauthorized } from './errors.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role || 'user',
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    throw new Unauthorized('Invalid or expired token');
  }
}
