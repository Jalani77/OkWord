import Phaser from 'phaser';
import Field from '../entities/Field.js';
import Team from '../entities/Team.js';
import Disc from '../entities/Disc.js';
import GameStateManager from '../managers/GameStateManager.js';
import PossessionManager from '../managers/PossessionManager.js';
import StallManager from '../managers/StallManager.js';
import ScoreManager from '../managers/ScoreManager.js';
import InputController from '../systems/InputController.js';
import DiscPhysicsEngine from '../systems/DiscPhysicsEngine.js';
import CollisionSystem from '../systems/CollisionSystem.js';
import AIController from '../systems/AIController.js';
import {
  GAME_WIDTH, GAME_HEIGHT, GAME_STATES, DISC_STATES,
  TEAMS, FIELD_BOUNDS, FIELD, PLAYER, PULL, STALL
} from '../utils/Constants.js';
import { distanceBetween, angleBetween } from '../utils/MathHelpers.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a1628');

    this.field = new Field(this);

    this.gsm = new GameStateManager();
    this.possession = new PossessionManager();
    this.stallManager = new StallManager();
    this.scoreManager = new ScoreManager();

    this.teamA = new Team(this, TEAMS.A, true);
    this.teamB = new Team(this, TEAMS.B, false);
    this.teamA.createPlayers(7);
    this.teamB.createPlayers(7);

    this.disc = new Disc(this);
    this.discPhysics = new DiscPhysicsEngine(this.disc);

    this.collision = new CollisionSystem(this);
    this.ai = new AIController(this);
    this.input_ = new InputController(this);

    this.controlledPlayer = null;
    this.throwingTeamId = null;
    this.pullAimAngle = 0;
    this.pullPower = PULL.MIN_POWER;
    this.pullCharging = false;

    this.aimGraphics = this.add.graphics();
    this.aimGraphics.setDepth(15);

    this.effectsGraphics = this.add.graphics();
    this.effectsGraphics.setDepth(18);
    this.particles = [];

    this.setupUI();
    this.setupCallbacks();
    this.setupStateListeners();

    this.gsm.setState(GAME_STATES.KICKOFF_PULL);
  }

  setupUI() {
    this.scoreText = this.add.text(GAME_WIDTH / 2, 15, '', {
      fontSize: '20px', fill: '#ffffff', fontFamily: 'Arial Black, Arial',
    }).setOrigin(0.5).setDepth(20);

    this.stateText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, '', {
      fontSize: '13px', fill: '#aaaacc', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(20);

    this.stallText = this.add.text(0, 0, '', {
      fontSize: '16px', fill: '#ff4444', fontFamily: 'Arial Black, Arial',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(20).setVisible(false);

    this.possessionIndicator = this.add.text(GAME_WIDTH / 2, 38, '', {
      fontSize: '12px', fill: '#88aaff', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(20);

    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontSize: '32px', fill: '#ffff00', fontFamily: 'Arial Black, Arial',
      stroke: '#000000', strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setVisible(false);

    this.pullAimGraphics = this.add.graphics();
    this.pullAimGraphics.setDepth(15);
  }

  setupCallbacks() {
    this.input_.onThrowStartCallback(() => this.onThrowStart());
    this.input_.onThrowReleaseCallback(() => this.onThrowRelease());
    this.input_.onCallPassCallback(() => this.onCallPass());
    this.input_.onSwitchPlayerCallback(() => this.switchControlledPlayer());

    this.collision.onCatch = (player) => this.handleCatch(player);
    this.collision.onInterception = (player) => this.handleInterception(player);

    this.stallManager.onStallOut = () => this.handleTurnover('STALL');
  }

  setupStateListeners() {
    this.gsm.on(GAME_STATES.KICKOFF_PULL, () => this.enterPull());
    this.gsm.on(GAME_STATES.LIVE_PLAY, () => this.enterLivePlay());
    this.gsm.on(GAME_STATES.TURNOVER, () => this.enterTurnover());
    this.gsm.on(GAME_STATES.SCORE, () => this.enterScore());
    this.gsm.on(GAME_STATES.RESET_AFTER_SCORE, () => this.enterResetAfterScore());
    this.gsm.on(GAME_STATES.GAME_OVER, () => this.enterGameOver());
  }

  // --- State Transitions ---

  enterPull() {
    this.stallManager.reset();
    this.ai.resetTimers();

    const defTeam = this.getDefenseTeam();
    const offTeam = this.getOffenseTeam();

    defTeam.resetForPull();
    offTeam.resetForPull();

    const puller = defTeam.players[0];
    this.disc.attachToPlayer(puller);
    this.throwingTeamId = defTeam.id;

    this.controlledPlayer = puller;
    this.setAllControlled(false);
    puller.setControlled(true);
    puller.startPivot();

    this.pullAimAngle = defTeam.attackingRight ? Math.PI : 0;
    this.pullPower = (PULL.MIN_POWER + PULL.MAX_POWER) / 2;
    this.pullCharging = false;
  }

  enterLivePlay() {
    this.showMessage('');
  }

  enterTurnover() {
    this.possession.turnover();
    this.getTeamA().swapOffense();
    this.getTeamB().swapOffense();

    const newOffTeam = this.getOffenseTeam();
    const closestPlayer = this.findClosestPlayerToDisc(newOffTeam);

    if (closestPlayer) {
      this.giveDiscToPlayer(closestPlayer);
      this.setControlledPlayerForTeam(newOffTeam);
    }

    this.stallManager.reset();
    this.ai.resetTimers();

    this.time.delayedCall(500, () => {
      if (this.gsm.is(GAME_STATES.TURNOVER)) {
        this.gsm.setState(GAME_STATES.LIVE_PLAY);
      }
    });
  }

  enterScore() {
    const teamId = this.possession.getOffenseTeamId();
    this.scoreManager.addPoint(teamId);

    const teamName = teamId === TEAMS.A ? 'BLUE' : 'RED';
    this.showMessage(`${teamName} SCORES!`, 2000);

    this.time.delayedCall(2000, () => {
      if (this.scoreManager.isGameOver()) {
        this.gsm.setState(GAME_STATES.GAME_OVER);
      } else {
        this.gsm.setState(GAME_STATES.RESET_AFTER_SCORE);
      }
    });
  }

  enterResetAfterScore() {
    this.possession.turnover();
    this.getTeamA().swapOffense();
    this.getTeamB().swapOffense();
    this.getTeamA().swapDirection();
    this.getTeamB().swapDirection();

    this.stallManager.reset();
    this.ai.resetTimers();

    this.time.delayedCall(500, () => {
      this.gsm.setState(GAME_STATES.KICKOFF_PULL);
    });
  }

  enterGameOver() {
    const winner = this.scoreManager.getWinner();
    const name = winner === TEAMS.A ? 'BLUE' : 'RED';
    const scores = this.scoreManager.getScores();
    this.showMessage(`${name} WINS!\n${scores.A} - ${scores.B}\n\nClick to Restart`, 0);

    this.input.once('pointerdown', () => {
      this.scoreManager.reset();
      this.possession.setOffense(TEAMS.A);
      this.getTeamA().isOffense = true;
      this.getTeamB().isOffense = false;
      this.getTeamA().attackingRight = true;
      this.getTeamB().attackingRight = false;
      this.gsm.setState(GAME_STATES.KICKOFF_PULL);
    });
  }

  // --- Input Handlers ---

  onThrowStart() {
    const state = this.gsm.getState();

    if (state === GAME_STATES.KICKOFF_PULL) {
      this.pullCharging = true;
      this.pullPower = PULL.MIN_POWER;
      return;
    }

    if (state !== GAME_STATES.LIVE_PLAY) return;

    if (this.controlledPlayer && this.controlledPlayer.hasDisc) {
      this.disc.startCharge();
    }
  }

  onThrowRelease() {
    const state = this.gsm.getState();

    if (state === GAME_STATES.KICKOFF_PULL) {
      this.executePull();
      return;
    }

    if (state !== GAME_STATES.LIVE_PLAY) return;

    if (this.controlledPlayer && this.controlledPlayer.hasDisc && this.disc.isCharging) {
      const pointer = this.input_.getPointerPosition();
      const angle = angleBetween(
        { x: this.controlledPlayer.x, y: this.controlledPlayer.y },
        { x: pointer.x, y: pointer.y }
      );
      const power = this.disc.getChargePower();

      this.throwingTeamId = this.controlledPlayer.teamId;
      this.spawnThrowEffect(this.controlledPlayer.x, this.controlledPlayer.y, angle);
      this.controlledPlayer.releaseDisc();
      this.disc.throwDisc(angle, power);
      this.stallManager.reset();

      this.switchToClosestNonHandler();
    }
  }

  executePull() {
    if (!this.pullCharging) return;
    this.pullCharging = false;

    const puller = this.controlledPlayer;
    if (!puller) return;

    this.throwingTeamId = puller.teamId;
    puller.releaseDisc();
    this.disc.throwDisc(this.pullAimAngle, this.pullPower);

    const offTeam = this.getOffenseTeam();
    this.setControlledPlayerForTeam(offTeam);

    this.gsm.setState(GAME_STATES.LIVE_PLAY);
  }

  onCallPass() {
    if (!this.gsm.is(GAME_STATES.LIVE_PLAY)) return;

    const offTeam = this.getOffenseTeam();
    const handler = offTeam.players.find(p => p.hasDisc);
    if (!handler || handler.isControlled) return;

    const target = this.ai.chooseThrowTarget(handler, offTeam.players, this.getDefenseTeam().players);
    if (!target) return;

    const angle = angleBetween(
      { x: handler.x, y: handler.y },
      { x: target.x, y: target.y }
    );
    const dist = distanceBetween(
      { x: handler.x, y: handler.y },
      { x: target.x, y: target.y }
    );
    const power = Math.min(dist * 1.5, 450);

    this.throwingTeamId = handler.teamId;
    handler.releaseDisc();
    this.disc.throwDisc(angle, power);
    this.stallManager.reset();
  }

  switchControlledPlayer() {
    const offTeam = this.getOffenseTeam();
    const players = offTeam.players.filter(p => !p.hasDisc);
    if (players.length === 0) return;

    const currentIdx = players.findIndex(p => p.isControlled);
    const nextIdx = (currentIdx + 1) % players.length;

    this.setAllControlled(false);
    const handler = offTeam.players.find(p => p.hasDisc);
    if (handler) handler.setControlled(false);

    this.controlledPlayer = players[nextIdx];
    this.controlledPlayer.setControlled(true);
  }

  switchToClosestNonHandler() {
    const offTeam = this.getOffenseTeam();
    const nonHandlers = offTeam.players.filter(p => !p.hasDisc);
    if (nonHandlers.length === 0) return;

    const pointer = this.input_.getPointerPosition();
    let closest = nonHandlers[0];
    let minDist = Infinity;

    for (const p of nonHandlers) {
      const d = distanceBetween({ x: p.x, y: p.y }, pointer);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }

    this.setAllControlled(false);
    this.controlledPlayer = closest;
    closest.setControlled(true);
  }

  // --- Catch / Turnover ---

  handleCatch(player) {
    const offTeam = this.getOffenseTeam();
    this.spawnCatchEffect(player.x, player.y);

    if (offTeam.id === player.teamId) {
      if (this.field.isInEndZone(player.x, player.y, offTeam.getTargetEndZone())) {
        this.giveDiscToPlayer(player);
        this.spawnScoreEffect(player.x, player.y);
        this.gsm.setState(GAME_STATES.SCORE);
        return;
      }

      this.giveDiscToPlayer(player);

      if (!player.isControlled) {
        this.setAllControlled(false);
        this.controlledPlayer = player;
        player.setControlled(true);
      }
    } else {
      this.handleInterception(player);
    }
  }

  handleInterception(player) {
    this.giveDiscToPlayer(player);
    this.handleTurnover('INTERCEPTION');
  }

  handleTurnover(reason) {
    this.disc.state = DISC_STATES.HELD;
    this.showMessage(reason === 'STALL' ? 'STALL OUT!' : 'TURNOVER!', 1200);
    this.gsm.setState(GAME_STATES.TURNOVER);
  }

  // --- Helpers ---

  giveDiscToPlayer(player) {
    this.getAllPlayers().forEach(p => {
      if (p.hasDisc) p.releaseDisc();
    });

    player.catchDisc();
    this.disc.attachToPlayer(player);
    this.possession.setHandler(player.id);
  }

  findClosestPlayerToDisc(team) {
    let closest = null;
    let minDist = Infinity;

    for (const p of team.players) {
      const d = distanceBetween(
        { x: p.x, y: p.y },
        { x: this.disc.x, y: this.disc.y }
      );
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    return closest;
  }

  setControlledPlayerForTeam(team) {
    this.setAllControlled(false);
    const handler = team.players.find(p => p.hasDisc);
    if (handler) {
      this.controlledPlayer = handler;
      handler.setControlled(true);
    } else {
      this.controlledPlayer = team.players[0];
      team.players[0].setControlled(true);
    }
  }

  setAllControlled(val) {
    this.getAllPlayers().forEach(p => p.setControlled(val));
  }

  getOffenseTeam() {
    return this.possession.isOffense(TEAMS.A) ? this.teamA : this.teamB;
  }

  getDefenseTeam() {
    return this.possession.isOffense(TEAMS.A) ? this.teamB : this.teamA;
  }

  getTeamA() { return this.teamA; }
  getTeamB() { return this.teamB; }

  getAllPlayers() {
    return [...this.teamA.players, ...this.teamB.players];
  }

  showMessage(text, duration = 0) {
    this.messageText.setText(text);
    this.messageText.setVisible(!!text);

    if (text) {
      this.messageText.setScale(0.5);
      this.messageText.setAlpha(0);
      this.tweens.add({
        targets: this.messageText,
        scaleX: 1, scaleY: 1, alpha: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }

    if (duration > 0 && text) {
      this.time.delayedCall(duration, () => {
        this.tweens.add({
          targets: this.messageText,
          alpha: 0,
          duration: 200,
          onComplete: () => this.messageText.setVisible(false),
        });
      });
    }
  }

  spawnCatchEffect(x, y) {
    const ring = this.add.circle(x, y, PLAYER.CATCH_RADIUS, 0x00ff88, 0).setDepth(16);
    ring.setStrokeStyle(2, 0x00ff88, 1);
    this.tweens.add({
      targets: ring,
      scaleX: 2, scaleY: 2, alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  spawnScoreEffect(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 80 + Math.random() * 120;
      const color = [0xffff00, 0xff8800, 0x00ff88, 0xffffff][i % 4];
      const size = 3 + Math.random() * 3;

      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size, color, life: 1.0, decay: 0.8 + Math.random() * 0.5,
      });
    }

    this.cameras.main.shake(200, 0.005);
  }

  spawnThrowEffect(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const a = angle + Math.PI + spread;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        size: 2 + Math.random() * 2, color: 0xaaddff, life: 1.0, decay: 2.5,
      });
    }
  }

  updateParticles(delta) {
    const dt = delta / 1000;
    this.effectsGraphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.effectsGraphics.fillStyle(p.color, p.life);
      this.effectsGraphics.fillCircle(p.x, p.y, p.size * p.life);
    }
  }

  // --- Update Loop ---

  update(time, delta) {
    const state = this.gsm.getState();

    this.updateUI();
    this.updateParticles(delta);

    if (state === GAME_STATES.KICKOFF_PULL) {
      this.updatePull(delta);
      return;
    }

    if (state === GAME_STATES.SCORE || state === GAME_STATES.GAME_OVER ||
        state === GAME_STATES.RESET_AFTER_SCORE) {
      this.drawPlayers();
      return;
    }

    if (state === GAME_STATES.LIVE_PLAY || state === GAME_STATES.TURNOVER) {
      this.updateLivePlay(delta);
    }
  }

  updatePull(delta) {
    const pointer = this.input_.getPointerPosition();

    if (this.controlledPlayer) {
      this.pullAimAngle = angleBetween(
        { x: this.controlledPlayer.x, y: this.controlledPlayer.y },
        { x: pointer.x, y: pointer.y }
      );

      if (this.pullCharging) {
        this.pullPower = Math.min(this.pullPower + PULL.AIM_SPEED * delta * 0.3, PULL.MAX_POWER);
      }
    }

    this.drawPullAim();
    this.drawPlayers();

    if (this.controlledPlayer && this.disc.state === DISC_STATES.HELD) {
      this.disc.setPosition(this.controlledPlayer.x, this.controlledPlayer.y);
    }
  }

  drawPullAim() {
    this.pullAimGraphics.clear();
    if (!this.controlledPlayer) return;

    const px = this.controlledPlayer.x;
    const py = this.controlledPlayer.y;
    const len = 60 + (this.pullPower / PULL.MAX_POWER) * 60;

    this.pullAimGraphics.lineStyle(2, 0xffff00, 0.8);
    this.pullAimGraphics.beginPath();
    this.pullAimGraphics.moveTo(px, py);
    this.pullAimGraphics.lineTo(
      px + Math.cos(this.pullAimAngle) * len,
      py + Math.sin(this.pullAimAngle) * len
    );
    this.pullAimGraphics.strokePath();

    if (this.pullCharging) {
      const ratio = (this.pullPower - PULL.MIN_POWER) / (PULL.MAX_POWER - PULL.MIN_POWER);
      const barW = 40;
      const barH = 5;
      const bx = px - barW / 2;
      const by = py - 30;
      this.pullAimGraphics.fillStyle(0x333333, 0.8);
      this.pullAimGraphics.fillRect(bx, by, barW, barH);
      const c = ratio < 0.5 ? 0x00ff00 : ratio < 0.8 ? 0xffff00 : 0xff0000;
      this.pullAimGraphics.fillStyle(c, 1);
      this.pullAimGraphics.fillRect(bx, by, barW * ratio, barH);
    }
  }

  updateLivePlay(delta) {
    // Move controlled player
    if (this.controlledPlayer && !this.controlledPlayer.isPivoting) {
      this.controlledPlayer.moveWithInput(this.input_.cursors, this.input_.wasd);
    }

    if (this.controlledPlayer && this.controlledPlayer.isPivoting) {
      const pointer = this.input_.getPointerPosition();
      this.controlledPlayer.updatePivotAngle(pointer.x, pointer.y);
    }

    // Update disc charge
    if (this.disc.isCharging) {
      this.disc.updateCharge(delta);
    }

    // Update disc physics
    this.discPhysics.update(delta);
    this.disc.drawTrail();

    // Disc on ground = turnover
    if (this.disc.state === DISC_STATES.GROUND) {
      this.handleTurnover('DROP');
      return;
    }

    // Check disc-player collisions
    const offTeam = this.getOffenseTeam();
    const defTeam = this.getDefenseTeam();
    this.collision.checkDiscPlayerCollisions(
      this.disc, offTeam.players, defTeam.players, this.throwingTeamId
    );

    // Keep disc on handler
    if (this.disc.state === DISC_STATES.HELD) {
      const handler = this.getAllPlayers().find(p => p.hasDisc);
      if (handler) {
        this.disc.setPosition(handler.x, handler.y);
      }
    }

    // Stall count
    if (this.disc.state === DISC_STATES.HELD) {
      const handler = offTeam.players.find(p => p.hasDisc);
      if (handler) {
        const isMarked = this.collision.checkDefenderMark(handler, defTeam.players);
        if (isMarked && !this.stallManager.isActive()) {
          this.stallManager.start();
        } else if (!isMarked && this.stallManager.isActive()) {
          this.stallManager.reset();
        }
        if (this.stallManager.isActive()) {
          this.stallManager.update(delta);
        }
      }
    }

    // AI
    const offHandler = offTeam.players.find(p => p.hasDisc);
    this.ai.updateOffenseAI(offTeam.players, offHandler, this.disc, delta);
    this.ai.updateDefenseAI(defTeam.players, offTeam.players, offHandler, this.disc, delta);

    // AI handler auto-throw under pressure
    if (offHandler && !offHandler.isControlled && offHandler.hasDisc && this.stallManager.getCount() >= 7) {
      const target = this.ai.chooseThrowTarget(offHandler, offTeam.players, defTeam.players);
      if (target) {
        const angle = angleBetween(
          { x: offHandler.x, y: offHandler.y },
          { x: target.x, y: target.y }
        );
        const dist = distanceBetween(
          { x: offHandler.x, y: offHandler.y },
          { x: target.x, y: target.y }
        );
        const power = Math.min(dist * 1.2, 400);
        this.throwingTeamId = offHandler.teamId;
        offHandler.releaseDisc();
        this.disc.throwDisc(angle, power);
        this.stallManager.reset();
      }
    }

    // Draw
    this.drawPlayers();
    this.drawAim();
    this.drawStallCounter();
    this.drawPowerMeter();
  }

  drawPlayers() {
    this.getAllPlayers().forEach(p => p.drawOutline());
  }

  drawAim() {
    this.aimGraphics.clear();
    if (!this.controlledPlayer || !this.controlledPlayer.hasDisc) return;

    const pointer = this.input_.getPointerPosition();
    const px = this.controlledPlayer.x;
    const py = this.controlledPlayer.y;
    const angle = angleBetween({ x: px, y: py }, { x: pointer.x, y: pointer.y });
    const len = 50;

    this.aimGraphics.lineStyle(1, 0xffffff, 0.4);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const dotX = px + Math.cos(angle) * len * t;
      const dotY = py + Math.sin(angle) * len * t;
      this.aimGraphics.fillStyle(0xffffff, 0.5 - t * 0.3);
      this.aimGraphics.fillCircle(dotX, dotY, 2);
    }
  }

  drawStallCounter() {
    if (this.stallManager.isActive()) {
      const handler = this.getOffenseTeam().players.find(p => p.hasDisc);
      if (handler) {
        this.stallText.setVisible(true);
        this.stallText.setPosition(handler.x + 20, handler.y - 25);
        this.stallText.setText(`STALL: ${this.stallManager.getCount()}`);
      }
    } else {
      this.stallText.setVisible(false);
    }
  }

  drawPowerMeter() {
    if (this.controlledPlayer && this.controlledPlayer.hasDisc) {
      this.disc.drawPowerMeter(this.controlledPlayer.x, this.controlledPlayer.y);
    } else {
      this.disc.powerGraphics.clear();
    }
  }

  updateUI() {
    const scores = this.scoreManager.getScores();
    this.scoreText.setText(`BLUE ${scores.A}  -  ${scores.B} RED`);

    const state = this.gsm.getState();
    const stateLabels = {
      [GAME_STATES.KICKOFF_PULL]: 'PULL — Aim and click to throw',
      [GAME_STATES.LIVE_PLAY]: 'LIVE PLAY',
      [GAME_STATES.TURNOVER]: 'TURNOVER',
      [GAME_STATES.SCORE]: 'SCORE!',
      [GAME_STATES.GAME_OVER]: 'GAME OVER',
      [GAME_STATES.RESET_AFTER_SCORE]: 'Resetting...',
    };
    this.stateText.setText(stateLabels[state] || '');

    const offId = this.possession.getOffenseTeamId();
    const offName = offId === TEAMS.A ? 'BLUE' : 'RED';
    this.possessionIndicator.setText(`Offense: ${offName}`);

    this.pullAimGraphics.clear();
  }
}
