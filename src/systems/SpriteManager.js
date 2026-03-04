export default class SpriteManager {
  constructor(scene) {
    this.scene = scene;
    this.generated = false;
  }

  generateTextures() {
    if (this.generated) return;
    this.generated = true;

    this._genPlayerTexture('player_idle', 0.0);
    this._genPlayerTexture('player_jog', 0.15);
    this._genPlayerTexture('player_sprint', 0.35);
    this._genDirectionArrow();
  }

  _genPlayerTexture(key, motionStretch) {
    if (this.scene.textures.exists(key)) return;

    const s = 48;
    const cx = s / 2;
    const cy = s / 2;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x000000, 0.1 + motionStretch * 0.1);
    g.fillEllipse(cx, cy + 6, 28 + motionStretch * 8, 9);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy + 2, 15);
    g.fillCircle(cx, cy - 10, 7);
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 5, cy - 7, 10, 5);

    if (motionStretch > 0) {
      g.fillStyle(0xffffff, 0.15 + motionStretch * 0.2);
      g.fillEllipse(cx - 6, cy + 2, 6, 12 + motionStretch * 10);
    }

    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(cx - 3, cy - 2, 6);

    g.lineStyle(1, 0xdddddd, 0.2);
    g.strokeCircle(cx, cy + 2, 15);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  _genDirectionArrow() {
    if (this.scene.textures.exists('dir_arrow')) return;

    const s = 16;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(s, s / 2, 0, 0, 0, s);
    g.generateTexture('dir_arrow', s, s);
    g.destroy();
  }

  getTextureForState(animState) {
    switch (animState) {
      case 'sprint': return 'player_sprint';
      case 'jog': return 'player_jog';
      default: return 'player_idle';
    }
  }
}
