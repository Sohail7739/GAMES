<script setup>
import { computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../../store/room.js';

const room = useRoomStore();
const { t } = useI18n();

const S = 30; // Cell size
const W = 15 * S; // Total width 450
const COLORS = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  white: '#ffffff',
  border: '#333333'
};

const st = computed(() => room.matchState?.state || {});
const ph = computed(() => st.value.phase);
const dice = computed(() => st.value.dice);
const mySeat = computed(() => room.mySeat);
const isMyTurn = computed(() => meta.value?.status === 'running' && mySeat.value === meta.value?.currentSeat);
const meta = computed(() => room.matchState?.meta || {});
const seats = computed(() => meta.value?.players || []);

// Track mapping (0-51)
const trackPath = [
  {x:1, y:6}, {x:2, y:6}, {x:3, y:6}, {x:4, y:6}, {x:5, y:6},
  {x:6, y:5}, {x:6, y:4}, {x:6, y:3}, {x:6, y:2}, {x:6, y:1}, {x:6, y:0},
  {x:7, y:0}, {x:8, y:0},
  {x:8, y:1}, {x:8, y:2}, {x:8, y:3}, {x:8, y:4}, {x:8, y:5},
  {x:9, y:6}, {x:10, y:6}, {x:11, y:6}, {x:12, y:6}, {x:13, y:6}, {x:14, y:6},
  {x:14, y:7}, {x:14, y:8},
  {x:13, y:8}, {x:12, y:8}, {x:11, y:8}, {x:10, y:8}, {x:9, y:8},
  {x:8, y:9}, {x:8, y:10}, {x:8, y:11}, {x:8, y:12}, {x:8, y:13}, {x:8, y:14},
  {x:7, y:14}, {x:6, y:14},
  {x:6, y:13}, {x:6, y:12}, {x:6, y:11}, {x:6, y:10}, {x:6, y:9},
  {x:5, y:8}, {x:4, y:8}, {x:3, y:8}, {x:2, y:8}, {x:1, y:8}, {x:0, y:8},
  {x:0, y:7}, {x:0, y:6}
];

const homePaths = {
  red:    [{x:1, y:7}, {x:2, y:7}, {x:3, y:7}, {x:4, y:7}, {x:5, y:7}],
  green:  [{x:7, y:1}, {x:7, y:2}, {x:7, y:3}, {x:7, y:4}, {x:7, y:5}],
  yellow: [{x:13, y:7}, {x:12, y:7}, {x:11, y:7}, {x:10, y:7}, {x:9, y:7}],
  blue:   [{x:7, y:13}, {x:7, y:12}, {x:7, y:11}, {x:7, y:10}, {x:7, y:9}]
};

const basePositions = {
  red:    [{x:1.5, y:1.5}, {x:3.5, y:1.5}, {x:1.5, y:3.5}, {x:3.5, y:3.5}],
  green:  [{x:10.5, y:1.5}, {x:12.5, y:1.5}, {x:10.5, y:3.5}, {x:12.5, y:3.5}],
  yellow: [{x:10.5, y:10.5}, {x:12.5, y:10.5}, {x:10.5, y:12.5}, {x:12.5, y:12.5}],
  blue:   [{x:1.5, y:10.5}, {x:3.5, y:10.5}, {x:1.5, y:12.5}, {x:3.5, y:12.5}]
};

function getCellPos(cell) {
  return { x: cell.x * S + S/2, y: cell.y * S + S/2 };
}

function tokenPos(seat, token, ti) {
  const color = st.value.colors?.[seat] || 'red';
  if (token.steps === -1) {
    const pos = basePositions[color][ti] || basePositions[color][0];
    return { x: pos.x * S, y: pos.y * S };
  }
  if (token.steps >= 57) {
    return { x: 7.5 * S, y: 7.5 * S }; // Center
  }
  if (token.steps >= 52) {
    const idx = token.steps - 52;
    const cell = homePaths[color][idx];
    return getCellPos(cell || {x:7, y:7});
  }
  const startOffset = st.value.starts?.[seat] || 0;
  const idx = (startOffset + token.steps) % 52;
  const cell = trackPath[idx];
  return getCellPos(cell);
}

