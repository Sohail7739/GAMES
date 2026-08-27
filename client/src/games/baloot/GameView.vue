<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../../store/room.js';

const room = useRoomStore();
const { t } = useI18n();

const st = computed(() => room.matchState?.state || {});
const meta = computed(() => room.matchState?.meta || {});
const seats = computed(() => meta.value?.players || []);
const mySeat = computed(() => room.mySeat);
const isMyTurn = computed(() => meta.value?.status === 'running' && mySeat.value === meta.value?.currentSeat);
const phase = computed(() => st.value.phase);
const myHand = computed(() => st.value.hands?.[mySeat.value] || []);
const myTeam = computed(() => seats.value.find((p) => p.seat === mySeat.value)?.seat != null ? st.value.teamOfSeat?.[mySeat.value] : null);

const SUIT_EMOJI = { spades: '♠', clubs: '♣', hearts: '♥', diamonds: '♦' };
function cardLabel(c) { return `${SUIT_EMOJI[c.suit] || '🂠'} ${c.rank}`; }
function bidOpts() {
  const cur = st.value.highestBid;
  const order = ['spades', 'clubs', 'hearts', 'diamonds'];
  if (cur?.sun) return order; // can only pass against sun
  if (!cur) return order;
  const i = order.indexOf(cur.suit);
  return order.slice(i + 1);
}
function bid(v) {
  if (phase.value !== 'bidding' || !isMyTurn.value) return;
  room.sendAction({ type: 'bid', value: v });
}
function play(c) {
  if (phase.value !== 'playing' || !isMyTurn.value) return;
  room.sendAction({ type: 'play', card: c });
}
</script>
<template>
  <div class="baloot-view">
    <div class="scores"><b>{{ st.value.scores?.[0] ?? 0 }}</b> — <b>{{ st.value.scores?.[1] ?? 0 }}</b> / {{ st.value.targetScore }}</div>

    <div v-if="phase === 'bidding'" class="bidding">
      <div class="muted">{{ t('game.yourTurn') }}</div>
      <div class="row gap">
        <button v-for="s in bidOpts()" :key="s" class="btn btn-sm btn-ghost" @click="bid(s)">{{ s }} (بلوت؟) {{ SUIT_EMOJI[s] }}</button>
        <button class="btn btn-sm" @click="bid('sun')">🌞 {{ t('game.sun') }}</button>
        <button class="btn btn-sm btn-ghost" @click="bid('pass')">{{ t('game.pass') }}</button>
      </div>
      <div v-if="st.value.highestBid" class="small">{{ t('game.highestBid') }}: {{ st.value.highestBid.sun ? 'sun' : (st.value.highestBid.suit) }}</div>
    </div>

    <div v-else-if="phase === 'playing'" class="playing">
      <div class="small muted">{{ t('match.yourTurn') }} · {{ t('game.ledSuit') }}: {{ st.value.ledSuit }}</div>
      <div class="table">
                <div v-for="c in st.value.table" :key="c.seat" class="trick-card">{{ cardLabel(c.card) }} <span class="small">({{ c.seat + 1 }})</span></div>
      </div>
      <div class="hand">
        <div v-for="c in myHand" :key="c.suit+c.rank" class="card" @click="play(c)">{{ cardLabel(c) }}</div>
      </div>
    </div>

    <div v-else class="muted">{{ t('match.waitingTurn', { name: '' }) }}</div>
  </div>
</template>
<style scoped>
.baloot-view { display: flex; flex-direction: column; gap: 12px; }
.scores { font-size: 18px; font-weight: 800; text-align: center; }
.row.gap { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hand { display: flex; flex-wrap: wrap; gap: 8px; }
.card { padding: 6px 10px; border-radius: 8px; background: var(--bg-elev-2); border: 1px solid var(--border); font-size: 13px; cursor: pointer; }
.card:hover { border-color: var(--accent); }
.table { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; min-height: 24px; }
.trick-card { background: var(--surface); padding: 4px 10px; border-radius: 8px; font-size: 13px; }
.bidding { display: flex; flex-direction: column; gap: 10px; }
.muted { color: var(--text-dim); font-size: 13px; }
.small { font-size: 12px; color: var(--text-faint); }
</style>
