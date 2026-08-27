import { defineStore } from 'pinia';
import { authApi } from '../api/index.js';
import { setToken, apiToken } from '../api/http.js';

export const useAuthStore = defineStore('adminAuth', {
  state: () => ({ user: null, token: apiToken(), booting: true }),
  getters: { ready: (s) => !!s.token && !!s.user },
  actions: {
    async login(body) {
      const res = await authApi.login(body);
      this.token = res.token;
      this.user = res.user;
      setToken(res.token);
    },
    async boot() {
      this.booting = true;
      try {
        if (this.token) this.user = await authApi.me();
      } catch { this.token = null; this.user = null; setToken(null); }
      finally { this.booting = false; }
    },
    logout() { this.token = null; this.user = null; setToken(null); },
  },
});
