<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomStore } from '../../store/room.js';

const room = useRoomStore();
const { t } = useI18n();

const st = computed(() => room.matchState?.state || {});
const meta = computed(() => room.matchState?.meta || {});
const mySeat = computed(() => room.mySeat);
const geo = computed(() => st.value.geometry || { H: 37, R: 1.6, SR: 2.1, POCKET_R: 2.6 });
const SCALE = 7.2;
const HALF = geo.value.H * SCALE;
const SIZE = HALF * 2;
const MARGIN = 30;
const W = SIZE + MARGIN * 2;

const myTeam = computed(() => {
  const teams = st.value.teams || [[], []];
  return teams[0]?.includes(mySeat.value) ? 0 : teams[1]?.includes(mySeat.value) ? 1 : 0;
});
const isMyTurn = computed(() => meta.value?.status === 'running' && st.value.shooter === mySeat.value);
const isMyTeamTurn = computed(() => meta.value?.status === 'running' && myTeam.value === (st.value.currentTeam ?? 0));

// angles in radians (matching engine). 0 -> +x (right), +90deg -> up on the board.
const angle = ref(0);
const power = ref(0.5);
const aimLocked = ref(false);

const COINS = computed(() => Object.assign({ queen: [] }, st.value.coins));

// server coords -> svg coords (y flips so +y is up on the board)
function ccx(c) { return MARGIN + (geo.value.H + (c?.x ?? 0)) * SCALE; }
function ccy(c) { return MARGIN + (geo.value.H - (c?.y ?? 0)) * SCALE; }

const pocketPositions = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
  [0, 1], [0, -1], [1, 0], [-1, 0],
];
function pkx(p) { return MARGIN + (geo.value.H + p[0] * geo.value.H) * SCALE; }
function pky(p) { return MARGIN + (geo.value.H - p[1] * geo.value.H) * SCALE; }

// end of the aim arrow (screen space)
const aimEnd = computed(() => {
  const s = st.value.striker || { x: 0, y: 0 };
  const sx = ccx(s), sy = ccy(s);
  const len = 20 + power.value * HALF * 0.9;
  return { x: sx + Math.cos(angle.value) * len, y: sy - Math.sin(angle.value) * len };
});

