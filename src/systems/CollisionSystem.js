import Phaser from 'phaser';
import { PLAYER, DISC_STATES } from '../utils/Constants.js';
import { distanceBetween } from '../utils/MathHelpers.js';

export default class CollisionSystem {
  constructor(scene) {
    this.scene = scene;
    this.onCatch = null;
    this.onInterception = null;
    this.onGround = null;
    this.onOutOfBounds = null;
    this.overlapCollider = null;
  }

  /**
   * Creates a Phaser physics group from all player sprites, then registers
   * a physics.add.overlap between the disc sprite and that group.
   * Call once during GameScene.create() after players and disc exist.
   */
  setupPhysicsOverlap(disc, allPlayers, throwingTeamIdFn) {
    this.disc = disc;
    this.throwingTeamIdFn = throwingTeamIdFn;

    this.playerGroup = this.scene.physics.add.group({ classType: Phaser.GameObjects.Arc });
    this.playerGroup.clear(true, false);

    for (const player of allPlayers) {
      this.playerGroup.add(player.sprite);
    }

    this.overlapCollider = this.scene.physics.add.overlap(
      disc.sprite,
      this.playerGroup,
      this._onOverlap.bind(this),
      this._shouldProcess.bind(this),
      this
    );
  }

  /**
   * Process callback — Phaser calls this before the overlap callback.
   * Return true only when a real catch should be evaluated.
   */
  _shouldProcess(discSprite, playerSprite) {
    if (!this.disc.canBeCaught()) return false;

    const dist = Phaser.Math.Distance.Between(
      discSprite.x, discSprite.y,
      playerSprite.x, playerSprite.y
    );
    return dist < PLAYER.CATCH_RADIUS;
  }

  /**
   * Overlap callback — fires when _shouldProcess returned true.
   * Determines catch vs interception and dispatches.
   */
  _onOverlap(discSprite, playerSprite) {
    if (this.disc.state !== DISC_STATES.THROWN) return;

    const player = playerSprite.getData('playerRef');
    if (!player) return;

    const throwingTeamId = this.throwingTeamIdFn();

    if (player.teamId === throwingTeamId) {
      if (player.id === this.disc.lastThrowerId) return;
      if (this.onCatch) this.onCatch(player);
    } else {
      if (this.onInterception) this.onInterception(player);
    }
  }

  /**
   * Manual fallback — kept for cases like pull resolution where the
   * disc might need an immediate proximity check outside the physics step.
   */
  checkDiscPlayerCollisions(disc, offensePlayers, defensePlayers, throwingTeamId) {
    if (!disc.canBeCaught()) return;

    const allPlayers = [...offensePlayers, ...defensePlayers];
    allPlayers.sort((a, b) => {
      const da = distanceBetween({ x: disc.x, y: disc.y }, { x: a.x, y: a.y });
      const db = distanceBetween({ x: disc.x, y: disc.y }, { x: b.x, y: b.y });
      return da - db;
    });

    for (const player of allPlayers) {
      if (!this.isInCatchRadius(disc, player)) continue;
      if (player.id === disc.lastThrowerId) continue;

      if (player.teamId === throwingTeamId) {
        if (this.onCatch) this.onCatch(player);
      } else {
        if (this.onInterception) this.onInterception(player);
      }
      return;
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
