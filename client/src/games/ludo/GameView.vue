<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../../store/room.js';
import { useAuthStore } from '../../store/auth.js';

const room = useRoomStore();
const auth = useAuthStore();
const { t } = useI18n();

const N = 13, C = 34, M = C, W = (N + 2) * C, cx = W / 2, cy = W / 2;
const COLOR_MAP = { red: '#ef4444', green: '#22c55e', yellow: '#eab308', blue: '#3b82f6' };
const START = [0, 13, 26, 39];
const CORNER = {
  0: { x: M + C / 2, y: W - M - C / 2 },
  13: { x: W - M - C / 2, y: W - M - C / 2 },
  26: { x: W - M - C / 2, y: M + C / 2 },
  39: { x: M + C / 2, y: M + C / 2 },
};
const FINISH = {
  0: { x: cx + C / 2, y: cy + C / 2 },
  13: { x: cx + C / 2, y: cy - C / 2 },
  26: { x: cx - C / 2, y: cy - C / 2 },
  39: { x: cx - C / 2, y: cy + C / 2 },
};
function trackPos(i) {
  const side = Math.floor(i / N), o = i % N, h = C / 2;
  if (side === 0) return { x: M + o * C + h, y: W - M - h };
  if (side === 1) return { x: W - M - h, y: W - M - o * C - h };
  if (side === 2) return { x: W - M - o * C - h, y: M + h };
  return { x: M + h, y: M + o * C + h };
}
function tokenPos(seat, token) {
  const start = st.value.starts?.[seat];
  if (!start) return { x: cx, y: cy };
  if (token.steps === -1) { const c = CORNER[start]; return { x: c.x, y: c.y }; }
  if (token.steps >= 57) { const f = FINISH[start]; return { x: f.x, y: f.y }; }
  if (token.steps >= 52) {
    const k = token.steps - 52;
    const c = CORNER[start], f = FINISH[start];
    const e = { x: c.x + (f.x - c.x) * 0.55, y: c.y + (f.y - c.y) * 0.55 };
    return { x: e.x + (f.x - e.x) * (k / 4), y: e.y + (f.y - e.y) * (k / 4) };
  }
  const idx = (start + token.steps) % st.value.boardSize;
  return trackPos(idx);
}
function movable(seat, d) {
  const out = [];
  const toks = st.value.tokens?.[seat] || [];
  toks.forEach((to, i) => {
    if (to.steps === -1 && d === 6) out.push(i);
    else if (to.steps >= 0 && to.steps + d <= 57) out.push(i);
  });
  return out;
}
function roll() {
  if (isMyTurn.value && ph.value === 'waiting_roll') room.sendAction({ type: 'roll' });
}
function move(i) {
  if (isMyTurn.value && ph.value === 'waiting_move') room.sendAction({ type: 'move', token: i });
}

const st = computed(() => room.matchState?.state || {});
const ph = computed(() => st.value.phase);
const dice = computed(() => st.value.dice);
const mySeat = computed(() => room.mySeat);
const isMyTurn = computed(() => meta.value?.status === 'running' && mySeat.value === meta.value?.currentSeat);
const meta = computed(() => room.matchState?.meta || {});
const seats = computed(() => meta.value?.players || []);
</script>
<template>
  <div class="ludo-view">
    <svg :width="W" :height="W" class="board" :viewBox="`0 0 ${W} ${W}`" aria-label="Ludo board">
      <rect x="0" y="0" :width="W" :height="W" fill="var(--bg-soft)" rx="6" />
      <polygon :points="`${M},${W-M} ${W-M},${W-M} ${M+M},${W-M-M}`" fill="rgba(239,68,68,.18)" />
      <polygon :points="`${W-M},${W-M} ${W-M},${M} ${W-M-M},${W-M-M}`" fill="rgba(59,130,246,.18)" />
      <polygon :points="`${W-M},${M} ${M},${M} ${M+M},${M+M}`" fill="rgba(234,179,8,.18)" />
      <polygon :points="`${M},${M} ${M},${W-M} ${M+M},${W-M-M}`" fill="rgba(34,197,94,.18)" />
      <g fill="var(--gold)">
        <circle v-for="c in (st.value.safeCells||[])" :key="c" :cx="trackPos(c).x" :cy="trackPos(c).y" :r="C*0.2" />
      </g>
      <g>
        <rect v-for="i in 52" :key="'t'+i" :x="trackPos(i-1).x-C*0.36" :y="trackPos(i-1).y-C*0.36" :width="C*0.72" :height="C*0.72" rx="3" fill="var(--bg-elev)" :stroke="st.value.safeCells?.includes(i-1) ? 'var(--gold)' : 'var(--border)'" stroke-width="1" />
      </g>
      <circle :cx="cx" :cy="cy" :r="C*0.45" fill="var(--bg-elev-2)" stroke="var(--border)" />
      <text :x="cx" :y="cy+5" text-anchor="middle" font-size="16">🎲</text>
      <g v-for="p in seats" :key="p.id">
        <g v-for="(tok, ti) in (st.value.tokens?.[p.seat] || [])" :key="ti">
          <circle :cx="tokenPos(p.seat, tok).x" :cy="tokenPos(p.seat, tok).y" :r="C*0.24" :fill="COLOR_MAP[st.value.colors?.[p.seat]] || '#9ca3af'" :stroke="mySeat===p.seat ? 'var(--accent)' : '#000'" stroke-width="2" />
        </g>
      </g>
    </svg>
    <div class="ctrl">
      <div v-if="ph==='waiting_roll' && isMyTurn" class="row"><button class="btn btn-lg btn-primary" @click="roll">🎲 {{ t('game.rollDice') }}</button></div>
      <div v-else-if="ph==='waiting_move' && isMyTurn" class="row gap">
        <button v-for="idx in movable(mySeat, dice)" :key="idx" class="btn btn-sm" @click="move(idx)">{{ t('game.move') }} {{ idx+1 }}</button>
        <span class="pill">{{ t('game.diceRolled') }}: {{ dice }}</span>
      </div>
      <div v-else class="muted">{{ t('match.yourTurn') }} / {{ t('match.waitingTurn', { name: '' }) }}</div>
      <div v-if="st.value.finished?.length" class="row mt-8"><span class="pill pill-cat">{{ t('match.finished') }}</span></div>
    </div>
  </div>
</template>
<style scoped>
.ludo-view { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.board { width: 100%; max-width: 420px; height: auto; display: block; box-shadow: var(--shadow-soft); }
.ctrl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
.row.gap { display: flex; gap: 8px; }
.mt-8 { margin-top: 8px; }
</style>
