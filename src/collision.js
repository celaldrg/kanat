/**
 * Collision helpers. Pure module: no DOM, no globals.
 * Touching counts as a hit (distance <= radius).
 */

/** @typedef {{ x: number, y: number, r: number }} Circle */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {{ x: number, width: number, gapY: number, gap: number }} Gate */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Test whether a circle overlaps or touches an axis-aligned rectangle.
 * @param {Circle} circle
 * @param {Rect} rect
 * @returns {boolean}
 */
export function circleRectOverlap(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * The two solid parts of a gate: the column above the gap and the one below it.
 * @param {Gate} gate
 * @param {number} groundY Top edge of the ground.
 * @returns {[Rect, Rect]} [upper, lower]
 */
export function obstacleRects(gate, groundY) {
  const gapTop = gate.gapY - gate.gap / 2;
  const gapBottom = gate.gapY + gate.gap / 2;
  return [
    { x: gate.x, y: 0, w: gate.width, h: gapTop },
    { x: gate.x, y: gapBottom, w: gate.width, h: groundY - gapBottom },
  ];
}

/**
 * Test whether a circle hits either column of a gate.
 * @param {Circle} circle
 * @param {Gate} gate
 * @param {number} groundY
 * @returns {boolean}
 */
export function circleHitsObstacle(circle, gate, groundY) {
  return obstacleRects(gate, groundY).some((rect) => circleRectOverlap(circle, rect));
}
