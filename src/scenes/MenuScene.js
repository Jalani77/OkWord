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
      fontSize: '48px',
      fill: '#ffffff',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold',
      stroke: '#3366ff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 80, '2D', {
      fontSize: '28px',
      fill: '#88aaff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 10, '[ START GAME ]', {
      fontSize: '28px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#3366ff',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setStyle({ fill: '#ffff00' }));
    playBtn.on('pointerout', () => playBtn.setStyle({ fill: '#ffffff' }));
    playBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    const controlsY = cy + 90;
    const controlStyle = { fontSize: '14px', fill: '#aaaacc', fontFamily: 'Arial', align: 'center' };

    this.add.text(cx, controlsY, 'Controls', {
      fontSize: '18px', fill: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.add.text(cx, controlsY + 30,
      'WASD / Arrows — Move   |   Click & Drag — Aim + Set Power   |   Release — Throw', controlStyle
    ).setOrigin(0.5);

    this.add.text(cx, controlsY + 55,
      'TAB — Switch Player   |   SPACE — Call for Pass', controlStyle
    ).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT - 30, 'First to 15 points wins!', {
      fontSize: '12px', fill: '#666688', fontFamily: 'Arial',
    }).setOrigin(0.5);
  }
}
