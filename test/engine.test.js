import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, rotationFromVelocity, pickGapY, FIXED_STEP } from '../src/engine.js';
import { makeConfig, difficultyAt, skyProgress } from '../src/config.js';
import { createRng } from '../src/rng.js';

const cfg = makeConfig();
const FAR = 1e6; // untilSpawn value that keeps new gates from spawning

/** Run update(1/60) until a predicate holds or the time limit passes; collects events. */
function runUntil(game, predicate, seconds = 10) {
  const events = [];
  for (let i = 0; i < seconds * 60 && !predicate(game.getState()); i++) {
    events.push(...game.update(1 / 60));
  }
  return events;
}

test('a new game waits on the ready screen with no gates', () => {
  const game = createGame({ seed: 1 });
  game.update(2);
  const state = game.getState();
  assert.equal(state.phase, 'ready');
  assert.equal(state.score, 0);
  assert.equal(state.obstacles.length, 0);
  assert.ok(Math.abs(state.player.y - cfg.startY) <= cfg.bobAmplitude, 'only bobs around the start height');
});

test('the first flap starts the round and lifts the plane', () => {
  const game = createGame({ seed: 1 });
  assert.equal(game.flap(), true);
  const state = game.getState();
  assert.equal(state.phase, 'playing');
  assert.equal(state.player.vy, cfg.flapImpulse);
  game.update(0.1);
  assert.ok(game.getState().player.y < cfg.startY, 'moved up');
});

test('hitting the ground ends the game', () => {
  const game = createGame({ seed: 1 });
  game.flap();
  const events = runUntil(game, (s) => s.phase === 'over', 5);
  const state = game.getState();
  assert.equal(state.phase, 'over');
  assert.deepEqual(events, ['hit']);
  assert.equal(state.player.y + state.player.r, cfg.groundY, 'rests on the ground');
  assert.equal(game.flap(), false, 'no flapping after game over');
  game.update(1);
  assert.equal(game.getState().player.y + state.player.r, cfg.groundY, 'stays on the ground');
});

test('hitting the ceiling ends the game', () => {
  const game = createGame({
    initialState: { phase: 'playing', untilSpawn: FAR, player: { y: 30, vy: -400 } },
  });
  const events = game.update(0.05);
  assert.equal(game.getState().phase, 'over');
  assert.deepEqual(events, ['hit']);
});

test('hitting a gate column ends the game', () => {
  const game = createGame({
    initialState: {
      phase: 'playing',
      untilSpawn: FAR,
      player: { y: 400, vy: 0 },
      obstacles: [{ x: cfg.playerX - 20, gapY: 150, gap: 150 }],
    },
  });
  const events = game.update(FIXED_STEP);
  assert.equal(game.getState().phase, 'over');
  assert.deepEqual(events, ['hit']);
});

test('passing a gate scores exactly once', () => {
  const game = createGame({
    config: { gravity: 0 },
    initialState: {
      phase: 'playing',
      untilSpawn: FAR,
      player: { y: 300, vy: 0 },
      obstacles: [{ x: cfg.playerX - 30, gapY: 300, gap: 160 }],
    },
  });
  const first = game.update(0.25);
  const rest = runUntil(game, () => false, 2);
  const state = game.getState();
  assert.equal(state.phase, 'playing');
  assert.equal(state.score, 1);
  assert.deepEqual([...first, ...rest], ['score']);
});

test('gates spawn at a fixed spacing while scrolling', () => {
  const game = createGame({
    seed: 3,
    config: { gravity: 0, flapImpulse: 0, baseGap: 400, minGap: 400 },
  });
  game.flap();
  runUntil(game, () => false, 8);
  const { obstacles, phase, score } = game.getState();
  assert.equal(phase, 'playing');
  assert.ok(score >= 3, `passed several gates (score ${score})`);
  assert.ok(obstacles.length >= 2);
  for (let i = 1; i < obstacles.length; i++) {
    assert.ok(Math.abs(obstacles[i].x - obstacles[i - 1].x - cfg.spacing) < 1e-6, 'constant spacing');
  }
});

test('gap centres stay inside the field and close to the previous gap', () => {
  const rng = createRng(99);
  let previous = cfg.startY;
  for (let i = 0; i < 2000; i++) {
    const gap = difficultyAt(i % 60, cfg).gap;
    const y = pickGapY(rng, gap, previous, cfg);
    assert.ok(y - gap / 2 >= cfg.gapMargin, 'gap top below the ceiling margin');
    assert.ok(y + gap / 2 <= cfg.groundY - cfg.gapMargin, 'gap bottom above the ground margin');
    assert.ok(Math.abs(y - previous) <= cfg.maxGapShift, 'shift is limited');
    previous = y;
  }
});

