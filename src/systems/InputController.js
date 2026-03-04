import { DISC } from '../utils/Constants.js';
import { clamp } from '../utils/MathHelpers.js';

export default class InputController {
  constructor(scene) {
    this.scene = scene;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard.addKey('W'),
      down: scene.input.keyboard.addKey('S'),
      left: scene.input.keyboard.addKey('A'),
      right: scene.input.keyboard.addKey('D'),
    };
    this.spaceKey = scene.input.keyboard.addKey('SPACE');
    this.switchKey = scene.input.keyboard.addKey('TAB');

    this.pointer = scene.input.activePointer;

    // Drag gesture state
    this.dragActive = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;

    this._onThrowStart = null;
    this._onThrowRelease = null;
    this._onCallPass = null;
    this._onSwitchPlayer = null;

    scene.input.on('pointerdown', (pointer) => {
      this.dragActive = true;
      this.dragStartX = pointer.worldX;
      this.dragStartY = pointer.worldY;
      this.dragCurrentX = pointer.worldX;
      this.dragCurrentY = pointer.worldY;
      if (this._onThrowStart) this._onThrowStart();
    });

    scene.input.on('pointermove', (pointer) => {
      if (!this.dragActive) return;
      this.dragCurrentX = pointer.worldX;
      this.dragCurrentY = pointer.worldY;
    });

    scene.input.on('pointerup', (pointer) => {
      if (!this.dragActive) return;
      this.dragCurrentX = pointer.worldX;
      this.dragCurrentY = pointer.worldY;
      this.dragActive = false;
      if (this._onThrowRelease) this._onThrowRelease();
    });

    scene.input.keyboard.on('keydown-SPACE', () => {
      if (this._onCallPass) this._onCallPass();
    });

    scene.input.keyboard.on('keydown-TAB', (event) => {
      event.preventDefault();
      if (this._onSwitchPlayer) this._onSwitchPlayer();
    });
  }

  onThrowStartCallback(cb) { this._onThrowStart = cb; }
  onThrowReleaseCallback(cb) { this._onThrowRelease = cb; }
  onCallPassCallback(cb) { this._onCallPass = cb; }
  onSwitchPlayerCallback(cb) { this._onSwitchPlayer = cb; }

  /**
   * Returns the drag vector from pointerdown origin to current/release position.
   * angle: direction of the drag in radians
   * power: clamped magnitude scaled by sensitivity
   * magnitude: raw pixel distance of the drag
   */
  getDragVector() {
    const dx = this.dragCurrentX - this.dragStartX;
    const dy = this.dragCurrentY - this.dragStartY;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude < DISC.DRAG_THROW_DEADZONE) {
      return { angle: 0, power: 0, dx: 0, dy: 0, magnitude: 0 };
    }

    const angle = Math.atan2(dy, dx);
    const rawPower = magnitude * DISC.DRAG_THROW_SENSITIVITY;
    const power = clamp(rawPower, DISC.MIN_POWER, DISC.MAX_POWER);

    return { angle, power, dx, dy, magnitude };
  }

  isDragging() {
    return this.dragActive;
  }

  getPointerPosition() {
    return {
      x: this.pointer.worldX,
      y: this.pointer.worldY,
    };
  }

  getMovementInput() {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) x = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) x = 1;

    if (this.cursors.up.isDown || this.wasd.up.isDown) y = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) y = 1;

    return { x, y };
  }
}
