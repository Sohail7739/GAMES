<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useGamesStore } from '../store/games.js';
import { useRoomStore } from '../store/room.js';
import { useUiStore } from '../store/ui.js';
import { roomsApi } from '../api/index.js';
import { ApiError } from '../api/http.js';
import Modal from '../components/Modal.vue';

const route = useRoute();
const router = useRouter();
const games = useGamesStore();
const room = useRoomStore();
const ui = useUiStore();
const { t, locale } = useI18n();

const code = computed(() => route.params.code);
const game = computed(() => games.byCode(code.value));
const isEn = computed(() => locale.value === 'en');

const leaderboard = ref([]);
const showCreate = ref(false);
const createName = ref('');
const createPrivate = ref(true);
const createPassword = ref('');
const creating = ref(false);

onMounted(async () => {
  try {
    await games.fetchDetail(code.value);
    const lb = await roomsApi.list();
    void lb;
  } catch (e) {
    ui.error(e.message || t('common.error'));
  }
  try {
    const res = await gamesApiLeaderboard(code.value);
    leaderboard.value = res.leaderboard || [];
  } catch {
    /* ignore */
  }
});

async function gamesApiLeaderboard(c) {
  const { gamesApi } = await import('../api/index.js');
  return gamesApi.leaderboard(c, 10);
}

function quickMatch() {
  if (!game.value.enabled) return ui.error(t('errors.GAME_DISABLED'));
  room.queuedFor = code.value;
  games.queue(code.value);
  router.push({ name: 'play', params: { code: code.value } });
}

async function createRoom() {
  creating.value = true;
  try {
    const res = await roomsApi.create({
      gameCode: code.value,
      name: createName.value.trim() || `${game.value.name} Room`,
      isPrivate: createPrivate.value,
      password: createPrivate.value ? createPassword.value : '',
    });
    if (res.room) {
      router.push({ name: 'room', params: { code: res.room.code } });
    }
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : t('common.error');
    ui.error(msg);
  } finally {
    creating.value = false;
    showCreate.value = false;
  }
}

const gName = computed(() => (isEn.value ? game.value?.name : game.value?.nameAr || game.value?.name));
const gDesc = computed(() => (isEn.value ? game.value?.description : game.value?.descriptionAr || game.value?.description));
const catLabel = computed(() => t('lobby.' + (game.value?.category || 'board')));
</script>

<template>
  <div v-if="game">
    <button class="btn btn-sm mb-8" @click="router.push({ name: 'lobby' })">← {{ t('common.back') }}</button>

    <div class="card" style="overflow: hidden; padding: 0">
      <div
        class="game-card-cover"
        :style="{ height: '180px', '--gc1': game.color || '#7c5cff', '--gc2': 'color-mix(in srgb, ' + (game.color || '#7c5cff') + ' 60%, #4f7df9)' }"
      >
        <span class="emo" style="font-size: 84px">{{ game.icon || '🎮' }}</span>
      </div>
      <div style="padding: 18px">
        <div class="row between wrap">
          <div>
            <h1 style="font-size: 24px; font-weight: 800">{{ gName }}</h1>
            <div class="row mt-8">
              <span class="pill pill-cat">{{ catLabel }}</span>
              <span class="pill">👥 {{ game.minPlayers }}-{{ game.maxPlayers }}</span>
            </div>
          </div>
          <div v-if="!game.enabled" class="pill" style="color: var(--red)">⏸ {{ t('errors.GAME_DISABLED') }}</div>
        </div>
        <p class="muted mt-16" style="line-height: 1.6; font-size: 14px">{{ gDesc }}</p>
      </div>
    </div>

    <div class="grid-2 mt-16">
      <button class="btn btn-primary btn-lg btn-block" :disabled="!game.enabled" @click="quickMatch">
        ⚡ {{ t('game.quickMatch') }}
      </button>
      <button class="btn btn-lg btn-block" :disabled="!game.enabled" @click="showCreate = true">
        🏠 {{ t('game.createPrivate') }}
      </button>
    </div>

    <div class="card mt-16">
      <div class="section-title"><span class="emo">🏆</span> {{ t('game.leaderboard') }}</div>
      <div v-if="leaderboard.length" class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ t('leaderboard.rank') }}</th>
              <th>{{ t('leaderboard.player') }}</th>
              <th>{{ t('leaderboard.wins') }}</th>
              <th>{{ t('leaderboard.points') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in leaderboard.slice(0, 10)" :key="row.id">
              <td class="rank-top">#{{ i + 1 }}</td>
              <td>
                <span class="row">
                  <span style="font-size: 20px">{{ row.avatar || '👤' }}</span>
                  <span style="font-weight: 700">{{ row.username }}</span>
                </span>
              </td>
              <td>{{ row.wins }}</td>
              <td>{{ row.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state"><span class="em">📊</span>{{ t('leaderboard.title') }}</div>
    </div>

    <Modal v-if="showCreate" :title="t('lobby.createRoom')" :sub="gName" @close="showCreate = false">
      <div class="field">
        <label>{{ t('room.title') }}</label>
        <input v-model="createName" class="input" :placeholder="`${game.name} Room`" />
      </div>
      <div class="row between mb-16">
        <label style="font-weight: 700; font-size: 13.5px">{{ t('lobby.privateRoom') }}</label>
        <button class="toggle" :class="{ on: createPrivate }" @click="createPrivate = !createPrivate"><span class="knob" /></button>
      </div>
      <div v-if="createPrivate" class="field">
        <label>{{ t('auth.password') }}</label>
        <input v-model="createPassword" class="input" type="password" placeholder="••••" />
      </div>
      <button class="btn btn-primary btn-block btn-lg" :disabled="creating" @click="createRoom">
        <span v-if="creating" class="spinner" style="width: 16px; height: 16px; border-top-color: #fff" />
        {{ t('lobby.createRoom') }}
      </button>
    </Modal>
  </div>
  <div v-else class="loader"><span class="spinner" /> {{ t('common.loading') }}</div>
</template>
