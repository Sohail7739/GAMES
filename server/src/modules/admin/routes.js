import { Router } from 'express';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired, adminRequired } from '../../middleware/auth.js';
import { adminService } from './service.js';

const router = Router();
router.use(authRequired, adminRequired);

router.get(
  '/overview',
  asyncHandler((req, res) => ok(res, adminService.overview()))
);

router.get(
  '/analytics',
  asyncHandler((req, res) => ok(res, adminService.analytics()))
);

router.get(
  '/system-info',
  asyncHandler((req, res) => ok(res, adminService.systemInfo()))
);

// Users
router.get(
  '/users',
  asyncHandler((req, res) => ok(res, adminService.listUsers(req.query)))
);
router.get(
  '/users/:id',
  asyncHandler((req, res) => ok(res, adminService.getUser(Number(req.params.id))))
);
router.patch(
  '/users/:id',
  asyncHandler((req, res) => ok(res, adminService.updateUser(req.user.id, Number(req.params.id), req.body)))
);
router.post(
  '/users/:id/ban',
  asyncHandler((req, res) => ok(res, adminService.banUser(req.user.id, Number(req.params.id), req.body.reason)))
);
router.post(
  '/users/:id/unban',
  asyncHandler((req, res) => ok(res, adminService.unbanUser(req.user.id, Number(req.params.id))))
);

// Games
router.get(
  '/games',
  asyncHandler((req, res) => ok(res, { games: adminService.listGames() }))
);
router.post(
  '/games/:code/toggle',
  asyncHandler((req, res) => ok(res, adminService.toggleGame(req.user.id, req.params.code)))
);
router.patch(
  '/games/:code/config',
  asyncHandler((req, res) => ok(res, adminService.updateGameConfig(req.user.id, req.params.code, req.body)))
);

// Rooms & matches
router.get(
  '/rooms',
  asyncHandler((req, res) => ok(res, { rooms: adminService.listRooms() }))
);
router.get(
  '/matches',
  asyncHandler((req, res) => ok(res, adminService.listMatches(req.query)))
);

// Reports
router.get(
  '/reports',
  asyncHandler((req, res) => ok(res, adminService.listReports(req.query)))
);
router.patch(
  '/reports/:id',
  asyncHandler((req, res) => ok(res, adminService.resolveReport(req.user.id, Number(req.params.id), req.body)))
);

// Announcements
router.get(
  '/announcements',
  asyncHandler((req, res) => ok(res, { announcements: adminService.listAnnouncements() }))
);
router.post(
  '/announcements',
  asyncHandler((req, res) => ok(res, adminService.createAnnouncement(req.user.id, req.body)))
);
router.post(
  '/announcements/:id/toggle',
  asyncHandler((req, res) => ok(res, adminService.toggleAnnouncement(req.user.id, Number(req.params.id), req.body.active !== false)))
);

// Logs
router.get(
  '/logs',
  asyncHandler((req, res) => ok(res, adminService.listLogs(req.query)))
);
router.get(
  '/admin-logs',
  asyncHandler((req, res) => ok(res, { logs: adminService.listAdminLogs(req.query.limit) }))
);

// Achievements
router.get(
  '/achievements',
  asyncHandler((req, res) => ok(res, { achievements: adminService.listAchievements() }))
);
router.post(
  '/achievements',
  asyncHandler((req, res) => ok(res, adminService.createAchievement(req.user.id, req.body)))
);
router.post(
  '/achievements/grant',
  asyncHandler((req, res) => ok(res, adminService.grantAchievement(req.user.id, Number(req.body.userId), req.body.code)))
);

// Leaderboards
router.get(
  '/leaderboard',
  asyncHandler((req, res) => ok(res, { leaderboard: adminService.leaderboard(req.query.game, req.query.limit) }))
);

export default router;
