import { AI, PLAYER, FIELD_BOUNDS, FIELD, DISC_STATES } from '../utils/Constants.js';
import { distanceBetween, angleBetween, normalizeVector, randomInRange } from '../utils/MathHelpers.js';

export default class AIController {
  constructor(scene) {
    this.scene = scene;
    this.decisionTimers = {};
    this.targetPositions = {};
  }

  updateOffenseAI(players, handler, disc, delta) {
    for (const player of players) {
      if (player.isControlled || player.hasDisc) continue;

      if (!this.decisionTimers[player.id]) {
        this.decisionTimers[player.id] = 0;
      }
      this.decisionTimers[player.id] += delta;

      if (this.decisionTimers[player.id] > AI.DECISION_INTERVAL) {
        this.decisionTimers[player.id] = 0;
        this.decideOffenseTarget(player, handler, players);
      }

      this.moveTowardTarget(player, delta);
    }
  }

  updateDefenseAI(defenders, offensePlayers, handler, disc, delta) {
    for (let i = 0; i < defenders.length; i++) {
      const defender = defenders[i];
      if (defender.isControlled) continue;

      if (!this.decisionTimers[defender.id]) {
        this.decisionTimers[defender.id] = 0;
      }
      this.decisionTimers[defender.id] += delta;

      if (this.decisionTimers[defender.id] > AI.DECISION_INTERVAL) {
        this.decisionTimers[defender.id] = 0;
        this.decideDefenseTarget(defender, offensePlayers, handler, disc, i);
      }

      this.moveTowardTarget(defender, delta);

      if (disc && disc.state === DISC_STATES.THROWN) {
        this.tryIntercept(defender, disc, delta);
      }
    }
  }

  decideOffenseTarget(player, handler, teammates) {
    const fieldCenterX = FIELD.OFFSET_X + FIELD.WIDTH / 2;
    const fieldCenterY = FIELD.OFFSET_Y + FIELD.HEIGHT / 2;

    let targetX, targetY;

    if (player.role === 'handler') {
      targetX = handler
        ? handler.x + randomInRange(-100, 100)
        : fieldCenterX + randomInRange(-80, 80);
      targetY = handler
        ? handler.y + randomInRange(-80, 80)
        : fieldCenterY + randomInRange(-80, 80);
    } else {
      targetX = fieldCenterX + randomInRange(-200, 200);
      targetY = FIELD.OFFSET_Y + randomInRange(40, FIELD.HEIGHT - 40);

      let tooClose = false;
      for (const mate of teammates) {
        if (mate.id === player.id) continue;
        const dist = distanceBetween(
          { x: targetX, y: targetY },
          { x: mate.x, y: mate.y }
        );
        if (dist < AI.SPACING_DISTANCE) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) {
        targetX += randomInRange(-60, 60);
        targetY += randomInRange(-60, 60);
      }
    }

    targetX = Math.max(FIELD_BOUNDS.LEFT + 20, Math.min(FIELD_BOUNDS.RIGHT - 20, targetX));
    targetY = Math.max(FIELD_BOUNDS.TOP + 20, Math.min(FIELD_BOUNDS.BOTTOM - 20, targetY));

    this.targetPositions[player.id] = { x: targetX, y: targetY };
  }

  decideDefenseTarget(defender, offensePlayers, handler, disc, index) {
    if (index === 0 && handler && handler.hasDisc) {
      const angle = angleBetween(handler, defender);
      this.targetPositions[defender.id] = {
        x: handler.x + Math.cos(angle) * AI.MARK_DISTANCE * 0.5,
        y: handler.y + Math.sin(angle) * AI.MARK_DISTANCE * 0.5,
      };
      return;
    }

    const matchup = offensePlayers[index % offensePlayers.length];
    if (matchup) {
      this.targetPositions[defender.id] = {
        x: matchup.x + randomInRange(-20, 20),
        y: matchup.y + randomInRange(-20, 20),
      };
    }
  }

  tryIntercept(defender, disc, delta) {
    const dist = distanceBetween(
      { x: defender.x, y: defender.y },
      { x: disc.x, y: disc.y }
    );

    if (dist < AI.INTERCEPT_RADIUS * 2) {
      this.targetPositions[defender.id] = { x: disc.x, y: disc.y };
    }
  }

  moveTowardTarget(player, delta) {
    const target = this.targetPositions[player.id];
    if (!target) {
      player.body.setAcceleration(0, 0);
      return;
    }

    const dist = distanceBetween(
      { x: player.x, y: player.y },
      target
    );

    if (dist < 5) {
      player.body.setAcceleration(0, 0);
      return;
    }

    const dir = normalizeVector(target.x - player.x, target.y - player.y);
    const accel = PLAYER.ACCELERATION * AI.CUT_SPEED_FACTOR;
    player.body.setAcceleration(dir.x * accel, dir.y * accel);
    player.constrainToField();
  }

  chooseThrowTarget(handler, teammates, defenders) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const mate of teammates) {
      if (mate.id === handler.id || mate.hasDisc) continue;

      let minDefDist = Infinity;
      for (const def of defenders) {
        const dd = distanceBetween(
          { x: mate.x, y: mate.y },
          { x: def.x, y: def.y }
        );
        if (dd < minDefDist) minDefDist = dd;
      }

      const dist = distanceBetween(
        { x: handler.x, y: handler.y },
        { x: mate.x, y: mate.y }
      );

      const openness = minDefDist;
      const notTooFar = dist < 350 ? 1 : 0.3;
      const score = openness * notTooFar + randomInRange(-20, 20);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = mate;
      }
    }

    return bestTarget;
  }

  resetTimers() {
    this.decisionTimers = {};
    this.targetPositions = {};
  }
}
