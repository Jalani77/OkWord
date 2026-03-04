import { DISC, DISC_STATES, FIELD_BOUNDS } from '../utils/Constants.js';

export default class DiscPhysicsEngine {
  constructor(disc) {
    this.disc = disc;
  }

  update(delta) {
    if (this.disc.state !== DISC_STATES.THROWN) return;

    this.disc.updateFlight(delta);

    if (this.disc.isOutOfBounds()) {
      this.clampToField();
      this.disc.hitGround();
    }
  }

  clampToField() {
    const d = this.disc;
    if (d.x < FIELD_BOUNDS.LEFT) d.x = FIELD_BOUNDS.LEFT;
    if (d.x > FIELD_BOUNDS.RIGHT) d.x = FIELD_BOUNDS.RIGHT;
    if (d.y < FIELD_BOUNDS.TOP) d.y = FIELD_BOUNDS.TOP;
    if (d.y > FIELD_BOUNDS.BOTTOM) d.y = FIELD_BOUNDS.BOTTOM;
  }
}
