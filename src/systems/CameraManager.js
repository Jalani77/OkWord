import { DISC_STATES, FIELD_BOUNDS, FIELD } from '../utils/Constants.js';

export default class CameraManager {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'none';
    this.currentTarget = null;
    this.cam = scene.cameras.main;

    this.cam.setZoom(1.15);
    this.cam.setBounds(
      FIELD_BOUNDS.LEFT - 10, FIELD_BOUNDS.TOP - 10,
      FIELD.WIDTH + 20, FIELD.HEIGHT + 20
    );
    this.cam.setDeadzone(160, 90);
  }

  update(disc, controlledPlayer) {
    if (disc.state === DISC_STATES.THROWN) {
      if (this.mode !== 'disc') {
        this.cam.startFollow(disc.sprite, true, 0.12, 0.12);
        this.mode = 'disc';
        this.currentTarget = null;
      }
      return;
    }

    if (controlledPlayer) {
      if (this.mode !== 'player' || this.currentTarget !== controlledPlayer) {
        this.cam.startFollow(controlledPlayer.sprite, true, 0.08, 0.08);
        this.mode = 'player';
        this.currentTarget = controlledPlayer;
      }
    }
  }

  pinToScreen(...gameObjects) {
    for (const obj of gameObjects) {
      if (obj && obj.setScrollFactor) obj.setScrollFactor(0);
    }
  }
}
