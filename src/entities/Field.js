import { FIELD, FIELD_BOUNDS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants.js';

export default class Field {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.draw();
  }

  draw() {
    const g = this.graphics;
    g.clear();

    g.fillStyle(FIELD.GRASS_COLOR, 1);
    g.fillRect(FIELD.OFFSET_X, FIELD.OFFSET_Y, FIELD.WIDTH, FIELD.HEIGHT);

    g.fillStyle(FIELD.ENDZONE_LEFT_COLOR, 0.5);
    g.fillRect(FIELD.OFFSET_X, FIELD.OFFSET_Y, FIELD.ENDZONE_WIDTH, FIELD.HEIGHT);

    g.fillStyle(FIELD.ENDZONE_RIGHT_COLOR, 0.5);
    g.fillRect(
      FIELD_BOUNDS.ENDZONE_RIGHT_START,
      FIELD.OFFSET_Y,
      FIELD.ENDZONE_WIDTH,
      FIELD.HEIGHT
    );

    g.lineStyle(2, FIELD.LINE_COLOR, 1);
    g.strokeRect(FIELD.OFFSET_X, FIELD.OFFSET_Y, FIELD.WIDTH, FIELD.HEIGHT);

    g.beginPath();
    g.moveTo(FIELD_BOUNDS.ENDZONE_LEFT_END, FIELD.OFFSET_Y);
    g.lineTo(FIELD_BOUNDS.ENDZONE_LEFT_END, FIELD_BOUNDS.BOTTOM);
    g.strokePath();

    g.beginPath();
    g.moveTo(FIELD_BOUNDS.ENDZONE_RIGHT_START, FIELD.OFFSET_Y);
    g.lineTo(FIELD_BOUNDS.ENDZONE_RIGHT_START, FIELD_BOUNDS.BOTTOM);
    g.strokePath();

    const midX = FIELD.OFFSET_X + FIELD.WIDTH / 2;
    g.lineStyle(1, FIELD.LINE_COLOR, 0.4);
    g.beginPath();
    g.moveTo(midX, FIELD.OFFSET_Y);
    g.lineTo(midX, FIELD_BOUNDS.BOTTOM);
    g.strokePath();

    this.drawFieldLabels();
  }

  drawFieldLabels() {
    const style = { fontSize: '14px', fill: '#ffffff', fontFamily: 'Arial', alpha: 0.6 };

    const leftZoneCenterX = FIELD.OFFSET_X + FIELD.ENDZONE_WIDTH / 2;
    const rightZoneCenterX = FIELD_BOUNDS.ENDZONE_RIGHT_START + FIELD.ENDZONE_WIDTH / 2;
    const labelY = FIELD.OFFSET_Y + FIELD.HEIGHT / 2;

    this.scene.add.text(leftZoneCenterX, labelY, 'END\nZONE', {
      ...style,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.4);

    this.scene.add.text(rightZoneCenterX, labelY, 'END\nZONE', {
      ...style,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.4);
  }

  isInBounds(x, y) {
    return (
      x >= FIELD_BOUNDS.LEFT &&
      x <= FIELD_BOUNDS.RIGHT &&
      y >= FIELD_BOUNDS.TOP &&
      y <= FIELD_BOUNDS.BOTTOM
    );
  }

  isInLeftEndZone(x, y) {
    return (
      this.isInBounds(x, y) &&
      x <= FIELD_BOUNDS.ENDZONE_LEFT_END
    );
  }

  isInRightEndZone(x, y) {
    return (
      this.isInBounds(x, y) &&
      x >= FIELD_BOUNDS.ENDZONE_RIGHT_START
    );
  }

  isInEndZone(x, y, side) {
    if (side === 'left') return this.isInLeftEndZone(x, y);
    if (side === 'right') return this.isInRightEndZone(x, y);
    return this.isInLeftEndZone(x, y) || this.isInRightEndZone(x, y);
  }
}
