<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../store/room.js';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { roomsApi, usersApi } from '../api/index.js';
import Modal from '../components/Modal.vue';

const route = useRoute();
const router = useRouter();
const room = useRoomStore();
const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();

const code = computed(() => String(route.params.code || '').toUpperCase());
const showPassword = ref(false);
const password = ref('');
const chatMsg = ref('');
const copied = ref(false);
const chatBox = ref(null);

// Invite friends to this room
const inviteOpen = ref(false);
const friendList = ref([]);
const invitedId = ref(null);
const invitingId = ref(null);

async function openInvite() {
  invitedId.value = null;
  try {
    const res = await usersApi.friends();
    friendList.value = res.friends || [];
  } catch (e) {
    ui.error(e.message);
    return;
  }
  inviteOpen.value = true;
}

async function sendInvite(fid) {
  invitingId.value = fid;
  try {
    await roomsApi.invite(code.value, fid);
    invitedId.value = fid;
    ui.success(t('room.inviteSent'));
  } catch (e) {
    ui.error(e.message);
  } finally {
    invitingId.value = null;
  }
}

const sortedPlayers = computed(() => [...room.players].sort((a, b) => a.seat - b.seat));
const isHost = computed(() => room.room?.hostId === auth.user?.id);

onMounted(async () => {
  try {
    const res = await roomsApi.get(code.value);
    if (!res.room) {
      ui.error(t('errors.ROOM_NOT_FOUND'));
      router.replace({ name: 'lobby' });
      return;
    }
  } catch {
    ui.error(t('errors.ROOM_NOT_FOUND'));
    router.replace({ name: 'lobby' });
    return;
  }
  room.joinRoom(code.value);
});

onUnmounted(() => {
  room.leaveRoom();
});

watch(
  () => room.room?.status,
  (status) => {
    if (status === 'playing' && room.matchCode) {
      router.replace({ name: 'play', params: { code: room.currentGame } });
    }
  }
);

watch(
  () => room.room?.matchCode,
  (mc) => {
    if (room.room?.status === 'playing' && mc) {
      router.replace({ name: 'play', params: { code: room.currentGame } });
    }
  }
);

watch(
  () => room.error,
  (err) => {
    if (err === 'WRONG_PASSWORD') {
      showPassword.value = true;
      room.error = null;
    } else if (err) {
      ui.error(t('errors.' + err) || err);
      room.error = null;
    }
  }
);

watch(
  () => room.chat.length,
  () => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }
);

function submitPassword() {
  room.joinRoom(code.value, password.value);
  showPassword.value = false;
}

function copyCode() {
  navigator.clipboard?.writeText(code.value).catch(() => {});
  copied.value = true;
  setTimeout(() => (copied.value = false), 1600);
}

function sendChat() {
  const m = chatMsg.value.trim();
  if (!m) return;
  room.sendChat(m);
  chatMsg.value = '';
}

function startGame() {
  room.startMatch();
}

function toggleReady() {
  const me = room.players.find((p) => p.id === auth.user?.id);
  room.setReady(!(me && me.ready));
}

function leave() {
  router.replace({ name: 'lobby' });
}
</script>

