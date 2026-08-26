import { db } from '../db/index.js';

export function recordAdminLog(adminId, action, targetType, targetId, details = {}) {
  db.prepare(
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?,?,?,?,?)'
  ).run(adminId, action, targetType, targetId, JSON.stringify(details));
}

export function systemLog(level, category, message, meta = {}) {
  db.prepare('INSERT INTO system_logs (level, category, message, meta) VALUES (?,?,?,?)').run(
    level,
    category,
    message,
    JSON.stringify(meta)
  );
}
