<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { ApiError } from '../api/http.js';
import { applyLocale } from '../i18n/index.js';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const mode = ref('login');
const identity = ref('');
const username = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');

const isEn = computed(() => locale.value === 'en');

function switchMode(m) {
  mode.value = m;
  error.value = '';
}

function errText(e) {
  if (e instanceof ApiError) return e.message;
  return t('common.error');
}

async function submit() {
  error.value = '';
  try {
    if (mode.value === 'login') {
      await auth.login({ identity: identity.value.trim(), password: password.value });
    } else {
      if (password.value !== confirm.value) {
        error.value = t('auth.passwordMin');
        return;
      }
      await auth.register({
        username: username.value.trim(),
        email: email.value.trim() || null,
        phone: phone.value.trim() || null,
        password: password.value,
      });
    }
    const redirect = route.query.redirect || '/';
    router.push(redirect);
  } catch (e) {
    error.value = errText(e);
  }
}

async function guest() {
  try {
    await auth.guest();
    router.push('/');
  } catch (e) {
    error.value = errText(e);
  }
}

function setLocale(l) {
  applyLocale(l);
}
</script>

<template>
  <div class="auth-wrap">
    <div class="ambient" />
    <div class="auth-card">
      <div class="auth-hero">
        <div class="logo">🎮</div>
        <h1>{{ isEn ? 'Arena Games' : 'أرينا جيمز' }}</h1>
        <p>{{ t('tagline') }}</p>
      </div>

      <div class="row center mb-16" style="justify-content: center">
        <button class="chip" :class="{ active: isEn }" @click="setLocale('en')">English</button>
        <button class="chip" :class="{ active: !isEn }" @click="setLocale('ar')">العربية</button>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab" :class="{ active: mode === 'login' }" @click="switchMode('login')">{{ t('nav.login') }}</button>
        <button class="auth-tab" :class="{ active: mode === 'register' }" @click="switchMode('register')">{{ t('nav.register') }}</button>
      </div>

      <form @submit.prevent="submit">
        <template v-if="mode === 'login'">
          <div class="field">
            <label>{{ t('auth.identity') }}</label>
            <input v-model="identity" class="input" :placeholder="t('auth.identity')" autocomplete="username" />
          </div>
        </template>
        <template v-else>
          <div class="field">
            <label>{{ t('auth.username') }}</label>
            <input v-model="username" class="input" autocomplete="username" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>{{ t('auth.email') }}</label>
              <input v-model="email" class="input" type="email" />
            </div>
            <div class="field">
              <label>{{ t('auth.phone') }}</label>
              <input v-model="phone" class="input" type="tel" />
            </div>
          </div>
        </template>
        <div class="field">
          <label>{{ t('auth.password') }}</label>
          <input v-model="password" class="input" type="password" autocomplete="current-password" />
        </div>
        <div v-if="mode === 'register'" class="field">
          <label>{{ t('auth.password') }} ({{ t('auth.passwordMin') }})</label>
          <input v-model="confirm" class="input" type="password" autocomplete="new-password" />
        </div>

        <div v-if="error" class="ticker" style="color: var(--red); border-color: rgba(255,92,108,.3); background: rgba(255,92,108,.1)">
          {{ error }}
        </div>

        <button class="btn btn-primary btn-block btn-lg mt-16" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner" style="width: 16px; height: 16px; border-top-color: #fff" />
          {{ mode === 'login' ? t('nav.login') : t('nav.register') }}
        </button>
      </form>

      <div class="divider">{{ t('auth.orContinue') }}</div>

      <button class="btn btn-block" :disabled="auth.loading" @click="guest">
        <span>👤</span> {{ t('auth.guest') }}
      </button>
    </div>
  </div>
</template>
