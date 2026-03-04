export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function vectorFromAngle(angle, magnitude) {
  return {
    x: Math.cos(angle) * magnitude,
    y: Math.sin(angle) * magnitude,
  };
}

export function normalizeVector(vx, vy) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: vx / mag, y: vy / mag };
}

export function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
