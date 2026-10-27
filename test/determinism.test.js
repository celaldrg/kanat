import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomBetween } from '../src/rng.js';
import { createGame } from '../src/engine.js';
import { shouldAutoFlap } from '../src/demo.js';

/** Play `seconds` at 60 fps with the autopilot and record a snapshot every half second. */
function trace(options, seconds) {
  const game = createGame(options);
  game.flap();
  const snapshots = [];
  for (let frame = 1; frame <= seconds * 60; frame++) {
    if (shouldAutoFlap(game.getState(), game.config)) game.flap();
    game.update(1 / 60);
    if (frame % 30 === 0) snapshots.push(game.getState());
  }
  return snapshots;
}

test('the RNG repeats for the same seed and differs for another', () => {
  const a = createRng(123);
  const b = createRng(123);
  const c = createRng(124);
  const seqA = Array.from({ length: 50 }, a);
  const seqB = Array.from({ length: 50 }, b);
  const seqC = Array.from({ length: 50 }, c);
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((v) => v >= 0 && v < 1), 'values in [0, 1)');
});

test('randomBetween maps into the requested range', () => {
  assert.equal(randomBetween(() => 0, 5, 9), 5);
  assert.equal(randomBetween(() => 0.5, 5, 9), 7);
});

test('the same seed and inputs give the same game', () => {
  const first = trace({ seed: 7 }, 12);
  const second = trace({ seed: 7 }, 12);
  assert.deepEqual(first, second);
  assert.ok(first.at(-1).score > 0, 'the run actually passed gates');
});

test('a different seed gives a different course', () => {
  const gaps = (seed) => trace({ seed }, 6).flatMap((s) => s.obstacles.map((o) => o.gapY));
  assert.notDeepEqual(gaps(7), gaps(8));
});

test('an injected random source drives gate placement', () => {
  const game = createGame({ rng: () => 0.5, config: { gravity: 0, flapImpulse: 0, maxGapShift: 1000 } });
  game.flap();
  for (let i = 0; i < 4; i++) game.update(0.25);
  const [gate] = game.getState().obstacles;
  const { gapMargin, groundY } = game.config;
  const lowest = gapMargin + gate.gap / 2;
  const highest = groundY - gapMargin - gate.gap / 2;
  assert.equal(gate.gapY, (lowest + highest) / 2);
  assert.equal(gate.variant, 0.5);
});
