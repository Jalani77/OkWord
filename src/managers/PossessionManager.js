import { TEAMS } from '../utils/Constants.js';

export default class PossessionManager {
  constructor() {
    this.offenseTeamId = TEAMS.A;
    this.handlerId = null;
  }

  setOffense(teamId) {
    this.offenseTeamId = teamId;
  }

  getOffenseTeamId() {
    return this.offenseTeamId;
  }

  getDefenseTeamId() {
    return this.offenseTeamId === TEAMS.A ? TEAMS.B : TEAMS.A;
  }

  setHandler(playerId) {
    this.handlerId = playerId;
  }

  getHandlerId() {
    return this.handlerId;
  }

  turnover() {
    this.offenseTeamId = this.getDefenseTeamId();
    this.handlerId = null;
  }

  isOffense(teamId) {
    return this.offenseTeamId === teamId;
  }
}