test('speed rises and the gap shrinks with score, both capped', () => {
  const start = difficultyAt(0, cfg);
  const mid = difficultyAt(10, cfg);
  const late = difficultyAt(1000, cfg);
  assert.deepEqual(start, { speed: cfg.baseSpeed, gap: cfg.baseGap });
  assert.ok(mid.speed > start.speed && mid.gap < start.gap);
  assert.deepEqual(late, { speed: cfg.maxSpeed, gap: cfg.minGap });
});

test('the sky shifts from day to dusk as the score rises', () => {
  assert.equal(skyProgress(0, cfg), 0);
  assert.equal(skyProgress(cfg.skyFullAtScore / 2, cfg), 0.5);
  assert.equal(skyProgress(10_000, cfg), 1);
  const game = createGame({ initialState: { score: 25 } });
  assert.equal(game.getState().sky, 0.5);
});

test('rotation follows vertical velocity and is clamped', () => {
  assert.equal(rotationFromVelocity(0, cfg), 0);
  assert.ok(rotationFromVelocity(-100, cfg) < 0, 'nose up while rising');
  assert.ok(rotationFromVelocity(200, cfg) > 0, 'nose down while falling');
  assert.equal(rotationFromVelocity(-10_000, cfg), cfg.minRotation);
  assert.equal(rotationFromVelocity(cfg.maxFallSpeed, cfg), cfg.maxRotation);
});

test('fall speed is capped', () => {
  const game = createGame({ config: { groundHeight: -100_000 } });
  game.flap();
  game.update(0.25);
  game.update(0.25);
  game.update(0.25);
  assert.equal(game.getState().player.vy, cfg.maxFallSpeed);
});

test('the fixed timestep makes results independent of frame rate', () => {
  const play = (fps) => {
    const game = createGame({ seed: 5 });
    game.flap();
    for (let i = 0; i < fps; i++) game.update(1 / fps);
    return game.getState();
  };
  const at30 = play(30);
  assert.deepEqual(play(60), at30);
  assert.deepEqual(play(120), at30);
});

test('long or invalid frame times are handled safely', () => {
  const game = createGame({ seed: 1 });
  game.update(10);
  assert.ok(game.getState().clock <= cfg.maxFrameTime + 1e-9, 'one huge frame is capped');
  const before = game.getState();
  assert.deepEqual(game.update(-1), []);
  assert.deepEqual(game.update(Number.NaN), []);
  assert.deepEqual(game.getState(), before);
});

test('pause freezes the round and resume continues it', () => {
  const game = createGame({ seed: 1 });
  assert.equal(game.pause(), false, 'cannot pause on the ready screen');
  game.flap();
  assert.equal(game.pause(), true);
  const paused = game.getState();
  assert.equal(paused.phase, 'paused');
  assert.equal(game.flap(), false, 'flap is ignored while paused');
  game.update(1);
  assert.deepEqual(game.getState(), paused);
  assert.equal(game.togglePause(), true);
  assert.equal(game.getState().phase, 'playing');
  assert.equal(game.togglePause(), true);
  assert.equal(game.getState().phase, 'paused');
  assert.equal(game.resume(), true);
  assert.equal(game.resume(), false);
});

test('restart returns to the ready screen and keeps the best score', () => {
  const game = createGame({ initialState: { phase: 'playing', score: 4, untilSpawn: FAR } });
  runUntil(game, (s) => s.phase === 'over');
  assert.equal(game.getState().best, 4);
  game.restart(42);
  const state = game.getState();
  assert.equal(state.phase, 'ready');
  assert.equal(state.score, 0);
  assert.equal(state.best, 4);
  assert.equal(state.newBest, false);
  assert.equal(state.obstacles.length, 0);
});

test('getState returns a copy that cannot change the game', () => {
  const game = createGame({ initialState: { obstacles: [{ x: 200, gapY: 300 }] } });
  const state = game.getState();
  state.player.y = -999;
  state.obstacles[0].x = -999;
  state.obstacles.push({});
  const fresh = game.getState();
  assert.notEqual(fresh.player.y, -999);
  assert.equal(fresh.obstacles.length, 1);
  assert.equal(fresh.obstacles[0].x, 200);
});

test('invalid options are rejected', () => {
  assert.throws(() => createGame({ config: { gravty: 1 } }), TypeError);
  assert.throws(() => createGame({ initialState: { phase: 'over' } }), TypeError);
});
