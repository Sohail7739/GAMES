import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import { useAuthStore } from './store/auth.js';
import './theme.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
useAuthStore().boot();
app.mount('#app');