function lockAim() { aimLocked.value = true; }
function shoot() {
  if (!isMyTurn.value) return;
  room.sendAction({ type: 'shoot', power: Math.max(0.05, power.value), angle: angle.value });
  aimLocked.value = false;
  angle.value = 0; power.value = 0.5;
}
</script>
<template>
  <div class="carrom-view">
    <div class="hud">
      <div class="scores">
        <span class="chip w">⚪ {{ st.scores?.white ?? 0 }}</span>
        <span class="chip q">{{ st.queenHolder != null ? '👑' : '' }}</span>
        <span class="chip b">⚫ {{ st.scores?.black ?? 0 }}</span>
      </div>
      <div class="turn">
        <span v-if="isMyTurn" class="pill turn-me">{{ t('game.yourTurn') }}</span>
        <span v-else-if="isMyTeamTurn" class="pill">{{ t('match.opponentTurn') }}</span>
        <span v-else-if="st.winner != null" class="pill pill-cat">{{ t('match.finished') }}</span>
      </div>
    </div>

    <svg :width="W" :height="W" class="board" :viewBox="`0 0 ${W} ${W}`" aria-label="Carrom board">
      <defs>
        <radialGradient id="wood" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#cd9449"/><stop offset="100%" stop-color="#8a5a24"/></radialGradient>
        <radialGradient id="felt" cx="45%" cy="42%" r="75%"><stop offset="0%" stop-color="#2f9e44"/><stop offset="100%" stop-color="#187331"/></radialGradient>
        <radialGradient id="hole" cx="40%" cy="40%" r="75%"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#222"/></radialGradient>
        <radialGradient id="striker" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#fff6d8"/><stop offset="100%" stop-color="#d8b54a"/></radialGradient>
        <radialGradient id="queen" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#ff8fa3"/><stop offset="100%" stop-color="#c2185b"/></radialGradient>
      </defs>

      <rect :width="W" :height="W" rx="18" fill="url(#wood)"/>
      <rect :x="MARGIN-6" :y="MARGIN-6" :width="SIZE+12" :height="SIZE+12" fill="#6b3f16" stroke="#4a2608" stroke-width="2"/>
      <rect :x="MARGIN" :y="MARGIN" :width="SIZE" :height="SIZE" fill="url(#felt)"/>

      <polygon :points="`${MARGIN+HALF*0.04},${MARGIN+HALF*0.50} ${MARGIN+HALF*0.40},${MARGIN+HALF*0.04} ${MARGIN+HALF*0.46},${MARGIN+HALF*0.04} ${MARGIN+HALF*0.10},${MARGIN+HALF*0.50}`" fill="rgba(255,255,255,0.07)"/>
      <line :x1="MARGIN+HALF*0.18" :y1="MARGIN+HALF*0.72" :x2="MARGIN+HALF*0.82" :y2="MARGIN+HALF*0.72" stroke="rgba(255,255,255,0.22)" stroke-width="1.6"/>
      <line :x1="MARGIN+HALF*0.72" :y1="MARGIN+HALF*0.18" :x2="MARGIN+HALF*0.28" :y2="MARGIN+HALF*0.82" stroke="rgba(255,255,255,0.22)" stroke-width="1.6"/>

      <g :transform="`translate(${SIZE/2+MARGIN},${SIZE/2+MARGIN})`">
        <circle r="HALF*0.26" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2.5"/>
        <circle r="HALF*0.10" fill="rgba(255,255,255,0.18)"/>
        <path d="M 0,-10 L 8,26 L -8,26 Z" fill="rgba(255,255,255,0.42)"/>
        <circle r="HALF*0.26" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1" stroke-dasharray="9 7 3 7"/>
      </g>

      <g>
        <circle v-for="(p,i) in pocketPositions" :key="'pk'+i" :cx="pkx(p)" :cy="pky(p)" :r="geo.POCKET_R*SCALE" fill="url(#hole)" stroke="#0c2410" stroke-width="2"/>
      </g>

      <g>
        <circle v-for="c in (COINS.white||[]).filter(x=>!x.pocketed)" :key="'w'+c.id" :cx="ccx(c)" :cy="ccy(c)" :r="geo.R*SCALE*0.9" fill="#f7f5ea" stroke="#b9b2a0" stroke-width="1.4"/>
        <circle v-for="c in (COINS.black||[]).filter(x=>!x.pocketed)" :key="'b'+c.id" :cx="ccx(c)" :cy="ccy(c)" :r="geo.R*SCALE*0.9" fill="#3a3a42" stroke="#17171c" stroke-width="1.4"/>
      </g>

      <circle v-if="!COINS.queen?.pocketed" :cx="ccx(COINS.queen)" :cy="ccy(COINS.queen)" :r="geo.R*SCALE*0.9" fill="url(#queen)" stroke="#8d1040" stroke-width="1.6"/>

      <circle :cx="ccx(st.striker)" :cy="ccy(st.striker)" :r="geo.SR*SCALE*0.92" fill="url(#striker)" stroke="#a8842c" stroke-width="2"/>

      <line v-if="isMyTurn && !aimLocked" :x1="ccx(st.striker)" :y1="ccy(st.striker)" :x2="aimEnd.x" :y2="aimEnd.y" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="7 5"/>
      <circle v-if="isMyTurn && !aimLocked" :cx="aimEnd.x" :cy="aimEnd.y" r="7" fill="rgba(15,23,42,0.75)" stroke="var(--accent)" stroke-width="2"/>
    </svg>

    <div class="controls">
      <template v-if="isMyTurn">
        <div v-if="!aimLocked" class="aim">
          <label>{{ t('game.angle') }}<b>{{ Math.round(angle*180/Math.PI) }}°</b></label>
          <input type="range" min="0" :max="Math.PI*2" step="0.02" v-model.number="angle" class="slider"/>
          <label>{{ t('game.power') }}<b>{{ Math.round(power*100) }}%</b></label>
          <input type="range" min="0.05" max="1" step="0.01" v-model.number="power" class="slider"/>
          <button class="btn btn-primary" @click="lockAim">🎯 {{ t('game.lockAim') }}</button>
        </div>
        <button v-else class="btn btn-lg btn-primary" @click="shoot">🚀 {{ t('game.shoot') }}</button>
      </template>
      <div v-else-if="st.shots" class="shots">🎯 {{ t('game.shots') }} {{ st.shots?.[myTeam] ?? 0 }}/{{ st.strikerLimit }}</div>
    </div>
  </div>
</template>

<style scoped>
.carrom-view { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.hud { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.scores { display: flex; align-items: center; gap: 6px; }
.chip { padding: 4px 10px; border-radius: 20px; font-size: 14px; font-weight: 700; }
.chip.w { background: #f7f5ea; color: #333; }
.chip.b { background: #2b2b30; color: #fff; }
.chip.q { background: transparent; font-size: 16px; }
.turn { font-size: 13px; }
.turn-me { background: var(--accent-grad); color: #fff; }
.board { width: 100%; max-width: 430px; height: auto; border-radius: 18px; filter: drop-shadow(0 10px 22px rgba(0,0,0,.35)); }
.controls { width: 100%; max-width: 330px; display: flex; justify-content: center; }
.aim { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.aim label { font-size: 13px; color: var(--text-dim); display: flex; justify-content: space-between; }
.slider { width: 100%; accent-color: var(--accent); }
.shots { font-size: 13px; color: var(--text-dim); }
</style>
