import { api } from './http.js';

export const authApi = {
  login: (b) => api.post('/auth/login', b),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const adminApi = {
  overview: () => api.get('/admin/overview'),
  analytics: () => api.get('/admin/analytics'),
  systemInfo: () => api.get('/admin/system-info'),
  // users
  users: (q) => api.get('/admin/users' + (q ? `?${new URLSearchParams(q)}` : '')),
  updateUser: (id, body) => api.patch(`/admin/users/${id}`, body),
  banUser: (id, reason) => api.post(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id) => api.post(`/admin/users/${id}/unban`),
  // games
  games: () => api.get('/admin/games'),
  toggleGame: (code) => api.post(`/admin/games/${code}/toggle`, {}),
  updateGameConfig: (code, body) => api.patch(`/admin/games/${code}/config`, body),
  // rooms & matches
  rooms: () => api.get('/admin/rooms'),
  matches: (q) => api.get('/admin/matches' + (q ? `?${new URLSearchParams(q)}` : '')),
  // reports
  reports: (q) => api.get('/admin/reports' + (q ? `?${new URLSearchParams(q)}` : '')),
  resolveReport: (id, body) => api.patch(`/admin/reports/${id}`, body),
  // announcements
  announcements: () => api.get('/admin/announcements'),
  createAnnouncement: (body) => api.post('/admin/announcements', body),
  toggleAnnouncement: (id, active) => api.post(`/admin/announcements/${id}/toggle`, { active }),
  // achievements
  achievements: () => api.get('/admin/achievements'),
  createAchievement: (body) => api.post('/admin/achievements', body),
  grantAchievement: (userId, code) => api.post('/admin/achievements/grant', { userId, code }),
  // leaderboard / logs
  leaderboard: (q) => api.get('/admin/leaderboard' + (q ? `?${new URLSearchParams(q)}` : '')),
  logs: (q) => api.get('/admin/logs' + (q ? `?${new URLSearchParams(q)}` : '')),
  adminLogs: (limit) => api.get('/admin/admin-logs' + (limit ? `?limit=${limit}` : '')),
};
