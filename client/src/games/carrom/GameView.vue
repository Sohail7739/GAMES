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
const MARGIN = 35;
const W = SIZE + MARGIN * 2;

const myTeam = computed(() => {
  const teams = st.value.teams || [[], []];
  return teams[0]?.includes(mySeat.value) ? 0 : teams[1]?.includes(mySeat.value) ? 1 : 0;
});
const isMyTurn = computed(() => meta.value?.status === 'running' && st.value.shooter === mySeat.value);
const isMyTeamTurn = computed(() => meta.value?.status === 'running' && myTeam.value === (st.value.currentTeam ?? 0));

const angle = ref(0);
const power = ref(0.5);
const aimLocked = ref(false);

const COINS = computed(() => Object.assign({ queen: [] }, st.value.coins));

function ccx(c) { return MARGIN + (geo.value.H + (c?.x ?? 0)) * SCALE; }
function ccy(c) { return MARGIN + (geo.value.H - (c?.y ?? 0)) * SCALE; }

const pocketPositions = [ [1, 1], [1, -1], [-1, 1], [-1, -1] ];
function pkx(p) { return MARGIN + (geo.value.H + p[0] * geo.value.H) * SCALE; }
function pky(p) { return MARGIN + (geo.value.H - p[1] * geo.value.H) * SCALE; }

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
        <span v-else-if="st.winner != null" class="pill pill-cat">{{ t('match.finished') }}</span>
      </div>
    </div>

    <div class="board-frame">
      <svg :width="W" :height="W" class="board" :viewBox="`0 0 ${W} ${W}`">
        <defs>
          <radialGradient id="woodGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#e2b492" />
            <stop offset="100%" stop-color="#c6906f" />
          </radialGradient>
          <radialGradient id="frameGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#6d4c41" />
            <stop offset="100%" stop-color="#3e2723" />
          </radialGradient>
          <radialGradient id="coinWhite" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#d7ccc8" />
          </radialGradient>
          <radialGradient id="coinBlack" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#4e342e" />
            <stop offset="100%" stop-color="#1b1b1b" />
          </radialGradient>
          <radialGradient id="coinQueen" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ff5252" />
            <stop offset="100%" stop-color="#b71c1c" />
          </radialGradient>
          <radialGradient id="strikerGrad" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffe082" />
            <stop offset="100%" stop-color="#f57f17" />
          </radialGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="1" dy="2" />
            <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- Outer Frame -->
        <rect x="0" y="0" :width="W" :height="W" rx="20" fill="url(#frameGrad)" />
        <rect :x="5" :y="5" :width="W-10" :height="W-10" rx="18" fill="none" stroke="#2a1b15" stroke-width="2" />

        <!-- Pockets Background -->
        <circle v-for="(p,i) in pocketPositions" :key="'pkb'+i" :cx="pkx(p)" :cy="pky(p)" :r="geo.POCKET_R*SCALE + 12" fill="#2a1b15" />

        <!-- Main Wood Board -->
        <rect :x="MARGIN" :y="MARGIN" :width="SIZE" :height="SIZE" fill="url(#woodGrad)" />
        <rect :x="MARGIN" :y="MARGIN" :width="SIZE" :height="SIZE" fill="none" stroke="#5d4037" stroke-width="1.5" />

        <!-- Center Circles -->
        <circle :cx="W/2" :cy="W/2" :r="SCALE * 14" fill="none" stroke="#5d4037" stroke-width="1" opacity="0.6" />
        <circle :cx="W/2" :cy="W/2" :r="SCALE * 13.5" fill="none" stroke="#5d4037" stroke-width="1" opacity="0.3" />

        <!-- Striker Lines (Baselines) -->
        <g v-for="i in 4" :key="'line'+i" :transform="`rotate(${(i-1)*90}, ${W/2}, ${W/2})`">
          <rect :x="MARGIN + SCALE*6" :y="W - MARGIN - SCALE*6" :width="SIZE - SCALE*12" :height="SCALE*2.5" rx="8" fill="none" stroke="#5d4037" stroke-width="1" opacity="0.5" />
          <circle :cx="MARGIN + SCALE*6" :cy="W - MARGIN - SCALE*4.75" :r="SCALE*2.5" fill="#d32f2f" opacity="0.2" />
          <circle :cx="W - MARGIN - SCALE*6" :cy="W - MARGIN - SCALE*4.75" :r="SCALE*2.5" fill="#d32f2f" opacity="0.2" />
          <circle :cx="MARGIN + SCALE*6" :cy="W - MARGIN - SCALE*4.75" :r="SCALE*2" fill="none" stroke="#5d4037" stroke-width="1" />
          <circle :cx="W - MARGIN - SCALE*6" :cy="W - MARGIN - SCALE*4.75" :r="SCALE*2" fill="none" stroke="#5d4037" stroke-width="1" />
        </g>

        <!-- Pockets (Holes) -->
        <circle v-for="(p,i) in pocketPositions" :key="'pk'+i" :cx="pkx(p)" :cy="pky(p)" :r="geo.POCKET_R*SCALE" fill="#000" />

        <!-- Coins -->
        <g filter="url(#softShadow)">
          <circle v-for="c in (COINS.white||[]).filter(x=>!x.pocketed)" :key="'w'+c.id" :cx="ccx(c)" :cy="ccy(c)" :r="geo.R*SCALE*0.9" fill="url(#coinWhite)" stroke="#bcaaa4" stroke-width="0.5" />
          <circle v-for="c in (COINS.black||[]).filter(x=>!x.pocketed)" :key="'b'+c.id" :cx="ccx(c)" :cy="ccy(c)" :r="geo.R*SCALE*0.9" fill="url(#coinBlack)" stroke="#3e2723" stroke-width="0.5" />
          <circle v-if="!COINS.queen?.pocketed" :cx="ccx(COINS.queen)" :cy="ccy(COINS.queen)" :r="geo.R*SCALE*0.9" fill="url(#coinQueen)" stroke="#880e4f" stroke-width="0.5" />
        </g>

        <!-- Striker -->
        <circle :cx="ccx(st.striker)" :cy="ccy(st.striker)" :r="geo.SR*SCALE" fill="url(#strikerGrad)" stroke="#fbc02d" stroke-width="1.5" filter="url(#softShadow)" />

        <!-- Aiming line -->
        <line v-if="isMyTurn && !aimLocked" :x1="ccx(st.striker)" :y1="ccy(st.striker)" :x2="aimEnd.x" :y2="aimEnd.y" stroke="#ffeb3b" stroke-width="2" stroke-dasharray="6 4" opacity="0.8" />
      </svg>
    </div>

    <div class="controls">
      <template v-if="isMyTurn">
        <div v-if="!aimLocked" class="aim">
          <div class="slider-row">
            <label>{{ t('game.angle') }}</label>
            <input type="range" min="0" :max="Math.PI*2" step="0.02" v-model.number="angle" class="slider"/>
          </div>
          <div class="slider-row">
            <label>{{ t('game.power') }}</label>
            <input type="range" min="0.05" max="1" step="0.01" v-model.number="power" class="slider"/>
          </div>
          <button class="btn btn-primary" @click="lockAim">🎯 {{ t('game.lockAim') }}</button>
        </div>
        <button v-else class="btn btn-lg btn-primary" @click="shoot">🚀 {{ t('game.shoot') }}</button>
      </template>
      <div v-else class="status-msg muted">
        {{ st.shots ? `🎯 ${t('game.shots')} ${st.shots?.[myTeam] ?? 0}/${st.strikerLimit}` : t('match.waitingTurn', {name: ''}) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.carrom-view { display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; }
.hud { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 450px; }
.scores { display: flex; gap: 8px; }
.chip { padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 13px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.chip.w { background: #fdf5e6; color: #5d4037; }
.chip.b { background: #3e2723; color: #fff; }
.turn-me { background: var(--accent-grad); color: #fff; }

.board-frame {
  padding: 4px;
  background: #2a1b15;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.board {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 20px;
}

.controls { width: 100%; max-width: 360px; min-height: 80px; display: flex; flex-direction: column; justify-content: center; }
.aim { display: flex; flex-direction: column; gap: 10px; }
.slider-row { display: flex; align-items: center; gap: 10px; }
.slider-row label { width: 60px; font-size: 12px; font-weight: 700; color: var(--text-dim); }
.slider { flex: 1; accent-color: var(--accent); }
.status-msg { font-weight: 700; text-align: center; }
</style>
