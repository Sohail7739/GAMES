<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const list = ref({ logs: [], page: 1 });
const fLevel = ref('');
const fCat = ref('');
const load = async () => {
  try { list.value = await adminApi.logs({ level: fLevel.value, category: fCat.value, page: list.value.page }); }
  catch (e) { ui.error(e.message); }
};
onMounted(load);
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">📜 System Logs</h1>
    <div class="row mb-12"><input v-model="fLevel" class="input" placeholder="level" style="max-width:120px" />
      <input v-model="fCat" class="input" placeholder="category" style="max-width:140px" />
      <button class="btn sm" @click="list.value.page=1; load()">Filter</button></div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Level</th><th>Category</th><th>Message</th><th>Meta</th><th>Time</th></tr></thead>
        <tbody>
          <tr v-for="l in list.logs" :key="l.id">
            <td><span :style="l.level==='error'?'color:var(--red)':l.level==='warn'?'color:var(--orange)':'color:var(--green)'">{{ l.level }}</span></td>
            <td>{{ l.category }}</td><td>{{ l.message }}</td><td class="small muted">{{ l.meta }}</td><td class="small muted">{{ l.created_at }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
