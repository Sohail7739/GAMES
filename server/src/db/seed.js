import bcrypt from 'bcryptjs';
import { db, now } from './index.js';
import { logger } from '../lib/logger.js';

const hash = bcrypt.hashSync('password123', 10);

function upsertUser(username, email, phone, role, avatar, xp = 0, coins = 500, isBot = 0) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO users (username, email, phone, password_hash, role, avatar, xp, coins, is_bot, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'online')`
    )
    .run(username, email, phone, hash, role, avatar, xp, coins, isBot);
  return info.lastInsertRowid;
}

function upsertGame(code, name, nameAr, description, descriptionAr, category, icon, color, min, max, config, sort) {
  const existing = db.prepare('SELECT id FROM games WHERE code = ?').get(code);
  const row = {
    code,
    name,
    name_ar: nameAr,
    description,
    description_ar: descriptionAr,
    category,
    icon,
    color,
    enabled: 1,
    min_players: min,
    max_players: max,
    config: JSON.stringify(config),
    sort_order: sort,
  };
  if (existing) {
    db.prepare(
      `UPDATE games SET name=@name, name_ar=@name_ar, description=@description, description_ar=@description_ar,
       category=@category, icon=@icon, color=@color, enabled=@enabled, min_players=@min_players,
       max_players=@max_players, config=@config, sort_order=@sort_order WHERE code=@code`
    ).run(row);
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO games (code, name, name_ar, description, description_ar, category, icon, color, enabled,
         min_players, max_players, config, sort_order)
       VALUES (@code, @name, @name_ar, @description, @description_ar, @category, @icon, @color, @enabled,
         @min_players, @max_players, @config, @sort_order)`
    )
    .run(row);
  return info.lastInsertRowid;
}

function upsertAchievement(code, name, nameAr, description, icon, xp) {
  db.prepare(
    `INSERT OR IGNORE INTO achievements (code, name, name_ar, description, icon, xp)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(code, name, nameAr, description, icon, xp);
}

const adminId = upsertUser('admin', 'admin@gaming.app', null, 'admin', '🛡️', 9999, 10000);
upsertUser('player1', 'player1@gaming.app', null, 'user', '🦁', 1200);
upsertUser('player2', 'player2@gaming.app', null, 'user', '🦊', 800);
upsertUser('player3', 'player3@gaming.app', null, 'user', '🐼', 500);
upsertUser('player4', 'player4@gaming.app', null, 'user', '🐯', 150);
upsertUser('player5', 'player5@gaming.app', null, 'user', '🐸', 900);
upsertUser('salem', 'salem@example.com', null, 'user', '🏜️', 2100);
upsertUser('nora', 'nora@example.com', null, 'user', '🌸', 3300);
upsertUser('khalid', 'khalid@example.com', null, 'user', '⚡', 600);

const bots = ['DiceMaster', 'CardQueen', 'CarromPro', 'LudoKing', 'SultanSalah', 'Amina', 'Fahad', 'Reem'];
bots.forEach((b, i) => upsertUser(b, null, null, 'user', ['🤖', '👾', '🎲', '🎯'][i % 4], 200 + i * 400, 300, 1));

upsertGame(
  'baloot',
  'Baloot',
  'بلوت',
  'The classic Saudi 4-player partnership card game with hokum bidding.',
  'لعبة الورق السعودية الكلاسيكية لـ 4 لاعبين مع المزايدة في الحكم.',
  'card',
  '🃏',
  '#e05252',
  4,
  4,
  { targetScore: 152, roundsPerMatch: 0 },
  1
);
upsertGame(
  'jackaroo',
  'Jackaroo',
  'جاكارو',
  'A strategy board-and-card hybrid. Race your pawns while playing cards.',
  'لعبة استراتيجية تمزج الورق والطاولة. سبّق بيادقك وأنت تلعب الأوراق.',
  'strategy',
  '🎴',
  '#f5a623',
  2,
  4,
  { finishPoints: 3, handSize: 5 },
  2
);
upsertGame(
  'carrom',
  'Carrom',
  'كاروم',
  'Strike, pocket and master the queen in the classic board game with physics.',
  'اضرب وكوّس واحترف الملكة في لعبة الكاروم الكلاسيكية مع فيزياء واقعية.',
  'board',
  '🎯',
  '#4ca36c',
  2,
  4,
  { coinsPerPlayer: 9, queenBonus: 3, strikerLimit: 20 },
  3
);
upsertGame(
  'ludo',
  'Ludo Star',
  'لودو ستار',
  'The classic race game. Roll the dice, dodge and capture tokens to win.',
  'لعبة السباق الكلاسيكية. ارمِ النرد وتفادَ واقتنص القطع لتفوز.',
  'board',
  '🎲',
  '#4f7df9',
  2,
  4,
  { tokensPerPlayer: 4, safeCells: [0, 8, 13, 21, 26, 34, 39, 47], captureOnSix: false },
  4
);

upsertAchievement('first_win', 'First Win', 'أول فوز', 'Win your first match', '🏆', 100);
upsertAchievement('play_10', 'Getting Started', 'بداية الطريق', 'Play 10 matches', '🎮', 150);
upsertAchievement('friend_5', 'Social Butterfly', 'نجم التواصل', 'Add 5 friends', '👥', 100);
upsertAchievement('level_5', 'Rising Star', 'نجم صاعد', 'Reach level 5', '⭐', 200);
upsertAchievement('win_10', 'Serial Winner', 'فائز محترف', 'Win 10 matches in any game', '🥇', 300);
upsertAchievement('carrom_queen', 'Queen Master', 'ملكة الكاروم', 'Pocket the queen in Carrom', '👑', 150);
upsertAchievement('baloot_152', 'Baloot Champion', 'بطل البلوت', 'Reach 152 in Baloot', '🃏', 250);
upsertAchievement('ludo_capture', 'Token Hunter', 'صائد القطع', 'Capture a token in Ludo', '⚔️', 100);

db.prepare(
  `INSERT INTO announcements (title, body, target, active, created_by)
   VALUES ('Welcome to the Arena', 'All four games are live. Play, invite friends and climb the leaderboards!', 'all', 1, ?)`
).run(adminId);

db.prepare('INSERT OR IGNORE INTO system_logs (level, category, message) VALUES (?, ?, ?)').run(
  'info',
  'system',
  'Database seeded'
);

logger.info('Seed complete', { adminId, users: db.prepare('SELECT COUNT(*) c FROM users').get().c, games: db.prepare('SELECT COUNT(*) c FROM games').get().c });
