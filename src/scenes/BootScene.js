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
    this.scene.start('MenuScene');
  }
}
