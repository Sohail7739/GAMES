<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../store/room.js';
import { useGamesStore } from '../store/games.js';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { socketManager } from '../socket/index.js';
import { getGameView } from '../games/index.js';

const route = useRoute();
const router = useRouter();
const room = useRoomStore();
const games = useGamesStore();
const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();

const code = computed(() => route.params.code);
const gameView = computed(() => getGameView(code.value));
const wasConnected = ref(socketManager.connected);
const isMM = computed(() => games.matchmaking);

onMounted(() => {
  if (games.matchmakingGame !== code.value && !room.joined && !room.matchState) {
    games.queue(code.value);
  }
});

onUnmounted(() => {
  room.leaveRoom();
});

watch(
  () => socketManager.connected,
  (on) => {
    if (on && !wasConnected.value && room.joined) {
      room.joinRoom(room.room?.code, '');
      if (room.matchCode) room.joinMatch(room.matchCode);
    }
    wasConnected.value = on;
  }
);

function cancelMM() {
  games.cancelMatchmaking();
  router.replace({ name: 'game', params: { code: code.value } });
}

function leaveMatch() {
  room.leaveRoom();
  router.replace({ name: 'lobby' });
}

function playAgain() {
  room.finished = null;
  games.queue(code.value);
}

const won = computed(() => myResult.value?.result === 'win');

// Debug
watch([() => room.room, () => room.matchState, () => isMM.value], ([r, ms, mm]) => {
  console.log('PlayView State:', { hasRoom: !!r, hasMatch: !!ms, isMM: mm });
}, { immediate: true });
</script>

<template>
  <div>
    <div v-if="isMM && !room.matchState" class="center mt-24" style="padding-top: 12vh">
      <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto 18px" />
      <h2 style="font-weight: 800">{{ t('game.quickMatch') }}</h2>
      <p class="muted mt-8">{{ t('game.quickMatchSub') }}</p>
      <button class="btn btn-danger mt-24" @click="cancelMM">{{ t('common.cancel') }}</button>
    </div>

    <div v-else-if="room.error" class="center mt-24" style="padding-top: 12vh">
      <span class="big-emo">⚠️</span>
      <h2 style="font-weight: 800">{{ t('common.error') }}</h2>
      <p class="muted mt-8">{{ room.error }}</p>
      <button class="btn btn-primary mt-24" @click="leaveMatch">{{ t('common.back') }}</button>
    </div>

    <div v-else-if="!room.room && !room.matchState" class="loader"><span class="spinner" /> {{ t('common.loading') }}</div>

    <template v-else>
      <div class="match-hud mb-16">
        <div class="row">
          <span class="pill">{{ room.room?.gameName || code }}</span>
          <span class="pill">{{ room.room?.code || '' }}</span>
        </div>
        <div class="turn-banner" :class="{ yours: room.matchState?.meta?.currentSeat === room.mySeat && room.matchState?.meta?.status === 'running' }">
          <span v-if="room.matchState?.meta?.status === 'running'" class="pulse-dot" />
          <template v-if="room.matchState?.meta?.currentSeat === room.mySeat">
            {{ t('match.yourTurn') }}
          </template>
          <template v-else>
            {{ t('match.waitingTurn', { name: '' }) }}<span v-if="room.matchState" class="muted">{{ '#' + (room.matchState.meta.currentSeat + 1) }}</span>
          </template>
        </div>
        <div class="row">
          <span v-if="!socketManager.connected" class="pill" style="color: var(--orange)">🔄 {{ t('match.reconnecting') }}</span>
          <button class="btn btn-sm" @click="leaveMatch">{{ t('match.leaveMatch') }}</button>
        </div>
      </div>

      <div class="seatbar mb-16">
        <div
          v-for="p in room.matchState?.meta?.players || room.players"
          :key="p.id"
          class="seat"
          :class="{ active: p.seat === room.matchState?.meta?.currentSeat && room.matchState?.meta?.status === 'running' }"
        >
          <span class="s-emo">{{ (Number(p.id) || 0) % 2 === 0 ? '👨' : '👩' }}</span>
          <span>{{ p.username }}<span v-if="p.id === auth.user?.id"> ({{ t('room.you') }})</span></span>
          <span v-if="p.seat === room.mySeat && room.matchState?.meta?.status !== 'running'" style="color: var(--red)">●</span>
        </div>
      </div>

      <div v-if="room.announces.length" class="ticker mb-16">{{ room.announces[room.announces.length - 1].text }}</div>

      <div class="game-perspective">
        <component :is="gameView" v-if="gameView" class="game-3d-tilt" />
      </div>

      <div v-if="room.finished" class="result-overlay">
        <div class="result-card">
          <span class="big-emo">{{ won ? '🏆' : '🎲' }}</span>
          <h2>{{ won ? t('match.youWon') : myResult ? t('match.youLost') : t('match.draw') }}</h2>
          <p class="muted">{{ t('match.finished') }}</p>
          <div class="result-list">
            <div v-for="r in room.finished.results" :key="r.seat" class="result-row">
              <span class="row">
                <span style="font-size: 18px">{{ room.matchState?.meta?.players.find((p) => p.seat === r.seat)?.avatar || '👤' }}</span>
                <span>{{ room.matchState?.meta?.players.find((p) => p.seat === r.seat)?.username || `Seat ${r.seat + 1}` }}</span>
              </span>
              <span :style="r.result === 'win' ? 'color: var(--green); font-weight:800' : 'color: var(--text-dim)'">
                {{ r.score }} · {{ r.result === 'win' ? t('profile.win') : r.result === 'draw' ? t('profile.draw') : t('profile.loss') }}
              </span>
            </div>
          </div>
          <div class="row mt-16">
            <button class="btn btn-primary btn-lg grow" @click="playAgain">{{ t('match.playAgain') }}</button>
            <button class="btn btn-lg" @click="leaveMatch">{{ t('match.leaveMatch') }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
