<script setup>
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../store/auth.js';
import { useUiStore } from '../store/ui.js';
import { applyLocale } from '../i18n/index.js';
import { useGamesStore } from '../store/games.js';

const auth = useAuthStore();
const ui = useUiStore();
const games = useGamesStore();
const { t, locale } = useI18n();

const isEn = () => locale.value === 'en';
function goBack() { window.history.back(); }
function setTheme(v) { ui.setTheme(v); }
function setLang(l) { applyLocale(l); }
async function logout() {
  await auth.logout();
  goBack();
}
</script>
<template>
  <div class="set-view">
    <button class="btn btn-sm mb-8" @click="goBack()">← {{ t('common.back') }}</button>
    <h1 style="font-size: 22px; font-weight: 800">{{ t('settings.title') }}</h1>

    <div class="card mt-16">
      <div class="section-title"><span class="emo">🎨</span> {{ t('settings.theme') }}</div>
      <div class="row" style="gap:10px">
        <button class="btn" :class="{active: ui.theme==='dark'}" @click="setTheme('dark')">{{ t('settings.dark') }}</button>
        <button class="btn" :class="{active: ui.theme==='light'}" @click="setTheme('light')">{{ t('settings.light') }}</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title"><span class="emo">🌐</span> {{ t('settings.language') }}</div>
      <div class="row" style="gap:10px">
        <button class="btn" :class="{active: isEn}" @click="setLang('en')">English</button>
                <button class="btn" :class="{active: !isEn}" @click="setLang('ar')">العربية</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title"><span class="emo">👤</span> {{ t('settings.account') }}</div>
      <div class="row" style="gap:10px; align-items:center">
        <span style="font-size:24px">{{ auth.user?.avatar || '👤' }}</span>
        <b>{{ auth.user?.username }}</b>
        <span class="pill">{{ t('profile.level') }} {{ auth.user?.level }}</span>
      </div>
      <div class="row mt-8"><button class="btn btn-block btn-ghost" style="justify-content:flex-start" @click="logout">→ {{ t('nav.logout') }}</button></div>
    </div>
  </div>
</template>
<style scoped>
.set-view { max-width: 640px; margin: 0 auto; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.btn.active, .btn.active[style*='accent'] { background: var(--accent-grad); color: #fff; }
</style>
