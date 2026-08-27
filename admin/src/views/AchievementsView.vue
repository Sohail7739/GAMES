<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const ach = ref([]);
const form = ref({ code: '', name: '', nameAr: '', description: '', icon: '🏆', xp: 50 });
const grantId = ref('');
const grantCode = ref('');
const load = async () => { try { ach.value = await adminApi.achievements(); } catch (e) { ui.error(e.message); } };
onMounted(load);
function create() {
  adminApi.createAchievement(form.value).then(() => { form.value = { code: '', name: '', nameAr: '', description: '', icon: '🏆', xp: 50 }; load(); }).catch((e) => ui.error(e.message));
}
function grant() {
  adminApi.grantAchievement(grantId.value, grantCode.value).then(() => { grantId.value = ''; grantCode.value = ''; }).catch((e) => ui.error(e.message));
}
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🏆 Achievements</h1>
    <div class="card mb-16">
      <h2 class="small muted">Create achievement</h2>
      <div class="grid-2 mt-8"><input v-model="form.code" class="input" placeholder="code" />
        <input v-model="form.name" class="input" placeholder="name" /></div>
      <div class="grid-2 mt-8"><input v-model="form.nameAr" class="input" placeholder="name (ar)" />
        <input v-model="form.icon" class="input" placeholder="icon emoji" style="max-width:80px" /></div>
      <div class="mt-8"><input v-model="form.description" class="input" placeholder="description" /></div>
      <div class="grid-2 mt-8"><input v-model.number="form.xp" class="input" type="number" placeholder="xp" style="max-width:100px" />
        <button class="btn sm btn-primary" @click="create">Create</button></div>
      <div class="mt-8"><h2 class="small muted">Grant to user</h2>
        <div class="row"><input v-model.number="grantId" class="input" type="number" placeholder="user id" style="max-width:120px" />
          <input v-model="grantCode" class="input" placeholder="achievement code" style="max-width:140px" />
          <button class="btn sm" @click="grant">Grant</button></div></div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Code</th><th>Name</th><th>XP</th><th>Unlocked</th></tr></thead>
        <tbody><tr v-for="a in ach" :key="a.id"><td>{{ a.code }}</td><td>{{ a.name }}</td><td>{{ a.xp }}</td><td>{{ a.unlocked_count }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
