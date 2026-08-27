import { io } from 'socket.io-client';
import { getToken } from '../api/http.js';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Set();
  }

  connect() {
    if (this.socket) return this.socket;
    const token = getToken();
    if (!token) return null;
    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    this.socket.on('connect', () => {
      this.connected = true;
      this.emitTo('connect');
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.emitTo('disconnect');
    });
    this.socket.onAny((event, payload) => this.emitTo(event, payload));
    return this.socket;
  }

  emitTo(event, payload) {
    this.listeners.forEach((fn) => fn(event, payload));
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, payload) {
    if (this.socket && this.connected) this.socket.emit(event, payload);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.listeners.clear();
  }
}

export const socketManager = new SocketManager();
