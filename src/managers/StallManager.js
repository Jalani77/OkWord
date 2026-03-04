import { STALL } from '../utils/Constants.js';

export default class StallManager {
  constructor() {
    this.count = 0;
    this.active = false;
    this.elapsed = 0;
    this.onStallOut = null;
  }

  start() {
    this.active = true;
    this.count = 0;
    this.elapsed = 0;
  }

  stop() {
    this.active = false;
    this.count = 0;
    this.elapsed = 0;
  }

  reset() {
    this.stop();
  }

  update(delta) {
    if (!this.active) return;

    this.elapsed += delta;
    const newCount = Math.floor(this.elapsed / STALL.INTERVAL_MS);

    if (newCount !== this.count) {
      this.count = newCount;
    }

    if (this.count >= STALL.MAX_COUNT) {
      this.active = false;
      if (this.onStallOut) {
        this.onStallOut();
      }
    }
  }

  getCount() {
    return this.count;
  }

  isActive() {
    return this.active;
  }
}
