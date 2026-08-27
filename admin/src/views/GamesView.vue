<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api/index.js';
import { useUiStore } from '../store/ui-shim.js';
const ui = useUiStore();
const games = ref([]);
const editing = ref(null);
const load = async () => { try { games.value = await adminApi.games(); } catch (e) { ui.error(e.message); } };
onMounted(load);
function toggle(g) { adminApi.toggleGame(g.code).then(load).catch((e) => ui.error(e.message)); }
function saveCfg(g) {
  adminApi.updateGameConfig(g.code, g.config).then(() => { editing.value = null; }).catch((e) => ui.error(e.message));
}
</script>
<template>
  <div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:16px">🎮 Games</h1>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Players</th><th>Enabled</th><th>Config</th></tr></thead>
        <tbody>
          <tr v-for="g in games" :key="g.code">
            <td>{{ g.code }}</td><td><b>{{ g.name }}</b></td><td>{{ g.category }}</td><td>{{ g.minPlayers }}-{{ g.maxPlayers }}</td>
            <td><button class="btn sm" :class="g.enabled?'pill-ok':'pill-no'" style="border:none" @click="toggle(g)">{{ g.enabled?'ON':'OFF' }}</button></td>
            <td><button class="btn sm" @click="editing=g; g.config={...(g.config||{})}">⚙️</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="editing" class="card mt-16">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">Edit config: {{ editing.code }}</h2>
      <div v-if="editing.code==='baloot'" class="grid-2">
        <div class="field"><label>targetScore</label><input v-model.number="editing.config.targetScore" class="input" type="number" /></div>
        <div class="field"><label>hokumTarget</label><input v-model.number="editing.config.hokumTarget" class="input" type="number" /></div>
      </div>
      <div v-else-if="editing.code==='ludo'" class="grid-2">
        <div class="field"><label>tokensPerPlayer</label><input v-model.number="editing.config.tokensPerPlayer" class="input" type="number" /></div>
        <div class="field"><label>captureOnSix</label><input type="checkbox" v-model.boolean="editing.config.captureOnSix" /></div>
      </div>
      <div v-else class="field"><label>Raw config JSON</label><textarea v-model="editing.config" class="input" rows="5" /></div>
      <div class="row mt-8"><button class="btn sm" @click="editing=null">Cancel</button><button class="btn sm btn-primary" @click="saveCfg(editing)">Save</button></div>
    </div>
  </div>
</template>
