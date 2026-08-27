<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { usersApi } from '../api/index.js';

const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();

const friends = ref([]);
const requests = ref([]);
const loading = ref(false);
const findId = ref('');
const tab = ref('friends');

async function reload() {
  loading.value = true;
  try {
    const res = await usersApi.friends();
    friends.value = res.friends || [];
    requests.value = res.requests || [];
  } catch (e) { ui.error(e.message || t('common.error')); }
  finally { loading.value = false; }
}
onMounted(reload);

async function addFriend() {
  const id = Number(findId.value);
  if (!id) return;
  try {
    const res = await usersApi.addFriend(id);
    ui.success(res.accepted ? t('toast.friendAccepted') : t('toast.friendAdded'));
    findId.value = '';
    reload();
  } catch (e) { ui.error(e.message); }
}
async function respond(fromId, accept) {
  try { await usersApi.respondFriend(fromId, accept); ui.success(accept ? t('toast.friendAccepted') : t('common.cancel')); reload(); }
  catch (e) { ui.error(e.message); }
}
async function unfriend(id) {
  try { await usersApi.removeFriend(id); ui.success(t('profile.removeFriend')); reload(); }
  catch (e) { ui.error(e.message); }
}
</script>
<template>
  <div class="friends-view">
    <button class="btn btn-sm mb-8" @click="window.history.back() || true">← {{ t('common.back') }}</button>
    <h1 style="font-size: 22px; font-weight: 800">{{ t('friends.title') }}</h1>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='friends'}" @click="tab='friends'">{{ t('friends.all') }} ({{ friends.length }})</button>
      <button class="tab" :class="{active: tab==='requests'}" @click="tab='requests'">{{ t('friends.requests') }} ({{ requests.length }})</button>
      <button class="tab" :class="{active: tab==='search'}" @click="tab='search'">🔍 {{ t('friends.search') }}</button>
    </div>

    <div v-if="tab==='friends'">
      <div v-if="friends.length">
        <div v-for="f in friends" :key="f.id" class="player-row">
          <span style="font-size:24px">{{ f.avatar || '👤' }}</span>
          <div><b>{{ f.username }}</b><div class="small">{{ f.level }} {{ t('profile.level') }} · {{ f.status }}</div></div>
          <button class="btn btn-sm btn-ghost" @click="unfriend(f.id)">✕</button>
        </div>
      </div>
      <div v-else class="empty-state">{{ t('friends.noFriends') }}</div>
    </div>

    <div v-else-if="tab==='requests'">
      <div v-if="requests.length">
        <div v-for="f in requests" :key="f.id" class="player-row">
          <span style="font-size:24px">{{ f.avatar || '👤' }}</span>
          <div><b>{{ f.username }}</b></div>
          <div class="row" style="gap:6px"><button class="btn btn-sm" @click="respond(f.id,true)">✅</button><button class="btn btn-sm" @click="respond(f.id,false)">❌</button></div>
        </div>
      </div>
      <div v-else class="empty-state">{{ t('friends.noRequests') }}</div>
    </div>

    <div v-else class="card">
      <div class="field"><label>{{ t('friends.userId') }}</label><input v-model.number="findId" class="input" type="number" placeholder="123" /></div>
      <button class="btn btn-primary btn-block" @click="addFriend">➕ {{ t('friends.add') }}</button>
    </div>
  </div>
</template>
<style scoped>
.friends-view { max-width: 640px; margin: 0 auto; }
.tabs { display: flex; gap: 4px; margin: 16px 0; border-bottom: 1px solid var(--border); }
.tab { padding: 10px 14px; border-radius: 10px 10px 0 0; background: var(--surface); cursor: pointer; }
.tab.active { background: var(--accent-grad); color: #fff; }
.player-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--surface); border-radius: 10px; border: 1px solid var(--border); margin-bottom: 8px; }
.small { font-size: 12px; color: var(--text-faint); }
.empty-state { padding: 24px; text-align: center; color: var(--text-dim); }
</style>
