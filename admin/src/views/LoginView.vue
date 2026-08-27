<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../store/auth.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const identity = ref('admin');
const password = ref('password123');
const loading = ref(false);
const error = ref('');

async function submit() {
  loading.value = true; error.value = '';
  try {
    await auth.login({ identity: identity.value, password: password.value });
    router.push(route.query.redirect || { name: 'dashboard' });
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
</script>
<template>
  <div class="card" style="max-width:360px;margin:60px auto">
    <h1 style="font-size:22px;font-weight:800;margin-bottom:16px">🔒 Admin Login</h1>
    <div v-if="error" class="muted" style="color:var(--red);border:1px solid var(--red);padding:8px;border-radius:8px;margin-bottom:12px">{{ error }}</div>
    <div class="field"><label>Username / email</label><input v-model="identity" class="input" /></div>
    <div class="field"><label>Password</label><input v-model="password" type="password" class="input" /></div>
    <button class="btn btn-primary btn-block" :disabled="loading" @click="submit">{{ loading ? '…' : 'Login' }}</button>
  </div>
</template>
