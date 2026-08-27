<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../../store/room.js';

const room = useRoomStore();
const { t } = useI18n();

const st = computed(() => room.matchState?.state || {});
const meta = computed(() => room.matchState?.meta || {});
const mySeat = computed(() => room.mySeat);
const isMyTurn = computed(() => meta.value?.status === 'running' && mySeat.value === meta.value?.currentSeat);
const myHand = computed(() => st.value.hands?.[mySeat.value] || []);
const myPawns = computed(() => st.value.pawns?.[mySeat.value] || []);
const selCard = ref(null);
const last = computed(() => st.value.lastAction || {});

function play(card, pawn) {
  if (!isMyTurn.value) return;
  const act = { type: 'play', card, pawn };
  if (card === 'J') act.mode = 'move';
  room.sendAction(act);
  selCard.value = null;
}
function cardLabel(c) {
  if (c === 'A') return '🃖 A';
  if (c === 'J') return '🃟 J';
  if (c === 'Q') return '🂿 Q';
  if (c === 'K') return '🂾 K';
  return '🂠 ' + c;
}
function pawnOk(p) {
  // valid target for a number/K/Q card is a non-home pawn; A/J accept any
  if (!selCard.value) return false;
  if (['A', 'J'].includes(selCard.value)) return true;
  return p !== 100;
}
</script>
<template>
  <div class="jackaroo-view">
    <div class="scores">🎴 {{ myHand.length }} {{ t('game.handSize') }} · 🎯 {{ last.seat != null ? `last: ${cardLabel(last.card)}` : '' }}</div>

    <div v-if="isMyTurn" class="section">
      <div class="muted">{{ t('match.yourTurn') }}</div>
      <div class="hand">
        <button v-for="(c,i) in myHand" :key="i+String(c)" class="card"
          :class="{ sel: selCard===c }" @click="selCard = (selCard===c ? null : c)">{{ cardLabel(c) }}</button>
      </div>

      <div v-if="selCard" class="pawns">
        <div class="small muted">{{ t('game.selectPawn') }} ({{ selCard }})</div>
        <div class="row">
          <button v-for="(p, i) in myPawns" :key="i" class="btn btn-sm" :disabled="!pawnOk(p)"
            @click="play(selCard, i)">#{{ i + 1 }} = {{ p === 100 ? '🏠' : p }}</button>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="muted">{{ t('match.waitingTurn', { name: '' }) }}</div>
      <div v-if="last.events?.length" class="small">→ {{ last.events[last.events.length-1].type }}</div>
    </div>
  </div>
</template>
<style scoped>
.jackaroo-view { display: flex; flex-direction: column; gap: 12px; }
.scores { font-size: 14px; font-weight: 700; }
.hand { display: flex; flex-wrap: wrap; gap: 8px; }
.card { padding: 8px 12px; border-radius: 8px; background: var(--bg-elev-2); border: 1px solid var(--border); font-size: 14px; cursor: pointer; }
.card.sel { border-color: var(--accent); background: var(--accent-grad); color: #fff; }
.pawns { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
.muted { color: var(--text-dim); font-size: 13px; }
.small { font-size: 12px; color: var(--text-faint); }
</style>
