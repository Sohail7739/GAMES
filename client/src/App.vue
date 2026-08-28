<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from './store/auth.js';
import { useUiStore } from './store/ui.js';
import { useNotificationsStore } from './store/notifications.js';
import { useGamesStore } from './store/games.js';
import { useRoomStore } from './store/room.js';

const auth = useAuthStore();
const ui = useUiStore();
const notif = useNotificationsStore();
const games = useGamesStore();
const room = useRoomStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const showChrome = computed(() => auth.isAuthed && route.name !== 'play');

const navItems = [
  { name: 'lobby', label: () => t('nav.home'), icon: '🏠' },
  { name: 'friends', label: () => t('nav.friends'), icon: '👥' },
  { name: 'leaderboard', label: () => t('nav.leaderboard'), icon: '🏆' },
  { name: 'notifications', label: () => t('nav.notifications'), icon: '🔔' },
];

function go(routeName) {
  router.push({ name: routeName });
}

function logout() {
  auth.logout();
  router.push({ name: 'auth' });
}
</script>

<template>
  <div class="app-shell">
    <div class="ambient" />

    <header v-if="showChrome" class="topbar">
      <div class="brand" @click="go('lobby')">
        <div class="brand-logo">🎮</div>
        <span class="brand-name">{{ t('appName') }}</span>
      </div>

      <div class="topbar-actions">
        <button v-if="!games.matchmaking" class="icon-btn" title="Notifications" @click="go('notifications')">
          🔔
          <span v-if="notif.unread > 0" class="badge-dot">{{ notif.unread }}</span>
        </button>
        <button v-else class="icon-btn mm-active" title="Matchmaking" @click="games.cancelMatchmaking()">
          <span class="spinner" style="width: 16px; height: 16px" />
        </button>
        <div class="mini-avatar" :title="auth.user?.username || ''" @click="go('profile')">
          {{ auth.user?.id?.charCodeAt(0) % 2 === 0 ? '👨' : '👩' }}
        </div>
      </div>
    </header>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <nav v-if="showChrome" class="bottomnav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: route.name === item.name }"
        @click="go(item.name)"
      >
        <span class="nav-ico">{{ item.icon }}</span>
        <span>{{ item.label() }}</span>
      </button>
    </nav>

    <div class="toast-host">
      <div v-for="toast in ui.toasts" :key="toast.id" class="toast" :class="toast.type" @click="ui.dismiss(toast.id)">
        <span class="t-ico">{{ toast.type === 'success' ? '✅' : toast.type === 'error' ? '⛔' : 'ℹ️' }}</span>
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>
