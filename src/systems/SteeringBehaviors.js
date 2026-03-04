import { PLAYER } from '../utils/Constants.js';

const STEERING_MAX_FORCE = PLAYER.ACCELERATION * 1.2;

export function seek(px, py, vx, vy, tx, ty, maxSpeed) {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: 0, y: 0 };

  const desiredVx = (dx / dist) * maxSpeed;
  const desiredVy = (dy / dist) * maxSpeed;

  let sx = desiredVx - vx;
  let sy = desiredVy - vy;
  const mag = Math.sqrt(sx * sx + sy * sy);
  if (mag > STEERING_MAX_FORCE) {
    sx = (sx / mag) * STEERING_MAX_FORCE;
    sy = (sy / mag) * STEERING_MAX_FORCE;
  }
  return { x: sx, y: sy };
}

export function arrive(px, py, vx, vy, tx, ty, maxSpeed, slowRadius = 50) {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return { x: -vx * 0.5, y: -vy * 0.5 };

  let targetSpeed = maxSpeed;
  if (dist < slowRadius) {
    targetSpeed = maxSpeed * (dist / slowRadius);
  }

  const desiredVx = (dx / dist) * targetSpeed;
  const desiredVy = (dy / dist) * targetSpeed;

  let sx = desiredVx - vx;
  let sy = desiredVy - vy;
  const mag = Math.sqrt(sx * sx + sy * sy);
  if (mag > STEERING_MAX_FORCE) {
    sx = (sx / mag) * STEERING_MAX_FORCE;
    sy = (sy / mag) * STEERING_MAX_FORCE;
  }
  return { x: sx, y: sy };
}

export function shadow(px, py, vx, vy, markX, markY, anchorX, anchorY, shadowDist, maxSpeed) {
  const dx = anchorX - markX;
  const dy = anchorY - markY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let targetX, targetY;
  if (dist < 1) {
    targetX = markX;
    targetY = markY;
  } else {
    targetX = markX + (dx / dist) * shadowDist;
    targetY = markY + (dy / dist) * shadowDist;
  }

  return arrive(px, py, vx, vy, targetX, targetY, maxSpeed, 40);
}
