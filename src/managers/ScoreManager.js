import { SCORE_TO_WIN } from '../utils/Constants.js';

export default class ScoreManager {
  constructor() {
    this.scores = { A: 0, B: 0 };
  }

  addPoint(teamId) {
    this.scores[teamId]++;
  }

  getScore(teamId) {
    return this.scores[teamId];
  }

  getScores() {
    return { ...this.scores };
  }

  isGameOver() {
    return this.scores.A >= SCORE_TO_WIN || this.scores.B >= SCORE_TO_WIN;
  }

  getWinner() {
    if (this.scores.A >= SCORE_TO_WIN) return 'A';
    if (this.scores.B >= SCORE_TO_WIN) return 'B';
    return null;
  }

  reset() {
    this.scores = { A: 0, B: 0 };
  }
}
