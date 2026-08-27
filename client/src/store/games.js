import { defineStore } from 'pinia';
import { gamesApi, roomsApi, usersApi } from '../api/index.js';
import { socketManager } from '../socket/index.js';
import { useAuthStore } from './auth.js';

export const useGamesStore = defineStore('games', {
  state: () => ({
    games: [],
    playersOnline: 0,
    loaded: false,
    gameDetail: null,
    publicRooms: [],
    matchmaking: false,
    matchmakingGame: null,
    announcements: [],
  }),
  getters: {
    byCode: (s) => (code) => s.games.find((g) => g.code === code),
  },
  actions: {
    async fetchGames() {
      const res = await gamesApi.list();
      this.games = res.games;
      this.playersOnline = res.playersOnline;
      this.loaded = true;
      return res;
    },
    async fetchDetail(code) {
      const res = await gamesApi.detail(code);
      this.gameDetail = res;
      return res;
    },
    async fetchPublicRooms() {
      const res = await roomsApi.list();
      this.publicRooms = res.rooms;
      return res.rooms;
    },
    async fetchAnnouncements() {
      const res = await usersApi.leaderboard();
      return res;
    },
    async queue(gameCode) {
      this.matchmaking = true;
      this.matchmakingGame = gameCode;
      socketManager.emit('matchmaking:queue', { gameCode });
    },
    cancelMatchmaking() {
      this.matchmaking = false;
      this.matchmakingGame = null;
      socketManager.emit('matchmaking:cancel');
    },
    bindSocket() {
      const off = socketManager.on((event, payload) => {
        if (event === 'matchmaking:waiting') this.matchmaking = true;
        if (event === 'matchmaking:found') {
          this.matchmaking = false;
          this.matchmakingGame = null;
        }
        if (event === 'matchmaking:cancelled') {
          this.matchmaking = false;
          this.matchmakingGame = null;
        }
        if (event === 'matchmaking:error') {
          this.matchmaking = false;
          this.matchmakingGame = null;
        }
      });
      return off;
    },
  },
});