<template>
  <div>
    <button class="btn btn-sm mb-8" @click="leave">← {{ t('common.back') }}</button>

    <div class="card mb-16">
      <div class="row between wrap">
        <div>
          <div class="row">
            <h1 style="font-size: 22px; font-weight: 800">{{ room.room?.gameName || t('room.title') }}</h1>
            <span class="pill" :style="room.room?.status === 'playing' ? 'color: var(--orange)' : ''">
              {{ room.room?.status === 'playing' ? t('room.playing') : t('room.waiting') }}
            </span>
          </div>
          <p class="muted mt-8" style="font-size: 13px">{{ t('room.requires', { min: room.room?.minPlayers, max: room.room?.maxPlayers }) }}</p>
        </div>
        <div class="center">
          <div class="faint" style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em">{{ t('room.code') }}</div>
          <div style="font-size: 26px; font-weight: 800; letter-spacing: 0.12em; color: var(--accent)">{{ code }}</div>
          <button class="btn btn-sm btn-ghost" @click="copyCode">{{ copied ? '✅ ' + t('room.copied') : t('room.copyCode') }}</button>
        </div>
      </div>
    </div>

    <div class="grid-2-1">
      <div>
        <div class="section-title"><span class="emo">👥</span> {{ t('room.players') }} ({{ room.players.length }}/{{ room.room?.maxPlayers }})</div>
        <div class="list mb-16">
          <div v-for="p in sortedPlayers" :key="p.id" class="player-row">
            <span style="font-size: 30px">{{ p.id?.charCodeAt(0) % 2 === 0 ? '👨' : '👩' }}</span>
            <div class="p-info">
              <div class="p-name">
                {{ p.username }}
                <span v-if="p.id === auth.user?.id" class="you-tag">{{ t('room.you') }}</span>
                <span v-if="p.id === room.room?.hostId" class="host-tag">{{ t('room.host') }}</span>
              </div>
              <div class="faint" style="font-size: 11px">Seat {{ p.seat + 1 }}</div>
            </div>
            <span class="pill" :style="p.ready ? 'color: var(--green)' : ''">{{ p.ready ? '✅ ' + t('room.ready') : t('room.notReady') }}</span>
          </div>
        </div>

        <div v-if="room.announces.length" class="ticker mb-16">{{ room.announces[room.announces.length - 1].text }}</div>

        <div class="row wrap mb-16">
          <button class="btn btn-primary btn-lg grow" v-if="isHost && room.room?.status === 'waiting'" @click="startGame">
            🚀 {{ t('room.start') }}
          </button>
          <button class="btn btn-lg grow" v-else-if="room.room?.status === 'waiting'" @click="toggleReady">
            {{ room.players.find((p) => p.id === auth.user?.id)?.ready ? '✅ ' + t('room.ready') : t('room.notReady') }}
          </button>
          <button class="btn btn-lg" v-if="isHost && room.room?.status === 'waiting'" @click="room.addBot()">🤖 {{ t('room.addBot') }}</button>
          <button class="btn btn-lg" v-if="room.room?.status === 'waiting'" @click="openInvite">👥 {{ t('room.invite') }}</button>
          <button class="btn btn-lg" @click="leave">← {{ t('room.leave') }}</button>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><span class="emo">💬</span> {{ t('room.chat') }}</div>
        <div ref="chatBox" class="chat-box">
          <div v-for="(m, i) in room.chat" :key="i" class="msg" :class="{ mine: m.user.id === auth.user?.id }">
            <div class="m-name">{{ m.user.username }}</div>
            <div>{{ m.message }}</div>
          </div>
          <div v-if="!room.chat.length" class="empty-state" style="padding: 12px; font-size: 12px">💬</div>
        </div>
        <div class="row mt-8">
          <input v-model="chatMsg" class="input grow" :placeholder="t('room.messagePlaceholder')" @keyup.enter="sendChat" />
          <button class="btn btn-primary" @click="sendChat">{{ t('room.send') }}</button>
        </div>
      </div>
    </div>

    <Modal v-if="showPassword" :title="t('room.title')" :sub="t('errors.WRONG_PASSWORD')" @close="showPassword = false">
      <div class="field">
        <label>{{ t('auth.password') }}</label>
        <input v-model="password" class="input" type="password" @keyup.enter="submitPassword" />
      </div>
      <button class="btn btn-primary btn-block" @click="submitPassword">{{ t('lobby.join') }}</button>
    </Modal>

    <Modal v-if="inviteOpen" :title="t('room.invite')" :sub="t('room.inviteHint')" @close="inviteOpen = false">
      <div v-if="friendList.length">
        <div v-for="f in friendList" :key="f.id" class="friend-invite">
          <span style="font-size: 22px">{{ f.id?.charCodeAt(0) % 2 === 0 ? '👨' : '👩' }}</span>
          <div class="fi-name">{{ f.username }} <span v-if="f.online" class="inv-online">● online</span></div>
          <button
            class="btn btn-sm btn-primary"
            :disabled="invitingId === f.id || invitedId === f.id"
            @click="sendInvite(f.id)"
          >
            {{ invitedId === f.id ? '✅ ' + t('room.inviteSent') : t('room.inviteSend') }}
          </button>
        </div>
      </div>
      <div v-else class="empty-state">{{ t('room.noFriendsInvite') }}</div>
    </Modal>
  </div>
</template>
<style scoped>
.friend-invite { display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; background: var(--surface); }
.fi-name { flex: 1; font-weight: 700; }
.inv-online { color: var(--green); font-size: 11px; }
</style>
