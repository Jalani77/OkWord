import Phaser from 'phaser';
import { PLAYER, FIELD_BOUNDS } from '../utils/Constants.js';

export default class Player {
  constructor(scene, x, y, teamId, id, role = 'cutter') {
    this.scene = scene;
    this.id = id;
    this.teamId = teamId;
    this.role = role;
    this.hasDisc = false;
    this.isPivoting = false;
    this.pivotAngle = 0;
    this.anchorX = 0;
    this.anchorY = 0;
    this.isControlled = false;

    const color = teamId === 'A' ? PLAYER.TEAM_A_COLOR : PLAYER.TEAM_B_COLOR;

    this.sprite = scene.add.circle(x, y, PLAYER.RADIUS, color);
    scene.physics.add.existing(this.sprite);

    this.sprite.body.setCircle(PLAYER.RADIUS);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.body.setMaxVelocity(PLAYER.MAX_SPEED, PLAYER.MAX_SPEED);
    this.sprite.body.setDrag(PLAYER.DRAG, PLAYER.DRAG);

    this.sprite.setData('playerRef', this);

    this.outlineGraphics = scene.add.graphics();
    this.directionGraphics = scene.add.graphics();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  set x(val) { this.sprite.x = val; }
  set y(val) { this.sprite.y = val; }

  get body() { return this.sprite.body; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
    if (this.sprite.body) {
      this.sprite.body.reset(x, y);
    }
  }

  setControlled(controlled) {
    this.isControlled = controlled;
  }

  moveWithInput(cursors, wasd) {
    if (this.isPivoting) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.setPosition(this.anchorX, this.anchorY);
      return;
    }

    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd.left.isDown) vx = -1;
    else if (cursors.right.isDown || wasd.right.isDown) vx = 1;

    if (cursors.up.isDown || wasd.up.isDown) vy = -1;
    else if (cursors.down.isDown || wasd.down.isDown) vy = 1;

    if (vx !== 0 || vy !== 0) {
      const mag = Math.sqrt(vx * vx + vy * vy);
      this.sprite.body.setAcceleration(
        (vx / mag) * PLAYER.ACCELERATION,
        (vy / mag) * PLAYER.ACCELERATION
      );
    } else {
      this.sprite.body.setAcceleration(0, 0);
    }

    this.constrainToField();
  }

  constrainToField() {
    const r = PLAYER.RADIUS;
    if (this.sprite.x < FIELD_BOUNDS.LEFT + r) {
      this.sprite.x = FIELD_BOUNDS.LEFT + r;
      this.sprite.body.setVelocityX(0);
    }
    if (this.sprite.x > FIELD_BOUNDS.RIGHT - r) {
      this.sprite.x = FIELD_BOUNDS.RIGHT - r;
      this.sprite.body.setVelocityX(0);
    }
    if (this.sprite.y < FIELD_BOUNDS.TOP + r) {
      this.sprite.y = FIELD_BOUNDS.TOP + r;
      this.sprite.body.setVelocityY(0);
    }
    if (this.sprite.y > FIELD_BOUNDS.BOTTOM - r) {
      this.sprite.y = FIELD_BOUNDS.BOTTOM - r;
      this.sprite.body.setVelocityY(0);
    }
  }

  startPivot() {
    this.isPivoting = true;
    this.anchorX = this.sprite.x;
    this.anchorY = this.sprite.y;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.body.setAcceleration(0, 0);
  }

  stopPivot() {
    this.isPivoting = false;
  }

  updatePivotAngle(pointerX, pointerY) {
    if (!this.isPivoting) return;
    this.pivotAngle = Math.atan2(
      pointerY - this.anchorY,
      pointerX - this.anchorX
    );
  }

  catchDisc() {
    this.hasDisc = true;
    this.startPivot();
  }

  releaseDisc() {
    this.hasDisc = false;
    this.stopPivot();
  }

  drawOutline() {
    this.outlineGraphics.clear();
    this.directionGraphics.clear();

    if (this.isControlled) {
      this.outlineGraphics.lineStyle(2, PLAYER.CONTROLLED_OUTLINE, 1);
      this.outlineGraphics.strokeCircle(this.sprite.x, this.sprite.y, PLAYER.RADIUS + 3);
    }

    if (this.isPivoting && this.hasDisc) {
      this.directionGraphics.lineStyle(2, 0xffff00, 0.7);
      const len = 30;
      const endX = this.sprite.x + Math.cos(this.pivotAngle) * len;
      const endY = this.sprite.y + Math.sin(this.pivotAngle) * len;
      this.directionGraphics.beginPath();
      this.directionGraphics.moveTo(this.sprite.x, this.sprite.y);
      this.directionGraphics.lineTo(endX, endY);
      this.directionGraphics.strokePath();
    }
  }

  destroy() {
    this.sprite.destroy();
    this.outlineGraphics.destroy();
    this.directionGraphics.destroy();
  }
}
