import { Router } from 'express';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired } from '../../middleware/auth.js';
import { notificationsService } from './service.js';
import { db } from '../../db/index.js';

const router = Router();
router.use(authRequired);

router.get(
  '/',
  asyncHandler((req, res) => {
    ok(res, {
      notifications: notificationsService.list(req.user.id, req.query.limit),
      unread: notificationsService.unreadCount(req.user.id),
    });
  })
);

router.get(
  '/announcements',
  asyncHandler((req, res) => {
    ok(res, { announcements: db.prepare('SELECT * FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 10').all() });
  })
);

router.patch(
  '/:id/read',
  asyncHandler((req, res) => {
    notificationsService.markRead(req.user.id, Number(req.params.id));
    ok(res, { read: true });
  })
);

router.post(
  '/read-all',
  asyncHandler((req, res) => {
    notificationsService.markAllRead(req.user.id);
    ok(res, { read: true });
  })
);

export default router;
