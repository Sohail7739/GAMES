<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const data = ref(null);
const load = async () => { try { data.value = await adminApi.analytics(); } catch (e) { ui.error(e.message); } };
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">📈 Analytics</h1>
    <template v-if="data">
      <div class="grid-3">
        <div class="card"><b>{{ data.todayMatches }}</b><div class="small muted">Matches today</div></div>
      </div>
      <div class="card mt-16">
        <div class="muted">Per game</div>
        <table class="tbl mt-8">
          <thead><tr><th>Game</th><th>Matches</th><th>Finished</th></tr></thead>
          <tbody><tr v-for="g in data.perGame" :key="g.code"><td>{{ g.name }}</td><td>{{ g.matches }}</td><td>{{ g.finished }}</td></tr></tbody>
        </table>
      </div>
      <div class="grid-2 mt-16">
        <div class="card"><div class="muted">Top winners</div>
          <div v-for="w in data.topWinners" :key="w.id" class="row small">{{ w.username }} ({{ w.wins }}W / {{ w.played }}P)</div></div>
        <div class="card"><div class="muted">Top ratings</div>
          <div v-for="w in data.topRatings" :key="w.id" class="row small">{{ w.username }} — {{ w.game }} ({{ w.rating }})</div></div>
      </div>
    </template>
    <div v-else><span class="spinner" /> Loading…</div>
  </div>
</template>
