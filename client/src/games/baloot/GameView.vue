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

function getSuitColor(suit) {
  return suit === 'hearts' || suit === 'diamonds' ? 'var(--red)' : '#1f2937';
}

function cardLabel(c) { 
  return { rank: c.rank, suit: SUIT_EMOJI[c.suit] || '🂠' };
}

function bidOpts() {
  const cur = st.value.highestBid;
  const order = ['spades', 'clubs', 'hearts', 'diamonds'];
  if (cur?.sun) return order; 
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

// Map seats to positions around the table relative to "mySeat"
// 0 = bottom, 1 = right, 2 = top, 3 = left
function getSeatPosition(seatIdx) {
  if (mySeat.value == null) return seatIdx; // Not playing
  return (seatIdx - mySeat.value + 4) % 4;
}

const posClasses = ['pos-bottom', 'pos-right', 'pos-top', 'pos-left'];
</script>

<template>
  <div class="baloot-board-view">
    
    <!-- Scoreboard Header -->
    <div class="scoreboard">
      <div class="score-team">Team 1: <span>{{ st.value.scores?.[0] ?? 0 }}</span></div>
      <div class="target-score">Target: {{ st.value.targetScore }}</div>
      <div class="score-team">Team 2: <span>{{ st.value.scores?.[1] ?? 0 }}</span></div>
    </div>

    <!-- Bidding Phase Overlay -->
    <div v-if="phase === 'bidding'" class="bidding-panel">
      <div v-if="st.value.highestBid" class="current-bid">
        Highest Bid: {{ st.value.highestBid.sun ? '🌞 Sun' : st.value.highestBid.suit }}
      </div>
      
      <div v-if="isMyTurn" class="bid-actions">
        <h3 class="bid-title">{{ t('game.yourTurn') }} - Place Bid</h3>
        <div class="bid-buttons">
          <button v-for="s in bidOpts()" :key="s" class="btn bid-btn" :style="{ color: getSuitColor(s) }" @click="bid(s)">
            {{ s }} {{ SUIT_EMOJI[s] }}
          </button>
          <button class="btn btn-primary" @click="bid('sun')">🌞 Sun</button>
          <button class="btn btn-ghost" @click="bid('pass')">Pass</button>
        </div>
      </div>
      <div v-else class="waiting-turn">
        {{ t('match.waitingTurn', { name: '' }) }}
      </div>
    </div>

    <!-- Game Table -->
    <div class="game-table" v-if="phase === 'playing' || phase === 'bidding'">
      <div class="felt-surface">
        <div class="led-suit" v-if="st.value.ledSuit">Led: {{ SUIT_EMOJI[st.value.ledSuit] }}</div>
        
        <!-- Center Trick Area -->
        <div class="trick-center" v-if="st.value.table">
          <div v-for="c in st.value.table" :key="c.seat" 
               class="rich-card trick-card"
               :class="posClasses[getSeatPosition(c.seat)]"
               :style="{ color: getSuitColor(c.card.suit) }">
            <div class="card-corner top">
              <span class="val">{{ c.card.rank }}</span>
              <span class="suit">{{ SUIT_EMOJI[c.card.suit] }}</span>
            </div>
            <div class="card-center suit-lg">{{ SUIT_EMOJI[c.card.suit] }}</div>
            <div class="card-corner bottom">
              <span class="val">{{ c.card.rank }}</span>
              <span class="suit">{{ SUIT_EMOJI[c.card.suit] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Player Hand -->
    <div class="player-controls" v-if="phase === 'playing'">
      <div v-if="isMyTurn" class="turn-indicator active"><span class="pulse-dot"></span> {{ t('match.yourTurn') }}</div>
      <div v-else class="turn-indicator">{{ t('match.waitingTurn', { name: '' }) }}</div>
      
      <div class="player-hand" :class="{ 'my-turn': isMyTurn }">
        <div v-for="(c, i) in myHand" :key="c.suit+c.rank" 
             class="rich-card hand-card" 
             :style="{ color: getSuitColor(c.suit), zIndex: i }"
             @click="play(c)">
          <div class="card-corner top">
            <span class="val">{{ c.rank }}</span>
            <span class="suit">{{ SUIT_EMOJI[c.suit] }}</span>
          </div>
          <div class="card-center suit-lg">{{ SUIT_EMOJI[c.suit] }}</div>
          <div class="card-corner bottom">
            <span class="val">{{ c.rank }}</span>
            <span class="suit">{{ SUIT_EMOJI[c.suit] }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.baloot-board-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 20px;
}

/* Scoreboard */
.scoreboard {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 500px;
  background: var(--bg-elev);
  padding: 12px 24px;
  border-radius: 99px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  font-weight: 800;
  font-size: 15px;
}

.score-team span {
  font-size: 18px;
  color: var(--accent);
}

.target-score {
  color: var(--text-faint);
  font-size: 12px;
}

/* Bidding Panel */
.bidding-panel {
  width: 100%;
  max-width: 500px;
  background: var(--bg-elev-2);
  border-radius: var(--radius-lg);
  padding: 24px;
  text-align: center;
  box-shadow: var(--shadow);
  z-index: 20;
}

.current-bid {
  font-size: 16px;
  color: var(--gold);
  margin-bottom: 20px;
  font-weight: bold;
}

.bid-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bid-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.bid-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  font-weight: bold;
}

.waiting-turn {
  color: var(--text-dim);
  font-weight: bold;
}

/* Game Table */
.game-table {
  width: 100%;
  max-width: 600px;
  height: 350px;
  background: radial-gradient(circle, #2a5a3b 0%, #11381f 100%);
  border-radius: 120px;
  border: 8px solid #5a3c22;
  box-shadow: 0 15px 40px rgba(0,0,0,0.6), inset 0 0 50px rgba(0,0,0,0.8);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.led-suit {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.5);
  padding: 4px 12px;
  border-radius: 20px;
  color: #fff;
  font-weight: bold;
  font-size: 14px;
}

.trick-center {
  position: relative;
  width: 140px;
  height: 140px;
}

/* Player Controls & Hand */
.player-controls {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.turn-indicator {
  font-weight: bold;
  color: var(--text-dim);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.turn-indicator.active {
  color: var(--green);
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: var(--green);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--green);
  animation: pulse 1s infinite alternate;
}

/* Realistic Cards */
.rich-card {
  width: 75px;
  height: 110px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: -2px 4px 15px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  user-select: none;
  font-weight: 800;
  border: 1px solid #d1d5db;
}

.card-corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 15px;
  line-height: 1.1;
}

.card-corner.top { align-self: flex-start; }
.card-corner.bottom { align-self: flex-end; transform: rotate(180deg); }
.card-center.suit-lg { font-size: 34px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.8; }

/* Hand Overlap Styling */
.player-hand {
  display: flex;
  justify-content: center;
  gap: -30px;
  perspective: 1000px;
}

.hand-card {
  margin-left: -35px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: -4px 0 10px rgba(0,0,0,0.3);
}

.hand-card:first-child { margin-left: 0; }

.player-hand.my-turn .hand-card:hover {
  transform: translateY(-25px) scale(1.05);
  box-shadow: 0 10px 25px rgba(168, 85, 247, 0.5);
  border-color: var(--accent);
}

/* Trick Card Placements on the Table */
.trick-card {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-top: -55px;
  margin-left: -37.5px;
  box-shadow: 2px 4px 12px rgba(0,0,0,0.5);
}

.pos-bottom { transform: translate(0, 30px) rotate(5deg); z-index: 4; }
.pos-right { transform: translate(45px, 0) rotate(85deg); z-index: 3; }
.pos-top { transform: translate(0, -30px) rotate(-5deg); z-index: 2; }
.pos-left { transform: translate(-45px, 0) rotate(-85deg); z-index: 1; }

@keyframes pulse {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
</style>
