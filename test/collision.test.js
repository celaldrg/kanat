import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleRectOverlap, obstacleRects, circleHitsObstacle } from '../src/collision.js';

const rect = { x: 10, y: 10, w: 20, h: 20 };

test('circle overlapping a rectangle collides', () => {
  assert.equal(circleRectOverlap({ x: 20, y: 20, r: 3 }, rect), true, 'centre inside');
  assert.equal(circleRectOverlap({ x: 8, y: 20, r: 5 }, rect), true, 'crossing the left edge');
  assert.equal(circleRectOverlap({ x: 20, y: 33, r: 4 }, rect), true, 'crossing the bottom edge');
});

test('circle just touching a rectangle counts as a hit', () => {
  assert.equal(circleRectOverlap({ x: 5, y: 20, r: 5 }, rect), true, 'touching the left edge');
  assert.equal(circleRectOverlap({ x: 20, y: 35, r: 5 }, rect), true, 'touching the bottom edge');
  assert.equal(circleRectOverlap({ x: 7, y: 6, r: 5 }, rect), true, 'touching the corner (3-4-5)');
});

test('circle clearly missing a rectangle does not collide', () => {
  assert.equal(circleRectOverlap({ x: 4, y: 20, r: 5 }, rect), false, 'left of the rectangle');
  assert.equal(circleRectOverlap({ x: 20, y: 60, r: 5 }, rect), false, 'far below');
  assert.equal(circleRectOverlap({ x: 6, y: 6, r: 5 }, rect), false, 'near the corner, bounding boxes overlap');
});

test('a gate is split into an upper and a lower column around the gap', () => {
  const gate = { x: 100, width: 60, gapY: 300, gap: 160 };
  const [upper, lower] = obstacleRects(gate, 568);
  assert.deepEqual(upper, { x: 100, y: 0, w: 60, h: 220 });
  assert.deepEqual(lower, { x: 100, y: 380, w: 60, h: 188 });
});

test('circle inside the gap passes, touching a column hits', () => {
  const gate = { x: 100, width: 60, gapY: 300, gap: 160 };
  assert.equal(circleHitsObstacle({ x: 130, y: 300, r: 13 }, gate, 568), false, 'gap centre');
  assert.equal(circleHitsObstacle({ x: 130, y: 233, r: 13 }, gate, 568), true, 'touching the upper column');
  assert.equal(circleHitsObstacle({ x: 130, y: 367, r: 13 }, gate, 568), true, 'touching the lower column');
  assert.equal(circleHitsObstacle({ x: 50, y: 100, r: 13 }, gate, 568), false, 'left of the gate');
});
