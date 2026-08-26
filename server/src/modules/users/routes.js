import { Router } from 'express';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired } from '../../middleware/auth.js';
import { usersService } from './service.js';
import { createNotification } from '../../lib/dao.js';
import { notificationsService } from '../notifications/service.js';

const router = Router();
router.use(authRequired);

router.get(
  '/leaderboard',
  asyncHandler((req, res) => {
    ok(res, usersService.leaderboard(req.query.game, req.query.limit));
  })
);

router.get(
  '/me',
  asyncHandler((req, res) => {
    ok(res, usersService.getProfile(req.user.id, req.user.id));
  })
);

router.patch(
  '/me',
  asyncHandler((req, res) => {
    ok(res, usersService.updateProfile(req.user.id, req.body));
  })
);

router.get(
  '/me/friends',
  asyncHandler((req, res) => {
    ok(res, { friends: usersService.listFriends(req.user.id), requests: usersService.listFriendRequests(req.user.id) });
  })
);

router.post(
  '/me/friends',
  asyncHandler((req, res) => {
    const result = usersService.sendFriendRequest(req.user.id, Number(req.body.userId));
    if (result.accepted) {
      createNotification(req.user.id, 'friend', 'Friend request accepted', 'You are now friends');
      notificationsService.push(req.user.id, 'friend', 'New friend', `@${usersService.getProfile(Number(req.body.userId), req.user.id).username} accepted your request`);
    } else {
      notificationsService.push(Number(req.body.userId), 'friend', 'Friend request', `@${usersService.getProfile(req.user.id, Number(req.body.userId)).username} sent you a request`);
    }
    ok(res, result);
  })
);

router.patch(
  '/me/friends/:fromId',
  asyncHandler((req, res) => {
    const accept = req.body.accept !== false;
    const result = usersService.respondRequest(req.user.id, Number(req.params.fromId), accept);
    if (accept) {
      notificationsService.push(Number(req.params.fromId), 'friend', 'Request accepted', `@${usersService.getProfile(req.user.id, Number(req.params.fromId)).username} accepted your friend request`);
    }
    ok(res, result);
  })
);

router.delete(
  '/me/friends/:userId',
  asyncHandler((req, res) => {
    ok(res, usersService.removeFriend(req.user.id, Number(req.params.userId)));
  })
);

router.post(
  '/me/blocked/:userId',
  asyncHandler((req, res) => {
    ok(res, usersService.blockUser(req.user.id, Number(req.params.userId)));
  })
);

router.delete(
  '/me/blocked/:userId',
  asyncHandler((req, res) => {
    ok(res, usersService.unblockUser(req.user.id, Number(req.params.userId)));
  })
);

router.post(
  '/me/history',
  asyncHandler((req, res) => {
    ok(res, { history: usersService.matchHistory(req.user.id, req.body.game) });
  })
);

router.post(
  '/:id/report',
  asyncHandler((req, res) => {
    ok(res, usersService.reportUser(req.user.id, Number(req.params.id), req.body.reason, req.body.details));
  })
);

router.get(
  '/:id',
  asyncHandler((req, res) => {
    ok(res, usersService.getProfile(Number(req.params.id), req.user.id));
  })
);

export default router;
