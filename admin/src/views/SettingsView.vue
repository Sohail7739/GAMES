<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const info = ref(null);
const load = async () => { try { info.value = await adminApi.systemInfo(); } catch (e) { ui.error(e.message); } };
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">⚙️ Settings</h1>
    <div v-if="info" class="card">
      <div class="field">Node: <b>{{ info.node }}</b></div>
      <div class="field">Platform: <b>{{ info.platform }}</b></div>
      <div class="field">Uptime: <b>{{ Math.round(info.uptime) }}s</b></div>
      <div class="field">Memory (heapUsed): <b>{{ Math.round(info.memory?.heapUsed/1024/1024) }} MB</b></div>
    </div>
    <div class="card mt-16 muted small">Admin authentication uses the same /api/auth/login endpoint with an admin-role account.</div>
  </div>
</template>
