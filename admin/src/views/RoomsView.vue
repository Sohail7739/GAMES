<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const rooms = ref([]);
const load = async () => { try { rooms.value = await adminApi.rooms(); } catch (e) { ui.error(e.message); } };
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🏠 Rooms</h1>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Code</th><th>Name</th><th>Game</th><th>Status</th><th>Private</th><th>Players</th><th>Host</th></tr></thead>
        <tbody>
          <tr v-for="r in rooms" :key="r.id">
            <td>{{ r.code }}</td><td>{{ r.name }}</td><td>{{ r.game_name }}</td>
            <td><span class="pill" :class="r.status==='playing'?'pill-no':'pill-ok'">{{ r.status }}</span></td>
            <td>{{ r.isPrivate ? '🔒' : '🌐' }}</td><td>{{ r.players }}</td><td>{{ r.host_id }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
