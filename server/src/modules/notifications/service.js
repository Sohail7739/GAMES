import { db } from '../../db/index.js';
import { createNotification } from '../../lib/dao.js';

class NotificationsService {
  constructor() {
    this.emitter = null;
  }

  injectEmitter(emitter) {
    this.emitter = emitter;
  }

  push(userId, type, title, body, data = {}) {
    const notif = createNotification(userId, type, title, body, data);
    if (this.emitter) {
      this.emitter.to(`user:${userId}`).emit('notification:new', notif);
    }
    return notif;
  }

  list(userId, limit = 30) {
    return db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT ?').all(userId, limit);
  }

  markRead(userId, id) {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(id, userId);
  }

  markAllRead(userId) {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(userId);
  }

  unreadCount(userId) {
    return db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(userId).c;
  }
}

export const notificationsService = new NotificationsService();
