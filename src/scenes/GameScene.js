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
import CameraManager from '../systems/CameraManager.js';
import {
  GAME_WIDTH, GAME_HEIGHT, GAME_STATES, DISC_STATES,
  TEAMS, FIELD_BOUNDS, FIELD, PLAYER, PULL, DISC, AI
} from '../utils/Constants.js';
import { distanceBetween, angleBetween, clamp } from '../utils/MathHelpers.js';

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

    this.dragLineGraphics = this.add.graphics();
    this.dragLineGraphics.setDepth(15);

    this.effectsGraphics = this.add.graphics();
    this.effectsGraphics.setDepth(18);
    this.particles = [];

    this.setupUI();
    this.setupCallbacks();
    this.setupCollisionOverlap();
    this.setupStateListeners();

    this.setupDomHud();

    this.cameraMgr = new CameraManager(this);
    this.cameraMgr.pinToScreen(
      this.scoreText, this.stateText,
      this.possessionIndicator, this.messageText
    );

    this._setupNextState = GAME_STATES.KICKOFF_PULL;
    this.gsm.setState(GAME_STATES.SETUP);
  }

  /**
   * Binds to the DOM HUD overlay elements defined in index.html and hides
   * the old Phaser text objects.  Everything below is additive — no existing
   * rendering or state code is modified.
   */
  setupDomHud() {
    const container = document.getElementById('game-container');
    if (!container) return;

    this.domHud = container.querySelector('#game-hud');
    if (!this.domHud) return;

    this.domHud.style.display = '';

    this._domScoreA = this.domHud.querySelector('#hud-score-a');
    this._domScoreB = this.domHud.querySelector('#hud-score-b');
    this._domPoss   = this.domHud.querySelector('#hud-possession');
    this._domState   = this.domHud.querySelector('#hud-state');
    this._domMsg     = this.domHud.querySelector('#hud-message');
    this._domStall   = this.domHud.querySelector('#hud-stall');

    this._prevScoreA = -1;
    this._prevScoreB = -1;
    this._domMsgTimer = null;

    this.scoreText.setAlpha(0);
    this.stateText.setAlpha(0);
    this.possessionIndicator.setAlpha(0);
    this.messageText.setAlpha(0);

    this.stallText.setStyle({
      fontFamily: "'Inter', system-ui, sans-serif",
      fontStyle: 'bold',
      fontSize: '12px',
    });
  }

  updateCameraFollow() {
    if (this.cameraMgr) {
      this.cameraMgr.update(this.disc, this.controlledPlayer);
    }
  }

  enterSetup() {
    this.stallManager.reset();
    this.ai.resetTimers();

    const offTeam = this.getOffenseTeam();
    const defTeam = this.getDefenseTeam();
    const forPull = this._setupNextState === GAME_STATES.KICKOFF_PULL;

    offTeam.assignSetupTargets(forPull);
    defTeam.assignSetupTargets(forPull);

    if (!this.controlledPlayer) {
      this.setControlledPlayerForTeam(offTeam);
    }
  }

  updateSetup(delta) {
    const allPlayers = this.getAllPlayers();
    this.ai.updateSetupMovement(allPlayers, delta);

    if (this.controlledPlayer) {
      const tx = this.controlledPlayer.setupTargetX;
      const ty = this.controlledPlayer.setupTargetY;
      const dist = distanceBetween(
        { x: this.controlledPlayer.x, y: this.controlledPlayer.y },
        { x: tx, y: ty }
      );
      if (dist > 8) {
        const dir = { x: tx - this.controlledPlayer.x, y: ty - this.controlledPlayer.y };
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const walkAccel = PLAYER.WALK_SPEED * 4;
        this.controlledPlayer.body.setMaxVelocity(PLAYER.WALK_SPEED, PLAYER.WALK_SPEED);
        this.controlledPlayer.body.setAcceleration(
          (dir.x / mag) * walkAccel,
          (dir.y / mag) * walkAccel
        );
        this.controlledPlayer.constrainToField();
      } else {
        this.controlledPlayer.body.setVelocity(0, 0);
        this.controlledPlayer.body.setAcceleration(0, 0);
      }
    }

    if (this.disc.state === DISC_STATES.HELD) {
      const handler = this.getAllPlayers().find(p => p.hasDisc);
      if (handler) this.disc.setPosition(handler.x, handler.y);
    }

    this.drawPlayers();

    if (this.ai.isSetupComplete(allPlayers)) {
      this.ai.restoreMaxSpeed(allPlayers);
      this.gsm.setState(this._setupNextState);
    }
  }

  /**
   * Registers Phaser physics overlap between the disc and all player sprites.
   * This replaces the manual per-frame distance loop that was in updateLivePlay.
   */
  setupCollisionOverlap() {
    this.collision.setupPhysicsOverlap(
      this.disc,
      this.getAllPlayers(),
      () => this.throwingTeamId
    );
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
    this.gsm.on(GAME_STATES.SETUP, () => this.enterSetup());
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

    const offTeam = this.getOffenseTeam();
    const defTeam = this.getDefenseTeam();

    offTeam.players.forEach(p => {
      p.fsmState = p.hasDisc ? 'handler' : 'cutting';
    });

    this.ai.assignMatchups(defTeam.players, offTeam.players);
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

    this.time.delayedCall(1200, () => {
      if (!this.gsm.is(GAME_STATES.TURNOVER)) return;
      this.tweenPlayersToReset(() => {
        this.time.delayedCall(AI.TURNOVER_DELAY_MS, () => {
          if (this.gsm.is(GAME_STATES.TURNOVER)) {
            this.gsm.setState(GAME_STATES.LIVE_PLAY);
          }
        });
      });
    });
  }

  tweenPlayersToReset(onComplete) {
    const offTeam = this.getOffenseTeam();
    const defTeam = this.getDefenseTeam();

    offTeam.assignSetupTargets(false);
    defTeam.assignSetupTargets(false);

    const allPlayers = this.getAllPlayers();
    let completed = 0;
    const total = allPlayers.length;

    for (const player of allPlayers) {
      player.fsmState = 'idle';
      player.tweenToPosition(
        player.setupTargetX,
        player.setupTargetY,
        AI.TURNOVER_TWEEN_MS,
        () => {
          completed++;
          if (completed >= total && onComplete) onComplete();
        }
      );
    }
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
      this._setupNextState = GAME_STATES.KICKOFF_PULL;
      this.gsm.setState(GAME_STATES.SETUP);
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

    if (!this.controlledPlayer || !this.controlledPlayer.hasDisc) return;

    const drag = this.input_.getDragVector();

    if (drag.magnitude >= DISC.DRAG_THROW_DEADZONE) {
      this.executeThrow(drag.angle, drag.power);
    } else if (this.disc.isCharging) {
      const pointer = this.input_.getPointerPosition();
      const angle = angleBetween(
        { x: this.controlledPlayer.x, y: this.controlledPlayer.y },
        { x: pointer.x, y: pointer.y }
      );
      const power = this.disc.getChargePower();
      this.executeThrow(angle, power);
    }
  }

  executeThrow(angle, power) {
    if (!this.controlledPlayer || !this.controlledPlayer.hasDisc) return;

    this.throwingTeamId = this.controlledPlayer.teamId;
    this.spawnThrowEffect(this.controlledPlayer.x, this.controlledPlayer.y, angle);
    this.controlledPlayer.releaseDisc();
    this.disc.throwDisc(angle, power);
    this.disc.isCharging = false;
    this.disc.chargePower = 0;
    this.stallManager.reset();

    this.switchToClosestNonHandler();
  }

  executePull() {
    if (!this.pullCharging) return;
    this.pullCharging = false;

    const puller = this.controlledPlayer;
    if (!puller) return;

    puller.releaseDisc();
    this.disc.throwDisc(this.pullAimAngle, this.pullPower);

    const offTeam = this.getOffenseTeam();
    this.throwingTeamId = offTeam.id;
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
    this.spawnThrowEffect(handler.x, handler.y, angle);
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
    if (this.disc.state !== DISC_STATES.THROWN) return;

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
    if (this.disc.state !== DISC_STATES.THROWN) return;
    this.spawnCatchEffect(player.x, player.y);
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
      if (p.hasDisc) {
        p.releaseDisc();
        if (p.teamId === player.teamId) p.fsmState = 'cutting';
      }
    });

    player.catchDisc();
    player.fsmState = 'handler';
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

    if (this._domMsg) this._updateDomMessage(text, duration);
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

  processAdvancedAI(delta) {
    const state = this.gsm.getState();
    if (state !== GAME_STATES.LIVE_PLAY && state !== GAME_STATES.KICKOFF_PULL &&
        state !== GAME_STATES.SETUP) return;

    const allPlayers = this.getAllPlayers();
    for (const p of allPlayers) {
      if (p.isPivoting) continue;
      const limit = p.fsmState === 'idle' ? PLAYER.WALK_SPEED : PLAYER.MAX_SPEED;
      p.clampVelocity(limit);
    }
  }

  // --- Update Loop ---

  update(time, delta) {
    const state = this.gsm.getState();

    this.updateUI();
    this.updateParticles(delta);
    this.updateCameraFollow();

    if (state === GAME_STATES.SETUP) {
      this.updateSetup(delta);
      return;
    }

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

    this.processAdvancedAI(delta);
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
    if (this.controlledPlayer && !this.controlledPlayer.isPivoting) {
      this.controlledPlayer.moveWithInput(this.input_.cursors, this.input_.wasd);
    }

    if (this.controlledPlayer && this.controlledPlayer.isPivoting) {
      const pointer = this.input_.getPointerPosition();
      this.controlledPlayer.updatePivotAngle(pointer.x, pointer.y);
    }

    if (this.disc.isCharging) {
      this.disc.updateCharge(delta);
    }

    this.discPhysics.update(delta);
    this.disc.drawTrail();

    // Disc on ground = turnover (physics overlap won't fire for grounded disc)
    if (this.disc.state === DISC_STATES.GROUND) {
      this.handleTurnover('DROP');
      return;
    }

    // Overlap is handled by physics.add.overlap registered in setupCollisionOverlap.
    // No manual collision loop needed here.

    if (this.disc.state === DISC_STATES.HELD) {
      const handler = this.getAllPlayers().find(p => p.hasDisc);
      if (handler) {
        this.disc.setPosition(handler.x, handler.y);
      }
    }

    // Stall count
    if (this.disc.state === DISC_STATES.HELD) {
      const offTeam = this.getOffenseTeam();
      const defTeam = this.getDefenseTeam();
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

    const offTeam = this.getOffenseTeam();
    const defTeam = this.getDefenseTeam();
    const offHandler = offTeam.players.find(p => p.hasDisc);
    this.ai.updateOffenseAI(offTeam.players, offHandler, this.disc, delta);
    this.ai.updateDefenseAI(defTeam.players, offTeam.players, offHandler, this.disc, delta);

    // AI handler auto-throw under stall pressure
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
        this.spawnThrowEffect(offHandler.x, offHandler.y, angle);
        offHandler.releaseDisc();
        this.disc.throwDisc(angle, power);
        this.stallManager.reset();
      }
    }

    this.drawPlayers();
    this.drawDragLine();
    this.drawAim();
    this.drawStallCounter();
    this.drawPowerMeter();
  }

  /**
   * Draws a live drag-direction indicator from the handler while the
   * player is holding the mouse button and dragging to aim a throw.
   */
  drawDragLine() {
    this.dragLineGraphics.clear();
    if (!this.controlledPlayer || !this.controlledPlayer.hasDisc) return;
    if (!this.input_.isDragging()) return;

    const drag = this.input_.getDragVector();
    if (drag.magnitude < DISC.DRAG_THROW_DEADZONE) return;

    const px = this.controlledPlayer.x;
    const py = this.controlledPlayer.y;
    const powerRatio = clamp(
      (drag.power - DISC.MIN_POWER) / (DISC.MAX_POWER - DISC.MIN_POWER), 0, 1
    );
    const lineLen = 40 + powerRatio * 60;

    const endX = px + Math.cos(drag.angle) * lineLen;
    const endY = py + Math.sin(drag.angle) * lineLen;

    const color = powerRatio < 0.5 ? 0x00ff00 : powerRatio < 0.8 ? 0xffff00 : 0xff3333;
    this.dragLineGraphics.lineStyle(3, color, 0.8);
    this.dragLineGraphics.beginPath();
    this.dragLineGraphics.moveTo(px, py);
    this.dragLineGraphics.lineTo(endX, endY);
    this.dragLineGraphics.strokePath();

    const arrowLen = 8;
    const arrowAngle = 0.4;
    this.dragLineGraphics.beginPath();
    this.dragLineGraphics.moveTo(endX, endY);
    this.dragLineGraphics.lineTo(
      endX - Math.cos(drag.angle - arrowAngle) * arrowLen,
      endY - Math.sin(drag.angle - arrowAngle) * arrowLen
    );
    this.dragLineGraphics.moveTo(endX, endY);
    this.dragLineGraphics.lineTo(
      endX - Math.cos(drag.angle + arrowAngle) * arrowLen,
      endY - Math.sin(drag.angle + arrowAngle) * arrowLen
    );
    this.dragLineGraphics.strokePath();

    // Power bar under the drag line
    const barW = 40;
    const barH = 4;
    const bx = px - barW / 2;
    const by = py - 28;
    this.dragLineGraphics.fillStyle(0x222222, 0.7);
    this.dragLineGraphics.fillRect(bx, by, barW, barH);
    this.dragLineGraphics.fillStyle(color, 0.9);
    this.dragLineGraphics.fillRect(bx, by, barW * powerRatio, barH);
  }

  drawPlayers() {
    this.getAllPlayers().forEach(p => p.drawOutline());
  }

  drawAim() {
    this.aimGraphics.clear();
    if (!this.controlledPlayer || !this.controlledPlayer.hasDisc) return;
    if (this.input_.isDragging()) return;

    const pointer = this.input_.getPointerPosition();
    const px = this.controlledPlayer.x;
    const py = this.controlledPlayer.y;
    const angle = angleBetween({ x: px, y: py }, { x: pointer.x, y: pointer.y });
    const len = 50;

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

    if (this.stallText.visible) {
      const c = this.stallManager.getCount();
      this.stallText.setColor(c < 5 ? '#ffcc44' : c < 8 ? '#ff8844' : '#ff3333');
    }
  }

  drawPowerMeter() {
    if (this.controlledPlayer && this.controlledPlayer.hasDisc && this.disc.isCharging) {
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
      [GAME_STATES.SETUP]: 'SETUP -- Players taking positions',
      [GAME_STATES.KICKOFF_PULL]: 'PULL -- Aim and click to throw',
      [GAME_STATES.LIVE_PLAY]: 'LIVE PLAY -- Drag to throw',
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

    if (this.domHud) this.updateDomHud();
  }

  updateDomHud() {
    const scores = this.scoreManager.getScores();

    if (this._domScoreA && scores.A !== this._prevScoreA) {
      this._domScoreA.textContent = scores.A;
      this._domScoreA.classList.remove('score-bump');
      void this._domScoreA.offsetWidth;
      this._domScoreA.classList.add('score-bump');
      setTimeout(() => this._domScoreA.classList.remove('score-bump'), 450);
      this._prevScoreA = scores.A;
    }
    if (this._domScoreB && scores.B !== this._prevScoreB) {
      this._domScoreB.textContent = scores.B;
      this._domScoreB.classList.remove('score-bump');
      void this._domScoreB.offsetWidth;
      this._domScoreB.classList.add('score-bump');
      setTimeout(() => this._domScoreB.classList.remove('score-bump'), 450);
      this._prevScoreB = scores.B;
    }

    if (this._domPoss) {
      const offId = this.possession.getOffenseTeamId();
      const label = offId === TEAMS.A ? 'Blue Offense' : 'Red Offense';
      this._domPoss.textContent = label;
      this._domPoss.className = 'hud-possession ' +
        (offId === TEAMS.A ? 'poss-blue' : 'poss-red');
    }

    if (this._domState) {
      const state = this.gsm.getState();
      const labels = {
        [GAME_STATES.SETUP]: 'Setup \u2014 Players taking positions',
        [GAME_STATES.KICKOFF_PULL]: 'Pull \u2014 Aim & click to throw',
        [GAME_STATES.LIVE_PLAY]: 'Live Play \u2014 Drag to throw',
        [GAME_STATES.TURNOVER]: 'Turnover',
        [GAME_STATES.SCORE]: 'Score!',
        [GAME_STATES.GAME_OVER]: 'Game Over',
        [GAME_STATES.RESET_AFTER_SCORE]: 'Resetting\u2026',
      };
      this._domState.textContent = labels[state] || '';
    }

    if (this._domStall) {
      const active = this.stallManager.isActive();
      const count = this.stallManager.getCount();
      this._domStall.textContent = active ? `Stall ${count}` : '';
      this._domStall.classList.toggle('active', active);
      this._domStall.classList.toggle('warn', active && count >= 5 && count < 8);
      this._domStall.classList.toggle('crit', active && count >= 8);
    }
  }

  _updateDomMessage(text, duration) {
    if (!this._domMsg) return;

    if (this._domMsgTimer) {
      clearTimeout(this._domMsgTimer);
      this._domMsgTimer = null;
    }

    if (text) {
      this._domMsg.textContent = text;
      this._domMsg.classList.remove('visible');
      void this._domMsg.offsetWidth;
      this._domMsg.classList.add('visible');

      if (duration > 0) {
        this._domMsgTimer = setTimeout(() => {
          this._domMsg.classList.remove('visible');
        }, duration);
      }
    } else {
      this._domMsg.classList.remove('visible');
    }
  }
}
