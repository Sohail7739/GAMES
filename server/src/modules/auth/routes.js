import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired } from '../../middleware/auth.js';
import { authService } from './service.js';
import { systemLog } from '../../lib/audit.js';
import { presenceHub } from '../presence/hub.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    systemLog('info', 'auth', `User registered: ${result.user.username}`);
    ok(res, result);
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    presenceHub.setOnline(result.user.id);
    systemLog('info', 'auth', `User logged in: ${result.user.username}`);
    ok(res, result);
  })
);

router.post(
  '/guest',
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await authService.guestLogin(req.body.username);
    ok(res, result);
  })
);

router.post(
  '/verify/request',
  asyncHandler(async (req, res) => {
    const { target } = req.body;
    if (!target) throw Object.assign(new Error('Target is required'), { status: 400 });
    const code = authService.requestVerificationCode(String(target));
    systemLog('info', 'auth', `Verification code requested for ${target}`);
    ok(res, { sent: true, hint: `Code sent to ${target}`, devCode: process.env.NODE_ENV !== 'production' ? code : undefined });
  })
);

router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { target, code } = req.body;
    await authService.verifyCode(target, code);
    ok(res, { verified: true });
  })
);

router.post(
  '/logout',
  authRequired,
  asyncHandler(async (req, res) => {
    authService.logout(req.user.id);
    presenceHub.setOffline(req.user.id);
    ok(res, { loggedOut: true });
  })
);

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    ok(res, authService.getMe(req.user.id));
  })
);

export default router;
