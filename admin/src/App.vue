<script setup>
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './store/auth.js';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const items = [
  { name: 'dashboard', label: 'Dashboard', icon: '📊' },
  { name: 'users', label: 'Users', icon: '👥' },
  { name: 'games', label: 'Games', icon: '🎮' },
  { name: 'rooms', label: 'Rooms', icon: '🏠' },
  { name: 'matches', label: 'Matches', icon: '🕹️' },
  { name: 'reports', label: 'Reports', icon: '🚩' },
  { name: 'announcements', label: 'Announcements', icon: '📢' },
  { name: 'achievements', label: 'Achievements', icon: '🏆' },
  { name: 'leaderboard', label: 'Leaderboard', icon: '🥇' },
  { name: 'analytics', label: 'Analytics', icon: '📈' },
  { name: 'logs', label: 'Logs', icon: '📜' },
  { name: 'settings', label: 'Settings', icon: '⚙️' },
];
const active = (n) => route.name === n;
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">🎮 Arena Admin</div>
      <div v-if="auth.user">
        <div class="muted" style="font-size:12px;padding:0 12px;margin-bottom:8px">{{ auth.user.username }} ({{ auth.user.role }})</div>
        <div v-for="it in items" :key="it.name">
          <button class="nav-item" :class="{ active: active(it.name) }" @click="router.push({ name: it.name })">
            <span>{{ it.icon }}</span> {{ it.label }}
          </button>
        </div>
        <div class="nav-item" @click="auth.logout(); router.push({ name: 'login' })">🚪 Logout</div>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
<style scoped>
.muted { color: var(--text-dim); }
</style>
