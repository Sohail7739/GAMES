import { defineStore } from 'pinia';
import { socketManager } from '../socket/index.js';
import { useAuthStore } from './auth.js';

export const useRoomStore = defineStore('room', {
  state: () => ({
    room: null,
    matchCode: null,
    matchState: null,
    mySeat: null,
    chat: [],
    announces: [],
    error: null,
    finished: null,
    joined: false,
    queuedFor: null,
  }),
  getters: {
    players: (s) => s.room?.players || [],
    currentGame: (s) => s.room?.gameCode || null,
    isHost: (s) => {
      const auth = useAuthStore();
      return !!s.room && s.room.hostId === auth.user?.id;
    },
  },
  actions: {
    reset() {
      this.room = null;
      this.matchCode = null;
      this.matchState = null;
      this.mySeat = null;
      this.chat = [];
      this.announces = [];
      this.error = null;
      this.finished = null;
      this.joined = false;
      this.queuedFor = null;
    },
    joinRoom(code, password) {
      this.error = null;
      this.finished = null;
      socketManager.emit('room:join', { code, password });
    },
    leaveRoom() {
      if (this.joined) socketManager.emit('room:leave');
      this.reset();
    },
    setReady(ready) {
      socketManager.emit('room:ready', { ready });
    },
    startMatch() {
      socketManager.emit('room:start');
    },
    addBot() {
      socketManager.emit('room:addBot');
    },
    setSettings(settings) {
      socketManager.emit('room:settings', { settings });
    },
    sendChat(message) {
      socketManager.emit('room:chat', { message });
    },
    sendAction(action) {
      socketManager.emit('match:action', action);
    },
    joinMatch(code) {
      this.matchCode = code;
      socketManager.emit('match:join', { matchCode: code });
    },
    bindSocket() {
      const off = socketManager.on((event, payload) => {
        switch (event) {
          case 'connect': {
            // After a socket-level reconnect (drop mid-session), re-attach to the
            // active room/match so state sync and actions keep working.
            if (this.joined && this.room?.code) {
              this.joinRoom(this.room.code);
            } else if (this.matchCode) {
              this.joinMatch(this.matchCode);
            }
            break;
          }
          case 'room:joined':
            console.log('Room: joined', payload);
            this.room = payload.room;
            this.joined = true;
            this.finished = null;
            if (payload.room.matchCode) this.joinMatch(payload.room.matchCode);
            break;
          case 'room:update':
            console.log('Room: update', payload);
            this.room = payload.room;
            break;
          case 'room:started':
            console.log('Room: started', payload);
            this.joinMatch(payload.matchCode);
            break;
          case 'room:closed':
            console.log('Room: closed');
            if (this.joined) this.reset();
            break;
          case 'room:left':
            console.log('Room: left');
            this.reset();
            break;
          case 'room:error':
            console.error('Room: error', payload);
            this.error = payload.message;
            break;
          case 'room:chat':
            this.chat.push(payload);
            if (this.chat.length > 80) this.chat.shift();
            break;
          case 'match:state': {
            console.log('Match: state', payload);
            this.matchState = payload;
            this.matchCode = this.matchCode || payload.meta?.code;
            const auth = useAuthStore();
            if (auth.user) {
              const me = payload.meta?.players?.find((p) => p.id === auth.user.id);
              this.mySeat = me ? me.seat : this.mySeat;
            }
            break;
          }
          case 'match:turn':
            if (this.matchState) this.matchState.meta.currentSeat = payload.seat;
            break;
          case 'match:announce':
            this.announces.push({ text: payload.text, at: Date.now() });
            if (this.announces.length > 5) this.announces.shift();
            break;
          case 'match:finished':
            this.finished = payload;
            break;
          case 'matchmaking:found':
            console.log('Matchmaking: found', payload);
            this.queuedFor = null;
            this.joinRoom(payload.roomCode);
            break;
        }
      });
      return off;
    },
  },
});
