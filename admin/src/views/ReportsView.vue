<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const list = ref({ reports: [], total: 0, page: 1 });
const st = ref('');
const load = async () => {
  try { list.value = await adminApi.reports({ status: st.value, page: list.value.page }); }
  catch (e) { ui.error(e.message); }
};
onMounted(load);
const note = ref('');
const resolving = ref(null);
function resolve(r) {
  resolving.value = r;
  adminApi.resolveReport(r.id, { status: 'resolved', adminNote: note.value })
    .then(() => { load(); resolving.value = null; note.value = ''; })
    .catch((e) => ui.error(e.message));
}
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🚩 Reports</h1>
    <div class="row mb-12"><input v-model="st" class="input" placeholder="status filter" style="max-width:200px" />
      <button class="btn sm" @click="list.value.page=1; load()">Filter</button></div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>ID</th><th>Reporter</th><th>Target</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          <tr v-for="r in list.reports" :key="r.id">
            <td>{{ r.id }}</td>
            <td>{{ r.reporter }} <span class="small muted">({{ r.created_at }})</span></td>
            <td>{{ r.target }}</td>
            <td>{{ r.reason }} <span class="small muted">{{ r.details }}</span></td>
            <td><span class="pill" :class="r.status==='open'?'pill-no':'pill-ok'">{{ r.status }}</span></td>
            <td><input v-if="resolving===r" v-model="note" class="input" size="12" placeholder="note" />
              <button class="btn sm btn-primary" @click="resolve(r)">Resolve</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="small muted mt-8">{{ list.total }} reports</div>
  </div>
</template>
