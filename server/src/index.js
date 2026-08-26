import http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { notFoundHandler, errorHandler } from './lib/errors.js';
import { RealtimeHub } from './modules/realtime/hub.js';
import { registerGames } from './games/registry.js';
import { systemLog } from './lib/audit.js';

import authRoutes from './modules/auth/routes.js';
import usersRoutes from './modules/users/routes.js';
import gamesRoutes from './modules/games/routes.js';
import roomsRoutes from './modules/rooms/routes.js';
import notificationsRoutes from './modules/notifications/routes.js';
import adminRoutes from './modules/admin/routes.js';

registerGames();

const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
const hub = new RealtimeHub(server);

server.listen(config.port, () => {
  systemLog('info', 'system', `Server started on port ${config.port}`);
  logger.info(`Game platform server listening on :${config.port}`, { env: config.env });
});

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err?.message, stack: err?.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { message: reason?.message, stack: reason?.stack });
});

export { app, server, hub };
