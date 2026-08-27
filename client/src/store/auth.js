import { defineStore } from 'pinia';
import { authApi, usersApi } from '../api/index.js';
import { setToken, getToken } from '../api/http.js';
import { socketManager } from '../socket/index.js';
import { useRoomStore } from './room.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: getToken(),
    loading: false,
    booting: true,
  }),
  getters: {
    isAuthed: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async login(body) {
      this.loading = true;
      try {
        const res = await authApi.login(body);
        this._accept(res.token, res.user);
        return res;
      } finally {
        this.loading = false;
      }
    },
    async register(body) {
      this.loading = true;
      try {
        const res = await authApi.register(body);
        this._accept(res.token, res.user);
        return res;
      } finally {
        this.loading = false;
      }
    },
    async guest(username) {
      this.loading = true;
      try {
        const res = await authApi.guest(username);
        this._accept(res.token, res.user);
        return res;
      } finally {
        this.loading = false;
      }
    },
    _accept(token, user) {
      this.token = token;
      this.user = user;
      setToken(token);
      localStorage.setItem('token', token);
      socketManager.connect();
    },
    async boot() {
      this.booting = true;
      try {
        const t = localStorage.getItem('token');
        if (t) {
          setToken(t);
          this.token = t;
          this.user = await authApi.me();
          socketManager.connect();
        }
      } catch {
        this.logout();
      } finally {
        this.booting = false;
      }
    },
    async refreshMe() {
      if (!this.token) return;
      try {
        this.user = await authApi.me();
      } catch {
        /* ignore */
      }
    },
    async updateProfile(patch) {
      const user = await usersApi.updateMe(patch);
      this.user = { ...this.user, ...user };
      return user;
    },
    async logout() {
      try {
        await authApi.logout();
      } catch {
        /* ignore */
      }
      this.token = null;
      this.user = null;
      setToken(null);
      localStorage.removeItem('token');
      socketManager.disconnect();
      useRoomStore().reset();
    },
  },
});
