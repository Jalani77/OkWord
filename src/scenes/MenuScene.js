import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.cameras.main.setBackgroundColor('#0a1628');

    this.add.text(cx, cy - 140, 'ULTIMATE FRISBEE', {
      fontSize: '44px',
      fill: '#ffffff',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: 'bold',
      stroke: '#3366ff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 82, '2D', {
      fontSize: '22px',
      fill: '#88aaff',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: '600',
      letterSpacing: 6,
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 10, 'START GAME', {
      fontSize: '22px',
      fill: '#ffffff',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: '700',
      backgroundColor: '#3366ff',
      padding: { x: 36, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setStyle({ fill: '#ffff00' }));
    playBtn.on('pointerout', () => playBtn.setStyle({ fill: '#ffffff' }));
    playBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    const controlsY = cy + 94;
    const controlStyle = {
      fontSize: '12px',
      fill: '#8899bb',
      fontFamily: "'Inter', system-ui, sans-serif",
      align: 'center',
      lineSpacing: 4,
    };

    this.add.text(cx, controlsY, 'Controls', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: '600',
    }).setOrigin(0.5);

    this.add.text(cx, controlsY + 28,
      'WASD / Arrows \u2014 Move    |    Click & Drag \u2014 Aim + Power    |    Release \u2014 Throw',
      controlStyle
    ).setOrigin(0.5);

    this.add.text(cx, controlsY + 50,
      'TAB \u2014 Switch Player    |    SPACE \u2014 Call for Pass',
      controlStyle
    ).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT - 28, 'First to 15 points wins', {
      fontSize: '10px',
      fill: '#445566',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: '500',
    }).setOrigin(0.5);
  }
}
