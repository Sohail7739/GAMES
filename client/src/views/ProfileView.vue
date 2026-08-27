<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { usersApi } from '../api/index.js';
import { ApiError } from '../api/http.js';
import Modal from '../components/Modal.vue';
import Avatar from '../components/Avatar.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();

const profile = ref(null);
const editing = ref(false);
const editName = ref('');
const editBio = ref('');
const reportReason = ref('');
const reportDetails = ref('');
const showReport = ref(false);
const isOwn = computed(() => !route.params.id || Number(route.params.id) === auth.user?.id);
const rel = computed(() => profile.value?.relation || 'none');

function avatarList() {
  return ['🦁','🦊','🐼','🐯','🐸','🦄','🐙','🦉','🤖','👾','🎲','🎯','🛡️','🏜️','🌸','⚡'];
}
onMounted(async () => {
  if (isOwn.value) { profile.value = auth.user; return; }
  try { profile.value = await usersApi.profile(Number(route.params.id)); }
  catch (e) { ui.error(e.message || t('common.error')); router.replace({ name: 'lobby' }); }
});
watch(() => auth.user, () => { if (isOwn.value) profile.value = auth.user; });

function startEdit() { editName.value = profile.value?.username || ''; editBio.value = profile.value?.bio || ''; editing.value = true; }
async function save() {
  try {
    await auth.updateProfile({ username: editName.value, bio: editBio.value });
    profile.value = { ...profile.value, username: editName.value, bio: editBio.value };
    editing.value = false; ui.success(t('toast.saved'));
  } catch (e) { ui.error(e instanceof ApiError ? e.message : t('common.error')); }
}
function setAvatar(a) {
  auth.updateProfile({ avatar: a }).then(() => { profile.value = { ...profile.value, avatar: a }; ui.success(t('toast.saved')); }).catch((e) => ui.error(e.message));
}
function friendAction() {
  if (rel.value === 'none' && !profile.value?.isBlocked) {
    usersApi.addFriend(profile.value.id).then(() => { ui.success(t('toast.friendAdded')); profile.value = { ...profile.value, relation: 'pending' }; }).catch((e) => ui.error(e.message));
  }
}
function blockAction() {
  usersApi.block(profile.value.id).then(() => { ui.success(t('toast.blocked')); profile.value = { ...profile.value, isBlocked: true }; }).catch((e) => ui.error(e.message));
}
function submitReport() {
  if (!reportReason.value) return;
  usersApi.report(profile.value.id, reportReason.value, reportDetails.value)
    .then(() => { ui.success(t('toast.reported')); showReport.value = false; reportReason.value = ''; reportDetails.value = ''; })
    .catch((e) => ui.error(e.message));
}
</script>
<template>
  <div v-if="profile" class="profile">
    <button class="btn btn-sm mb-8" @click="router.push({ name: 'lobby' })">← {{ t('common.back') }}</button>

    <div class="card">
      <div class="row between">
        <div class="row gap">
          <Avatar :user="{ avatar: profile.avatar }" size="lg" />
          <div>
            <h1 style="font-size: 22px; font-weight: 800">{{ profile.username }}</h1>
            <div class="row" style="gap: 10px">
              <span class="pill">{{ t('profile.level') }} {{ profile.level }}</span>
              <span class="pill">💰 {{ profile.coins }}</span>
              <span v-if="profile.is_bot" class="pill">🤖 {{ t('friends.all') }}</span>
              <span class="pill" style="color: var(--text-dim)">{{ profile.status }}</span>
            </div>
          </div>
        </div>
        <div v-if="isOwn" class="row" style="gap: 6px">
          <button class="btn btn-sm btn-ghost" @click="startEdit">✏ {{ t('profile.edit') }}</button>
        </div>
      </div>
      <p v-if="profile.bio" class="muted mt-8">{{ profile.bio }}</p>
    </div>

    <div class="card mt-16">
      <div class="row between">
        <div class="section-title"><span class="emo">📊</span> {{ t('profile.stats') }}</div>
        <div v-if="isOwn" class="row gap">
          <span class="pill">{{ profile.xpProgress?.level || profile.level }} ({{ profile.xpProgress?.progress }}%)</span>
        </div>
      </div>
      <div v-if="profile.stats?.length" class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>{{ t('leaderboard.player') }}</th><th>{{ t('profile.wins') }}</th><th>{{ t('profile.matches') }}</th><th>{{ t('leaderboard.points') }}</th><th>{{ t('leaderboard.rating') }}</th></tr></thead>
          <tbody>
            <tr v-for="s in profile.stats" :key="s.code">
              <td>{{ s.name }}</td><td>{{ s.wins }}</td><td>{{ s.matchesPlayed }}</td><td>{{ s.points }}</td><td>{{ s.rating }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">{{ t('profile.noStats') }}</div>
    </div>

    <div v-if="profile.achievements?.length" class="card mt-16">
      <div class="section-title"><span class="emo">🏆</span> {{ t('profile.achievements') }}</div>
      <div class="grid-ach">
        <div v-for="a in profile.achievements" :key="a.code" class="ach">
          <span style="font-size: 22px">{{ a.icon || '🏆' }}</span>
          <div><b>{{ a.name }}</b><div class="small">{{ a.description }}</div></div>
        </div>
      </div>
    </div>

    <div v-if="profile.history?.length" class="card mt-16">
      <div class="section-title"><span class="emo">🕹️</span> {{ t('profile.history') }}</div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>{{ t('profile.result') }}</th><th>{{ t('leaderboard.player') }}</th><th>{{ t('profile.score') }}</th><th>{{ t('profile.date') }}</th></tr></thead>
          <tbody>
            <tr v-for="h in profile.history" :key="h.id">
              <td><span :style="h.result==='win'?'color:var(--green)':h.result==='draw'?'color:var(--orange)':'color:var(--text-dim)'">{{ h.result }}</span></td>
              <td>{{ h.gameName }}</td><td>{{ h.score }}</td><td>{{ h.finished_at || h.started_at }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="!isOwn && !profile.is_bot" class="row mt-16" style="gap: 8px; flex-wrap: wrap">
      <button v-if="rel !== 'accepted' && !profile.isBlocked" class="btn btn-sm" @click="friendAction">{{ t('profile.addFriend') }}</button>
      <button v-if="rel === 'accepted'" class="btn btn-sm btn-ghost">{{ t('profile.friendsCount') }}: {{ profile.friendsCount }}</button>
      <button v-if="!profile.isBlocked" class="btn btn-sm btn-ghost" @click="blockAction">🚫 {{ t('profile.block') }}</button>
      <button v-if="!profile.isBlocked" class="btn btn-sm btn-ghost" @click="showReport = true">🚩 {{ t('profile.report') }}</button>
    </div>

    <Modal v-if="editing" :title="t('profile.edit')" @close="editing=false">
      <div class="field"><label>{{ t('profile.username') }}</label><input v-model="editName" class="input" /></div>
      <div class="field"><label>{{ t('profile.bio') }}</label><input v-model="editBio" class="input" /></div>
      <div class="row"><button class="btn btn-sm btn-ghost" @click="editing=false">{{ t('common.cancel') }}</button><button class="btn btn-sm btn-primary" @click="save">{{ t('common.save') }}</button></div>
    </Modal>

    <Modal v-if="showReport" :title="t('profile.report')" @close="showReport=false">
      <div class="field"><label>{{ t('profile.report') }} (reason)</label><input v-model="reportReason" class="input" placeholder="cheating, abuse, ..." /></div>
      <div class="field"><label>{{ t('profile.bio') }}</label><textarea v-model="reportDetails" class="input" rows="3"></textarea></div>
      <div class="row"><button class="btn btn-sm btn-ghost" @click="showReport=false">{{ t('common.cancel') }}</button><button class="btn btn-sm btn-primary" @click="submitReport">{{ t('common.confirm') }}</button></div>
    </Modal>
  </div>
  <div v-else class="loader"><span class="spinner" /> {{ t('common.loading') }}</div>
</template>
<style scoped>
.profile { max-width: 860px; margin: 0 auto; }
.card { padding: 18px; }
.row.gap { display: flex; gap: 10px; align-items: center; }
.muted { color: var(--text-dim); font-size: 13px; }
.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.grid-ach { display: flex; flex-wrap: wrap; gap: 12px; }
.ach { display: flex; gap: 10px; align-items: flex-start; background: var(--surface); padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); }
</style>
