<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const list = ref({ matches: [], total: 0, page: 1 });
const status = ref('');
const load = async () => {
  try { list.value = await adminApi.matches({ status: status.value, page: list.value.page }); }
  catch (e) { ui.error(e.message); }
};
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🕹️ Matches</h1>
    <div class="row mb-12"><input v-model="status" class="input" placeholder="status filter" style="max-width:200px" />
      <button class="btn sm" @click="list.value.page=1; load()">Filter</button></div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Code</th><th>Game</th><th>Status</th><th>Winner</th><th>Started</th><th>Finished</th></tr></thead>
        <tbody>
          <tr v-for="m in list.matches" :key="m.id">
            <td>{{ m.code }}</td><td>{{ m.game_name }}</td><td>{{ m.status }}</td><td>{{ m.winner_id }}</td>
            <td class="small muted">{{ m.started_at }}</td><td class="small muted">{{ m.finished_at }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="small muted mt-8">{{ list.total }} matches</div>
  </div>
</template>
