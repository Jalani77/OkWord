import Phaser from 'phaser';
import { PLAYER, FIELD_BOUNDS } from '../utils/Constants.js';

const ANIM_STATES = { IDLE: 'idle', JOG: 'jog', SPRINT: 'sprint', PIVOT: 'pivot', THROW: 'throw' };
const JOG_THRESHOLD = 30;
const SPRINT_THRESHOLD = PLAYER.MAX_SPEED * 0.7;

export default class Player {
  constructor(scene, x, y, teamId, id, role = 'cutter') {
    this.scene = scene;
    this.id = id;
    this.teamId = teamId;
    this.role = role;
    this.hasDisc = false;
    this.isPivoting = false;
    this.pivotAngle = 0;
    this.anchorX = 0;
    this.anchorY = 0;
    this.isControlled = false;

    this.fsmState = 'idle';
    this.assignedMatchup = null;
    this.setupTargetX = 0;
    this.setupTargetY = 0;
    this.reticlePhase = 0;

    this.animState = ANIM_STATES.IDLE;
    this.facingAngle = 0;

    this.teamColor = teamId === 'A' ? PLAYER.TEAM_A_COLOR : PLAYER.TEAM_B_COLOR;

    const texKey = scene.textures.exists('player_idle') ? 'player_idle' : 'player_sprite';
    const hasTex = scene.textures.exists(texKey);

    if (hasTex) {
      this.sprite = scene.add.sprite(x, y, texKey);
      this.sprite.setDisplaySize(PLAYER.RADIUS * 2, PLAYER.RADIUS * 2);
      this.sprite.setTint(this.teamColor);
    } else {
      this.sprite = scene.add.circle(x, y, PLAYER.RADIUS, this.teamColor);
    }

    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(PLAYER.RADIUS);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.body.setMaxVelocity(PLAYER.MAX_SPEED, PLAYER.MAX_SPEED);
    this.sprite.body.setDrag(PLAYER.DRAG, PLAYER.DRAG);
    this.sprite.body.useDamping = true;
    this.sprite.body.setDrag(0.92, 0.92);

    this.sprite.setData('playerRef', this);

    this.dirArrow = null;
    if (scene.textures.exists('dir_arrow')) {
      this.dirArrow = scene.add.sprite(x, y, 'dir_arrow');
      this.dirArrow.setDisplaySize(8, 6);
      this.dirArrow.setAlpha(0);
      this.dirArrow.setDepth(5);
      this.dirArrow.setTint(this.teamColor);
    }

    this.outlineGraphics = scene.add.graphics();
    this.directionGraphics = scene.add.graphics();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  set x(val) { this.sprite.x = val; }
  set y(val) { this.sprite.y = val; }

  get body() { return this.sprite.body; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
    if (this.sprite.body) {
      this.sprite.body.reset(x, y);
    }
  }

  setControlled(controlled) {
    this.isControlled = controlled;
  }

  updateAnimState() {
    if (this.isPivoting) {
      this.animState = ANIM_STATES.PIVOT;
      return;
    }

    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > SPRINT_THRESHOLD) {
      this.animState = ANIM_STATES.SPRINT;
    } else if (speed > JOG_THRESHOLD) {
      this.animState = ANIM_STATES.JOG;
    } else {
      this.animState = ANIM_STATES.IDLE;
    }

    if (speed > 5) {
      this.facingAngle = Math.atan2(vy, vx);
    }

    if (this.sprite.setTexture) {
      const texMap = { sprint: 'player_sprint', jog: 'player_jog', idle: 'player_idle' };
      const desired = texMap[this.animState] || 'player_idle';
      if (this.scene.textures.exists(desired) && this.sprite.texture.key !== desired) {
        this.sprite.setTexture(desired);
        this.sprite.setDisplaySize(PLAYER.RADIUS * 2, PLAYER.RADIUS * 2);
        this.sprite.setTint(this.teamColor);
      }
    }
  }

