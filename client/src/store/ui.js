import { defineStore } from 'pinia';

let toastId = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    connected: false,
    theme: localStorage.getItem('theme') || 'dark',
  }),
  getters: {
    isDark: (s) => s.theme === 'dark',
  },
  actions: {
    toast(message, type = 'info', timeout = 3200) {
      const id = ++toastId;
      this.toasts.push({ id, message, type });
      setTimeout(() => this.dismiss(id), timeout);
    },
    success(message) {
      this.toast(message, 'success');
    },
    error(message) {
      this.toast(message, 'error', 4200);
    },
    info(message) {
      this.toast(message, 'info');
    },
    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('theme', theme);
      document.documentElement.dataset.theme = theme;
    },
    initTheme() {
      document.documentElement.dataset.theme = this.theme;
    },
  },
});
