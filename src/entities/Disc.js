import { DISC, DISC_STATES, FIELD_BOUNDS } from '../utils/Constants.js';

export default class Disc {
  constructor(scene) {
    this.scene = scene;
    this.state = DISC_STATES.HELD;
    this.ownerId = null;
    this.ownerTeamId = null;

    this.sprite = scene.add.circle(0, 0, DISC.RADIUS, DISC.COLOR);
    this.sprite.setDepth(10);

    this.velocityX = 0;
    this.velocityY = 0;
    this.flightTime = 0;
    this.power = 0;

    this.trailGraphics = scene.add.graphics();
    this.trailGraphics.setDepth(9);

    this.powerGraphics = scene.add.graphics();
    this.powerGraphics.setDepth(11);

    this.chargePower = 0;
    this.isCharging = false;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  set x(val) { this.sprite.x = val; }
  set y(val) { this.sprite.y = val; }

  attachToPlayer(player) {
    this.state = DISC_STATES.HELD;
    this.ownerId = player.id;
    this.ownerTeamId = player.teamId;
    this.sprite.setPosition(player.x, player.y);
    this.velocityX = 0;
    this.velocityY = 0;
    this.flightTime = 0;
  }

  throwDisc(angle, power) {
    this.state = DISC_STATES.THROWN;
    this.power = power;
    this.velocityX = Math.cos(angle) * power;
    this.velocityY = Math.sin(angle) * power;
    this.flightTime = 0;
    this.ownerId = null;
  }

  startCharge() {
    this.isCharging = true;
    this.chargePower = DISC.MIN_POWER;
  }

  updateCharge(delta) {
    if (!this.isCharging) return;
    this.chargePower = Math.min(
      this.chargePower + DISC.CHARGE_RATE * (delta / 1000),
      DISC.MAX_POWER
    );
  }

  getChargePower() {
    const p = this.chargePower;
    this.isCharging = false;
    this.chargePower = 0;
    return p;
  }

  updateFlight(delta) {
    if (this.state !== DISC_STATES.THROWN) return;

    const dt = delta / 1000;
    this.flightTime += dt;

    this.velocityX *= DISC.DRAG_FACTOR;
    this.velocityY *= DISC.DRAG_FACTOR;
    this.velocityY += DISC.GRAVITY * dt;

    this.sprite.x += this.velocityX * dt;
    this.sprite.y += this.velocityY * dt;

    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    if (speed < DISC.GROUND_THRESHOLD && this.flightTime > 0.5) {
      this.hitGround();
    }
  }

  hitGround() {
    this.state = DISC_STATES.GROUND;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  isOutOfBounds() {
    return (
      this.sprite.x < FIELD_BOUNDS.LEFT ||
      this.sprite.x > FIELD_BOUNDS.RIGHT ||
      this.sprite.y < FIELD_BOUNDS.TOP ||
      this.sprite.y > FIELD_BOUNDS.BOTTOM
    );
  }

  drawPowerMeter(playerX, playerY) {
    this.powerGraphics.clear();
    if (!this.isCharging) return;

    const ratio = (this.chargePower - DISC.MIN_POWER) / (DISC.MAX_POWER - DISC.MIN_POWER);
    const barWidth = 40;
    const barHeight = 5;
    const bx = playerX - barWidth / 2;
    const by = playerY - 25;

    this.powerGraphics.fillStyle(0x333333, 0.8);
    this.powerGraphics.fillRect(bx, by, barWidth, barHeight);

    const color = ratio < 0.5 ? 0x00ff00 : ratio < 0.8 ? 0xffff00 : 0xff0000;
    this.powerGraphics.fillStyle(color, 1);
    this.powerGraphics.fillRect(bx, by, barWidth * ratio, barHeight);
  }

  drawTrail() {
    this.trailGraphics.clear();
    if (this.state !== DISC_STATES.THROWN) return;

    this.trailGraphics.fillStyle(0xffffff, 0.3);
    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    const normFactor = Math.min(speed / DISC.MAX_POWER, 1);
    for (let i = 1; i <= 4; i++) {
      const alpha = 0.3 - i * 0.06;
      const size = DISC.RADIUS * (1 - i * 0.15);
      this.trailGraphics.fillStyle(0xffffff, Math.max(alpha, 0.05));
      this.trailGraphics.fillCircle(
        this.sprite.x - (this.velocityX * 0.003 * i) * normFactor,
        this.sprite.y - (this.velocityY * 0.003 * i) * normFactor,
        Math.max(size, 2)
      );
    }
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  destroy() {
    this.sprite.destroy();
    this.trailGraphics.destroy();
    this.powerGraphics.destroy();
  }
}
