<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '../store/ui.js';

const props = defineProps({
  game: { type: Object, required: true },
});

const router = useRouter();
const { t, locale } = useI18n();
const ui = useUiStore();

const isEn = computed(() => locale.value === 'en');
const name = computed(() => (isEn.value ? props.game.name : props.game.nameAr || props.game.name));
const desc = computed(() => (isEn.value ? props.game.description : props.game.descriptionAr || props.game.description));
const catLabel = computed(() => {
  const c = props.game.category;
  return t('lobby.' + (['card', 'board', 'strategy'].includes(c) ? c : 'board'));
});

function open() {
  if (!props.game.enabled) {
    ui.toast(t('errors.GAME_DISABLED'), 'error');
    return;
  }
  router.push({ name: 'game', params: { code: props.game.code } });
}
</script>

<template>
  <div class="game-card" :class="{ disabled: !game.enabled }" @click="open">
    <span v-if="!game.enabled" class="overlay-badge pill">⏸ {{ t('errors.GAME_DISABLED') }}</span>
    <div
      class="game-card-cover"
      :style="{ '--gc1': game.color || '#7c5cff', '--gc2': 'color-mix(in srgb, ' + (game.color || '#7c5cff') + ' 60%, #4f7df9)' }"
    >
      <span class="emo">{{ game.icon || '🎮' }}</span>
    </div>
    <div class="game-card-body">
      <div class="game-card-title">
        <span>{{ name }}</span>
      </div>
      <div class="game-card-desc">{{ desc }}</div>
      <div class="game-card-meta">
        <span class="pill pill-cat">{{ catLabel }}</span>
        <span class="pill">{{ game.minPlayers }}-{{ game.maxPlayers }} {{ t('game.minPlayers') }}</span>
      </div>
    </div>
  </div>
</template>
