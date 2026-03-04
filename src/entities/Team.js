import Player from './Player.js';
import { FIELD, FIELD_BOUNDS, PLAYER_ROLES } from '../utils/Constants.js';

export default class Team {
  constructor(scene, teamId, isOffense) {
    this.scene = scene;
    this.id = teamId;
    this.players = [];
    this.score = 0;
    this.isOffense = isOffense;
    this.attackingRight = teamId === 'A';
  }

  createPlayers(count = 7) {
    for (let i = 0; i < count; i++) {
      const role = i < 2 ? PLAYER_ROLES.HANDLER : PLAYER_ROLES.CUTTER;
      const player = new Player(this.scene, 0, 0, this.id, `${this.id}_${i}`, role);
      this.players.push(player);
    }
    this.resetPositions();
  }

  resetPositions() {
    const fieldCenterY = FIELD.OFFSET_Y + FIELD.HEIGHT / 2;
    const spacing = FIELD.HEIGHT / (this.players.length + 1);

    let baseX;
    if (this.isOffense) {
      baseX = this.attackingRight
        ? FIELD.OFFSET_X + FIELD.WIDTH * 0.35
        : FIELD.OFFSET_X + FIELD.WIDTH * 0.65;
    } else {
      baseX = this.attackingRight
        ? FIELD.OFFSET_X + FIELD.WIDTH * 0.65
        : FIELD.OFFSET_X + FIELD.WIDTH * 0.35;
    }

    this.players.forEach((player, i) => {
      const y = FIELD.OFFSET_Y + spacing * (i + 1);
      const xOffset = (i % 2 === 0 ? -1 : 1) * 30;
      player.setPosition(baseX + xOffset, y);
      player.hasDisc = false;
      player.isPivoting = false;
    });
  }

  resetForPull() {
    const spacing = FIELD.HEIGHT / (this.players.length + 1);

    let baseX;
    if (this.isOffense) {
      baseX = this.attackingRight
        ? FIELD_BOUNDS.ENDZONE_LEFT_END + 40
        : FIELD_BOUNDS.ENDZONE_RIGHT_START - 40;
    } else {
      baseX = this.attackingRight
        ? FIELD_BOUNDS.ENDZONE_RIGHT_START - 40
        : FIELD_BOUNDS.ENDZONE_LEFT_END + 40;
    }

    this.players.forEach((player, i) => {
      const y = FIELD.OFFSET_Y + spacing * (i + 1);
      player.setPosition(baseX, y);
      player.hasDisc = false;
      player.isPivoting = false;
    });
  }

  getHandler() {
    return this.players.find(p => p.hasDisc) || this.players[0];
  }

  swapOffense() {
    this.isOffense = !this.isOffense;
  }

  swapDirection() {
    this.attackingRight = !this.attackingRight;
  }

  getTargetEndZone() {
    return this.attackingRight ? 'right' : 'left';
  }
}
