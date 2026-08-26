import { Router } from 'express';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired } from '../../middleware/auth.js';
import { gamesService } from './service.js';
import { usersService } from '../users/service.js';

const router = Router();
router.use(authRequired);

router.get(
  '/',
  asyncHandler((req, res) => {
    const games = gamesService.listEnabled();
    const playersOnline = gamesService.onlineCount();
    ok(res, { games, playersOnline });
  })
);

router.get(
  '/:code',
  asyncHandler((req, res) => {
    const game = gamesService.getGame(req.params.code);
    const leaderboard = usersService.leaderboard(game.code, 10);
    ok(res, { game, leaderboard });
  })
);

router.get(
  '/:code/leaderboard',
  asyncHandler((req, res) => {
    ok(res, { leaderboard: usersService.leaderboard(req.params.code, req.query.limit || 50) });
  })
);

export default router;
