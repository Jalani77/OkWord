import { GAME_STATES } from '../utils/Constants.js';

export default class GameStateManager {
  constructor() {
    this.state = GAME_STATES.BOOT;
    this.previousState = null;
    this.listeners = {};
    this.stateTimestamp = Date.now();
  }

  setState(newState) {
    if (this.state === newState) return;
    this.previousState = this.state;
    this.state = newState;
    this.stateTimestamp = Date.now();
    this.emit(newState);
  }

  getState() {
    return this.state;
  }

  is(state) {
    return this.state === state;
  }

  on(state, callback) {
    if (!this.listeners[state]) {
      this.listeners[state] = [];
    }
    this.listeners[state].push(callback);
  }

  emit(state) {
    if (this.listeners[state]) {
      this.listeners[state].forEach(cb => cb(this.previousState));
    }
  }

  timeSinceStateChange() {
    return Date.now() - this.stateTimestamp;
  }
}
