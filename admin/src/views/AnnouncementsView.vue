<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const list = ref([]);
const form = ref({ title: '', body: '', target: 'all' });
const load = async () => { try { list.value = await adminApi.announcements(); } catch (e) { ui.error(e.message); } };
onMounted(load);
function create() {
  adminApi.createAnnouncement(form.value).then(() => { form.value = { title: '', body: '', target: 'all' }; load(); }).catch((e) => ui.error(e.message));
}
function toggle(a) { adminApi.toggleAnnouncement(a.id, !a.active).then(load).catch((e) => ui.error(e.message)); }
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">📢 Announcements</h1>
    <div class="card mb-16">
      <div class="grid-2"><input v-model="form.title" class="input" placeholder="title" />
        <select v-model="form.target" class="input"><option value="all">all</option><option value="users">users</option></select></div>
      <div class="mt-8"><textarea v-model="form.body" class="input" rows="3" placeholder="body" /></div>
      <button class="btn btn-primary mt-8" @click="create">Create</button>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Title</th><th>Target</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="a in list" :key="a.id">
            <td>{{ a.title }}</td><td>{{ a.target }}</td>
            <td><span class="pill" :class="a.active?'pill-ok':'pill-no'">{{ a.active?'active':'paused' }}</span></td>
            <td><button class="btn sm" @click="toggle(a)">{{ a.active?'Pause':'Enable' }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
