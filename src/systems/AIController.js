import { AI, PLAYER, FIELD_BOUNDS, FIELD, DISC_STATES } from '../utils/Constants.js';
import { distanceBetween, angleBetween, normalizeVector, randomInRange } from '../utils/MathHelpers.js';

export default class AIController {
  constructor(scene) {
    this.scene = scene;
    this.decisionTimers = {};
    this.targetPositions = {};
  }

  // ------------------------------------------------------------------
  //  SETUP phase — all players walk to assigned positions at WALK_SPEED
  // ------------------------------------------------------------------

  updateSetupMovement(players, delta) {
    for (const player of players) {
      if (player.isControlled) continue;

      const tx = player.setupTargetX;
      const ty = player.setupTargetY;
      const dist = distanceBetween({ x: player.x, y: player.y }, { x: tx, y: ty });

      if (dist < AI.SETUP_ARRIVE_THRESHOLD) {
        player.body.setVelocity(0, 0);
        player.body.setAcceleration(0, 0);
        continue;
      }

      const dir = normalizeVector(tx - player.x, ty - player.y);
      const walkAccel = PLAYER.WALK_SPEED * 4;
      player.body.setMaxVelocity(PLAYER.WALK_SPEED, PLAYER.WALK_SPEED);
      player.body.setAcceleration(dir.x * walkAccel, dir.y * walkAccel);
      player.constrainToField();
    }
  }

  isSetupComplete(allPlayers) {
    for (const player of allPlayers) {
      const dist = distanceBetween(
        { x: player.x, y: player.y },
        { x: player.setupTargetX, y: player.setupTargetY }
      );
      if (dist > AI.SETUP_ARRIVE_THRESHOLD) return false;
    }
    return true;
  }

  restoreMaxSpeed(players) {
    for (const player of players) {
      player.body.setMaxVelocity(PLAYER.MAX_SPEED, PLAYER.MAX_SPEED);
    }
  }

  // ------------------------------------------------------------------
  //  LIVE PLAY — offense
  // ------------------------------------------------------------------

  updateOffenseAI(players, handler, disc, delta) {
    for (const player of players) {
      if (player.isControlled || player.hasDisc) continue;

      if (!this.decisionTimers[player.id]) {
        this.decisionTimers[player.id] = 0;
      }
      this.decisionTimers[player.id] += delta;

      const interval = player.fsmState === 'cutting'
        ? AI.CUT_DECISION_INTERVAL
        : AI.DECISION_INTERVAL;

      if (this.decisionTimers[player.id] > interval) {
        this.decisionTimers[player.id] = 0;
        this.decideOffenseTarget(player, handler, players);
      }

      const speed = player.fsmState === 'cutting'
        ? AI.CUT_SPRINT_FACTOR
        : AI.CUT_SPEED_FACTOR;
      this.moveTowardTarget(player, delta, speed);
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

      this.moveTowardTarget(defender, delta, AI.CUT_SPEED_FACTOR);

      if (disc && disc.state === DISC_STATES.THROWN) {
        this.tryIntercept(defender, disc, delta);
      }
    }
  }

  // ------------------------------------------------------------------
  //  FSM-aware target selection
  // ------------------------------------------------------------------

  decideOffenseTarget(player, handler, teammates) {
    if (player.fsmState === 'cutting') {
      this.decideCutTarget(player, handler, teammates);
      return;
    }

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
    }

    targetX = Math.max(FIELD_BOUNDS.LEFT + 20, Math.min(FIELD_BOUNDS.RIGHT - 20, targetX));
    targetY = Math.max(FIELD_BOUNDS.TOP + 20, Math.min(FIELD_BOUNDS.BOTTOM - 20, targetY));

    this.targetPositions[player.id] = { x: targetX, y: targetY };
  }

  decideCutTarget(player, handler, teammates) {
    const fieldCenterY = FIELD.OFFSET_Y + FIELD.HEIGHT / 2;

    let bestX = 0;
    let bestY = 0;
    let bestScore = -Infinity;

    const allDefenders = this.scene.getDefenseTeam
      ? this.scene.getDefenseTeam().players
      : [];

    for (let attempt = 0; attempt < 5; attempt++) {
      let candX, candY;

      if (handler) {
        const upfield = randomInRange(60, 220);
        const lateral = randomInRange(-160, 160);
        candX = handler.x + upfield * (Math.random() > 0.5 ? 1 : -1);
        candY = handler.y + lateral;
      } else {
        candX = FIELD.OFFSET_X + randomInRange(FIELD.ENDZONE_WIDTH + 20, FIELD.WIDTH - FIELD.ENDZONE_WIDTH - 20);
        candY = FIELD.OFFSET_Y + randomInRange(30, FIELD.HEIGHT - 30);
      }

      candX = Math.max(FIELD_BOUNDS.LEFT + 20, Math.min(FIELD_BOUNDS.RIGHT - 20, candX));
      candY = Math.max(FIELD_BOUNDS.TOP + 20, Math.min(FIELD_BOUNDS.BOTTOM - 20, candY));

      let minDefDist = Infinity;
      for (const def of allDefenders) {
        const dd = distanceBetween({ x: candX, y: candY }, { x: def.x, y: def.y });
        if (dd < minDefDist) minDefDist = dd;
      }

      let minMateDist = Infinity;
      for (const mate of teammates) {
        if (mate.id === player.id) continue;
        const md = distanceBetween({ x: candX, y: candY }, { x: mate.x, y: mate.y });
        if (md < minMateDist) minMateDist = md;
      }

      const spacingBonus = minMateDist > AI.SPACING_DISTANCE ? 30 : -20;
      const score = minDefDist + spacingBonus;

      if (score > bestScore) {
        bestScore = score;
        bestX = candX;
        bestY = candY;
      }
    }

    this.targetPositions[player.id] = { x: bestX, y: bestY };
  }

  decideDefenseTarget(defender, offensePlayers, handler, disc, index) {
    if (defender.fsmState === 'marking' && defender.assignedMatchup) {
      const matchup = defender.assignedMatchup;
      const offset = 10;
      this.targetPositions[defender.id] = {
        x: matchup.x + randomInRange(-offset, offset),
        y: matchup.y + randomInRange(-offset, offset),
      };
      return;
    }

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

  // ------------------------------------------------------------------
  //  Matchup assignment
  // ------------------------------------------------------------------

  assignMatchups(defenders, offensePlayers) {
    const available = [...offensePlayers];

    for (const def of defenders) {
      let closest = null;
      let minDist = Infinity;

      for (const off of available) {
        const d = distanceBetween({ x: def.x, y: def.y }, { x: off.x, y: off.y });
        if (d < minDist) {
          minDist = d;
          closest = off;
        }
      }

      def.assignedMatchup = closest;
      def.fsmState = 'marking';

      if (closest) {
        const idx = available.indexOf(closest);
        if (idx !== -1) available.splice(idx, 1);
      }
    }
  }

  // ------------------------------------------------------------------
  //  Movement helpers (unchanged signatures)
  // ------------------------------------------------------------------

  tryIntercept(defender, disc, delta) {
    const dist = distanceBetween(
      { x: defender.x, y: defender.y },
      { x: disc.x, y: disc.y }
    );

    if (dist < AI.INTERCEPT_RADIUS * 2) {
      this.targetPositions[defender.id] = { x: disc.x, y: disc.y };
    }
  }

  moveTowardTarget(player, delta, speedFactor = AI.CUT_SPEED_FACTOR) {
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
    const accel = PLAYER.ACCELERATION * speedFactor;
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
