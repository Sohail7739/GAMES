import { defineStore } from 'pinia';
import { notificationsApi } from '../api/index.js';
import { socketManager } from '../socket/index.js';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [],
    announcements: [],
    unread: 0,
  }),
  actions: {
    async fetch() {
      try {
        const res = await notificationsApi.list();
        this.items = res.notifications || [];
        this.unread = res.unread || 0;
      } catch {
        /* ignore */
      }
    },
    async fetchAnnouncements() {
      try {
        const res = await notificationsApi.announcements();
        this.announcements = res.announcements || [];
      } catch {
        /* ignore */
      }
    },
    async markRead(id) {
      try {
        await notificationsApi.markRead(id);
        const n = this.items.find((i) => i.id === id);
        if (n) n.is_read = 1;
        this._countUnread();
      } catch {
        /* ignore */
      }
    },
    async readAll() {
      try {
        await notificationsApi.readAll();
        this.items.forEach((i) => (i.is_read = 1));
        this.unread = 0;
      } catch {
        /* ignore */
      }
    },
    _countUnread() {
      this.unread = this.items.filter((i) => !i.is_read).length;
    },
    bindSocket() {
      const off = socketManager.on((event, payload) => {
        if (event === 'notification:new') {
          this.items.unshift(payload);
          this.unread += 1;
          if (this.items.length > 100) this.items.pop();
        }
      });
      return off;
    },
  },
});