function movable(seat, d) {
  if (d === 0) return [];
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

// Local dice result to show even if turn advances
const lastRoll = ref(0);
watch(dice, (newVal) => { if (newVal > 0) lastRoll.value = newVal; });

</script>

<template>
  <div class="ludo-container">
    <div class="board-frame">
      <svg :width="450" :height="450" viewBox="0 0 450 450" class="ludo-svg">
        <rect x="0" y="0" width="450" height="450" fill="#d97706" rx="10" />
        <rect x="8" y="8" width="434" height="434" fill="#ffffff" rx="8" />

        <g class="track-grid">
          <rect v-for="(p, i) in trackPath" :key="i" :x="p.x*S" :y="p.y*S" :width="S" :height="S" fill="#fff" stroke="#eee" stroke-width="0.5" />
          <rect x="0" y="0" width="180" height="180" :fill="COLORS.red" opacity="0.05" />
          <rect x="270" y="0" width="180" height="180" :fill="COLORS.green" opacity="0.05" />
          <rect x="0" y="270" width="180" height="180" :fill="COLORS.blue" opacity="0.05" />
          <rect x="270" y="270" width="180" height="180" :fill="COLORS.yellow" opacity="0.05" />
        </g>

        <!-- Red Base -->
        <rect x="15" y="15" width="150" height="150" :fill="COLORS.red" rx="4" />
        <rect x="35" y="35" width="110" height="110" fill="#fff" rx="8" />
        <circle v-for="(p, i) in basePositions.red" :key="'r'+i" :cx="p.x*S" :cy="p.y*S" r="16" :fill="COLORS.red" opacity="0.1" />

        <!-- Green Base -->
        <rect x="285" y="15" width="150" height="150" :fill="COLORS.green" rx="4" />
        <rect x="305" y="35" width="110" height="110" fill="#fff" rx="8" />
        <circle v-for="(p, i) in basePositions.green" :key="'g'+i" :cx="p.x*S" :cy="p.y*S" r="16" :fill="COLORS.green" opacity="0.1" />

        <!-- Yellow Base -->
        <rect x="285" y="285" width="150" height="150" :fill="COLORS.yellow" rx="4" />
        <rect x="305" y="305" width="110" height="110" fill="#fff" rx="8" />
        <circle v-for="(p, i) in basePositions.yellow" :key="'y'+i" :cx="p.x*S" :cy="p.y*S" r="16" :fill="COLORS.yellow" opacity="0.1" />

        <!-- Blue Base -->
        <rect x="15" y="285" width="150" height="150" :fill="COLORS.blue" rx="4" />
        <rect x="35" y="305" width="110" height="110" fill="#fff" rx="8" />
        <circle v-for="(p, i) in basePositions.blue" :key="'b'+i" :cx="p.x*S" :cy="p.y*S" r="16" :fill="COLORS.blue" opacity="0.1" />

        <g>
          <!-- Red Path -->
          <rect :x="1*S" :y="6*S" :width="S" :height="S" :fill="COLORS.red" />
          <rect v-for="(p, i) in homePaths.red" :key="'hr'+i" :x="p.x*S" :y="p.y*S" :width="S" :height="S" :fill="COLORS.red" />
          <!-- Green Path -->
          <rect :x="8*S" :y="1*S" :width="S" :height="S" :fill="COLORS.green" />
          <rect v-for="(p, i) in homePaths.green" :key="'hg'+i" :x="p.x*S" :y="p.y*S" :width="S" :height="S" :fill="COLORS.green" />
          <!-- Yellow Path -->
          <rect :x="13*S" :y="8*S" :width="S" :height="S" :fill="COLORS.yellow" />
          <rect v-for="(p, i) in homePaths.yellow" :key="'hy'+i" :x="p.x*S" :y="p.y*S" :width="S" :height="S" :fill="COLORS.yellow" />
          <!-- Blue Path -->
          <rect :x="6*S" :y="13*S" :width="S" :height="S" :fill="COLORS.blue" />
          <rect v-for="(p, i) in homePaths.blue" :key="'hb'+i" :x="p.x*S" :y="p.y*S" :width="S" :height="S" :fill="COLORS.blue" />
        </g>

        <g fill="#999" font-family="Arial" font-size="20">
          <text :x="2*S+6" :y="6*S+22">☆</text>
          <text :x="8*S+6" :y="2*S+22">☆</text>
          <text :x="12*S+6" :y="8*S+22">☆</text>
          <text :x="6*S+6" :y="12*S+22">☆</text>
          <text :x="6*S+6" :y="2*S+22">☆</text>
          <text :x="2*S+6" :y="8*S+22">☆</text>
          <text :x="8*S+6" :y="12*S+22">☆</text>
          <text :x="12*S+6" :y="6*S+22">☆</text>
        </g>

        <g transform="translate(180, 180)">
          <path d="M 0,0 L 90,0 L 45,45 Z" :fill="COLORS.green" stroke="#000" stroke-width="0.5" />
          <path d="M 90,0 L 90,90 L 45,45 Z" :fill="COLORS.yellow" stroke="#000" stroke-width="0.5" />
          <path d="M 90,90 L 0,90 L 45,45 Z" :fill="COLORS.blue" stroke="#000" stroke-width="0.5" />
          <path d="M 0,90 L 0,0 L 45,45 Z" :fill="COLORS.red" stroke="#000" stroke-width="0.5" />
        </g>

        <g v-for="p in seats" :key="p.id">
          <g v-for="(tok, ti) in (st.tokens?.[p.seat] || [])" :key="ti">
            <g class="token-marker" :class="{ 'mine': mySeat === p.seat }" @click="move(ti)">
              <circle :cx="tokenPos(p.seat, tok, ti).x" :cy="tokenPos(p.seat, tok, ti).y + 2" r="14" fill="rgba(0,0,0,0.2)" />
              <circle :cx="tokenPos(p.seat, tok, ti).x" :cy="tokenPos(p.seat, tok, ti).y" r="14" :fill="COLORS[st.colors?.[p.seat]] || '#9ca3af'" stroke="#fff" stroke-width="2" />
              <circle :cx="tokenPos(p.seat, tok, ti).x" :cy="tokenPos(p.seat, tok, ti).y" r="6" fill="#fff" opacity="0.6" />
            </g>
          </g>
        </g>
      </svg>
    </div>

    <div class="ludo-controls">
      <div v-if="ph==='waiting_roll' && isMyTurn" class="roll-section">
        <button class="roll-btn" @click="roll">
          <span class="dice-icon">🎲</span> {{ t('game.rollDice') }}
        </button>
      </div>
      <div v-else-if="ph==='waiting_move' && isMyTurn" class="move-section">
        <div class="dice-display">🎲 {{ dice }}</div>
        <div class="move-options">
          <button v-for="idx in movable(mySeat, dice)" :key="idx" class="move-btn" @click="move(idx)">
            {{ t('game.move') }} {{ idx+1 }}
          </button>
        </div>
      </div>
      <div v-else class="turn-status">
        <span v-if="lastRoll > 0 && !isMyTurn" class="last-dice">🎲 {{ lastRoll }}</span>
        {{ isMyTurn ? t('match.yourTurn') : t('match.waitingTurn', { name: '' }) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.ludo-container { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; }
.board-frame { background: #fff; padding: 4px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.ludo-svg { display: block; max-width: 100%; height: auto; }
.token-marker { transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2); cursor: pointer; }
.token-marker.mine { filter: drop-shadow(0 0 8px var(--accent)); }
.ludo-controls { width: 100%; max-width: 400px; background: var(--bg-elev); padding: 12px 20px; border-radius: 16px; border: 1px solid var(--border); display: flex; justify-content: center; min-height: 70px; align-items: center; }
.roll-btn { background: var(--accent-grad); color: #fff; border: none; padding: 12px 30px; border-radius: 12px; font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); }
.dice-display { font-size: 24px; font-weight: 900; color: var(--accent); margin-right: 15px; background: var(--surface); padding: 8px 15px; border-radius: 10px; }
.move-section { display: flex; align-items: center; gap: 10px; }
.move-options { display: flex; gap: 8px; }
.move-btn { background: var(--surface-strong); color: var(--text); border: 1px solid var(--border-strong); padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
.move-btn:hover { background: var(--accent); color: #fff; }
.turn-status { font-weight: 700; color: var(--text-dim); display: flex; align-items: center; gap: 10px; }
.last-dice { background: var(--surface); padding: 4px 10px; border-radius: 8px; font-size: 14px; opacity: 0.8; }
</style>
