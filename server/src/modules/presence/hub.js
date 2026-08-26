import { db } from '../../db/index.js';
import { setStatus } from '../../lib/dao.js';

/**
 * Presence hub: tracks online sockets per user and broadcasts
 * online/offline transitions to their friends.
 */
class PresenceHub {
  constructor() {
    this.sockets = new Map(); // userId -> Set<socketId>
    this.emitter = null; // injected by realtime hub
  }

  injectEmitter(emitter) {
    this.emitter = emitter;
  }

  isOnline(userId) {
    const s = this.sockets.get(String(userId));
    return s ? s.size > 0 : false;
  }

  addSocket(userId, socket) {
    const key = String(userId);
    if (!this.sockets.has(key)) this.sockets.set(key, new Set());
    this.sockets.get(key).add(socket.id);
    const wasOffline = this.sockets.get(key).size === 1;
    setStatus(userId, 'online');
    if (wasOffline) this.broadcastToFriends(userId, { id: userId, status: 'online' });
  }

  removeSocket(userId, socket) {
    const key = String(userId);
    const set = this.sockets.get(key);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      this.sockets.delete(key);
      setStatus(userId, 'offline');
      this.broadcastToFriends(userId, { id: userId, status: 'offline' });
    }
  }

  setOnline(userId) {
    setStatus(userId, 'online');
  }

  setOffline(userId) {
    setStatus(userId, 'offline');
  }

  broadcastToFriends(userId, payload) {
    if (!this.emitter) return;
    const friendIds = db
      .prepare(
        `SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END fid
         FROM friends WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'`
      )
      .all(userId, userId, userId);
    for (const { fid } of friendIds) {
      this.emitter.to(`user:${fid}`).emit('presence:status', payload);
    }
  }
}

export const presenceHub = new PresenceHub();
