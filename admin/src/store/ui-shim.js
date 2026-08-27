import { defineStore } from 'pinia';
export const useUiStore = defineStore('adminUi', {
  state: () => ({ toast: '' }),
  actions: {
    error(m) { this.toast = m || 'Error'; setTimeout(() => this.toast = '', 3000); },
  },
});
