<script setup>
import { ref, onMounted, watch } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const q = ref('');
const load = async () => {
  try {
    const res = await adminApi.users({ q: q.value, page: page.value });
    rows.value = res.users; total.value = res.total;
  } catch (e) { ui.error(e.message); }
};
onMounted(load);
function toggleBan(u) {
  if (u.banned) adminApi.unbanUser(u.id).then(() => { u.banned = 0; }).catch((e) => ui.error(e.message));
  else adminApi.banUser(u.id, 'banned').then(() => { u.banned = 1; }).catch((e) => ui.error(e.message));
}
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">👥 Users</h1>
    <div class="row mb-12"><input v-model="q" @keyup.enter="page.value=1; load()" class="input" placeholder="Search username/email/phone…" style="max-width:280px" />
      <button class="btn sm" @click="page.value=1; load()">Search</button></div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>ID</th><th>User</th><th>Role</th><th>Status</th><th>Lv</th><th>XP</th><th>Coins</th><th>Banned</th><th>Bot</th></tr></thead>
        <tbody>
          <tr v-for="u in rows" :key="u.id">
            <td>{{ u.id }}</td>
            <td><b>{{ u.username }}</b></td>
            <td>{{ u.role }}</td>
            <td>{{ u.status }}</td>
            <td>{{ u.level }}</td>
            <td>{{ u.xp }}</td>
            <td>{{ u.coins }}</td>
            <td><button class="btn sm" :class="u.banned?'pill-no':'pill-ok'" style="border:none" @click="ban(u, !u.banned)">{{ u.banned?'ban':'ok' }}</button></td>
            <td>{{ u.is_bot ? '🤖' : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
