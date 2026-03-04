import Phaser from 'phaser';

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
    const s = 48;
    const cx = s / 2;
    const cy = s / 2;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx, cy + 6, 30, 10);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy + 2, 16);

    g.fillCircle(cx, cy - 10, 7);

    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 6, cy - 7, 12, 5);

    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(cx - 4, cy - 2, 7);

    g.lineStyle(1, 0xdddddd, 0.25);
    g.strokeCircle(cx, cy + 2, 16);

    g.generateTexture('player_sprite', s, s);
    g.destroy();
  }
}
