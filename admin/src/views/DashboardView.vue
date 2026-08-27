<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const ov = ref(null);
const load = async () => {
  try { ov.value = await adminApi.overview(); }
  catch (e) { ui.error(e.message); }
};
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">📊 Dashboard</h1>
    <template v-if="ov">
      <div class="grid-3">
        <div class="card"><b style="font-size:26px">{{ ov.totalUsers }}</b><div class="small muted">Total users</div></div>
        <div class="card"><b style="font-size:26px">{{ ov.onlineUsers }}</b><div class="small muted">Online now</div></div>
        <div class="card"><b style="font-size:26px">{{ ov.activeMatches }}</b><div class="small muted">Active matches</div></div>
      </div>
      <div class="grid-3">
        <div class="card"><b>{{ ov.totalMatches }}</b><div class="small muted">Total matches</div></div>
        <div class="card"><b>{{ ov.openRooms }}</b><div class="small muted">Open rooms</div></div>
        <div class="card"><b>{{ ov.openReports }}</b><div class="small muted">Open reports</div></div>
      </div>
      <div class="card mt-16">
        <div class="muted">Games activity (last 7 days)</div>
        <div v-for="g in ov.gameStats" :key="g.code" class="row" style="margin-top:6px">
          <span>{{ g.icon }} {{ g.name }}</span>
          <span class="pill" :class="g.enabled?'pill-ok':'pill-no'">{{ g.enabled?'enabled':'disabled' }}</span>
          <span class="small muted">{{ g.matches }} matches</span>
        </div>
      </div>
    </template>
    <div v-else><span class="spinner" /> Loading…</div>
  </div>
</template>
