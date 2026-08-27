import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import i18n from './i18n/index.js';
import { useAuthStore } from './store/auth.js';
import { useUiStore } from './store/ui.js';
import { useGamesStore } from './store/games.js';
import { useRoomStore } from './store/room.js';
import { useNotificationsStore } from './store/notifications.js';
import './theme.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);

const auth = useAuthStore();
const ui = useUiStore();
const games = useGamesStore();
const room = useRoomStore();
const notif = useNotificationsStore();

ui.initTheme();
room.bindSocket();
games.bindSocket();
notif.bindSocket();

auth.boot().then(() => {
  if (auth.isAuthed) {
    games.fetchGames().catch(() => {});
    notif.fetch().catch(() => {});
    notif.fetchAnnouncements().catch(() => {});
  }
  app.mount('#app');
});
