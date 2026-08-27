import { createRouter, createWebHistory } from 'vue-router';
import { apiToken } from '../api/http.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/users', name: 'users', component: () => import('../views/UsersView.vue') },
  { path: '/games', name: 'games', component: () => import('../views/GamesView.vue') },
  { path: '/rooms', name: 'rooms', component: () => import('../views/RoomsView.vue') },
  { path: '/matches', name: 'matches', component: () => import('../views/MatchesView.vue') },
  { path: '/reports', name: 'reports', component: () => import('../views/ReportsView.vue') },
  { path: '/analytics', name: 'analytics', component: () => import('../views/AnalyticsView.vue') },
  { path: '/achievements', name: 'achievements', component: () => import('../views/AchievementsView.vue') },
  { path: '/announcements', name: 'announcements', component: () => import('../views/AnnouncementsView.vue') },
    { path: '/logs', name: 'logs', component: () => import('../views/LogsView.vue') },
  { path: '/leaderboard', name: 'leaderboard', component: () => import('../views/LeaderboardView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/admin/'),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.public) return;
  if (!apiToken()) return { name: 'login', query: { redirect: to.fullPath } };
});
