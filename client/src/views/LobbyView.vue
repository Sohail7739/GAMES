<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../store/auth.js';
import { useGamesStore } from '../store/games.js';
import { useUiStore } from '../store/ui.js';
import GameCard from '../components/GameCard.vue';
import Modal from '../components/Modal.vue';
import { roomsApi } from '../api/index.js';
import { ApiError } from '../api/http.js';

const auth = useAuthStore();
const games = useGamesStore();
const ui = useUiStore();
const router = useRouter();
const { t, locale } = useI18n();

const category = ref('all');
const showJoin = ref(false);
const joinCode = ref('');
const joinPassword = ref('');
const joinLoading = ref(false);

const isEn = computed(() => locale.value === 'en');

const categories = computed(() => {
  const seen = new Set(['all']);
  games.games.forEach((g) => seen.add(g.category));
  return ['all', ...seen];
});

const filtered = computed(() => {
  if (category.value === 'all') return games.games;
  return games.games.filter((g) => g.category === category.value);
});

const catLabel = (c) => (c === 'all' ? t('lobby.all') : t('lobby.' + c));

onMounted(async () => {
  try {
    await games.fetchGames();
    games.fetchPublicRooms().catch(() => {});
  } catch (e) {
    ui.error(e.message || t('common.error'));
  }
});

async function joinRoom() {
  const code = joinCode.value.trim().toUpperCase();
  if (!code) return;
  joinLoading.value = true;
  try {
    const res = await roomsApi.join(code, joinPassword.value);
    if (res.room && res.room.code) {
      router.push({ name: 'room', params: { code: res.room.code } });
    }
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : t('common.error');
    ui.error(msg);
  } finally {
    joinLoading.value = false;
    showJoin.value = false;
  }
}

function goRoom(code) {
  router.push({ name: 'room', params: { code } });
}

function openGame(code) {
  router.push({ name: 'game', params: { code } });
}
</script>

<template>
  <div>
    <div class="mt-8 mb-16">
      <h1 style="font-size: 24px; font-weight: 800">
        {{ t('lobby.hello') }}, <span style="color: var(--accent)">{{ auth.user?.username }}</span> 👋
      </h1>
      <p class="muted" style="font-size: 13.5px; margin-top: 4px">
        {{ t('lobby.welcome') }} · <span class="pill pill-online" style="margin-inline-start: 6px">🟢 {{ games.playersOnline }} {{ t('lobby.playersOnline') }}</span>
      </p>
    </div>

    <div class="chips mb-16">
      <button v-for="c in categories" :key="c" class="chip" :class="{ active: category === c }" @click="category = c">
        {{ catLabel(c) }}
      </button>
    </div>

    <div class="game-grid">
      <GameCard v-for="g in filtered" :key="g.code" :game="g" />
    </div>

    <div class="grid-2 mt-24">
      <button class="btn btn-lg" @click="openGame(filtered[0]?.code || 'ludo')" v-if="filtered.length">
        ⚡ {{ t('lobby.playNow') }}
      </button>
      <button class="btn btn-lg btn-ghost" @click="showJoin = true">🔑 {{ t('lobby.joinByCode') }}</button>
    </div>

    <div class="section-title mt-24"><span class="emo">🌍</span> {{ t('lobby.publicRooms') }}</div>
    <div v-if="games.publicRooms.length" class="list">
      <button v-for="r in games.publicRooms.slice(0, 6)" :key="r.code" class="list-item card-hover" style="cursor: pointer" @click="goRoom(r.code)">
        <span style="font-size: 26px">{{ r.gameIcon || '🎮' }}</span>
        <div class="grow" style="text-align: start">
          <div style="font-weight: 700; font-size: 14px">{{ r.name }}</div>
          <div class="faint" style="font-size: 12px">{{ r.gameName }} · {{ r.players }}/{{ r.maxPlayers }}</div>
        </div>
        <span class="pill">{{ r.code }}</span>
      </button>
    </div>
    <div v-else class="empty-state">
      <span class="em">🕹️</span>
      {{ t('lobby.noPublicRooms') }}
    </div>

    <Modal v-if="showJoin" :title="t('lobby.joinByCode')" :sub="t('lobby.roomCodePlaceholder')" @close="showJoin = false">
      <div class="field">
        <label>{{ t('lobby.roomCode') }}</label>
        <input v-model="joinCode" class="input" placeholder="ABC12" maxlength="5" style="text-transform: uppercase" @keyup.enter="joinRoom" />
      </div>
      <div class="field">
        <label>{{ t('auth.password') }}</label>
        <input v-model="joinPassword" class="input" type="password" placeholder="••••" @keyup.enter="joinRoom" />
      </div>
      <button class="btn btn-primary btn-block btn-lg" :disabled="joinLoading" @click="joinRoom">
        <span v-if="joinLoading" class="spinner" style="width: 16px; height: 16px; border-top-color: #fff" />
        {{ t('lobby.join') }}
      </button>
    </Modal>
  </div>
</template>
