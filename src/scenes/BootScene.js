import Phaser from 'phaser';
import SpriteManager from '../systems/SpriteManager.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;
    const barW = 300;
    const barH = 20;
    const bx = (width - barW) / 2;
    const by = height / 2;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(bx, by, barW, barH);

    const progressBar = this.add.graphics();

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x3366ff, 1);
      progressBar.fillRect(bx + 2, by + 2, (barW - 4) * value, barH - 4);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });
  }

  create() {
    this.loadAssets();
    this.scene.start('MenuScene');
  }

  loadAssets() {
    const mgr = new SpriteManager(this);
    mgr.generateTextures();

    if (!this.textures.exists('player_sprite')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const s = 48;
      const cx = s / 2;
      const cy = s / 2;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx, cy + 2, 15);
      g.fillCircle(cx, cy - 10, 7);
      g.fillRect(cx - 5, cy - 7, 10, 5);
      g.generateTexture('player_sprite', s, s);
      g.destroy();
    }
  }
}
