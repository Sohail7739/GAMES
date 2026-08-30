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
const allPawns = computed(() => st.value.pawns || {});
const selCard = ref(null);
const last = computed(() => st.value.lastAction || {});

function play(card, pawn) {
  if (!isMyTurn.value) return;
  const act = { type: 'play', card, pawn };
  if (card === 'J') act.mode = 'move';
  room.sendAction(act);
  selCard.value = null;
}

function getCardSuitColor(c) {
  // Mock suits for visuals
  return ['A', 'K', 'Q', 'J'].includes(c) || ['1','3','5','7'].includes(String(c)) ? 'var(--red)' : 'var(--bg-soft)';
}

function cardLabel(c) {
  if (c === 'A') return { text: 'A', suit: '♥' };
  if (c === 'J') return { text: 'J', suit: '♠' };
  if (c === 'Q') return { text: 'Q', suit: '♦' };
  if (c === 'K') return { text: 'K', suit: '♣' };
  return { text: c, suit: (parseInt(c)%2===0 ? '♠' : '♥') };
}

function pawnOk(p) {
  if (!selCard.value) return false;
  if (['A', 'J'].includes(selCard.value)) return true;
  return p !== 100;
}

const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b'];

</script>

<template>
  <div class="jackaroo-board-view">
    <!-- Rich Graphical Board -->
    <div class="board-container">
      <div class="board-track">
        <!-- Generate 26 cells in a circular/oval layout -->
        <div v-for="cell in 26" :key="cell" class="track-cell" :style="{
          transform: `rotate(${(cell - 1) * (360 / 26)}deg) translate(130px) rotate(-${(cell - 1) * (360 / 26)}deg)`
        }">
          <span class="cell-num">{{ cell - 1 }}</span>
          
          <!-- Render pawns on this cell -->
          <div class="pawns-on-cell">
            <template v-for="(playerPawns, seatIdx) in allPawns" :key="seatIdx">
              <div v-for="(p, pIdx) in playerPawns" :key="pIdx">
                <div v-if="p === cell - 1" class="board-pawn" :style="{ background: colors[seatIdx % 4] }">
                   {{ pIdx + 1 }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      
      <div class="board-center">
        <div class="deck-pile">🎴 Jackaroo</div>
        <div v-if="last.card" class="last-played">
          <div class="rich-card mini" :style="{ color: getCardSuitColor(last.card) }">
            <span class="val">{{ cardLabel(last.card).text }}</span>
            <span class="suit">{{ cardLabel(last.card).suit }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Player Controls -->
    <div class="controls-panel">
      <div v-if="isMyTurn" class="turn-banner active">
        <span class="pulse-dot"></span> {{ t('match.yourTurn') }}
      </div>
      <div v-else class="turn-banner">
        {{ t('match.waitingTurn', { name: '' }) }}
      </div>

      <!-- Player Hand (Realistic Cards) -->
      <div class="player-hand" :class="{ 'my-turn': isMyTurn }">
        <div v-for="(c, i) in myHand" :key="i+String(c)" 
             class="rich-card" 
             :class="{ selected: selCard === c }" 
             :style="{ color: getCardSuitColor(c) }"
             @click="selCard = (selCard === c ? null : c)">
          <div class="card-corner top">
            <span class="val">{{ cardLabel(c).text }}</span>
            <span class="suit">{{ cardLabel(c).suit }}</span>
          </div>
          <div class="card-center suit-lg">{{ cardLabel(c).suit }}</div>
          <div class="card-corner bottom">
            <span class="val">{{ cardLabel(c).text }}</span>
            <span class="suit">{{ cardLabel(c).suit }}</span>
          </div>
        </div>
      </div>

      <!-- Action Area -->
      <div v-if="selCard" class="action-area slide-up">
        <div class="action-title">Select pawn to move with {{ selCard }}:</div>
        <div class="pawn-buttons">
          <button v-for="(p, i) in allPawns[mySeat]" :key="i" 
                  class="btn btn-primary pawn-btn" 
                  :disabled="!pawnOk(p)"
                  @click="play(selCard, i)">
            <span class="pawn-ico" :style="{ background: colors[mySeat % 4] }"></span>
            Pawn {{ i + 1 }} {{ p === 100 ? '(Home)' : '' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jackaroo-board-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  width: 100%;
  transform-style: preserve-3d;
}

.board-container {
  position: relative;
  width: 320px;
  height: 320px;
  background: var(--bg-elev);
  border-radius: 50%;
  border: 12px solid #5a3c22;
  box-shadow:
    0 25px 60px rgba(0,0,0,0.6),
    inset 0 0 40px rgba(168, 85, 247, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.board-track {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-cell {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-strong);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.3);
}

.cell-num {
  font-size: 10px;
  color: var(--text-faint);
  font-weight: bold;
}

.board-center {
  text-align: center;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.deck-pile {
  font-weight: 800;
  font-size: 16px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.pawns-on-cell {
  position: absolute;
  display: flex;
  gap: -5px;
}

.board-pawn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.5);
  font-size: 9px;
  font-weight: bold;
  color: #fff;
  display: grid;
  place-items: center;
  z-index: 5;
  transform: translateZ(5px);
}

/* Player Controls */
.controls-panel {
  width: 100%;
  max-width: 500px;
  background: var(--bg-elev-2);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow);
}

.turn-banner {
  text-align: center;
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 20px;
  color: var(--text-dim);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.turn-banner.active {
  color: var(--green);
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background: var(--green);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--green);
  animation: pulse 1.5s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.5; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.1); }
}

/* Playing Cards */
.player-hand {
  display: flex;
  justify-content: center;
  gap: -20px;
  margin-bottom: 20px;
  perspective: 1000px;
}

.rich-card {
  width: 70px;
  height: 105px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: -2px 4px 15px rgba(0,0,0,0.3);
  position: relative;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  cursor: pointer;
  margin-left: -25px; /* Overlap */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  user-select: none;
}

.rich-card:first-child { margin-left: 0; }

.player-hand.my-turn .rich-card:hover {
  transform: translateY(-15px) rotate(2deg);
  z-index: 10;
  box-shadow: -5px 10px 25px rgba(0,0,0,0.5);
}

.rich-card.selected {
  transform: translateY(-25px) scale(1.05);
  z-index: 20;
  box-shadow: 0 15px 30px rgba(168, 85, 247, 0.4);
  border: 2px solid var(--accent);
}

.card-corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}

.card-corner.top { align-self: flex-start; }
.card-corner.bottom { align-self: flex-end; transform: rotate(180deg); }
.card-center.suit-lg { font-size: 32px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.8; }

.rich-card.mini {
  width: 40px;
  height: 60px;
  margin: 0;
  border-radius: 4px;
  font-size: 10px;
  padding: 2px;
}
.rich-card.mini .card-center { display: none; }

/* Action Area */
.action-area {
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 15px;
  border: 1px solid var(--border);
}

.action-title {
  font-weight: bold;
  margin-bottom: 12px;
  color: var(--text);
  font-size: 14px;
}

.pawn-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pawn-btn {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pawn-ico {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.slide-up { animation: slide-up 0.3s ease forwards; }
</style>
