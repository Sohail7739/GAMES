<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const lb = ref([]);
const load = async () => { try { const r = await adminApi.leaderboard(); lb.value = r.leaderboard || []; } catch (e) { ui.error(e.message); } };
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🥇 Leaderboard</h1>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>#</th><th>Player</th><th>Points</th><th>Wins</th><th>Rating</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in lb" :key="r.id">
            <td>{{ i+1 }}</td><td><span style="font-size:18px">{{ r.avatar||'👤' }}</span> {{ r.username }}</td>
            <td>{{ r.points }}</td><td>{{ r.wins }}</td><td>{{ r.rating }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
