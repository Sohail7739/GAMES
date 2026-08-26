import { db, now } from '../db/index.js';
import { levelForXp, progressForXp } from './levels.js';
import { BadRequest } from './errors.js';

export const publicUser = `id, username, email, phone, role, avatar, status, level, xp, coins, bio, is_bot, banned, last_seen_at, created_at`;

export function getPublicUser(id) {
  return db.prepare(`SELECT ${publicUser} FROM users WHERE id = ?`).get(id);
}

export function getUserProfile(id) {
  const u = getPublicUser(id);
  if (!u) return null;
  const stats = db
    .prepare(
      `SELECT g.code, g.name, g.name_ar as nameAr, g.icon, g.color,
              s.wins, s.losses, s.draws, s.matches_played as matchesPlayed,
              s.points, s.rating
       FROM game_stats s JOIN games g ON g.id = s.game_id
       WHERE s.user_id = ? ORDER BY g.sort_order`
    )
    .all(id);
  const achievements = db
    .prepare(
      `SELECT a.code, a.name, a.name_ar as nameAr, a.description, a.icon, a.xp, ua.unlocked_at as unlockedAt
       FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = ? ORDER BY ua.unlocked_at DESC`
    )
    .all(id);
  const totalWins = db.prepare('SELECT COALESCE(SUM(wins),0) w FROM game_stats WHERE user_id=?').get(id).w;
  const totalMatches = db.prepare('SELECT COALESCE(SUM(matches_played),0) m FROM game_stats WHERE user_id=?').get(id).m;
  return {
    ...u,
    xpProgress: progressForXp(u.xp),
    stats,
    achievements,
    totals: { wins: totalWins, matches: totalMatches },
  };
}

export function addXp(userId, amount) {
  const u = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId);
  if (!u) return;
  const newXp = u.xp + amount;
  const newLevel = levelForXp(newXp);
  db.prepare('UPDATE users SET xp=?, level=?, last_seen_at=? WHERE id=?').run(newXp, newLevel, now(), userId);
  return { xp: newXp, level: newLevel, leveledUp: newLevel > u.level, gained: amount };
}

export function setStatus(userId, status) {
  db.prepare('UPDATE users SET status=?, last_seen_at=? WHERE id=?').run(status, now(), userId);
}

export function addCoins(userId, amount, meta = {}) {
  const u = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
  if (!u) return;
  const balance = u.coins + amount;
  if (balance < 0) throw new BadRequest('Insufficient coins');
  db.prepare('UPDATE users SET coins=? WHERE id=?').run(balance, userId);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, balance_after, meta) VALUES (?,?,?,?,?)'
  ).run(userId, amount > 0 ? 'credit' : 'debit', amount, balance, JSON.stringify(meta));
  return balance;
}

export function ensureStatRow(userId, gameId) {
  db.prepare('INSERT OR IGNORE INTO game_stats (user_id, game_id) VALUES (?,?)').run(userId, gameId);
}

export function recordMatchResult(userId, gameId, { win, draw, points, ratingDelta }) {
  ensureStatRow(userId, gameId);
  const s = db.prepare('SELECT * FROM game_stats WHERE user_id=? AND game_id=?').get(userId, gameId);
  const wins = s.wins + (win ? 1 : 0);
  const losses = s.losses + (!win && !draw ? 1 : 0);
  const draws = s.draws + (draw ? 1 : 0);
  const streak = win ? s.current_streak + 1 : 0;
  const best = Math.max(s.best_streak, streak);
  db.prepare(
    `UPDATE game_stats SET wins=?, losses=?, draws=?, matches_played=matches_played+1,
       points=points+?, rating=?, current_streak=?, best_streak=? WHERE user_id=? AND game_id=?`
  ).run(wins, losses, draws, points || 0, Math.max(0, s.rating + (ratingDelta || 0)), streak, best, userId, gameId);
}

export function unlockAchievement(userId, code) {
  const a = db.prepare('SELECT * FROM achievements WHERE code=?').get(code);
  if (!a) return null;
  const exists = db.prepare('SELECT 1 FROM user_achievements WHERE user_id=? AND achievement_id=?').get(userId, a.id);
  if (exists) return null;
  db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?,?)').run(userId, a.id);
  addXp(userId, a.xp);
  return a;
}

export function checkAchievements(userId) {
  const unlocked = [];
  const g = db.prepare('SELECT COALESCE(SUM(wins),0) wins, COALESCE(SUM(matches_played),0) matches FROM game_stats WHERE user_id=?').get(userId);
  const friends = db.prepare('SELECT COUNT(*) c FROM friends WHERE (user_id=? OR friend_id=?) AND status=\'accepted\'').get(userId, userId).c;
  const u = db.prepare('SELECT level FROM users WHERE id=?').get(userId);
  const defs = [
    { code: 'first_win', check: () => g.wins >= 1 },
    { code: 'play_10', check: () => g.matches >= 10 },
    { code: 'friend_5', check: () => friends >= 5 },
    { code: 'level_5', check: () => u.level >= 5 },
    { code: 'win_10', check: () => g.wins >= 10 },
  ];
  for (const d of defs) {
    if (d.check()) {
      const a = unlockAchievement(userId, d.code);
      if (a) unlocked.push(a);
    }
  }
  return unlocked;
}

export function getLeaderboard(gameCode, limit = 50) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar, u.level, s.wins, s.losses, s.draws,
              s.matches_played as matchesPlayed, s.points, s.rating
       FROM game_stats s
       JOIN users u ON u.id = s.user_id
       JOIN games g ON g.id = s.game_id
       WHERE g.code = ? AND u.is_bot = 0
       ORDER BY s.points DESC, s.rating DESC
       LIMIT ?`
    )
    .all(gameCode, limit);
}

export function getGlobalLeaderboard(limit = 50) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar, u.level, SUM(s.points) totalPoints,
              SUM(s.wins) wins, SUM(s.matches_played) matchesPlayed
       FROM game_stats s JOIN users u ON u.id = s.user_id
       WHERE u.is_bot = 0
       GROUP BY u.id
       ORDER BY totalPoints DESC, wins DESC
       LIMIT ?`
    )
    .all(limit);
}

export function createNotification(userId, type, title, body, data = {}) {
  const info = db
    .prepare('INSERT INTO notifications (user_id, type, title, body, data) VALUES (?,?,?,?,?)')
    .run(userId, type, title, body, JSON.stringify(data));
  return { id: info.lastInsertRowid, user_id: userId, type, title, body, data, is_read: 0, created_at: now() };
}
