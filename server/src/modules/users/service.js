import { db, now } from '../../db/index.js';
import { BadRequest, NotFound, Conflict } from '../../lib/errors.js';
import { getPublicUser, getLeaderboard, getGlobalLeaderboard } from '../../lib/dao.js';
import { presenceHub } from '../presence/hub.js';

export const usersService = {
  getProfile(userId, viewerId) {
    const profile = getPublicUser(userId);
    if (!profile) throw new NotFound('User not found');
    const friends = db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.status, u.level
         FROM friends f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
         WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'`
      )
      .all(userId, userId, userId);
    const stats = db
      .prepare(
        `SELECT g.code, g.name, g.name_ar as nameAr, g.icon, s.wins, s.losses, s.draws,
                s.matches_played as matchesPlayed, s.points, s.rating
         FROM game_stats s JOIN games g ON g.id = s.game_id WHERE s.user_id = ?`
      )
      .all(userId);
    const achievements = db
      .prepare(
        `SELECT a.code, a.name, a.name_ar as nameAr, a.icon, a.xp FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?`
      )
      .all(userId);
    let relation = 'none';
    let inbound = false;
    if (viewerId && viewerId !== userId) {
      const f = db
        .prepare('SELECT * FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)')
        .get(viewerId, userId, userId, viewerId);
      if (f) {
        relation = f.status;
        inbound = f.user_id === userId && f.friend_id === viewerId;
      }
    }
    const blocked = viewerId
      ? db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?').get(viewerId, userId)
      : null;
    return {
      ...profile,
      online: presenceHub.isOnline(userId),
      friendsCount: friends.length,
      relation,
      inbound,
      isBlocked: !!blocked,
      stats,
      achievements,
      friends,
    };
  },

  updateProfile(userId, patch) {
    const allowed = ['avatar', 'bio', 'username'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        fields.push(`${key}=?`);
        values.push(patch[key]);
        if (key === 'username') {
          const clean = String(patch.username).trim().replace(/\s+/g, '_');
          if (clean.length < 3) throw new BadRequest('Username must be at least 3 characters');
          const dup = db.prepare('SELECT id FROM users WHERE username=? AND id<>?').get(clean, userId);
          if (dup) throw new Conflict('Username already taken');
          values[values.length - 1] = clean;
        }
      }
    }
    if (fields.length) {
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id=?`).run(...values, userId);
    }
    return getPublicUser(userId);
  },

  listFriends(userId) {
    return db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.status, u.level, u.is_bot, u.last_seen_at
         FROM friends f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
         WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'`
      )
      .all(userId, userId, userId);
  },

  listFriendRequests(userId) {
    return db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.level, u.status
         FROM friends f JOIN users u ON u.id = f.user_id
         WHERE f.friend_id = ? AND f.status = 'pending'`
      )
      .all(userId);
  },

  sendFriendRequest(fromId, toId) {
    if (Number(fromId) === Number(toId)) throw new BadRequest('Cannot add yourself');
    const target = getPublicUser(toId);
    if (!target) throw new NotFound('User not found');
    if (db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=? OR blocker_id=? AND blocked_id=?').get(fromId, toId, toId, fromId)) {
      throw new BadRequest('Unable to send request');
    }
    const existing = db
      .prepare('SELECT * FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)')
      .get(fromId, toId, toId, fromId);
    if (existing) {
      if (existing.status === 'accepted') throw new Conflict('Already friends');
      if (existing.user_id === fromId) throw new Conflict('Request already sent');
      db.prepare('UPDATE friends SET status=\'accepted\' WHERE user_id=? AND friend_id=?').run(existing.user_id, existing.friend_id);
      return { accepted: true, userId: toId };
    }
    db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?,?,?)').run(fromId, toId, 'pending');
    return { accepted: false, userId: toId };
  },

  respondRequest(userId, fromId, accept) {
    const row = db.prepare('SELECT * FROM friends WHERE user_id=? AND friend_id=?').get(fromId, userId);
    if (!row) throw new NotFound('Request not found');
    if (accept) {
      db.prepare('UPDATE friends SET status=\'accepted\', created_at=? WHERE user_id=? AND friend_id=?').run(now(), fromId, userId);
    } else {
      db.prepare('DELETE FROM friends WHERE user_id=? AND friend_id=?').run(fromId, userId);
    }
    return { accepted: !!accept, userId: fromId };
  },

  removeFriend(userId, otherId) {
    db.prepare('DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)').run(
      userId,
      otherId,
      otherId,
      userId
    );
    return true;
  },

  blockUser(userId, targetId) {
    if (Number(userId) === Number(targetId)) throw new BadRequest('Cannot block yourself');
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?,?)').run(userId, targetId);
    db.prepare('DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)').run(userId, targetId, targetId, userId);
    return true;
  },

  unblockUser(userId, targetId) {
    db.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').run(userId, targetId);
    return true;
  },

  reportUser(reporterId, targetId, reason, details) {
    if (Number(reporterId) === Number(targetId)) throw new BadRequest('Cannot report yourself');
    const target = getPublicUser(targetId);
    if (!target) throw new NotFound('User not found');
    if (!reason) throw new BadRequest('Reason is required');
    db.prepare('INSERT INTO reports (reporter_id, target_id, reason, details) VALUES (?,?,?,?)').run(
      reporterId,
      targetId,
      reason,
      details || ''
    );
    return true;
  },

  matchHistory(userId, gameCode, limit = 20) {
    let sql = `SELECT m.id, m.code, m.game_id, g.code gameCode, g.name gameName, g.icon,
                      m.status, m.winner_id, m.started_at, m.finished_at,
                      mp.score, mp.result, mp.team, mp.seat
               FROM match_participants mp
               JOIN matches m ON m.id = mp.match_id
               JOIN games g ON g.id = m.game_id
               WHERE mp.user_id = ?`;
    const params = [userId];
    if (gameCode) {
      sql += ' AND g.code = ?';
      params.push(gameCode);
    }
    sql += ' ORDER BY m.id DESC LIMIT ?';
    params.push(Number(limit) || 20);
    return db.prepare(sql).all(...params);
  },

  leaderboard(gameCode, limit = 50) {
    if (gameCode) return getLeaderboard(gameCode, limit);
    return getGlobalLeaderboard(limit);
  },
};
