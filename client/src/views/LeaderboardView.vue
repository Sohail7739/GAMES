<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../store/ui.js';
import { usersApi, gamesApi } from '../api/index.js';

const ui = useUiStore();
const { t } = useI18n();

const games = ref([]);
const leaderboard = ref([]);
const tab = ref('global');
const loading = ref(false);

async function loadGames() {
  try { const res = await gamesApi.list(); games.value = res.games || []; } catch (e) { ui.error(e.message); }
}
async function load(page) {
  loading.value = true;
  try {
    if (page === 'global') leaderboard.value = await usersApi.leaderboard();
    else leaderboard.value = await gamesApi.leaderboard(page, 100);
  } catch (e) { ui.error(e.message); }
  finally { loading.value = false; }
}
onMounted(() => { loadGames(); load('global'); });
</script>
<template>
  <div class="lb-view">
    <button class="btn btn-sm mb-8" @click="window.history.back() || true">← {{ t('common.back') }}</button>
    <h1 style="font-size: 22px; font-weight: 800">{{ t('leaderboard.title') }}</h1>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='global'}" @click="tab='global'; load('global')">{{ t('leaderboard.global') }}</button>
      <button v-for="g in games" :key="g.code" class="tab" :class="{active: tab===g.code}" @click="tab=g.code; load(g.code)">{{ g.name }}</button>
    </div>

    <div v-if="leaderboard.length" class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>{{ t('leaderboard.rank') }}</th><th>{{ t('leaderboard.player') }}</th><th>{{ t('leaderboard.level') }}</th><th>{{ t('leaderboard.wins') }}</th><th>{{ t('leaderboard.matches') }}</th><th>{{ t('leaderboard.points') }}</th><th>{{ t('leaderboard.rating') }}</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in leaderboard" :key="r.id">
            <td class="rank-top">#{{ i+1 }}</td>
            <td><span style="font-size:20px">{{ r.avatar || '👤' }}</span> {{ r.username }}</td>
            <td>{{ r.level }}</td><td>{{ r.wins }}</td><td>{{ r.matches }}</td><td>{{ r.points }}</td><td>{{ r.rating }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-state">{{ t('profile.noStats') }}</div>
  </div>
</template>
<style scoped>
.lb-view { max-width: 760px; margin: 0 auto; }
.tabs { display: flex; gap: 4px; margin: 16px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.tab { padding: 10px 14px; border-radius: 10px 10px 0 0; background: var(--surface); cursor: pointer; font-size: 13px; }
.tab.active { background: var(--accent-grad); color: #fff; }
.rank-top { font-weight: 800; color: var(--gold); }
.empty-state { padding: 24px; text-align: center; color: var(--text-dim); }
</style>
