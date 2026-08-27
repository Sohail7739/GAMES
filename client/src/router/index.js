import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/http.js';

const routes = [
  { path: '/auth', name: 'auth', component: () => import('../views/AuthView.vue'), meta: { public: true } },
  { path: '/', name: 'lobby', component: () => import('../views/LobbyView.vue') },
  { path: '/game/:code', name: 'game', component: () => import('../views/GameDetailView.vue') },
  { path: '/room/:code', name: 'room', component: () => import('../views/RoomView.vue') },
  { path: '/play/:code', name: 'play', component: () => import('../views/PlayView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  { path: '/profile/:id', name: 'profileId', component: () => import('../views/ProfileView.vue') },
  { path: '/friends', name: 'friends', component: () => import('../views/FriendsView.vue') },
  { path: '/leaderboard', name: 'leaderboard', component: () => import('../views/LeaderboardView.vue') },
  { path: '/notifications', name: 'notifications', component: () => import('../views/NotificationsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (!to.meta.public && !getToken()) {
    return { name: 'auth', query: { redirect: to.fullPath } };
  }
  if (to.name === 'auth' && getToken()) {
    return { name: 'lobby' };
  }
});
