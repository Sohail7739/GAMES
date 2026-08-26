import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  adminOrigin: process.env.ADMIN_ORIGIN || '*',
  dbFile: process.env.DB_FILE || path.join(__dirname, '../../data/gaming.sqlite'),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcryptRounds: 10,
  rateLimit: {
    windowMs: 60 * 1000,
    max: 300,
  },
  verificationCodeTtlMs: 5 * 60 * 1000,
  matchmaking: {
    queueCheckIntervalMs: 3000,
    maxQueueWaitMs: 120000,
  },
};
