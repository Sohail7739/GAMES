import { Router } from 'express';
import { asyncHandler, ok } from '../../lib/http.js';
import { authRequired } from '../../middleware/auth.js';
import { roomsService } from './service.js';
import { gamesService } from '../games/service.js';

const router = Router();
router.use(authRequired);

router.get(
  '/',
  asyncHandler((req, res) => {
    ok(res, { rooms: roomsService.listPublic() });
  })
);

router.post(
  '/',
  asyncHandler((req, res) => {
    const room = roomsService.createRoom(req.user, req.body);
    ok(res, { room }, { created: true });
  })
);

router.get(
  '/:code',
  asyncHandler((req, res) => {
    const room = roomsService.getRoomByCode(req.params.code);
    ok(res, { room });
  })
);

router.post(
  '/:code/join',
  asyncHandler((req, res) => {
    const room = roomsService.joinRoomDb(req.user.id, req.params.code, req.body.password);
    ok(res, { room });
  })
);

router.post(
  '/:code/leave',
  asyncHandler((req, res) => {
    const left = roomsService.leaveRoomDb(req.user.id, req.params.code);
    ok(res, { left });
  })
);

export default router;
