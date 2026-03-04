import { PLAYER, DISC_STATES } from '../utils/Constants.js';
import { distanceBetween } from '../utils/MathHelpers.js';

export default class CollisionSystem {
  constructor(scene) {
    this.scene = scene;
    this.onCatch = null;
    this.onInterception = null;
    this.onGround = null;
    this.onOutOfBounds = null;
  }

  checkDiscPlayerCollisions(disc, offensePlayers, defensePlayers, throwingTeamId) {
    if (disc.state !== DISC_STATES.THROWN) return;

    for (const player of offensePlayers) {
      if (this.isInCatchRadius(disc, player)) {
        if (player.teamId === throwingTeamId) {
          if (this.onCatch) this.onCatch(player);
        } else {
          if (this.onInterception) this.onInterception(player);
        }
        return;
      }
    }

    for (const player of defensePlayers) {
      if (this.isInCatchRadius(disc, player)) {
        if (player.teamId === throwingTeamId) {
          if (this.onCatch) this.onCatch(player);
        } else {
          if (this.onInterception) this.onInterception(player);
        }
        return;
      }
    }
  }

  isInCatchRadius(disc, player) {
    const dist = distanceBetween(
      { x: disc.x, y: disc.y },
      { x: player.x, y: player.y }
    );
    return dist < PLAYER.CATCH_RADIUS;
  }

  checkDefenderMark(handler, defensePlayers) {
    if (!handler || !handler.hasDisc) return false;

    for (const defender of defensePlayers) {
      const dist = distanceBetween(
        { x: handler.x, y: handler.y },
        { x: defender.x, y: defender.y }
      );
      if (dist < PLAYER.MARK_RADIUS) {
        return true;
      }
    }
    return false;
  }

  getClosestDefender(handler, defensePlayers) {
    let closest = null;
    let minDist = Infinity;

    for (const defender of defensePlayers) {
      const dist = distanceBetween(
        { x: handler.x, y: handler.y },
        { x: defender.x, y: defender.y }
      );
      if (dist < minDist) {
        minDist = dist;
        closest = defender;
      }
    }
    return { player: closest, distance: minDist };
  }
}