  moveWithInput(cursors, wasd) {
    if (this.isPivoting) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.setPosition(this.anchorX, this.anchorY);
      return;
    }

    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd.left.isDown) vx = -1;
    else if (cursors.right.isDown || wasd.right.isDown) vx = 1;

    if (cursors.up.isDown || wasd.up.isDown) vy = -1;
    else if (cursors.down.isDown || wasd.down.isDown) vy = 1;

    if (vx !== 0 || vy !== 0) {
      const mag = Math.sqrt(vx * vx + vy * vy);
      this.sprite.body.setAcceleration(
        (vx / mag) * PLAYER.ACCELERATION,
        (vy / mag) * PLAYER.ACCELERATION
      );
    } else {
      this.sprite.body.setAcceleration(0, 0);
    }

    this.constrainToField();
  }

  constrainToField() {
    const r = PLAYER.RADIUS;
    if (this.sprite.x < FIELD_BOUNDS.LEFT + r) {
      this.sprite.x = FIELD_BOUNDS.LEFT + r;
      this.sprite.body.setVelocityX(0);
    }
    if (this.sprite.x > FIELD_BOUNDS.RIGHT - r) {
      this.sprite.x = FIELD_BOUNDS.RIGHT - r;
      this.sprite.body.setVelocityX(0);
    }
    if (this.sprite.y < FIELD_BOUNDS.TOP + r) {
      this.sprite.y = FIELD_BOUNDS.TOP + r;
      this.sprite.body.setVelocityY(0);
    }
    if (this.sprite.y > FIELD_BOUNDS.BOTTOM - r) {
      this.sprite.y = FIELD_BOUNDS.BOTTOM - r;
      this.sprite.body.setVelocityY(0);
    }
  }

  startPivot() {
    this.isPivoting = true;
    this.anchorX = this.sprite.x;
    this.anchorY = this.sprite.y;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.body.setAcceleration(0, 0);
  }

  stopPivot() {
    this.isPivoting = false;
  }

  updatePivotAngle(pointerX, pointerY) {
    if (!this.isPivoting) return;
    this.pivotAngle = Math.atan2(
      pointerY - this.anchorY,
      pointerX - this.anchorX
    );
  }

  catchDisc() {
    this.hasDisc = true;
    this.startPivot();
  }

  releaseDisc() {
    this.hasDisc = false;
    this.stopPivot();
  }

  drawOutline() {
    this.outlineGraphics.clear();
    this.directionGraphics.clear();

    this.updateAnimState();

    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const speed = Math.sqrt(
      this.sprite.body.velocity.x ** 2 + this.sprite.body.velocity.y ** 2
    );

    if (this.dirArrow) {
      if (speed > JOG_THRESHOLD) {
        this.dirArrow.setPosition(
          sx + Math.cos(this.facingAngle) * (PLAYER.RADIUS + 6),
          sy + Math.sin(this.facingAngle) * (PLAYER.RADIUS + 6)
        );
        this.dirArrow.setRotation(this.facingAngle);
        this.dirArrow.setAlpha(Math.min(speed / PLAYER.MAX_SPEED, 0.7));
      } else {
        this.dirArrow.setAlpha(0);
      }
    }

    if (this.isControlled) {
      this.reticlePhase += 0.04;
      const pulse = 1 + Math.sin(this.reticlePhase * 2) * 0.06;
      const r = (PLAYER.RADIUS + 9) * pulse;
      const bk = 7;
      const col = PLAYER.RETICLE_COLOR;

      this.outlineGraphics.lineStyle(1.5, col, 0.55);
      this.outlineGraphics.strokeCircle(sx, sy, (PLAYER.RADIUS + 4) * pulse);

      this.outlineGraphics.lineStyle(2, col, 0.85);
      const corners = [
        { cx: sx - r, cy: sy - r, dx: bk, dy2: bk },
        { cx: sx + r, cy: sy - r, dx: -bk, dy2: bk },
        { cx: sx - r, cy: sy + r, dx: bk, dy2: -bk },
        { cx: sx + r, cy: sy + r, dx: -bk, dy2: -bk },
      ];
      for (const c of corners) {
        this.outlineGraphics.beginPath();
        this.outlineGraphics.moveTo(c.cx + c.dx, c.cy);
        this.outlineGraphics.lineTo(c.cx, c.cy);
        this.outlineGraphics.lineTo(c.cx, c.cy + c.dy2);
        this.outlineGraphics.strokePath();
      }

      const glowAlpha = 0.12 + Math.sin(this.reticlePhase * 3) * 0.06;
      this.outlineGraphics.fillStyle(col, glowAlpha);
      this.outlineGraphics.fillCircle(sx, sy, PLAYER.RADIUS + 6);
    }

    if (this.animState === ANIM_STATES.SPRINT && speed > SPRINT_THRESHOLD) {
      const trailAlpha = 0.08;
      this.outlineGraphics.fillStyle(this.teamColor, trailAlpha);
      for (let i = 1; i <= 3; i++) {
        this.outlineGraphics.fillCircle(
          sx - Math.cos(this.facingAngle) * i * 5,
          sy - Math.sin(this.facingAngle) * i * 5,
          PLAYER.RADIUS - i * 2
        );
      }
    }

    if (this.isPivoting && this.hasDisc) {
      this.directionGraphics.lineStyle(2, 0xffff00, 0.7);
      const len = 30;
      const endX = sx + Math.cos(this.pivotAngle) * len;
      const endY = sy + Math.sin(this.pivotAngle) * len;
      this.directionGraphics.beginPath();
      this.directionGraphics.moveTo(sx, sy);
      this.directionGraphics.lineTo(endX, endY);
      this.directionGraphics.strokePath();
    }
  }

  clampVelocity(maxSpeed = PLAYER.MAX_SPEED) {
    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.sprite.body.setVelocity(vx * scale, vy * scale);
    }
  }

  tweenToPosition(x, y, duration = 800, onComplete) {
    this.sprite.body.setVelocity(0, 0);
    this.sprite.body.setAcceleration(0, 0);

    this.scene.tweens.add({
      targets: this.sprite,
      x, y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (this.sprite.body) {
          this.sprite.body.reset(this.sprite.x, this.sprite.y);
        }
      },
      onComplete: () => {
        if (this.sprite.body) {
          this.sprite.body.reset(x, y);
        }
        if (onComplete) onComplete();
      },
    });
  }

  destroy() {
    this.sprite.destroy();
    if (this.dirArrow) this.dirArrow.destroy();
    this.outlineGraphics.destroy();
    this.directionGraphics.destroy();
  }
}
