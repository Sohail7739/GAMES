<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../store/ui.js';
import { notificationsApi } from '../api/index.js';

const router = useRouter();
const ui = useUiStore();
const { t } = useI18n();

const items = ref([]);
const announcements = ref([]);
const unread = ref(0);

function ntData(n) {
  try {
    return typeof n.data === 'string' ? JSON.parse(n.data || '{}') : n.data || {};
  } catch {
    return {};
  }
}

function joinInvite(n) {
  const d = ntData(n);
  if (d.roomCode) {
    router.push({ name: 'room', params: { code: d.roomCode } });
    markRead(n.id);
  }
}

async function load() {
  try {
    const res = await notificationsApi.list();
    items.value = res.notifications || [];
    unread.value = res.unread || 0;
  } catch (e) { ui.error(e.message); }
  try {
    const res = await notificationsApi.announcements();
    announcements.value = res.announcements || [];
  } catch (e) { /* ignore */ }
}
async function markRead(id) {
  try { await notificationsApi.markRead(id); items.value = items.value.filter((i) => i.id !== id); unread.value = items.value.filter((i) => !i.is_read).length; }
  catch (e) { ui.error(e.message); }
}
async function readAll() {
  try { await notificationsApi.readAll(); items.value.forEach((i) => (i.is_read = 1)); unread.value = 0; }
  catch (e) { ui.error(e.message); }
}
onMounted(load);
</script>
<template>
  <div class="nt-view">
    <button class="btn btn-sm mb-8" @click="window.history.back() || true">← {{ t('common.back') }}</button>
    <div class="row between mb-16">
      <h1 style="font-size: 22px; font-weight: 800">{{ t('notifications.title') }}</h1>
      <div class="row" style="gap:8px">
        <button v-if="unread" class="btn btn-sm" @click="readAll">{{ t('notifications.markAll') }}</button>
        <span class="pill">{{ unread }} {{ t('notifications.unread') }}</span>
      </div>
    </div>

    <div v-if="announcements.length" class="card mb-16">
      <div class="section-title"><span class="emo">📢</span> {{ t('notifications.announcements') }}</div>
      <div v-for="a in announcements" :key="a.id" class="ticker">{{ a.title }} — {{ a.body }}</div>
    </div>

    <div v-if="items.length">
      <div v-for="n in items" :key="n.id" class="player-row" :style="{ opacity: n.is_read ? 0.6 : 1 }">
        <span class="emo">{{ n.type === 'invite' ? '🎮' : n.type === 'success' ? '✅' : n.type === 'achievement' ? '🏆' : n.type === 'friend' ? '👥' : '🔔' }}</span>
        <div><b>{{ n.title }}</b><div class="small muted">{{ n.body }}</div>
          <div v-if="n.type === 'invite' && ntData(n).roomCode" class="row mt-4" style="gap:6px">
            <button class="btn btn-sm btn-primary" @click="joinInvite(n)">{{ t('notifications.join') }}</button>
          </div>
        </div>
        <button v-if="!n.is_read" class="btn btn-sm btn-ghost" @click="markRead(n.id)">✓</button>
      </div>
    </div>
    <div v-else class="empty-state">{{ t('notifications.empty') }}</div>
  </div>
</template>
<style scoped>
.nt-view { max-width: 640px; margin: 0 auto; }
.row.between { display: flex; justify-content: space-between; align-items: center; }
.mb-16 { margin-bottom: 16px; }
.player-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--surface); border-radius: 10px; border: 1px solid var(--border); margin-bottom: 8px; }
.small { font-size: 12px; }
.muted { color: var(--text-faint); }
.emo { font-size: 20px; }
.empty-state { padding: 24px; text-align: center; color: var(--text-dim); }
</style>
