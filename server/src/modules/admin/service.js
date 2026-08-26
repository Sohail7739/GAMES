import { db, now } from '../../db/index.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { recordAdminLog, systemLog } from '../../lib/audit.js';
import { getPublicUser, getLeaderboard, getGlobalLeaderboard, unlockAchievement } from '../../lib/dao.js';
import { gameRegistry } from '../../games/registry.js';

function rowToGame(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.name_ar,
    description: row.description,
    descriptionAr: row.description_ar,
    category: row.category,
    icon: row.icon,
    color: row.color,
    enabled: !!row.enabled,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    config: JSON.parse(row.config || '{}'),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export const adminService = {
  overview() {
    const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    const onlineUsers = db.prepare('SELECT COUNT(*) c FROM users WHERE status=\'online\'').get().c;
    const activeMatches = db.prepare('SELECT COUNT(*) c FROM matches WHERE status=\'started\'').get().c;
    const totalMatches = db.prepare('SELECT COUNT(*) c FROM matches').get().c;
    const openRooms = db.prepare('SELECT COUNT(*) c FROM rooms WHERE status=\'waiting\'').get().c;
    const openReports = db.prepare('SELECT COUNT(*) c FROM reports WHERE status=\'open\'').get().c;
    const blockedUsers = db.prepare('SELECT COUNT(*) c FROM users WHERE banned=1').get().c;
    const gameStats = db
      .prepare(
        `SELECT g.code, g.name, g.icon, g.enabled,
                COUNT(DISTINCT m.id) matches
         FROM games g LEFT JOIN matches m ON m.game_id = g.id
         GROUP BY g.id ORDER BY g.sort_order`
      )
      .all()
      .map((r) => ({ code: r.code, name: r.name, icon: r.icon, enabled: !!r.enabled, matches: r.matches }));

    const last7 = db
      .prepare(
        `SELECT date(started_at) day, COUNT(*) matches FROM matches
         WHERE started_at >= date('now','-6 day') GROUP BY day ORDER BY day`
      )
      .all()
      .map((r) => ({ day: r.day, matches: r.matches }));

    const signups = db
      .prepare(
        `SELECT date(created_at) day, COUNT(*) users FROM users
         WHERE created_at >= date('now','-6 day') GROUP BY day ORDER BY day`
      )
      .all()
      .map((r) => ({ day: r.day, users: r.users }));

    return { totalUsers, onlineUsers, activeMatches, totalMatches, openRooms, openReports, blockedUsers, gameStats, last7, signups };
  },

  listUsers({ q, page = 1, limit = 25 }) {
    const offset = (Number(page) - 1) * Number(limit);
    let where = '';
    const params = [];
    if (q) {
      where = 'WHERE username LIKE ? OR email LIKE ? OR phone LIKE ?';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const users = db
      .prepare(
        `SELECT id, username, email, phone, role, avatar, status, level, xp, coins, is_bot, banned, last_seen_at, created_at
         FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) c FROM users ${where}`).get(...params).c;
    return { users, total, page: Number(page), limit: Number(limit) };
  },

  getUser(id) {
    const u = getPublicUser(id);
    if (!u) throw new NotFound('User not found');
    const stats = db.prepare('SELECT g.code, s.wins, s.losses, s.matches_played, s.points FROM game_stats s JOIN games g ON g.id=s.game_id WHERE s.user_id=?').all(id);
    const reports = db.prepare('SELECT * FROM reports WHERE target_id=? ORDER BY id DESC LIMIT 10').all(id);
    const history = db.prepare('SELECT m.code, g.code game, mp.result, mp.score, m.started_at FROM match_participants mp JOIN matches m ON m.id=mp.match_id JOIN games g ON g.id=m.game_id WHERE mp.user_id=? ORDER BY m.id DESC LIMIT 10').all(id);
    return { ...u, stats, reports, history };
  },

  updateUser(adminId, id, patch) {
    const user = getPublicUser(id);
    if (!user) throw new NotFound('User not found');
    const allowed = ['role', 'banned', 'coins', 'avatar', 'bio', 'username', 'level'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        fields.push(`${key}=?`);
        values.push(patch[key]);
      }
    }
    if (fields.length) {
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id=?`).run(...values, id);
      recordAdminLog(adminId, 'user_update', 'user', id, { patch });
    }
    return getPublicUser(id);
  },

  banUser(adminId, id, reason = '') {
    db.prepare('UPDATE users SET banned=1 WHERE id=?').run(id);
    recordAdminLog(adminId, 'user_ban', 'user', id, { reason });
    return { banned: true };
  },

  unbanUser(adminId, id) {
    db.prepare('UPDATE users SET banned=0 WHERE id=?').run(id);
    recordAdminLog(adminId, 'user_unban', 'user', id);
    return { banned: false };
  },

  listGames() {
    return db.prepare('SELECT * FROM games ORDER BY sort_order').all().map(rowToGame);
  },

  toggleGame(adminId, code) {
    const row = db.prepare('SELECT * FROM games WHERE code=?').get(code);
    if (!row) throw new NotFound('Game not found');
    const enabled = row.enabled ? 0 : 1;
    db.prepare('UPDATE games SET enabled=? WHERE id=?').run(enabled, row.id);
    recordAdminLog(adminId, 'game_toggle', 'game', row.id, { code, enabled });
    return rowToGame(db.prepare('SELECT * FROM games WHERE id=?').get(row.id));
  },

  updateGameConfig(adminId, code, patch) {
    const row = db.prepare('SELECT * FROM games WHERE code=?').get(code);
    if (!row) throw new NotFound('Game not found');
    const config = { ...JSON.parse(row.config || '{}') };
    const allowed = ['targetScore', 'hokumTarget', 'sunTarget', 'coinsPerPlayer', 'queenBonus', 'strikerLimit', 'finishPoints', 'handSize', 'tokensPerPlayer', 'safeCells', 'captureOnSix'];
    for (const key of allowed) {
      if (patch[key] !== undefined) config[key] = patch[key];
    }
    db.prepare('UPDATE games SET config=? WHERE id=?').run(JSON.stringify(config), row.id);
    recordAdminLog(adminId, 'game_config', 'game', row.id, { code, config });
    return rowToGame(db.prepare('SELECT * FROM games WHERE id=?').get(row.id));
  },

  listRooms() {
    return db
      .prepare(
        `SELECT r.id, r.code, r.name, r.is_private, r.status, r.host_id, r.created_at,
                g.code game_code, g.name game_name, g.icon,
                (SELECT COUNT(*) FROM room_players rp WHERE rp.room_id=r.id) players
         FROM rooms r JOIN games g ON g.id=r.game_id ORDER BY r.id DESC LIMIT 100`
      )
      .all()
      .map((r) => ({ ...r, isPrivate: !!r.is_private }));
  },

  listMatches({ status, page = 1, limit = 25 }) {
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (status) {
      where += ' AND m.status=?';
      params.push(status);
    }
    const matches = db
      .prepare(
        `SELECT m.id, m.code, m.status, m.started_at, m.finished_at, m.winner_id,
                g.code game_code, g.name game_name, g.icon
         FROM matches m JOIN games g ON g.id=m.game_id ${where}
         ORDER BY m.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) c FROM matches m ${where}`).get(...params).c;
    return { matches, total, page: Number(page), limit: Number(limit) };
  },

  listReports({ status, page = 1, limit = 25 }) {
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (status) {
      where += ' AND r.status=?';
      params.push(status);
    }
    const reports = db
      .prepare(
        `SELECT r.id, r.reason, r.details, r.status, r.admin_note, r.created_at,
                u.username reporter, u.avatar reporter_avatar,
                t.username target, t.avatar target_avatar
         FROM reports r
         JOIN users u ON u.id = r.reporter_id
         JOIN users t ON t.id = r.target_id ${where}
         ORDER BY r.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) c FROM reports r ${where}`).get(...params).c;
    return { reports, total, page: Number(page), limit: Number(limit) };
  },

  resolveReport(adminId, id, { status, adminNote }) {
    const row = db.prepare('SELECT * FROM reports WHERE id=?').get(id);
    if (!row) throw new NotFound('Report not found');
    db.prepare('UPDATE reports SET status=?, admin_note=? WHERE id=?').run(status || 'resolved', adminNote || '', id);
    recordAdminLog(adminId, 'report_resolve', 'report', id, { status, adminNote });
    return { resolved: true, id };
  },

  listAnnouncements() {
    return db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 50').all();
  },

  createAnnouncement(adminId, { title, body, target }) {
    if (!title) throw new BadRequest('Title required');
    const info = db.prepare('INSERT INTO announcements (title, body, target, active, created_by) VALUES (?,?,?,1,?)').run(title, body || '', target || 'all', adminId);
    recordAdminLog(adminId, 'announcement_create', 'announcement', info.lastInsertRowid, { title });
    return db.prepare('SELECT * FROM announcements WHERE id=?').get(info.lastInsertRowid);
  },

  toggleAnnouncement(adminId, id, active) {
    db.prepare('UPDATE announcements SET active=? WHERE id=?').run(active ? 1 : 0, id);
    recordAdminLog(adminId, 'announcement_toggle', 'announcement', id, { active });
    return { active: !!active };
  },

  listLogs({ level, category, page = 1, limit = 50 }) {
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (level) {
      where += ' AND level=?';
      params.push(level);
    }
    if (category) {
      where += ' AND category=?';
      params.push(category);
    }
    const logs = db.prepare(`SELECT * FROM system_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    return { logs, page: Number(page), limit: Number(limit) };
  },

  listAdminLogs(limit = 100) {
    return db.prepare('SELECT * FROM admin_logs ORDER BY id DESC LIMIT ?').all(limit);
  },

  analytics() {
    const perGame = db
      .prepare(
        `SELECT g.code, g.name, COUNT(m.id) matches, COALESCE(SUM(CASE WHEN m.status='finished' THEN 1 ELSE 0 END),0) finished
         FROM games g LEFT JOIN matches m ON m.game_id=g.id GROUP BY g.id ORDER BY g.sort_order`
      )
      .all();
    const topWinners = db
      .prepare(
        `SELECT u.id, u.username, u.avatar, SUM(s.wins) wins, SUM(s.matches_played) played
         FROM game_stats s JOIN users u ON u.id=s.user_id WHERE u.is_bot=0
         GROUP BY u.id ORDER BY wins DESC LIMIT 10`
      )
      .all();
    const topRatings = db
      .prepare(
        `SELECT u.id, u.username, u.avatar, s.rating, g.name game
         FROM game_stats s JOIN users u ON u.id=s.user_id JOIN games g ON g.id=s.game_id
         WHERE u.is_bot=0 ORDER BY s.rating DESC LIMIT 10`
      )
      .all();
    const today = db
      .prepare(`SELECT COUNT(*) c FROM matches WHERE date(started_at)=date('now')`)
      .get().c;
    const activityByHour = db
      .prepare(
        `SELECT strftime('%H', started_at) hour, COUNT(*) matches FROM matches
         WHERE started_at >= date('now','-1 day') GROUP BY hour ORDER BY hour`
      )
      .all();
    return { perGame, topWinners, topRatings, todayMatches: today, activityByHour };
  },

  listAchievements() {
    return db.prepare('SELECT a.*, (SELECT COUNT(*) FROM user_achievements ua WHERE ua.achievement_id=a.id) unlocked_count FROM achievements a ORDER BY id').all();
  },

  createAchievement(adminId, { code, name, nameAr, description, icon, xp }) {
    if (!code || !name) throw new BadRequest('Code and name required');
    const info = db.prepare('INSERT INTO achievements (code, name, name_ar, description, icon, xp) VALUES (?,?,?,?,?,?)').run(code, name, nameAr || name, description || '', icon || 'trophy', xp || 50);
    recordAdminLog(adminId, 'achievement_create', 'achievement', info.lastInsertRowid, { code });
    return db.prepare('SELECT * FROM achievements WHERE id=?').get(info.lastInsertRowid);
  },

  grantAchievement(adminId, userId, code) {
    const user = getPublicUser(userId);
    if (!user) throw new NotFound('User not found');
    const a = unlockAchievement(userId, code);
    recordAdminLog(adminId, 'achievement_grant', 'user', userId, { code });
    return { granted: !!a };
  },

  leaderboard(gameCode, limit = 100) {
    if (gameCode) return getLeaderboard(gameCode, limit);
    return getGlobalLeaderboard(limit);
  },

  systemInfo() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    return { uptime, memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal }, node: process.version, platform: process.platform };
  },
};

export { now };
