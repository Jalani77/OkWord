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

    this.isPointerDown = false;
    this.throwAngle = 0;

    scene.input.on('pointerdown', () => {
      this.isPointerDown = true;
      this.onThrowStart();
    });

    scene.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.onThrowRelease();
    });

    this._onThrowStart = null;
    this._onThrowRelease = null;
    this._onCallPass = null;
    this._onSwitchPlayer = null;

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

  onThrowStart() {
    if (this._onThrowStart) this._onThrowStart();
  }

  onThrowRelease() {
    if (this._onThrowRelease) this._onThrowRelease();
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
