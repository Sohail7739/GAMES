import { api } from './http.js';

export const authApi = {
  register: (body) => api.post('/auth/register', body),
  login: (body) => api.post('/auth/login', body),
  guest: (username) => api.post('/auth/guest', { username }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  requestCode: (target) => api.post('/auth/verify/request', { target }),
  verify: (target, code) => api.post('/auth/verify', { target, code }),
};

export const gamesApi = {
  list: () => api.get('/games'),
  detail: (code) => api.get(`/games/${code}`),
  leaderboard: (code, limit = 50) => api.get(`/games/${code}/leaderboard?limit=${limit}`),
};

export const usersApi = {
  me: () => api.get('/users/me'),
  updateMe: (patch) => api.patch('/users/me', patch),
  profile: (id) => api.get(`/users/${id}`),
  leaderboard: (game, limit = 50) => api.get(`/users/leaderboard${game ? `?game=${game}` : ''}`),
  friends: () => api.get('/users/me/friends'),
  addFriend: (userId) => api.post('/users/me/friends', { userId }),
  respondFriend: (fromId, accept) => api.patch(`/users/me/friends/${fromId}`, { accept }),
  removeFriend: (userId) => api.delete(`/users/me/friends/${userId}`),
  block: (userId) => api.post(`/users/me/blocked/${userId}`),
  unblock: (userId) => api.delete(`/users/me/blocked/${userId}`),
  history: (game) => api.post('/users/me/history', { game }),
  report: (userId, reason, details) => api.post(`/users/${userId}/report`, { reason, details }),
};

export const roomsApi = {
  list: () => api.get('/rooms'),
  create: (body) => api.post('/rooms', body),
  get: (code) => api.get(`/rooms/${code}`),
  join: (code, password) => api.post(`/rooms/${code}/join`, { password }),
  leave: (code) => api.post(`/rooms/${code}/leave`),
  invite: (code, userId) => api.post(`/rooms/${code}/invite/${userId}`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  announcements: () => api.get('/notifications/announcements'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
};
