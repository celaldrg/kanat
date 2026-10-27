import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGame, shouldAutoFlap, DEMO_SCORE } from '../src/demo.js';
import { createGame } from '../src/engine.js';

/** Fly with the autopilot at 60 fps; returns the final state. */
function autopilot(game, seconds) {
  for (let i = 0; i < seconds * 60; i++) {
    const state = game.getState();
    if (state.phase === 'over') break;
    if (state.phase === 'ready' || shouldAutoFlap(state, game.config)) game.flap();
    game.update(1 / 60);
  }
  return game.getState();
}

test('the demo starts mid-game with the plane between gate columns', () => {
  const state = createDemoGame().getState();
  assert.equal(state.phase, 'playing');
  assert.equal(state.score, DEMO_SCORE);
  assert.ok(state.sky > 0 && state.sky < 1, 'sky is part way to dusk');

  const onScreen = state.obstacles.filter((g) => g.x >= 0 && g.x + g.width <= state.width);
  assert.ok(onScreen.length >= 2, 'a couple of gates on screen');

  const { x, y, r } = state.player;
  const around = state.obstacles.find((g) => g.x <= x && x <= g.x + g.width);
  assert.ok(around, 'the plane is inside a gate');
  assert.ok(Math.abs(y - around.gapY) <= around.gap / 2 - r, 'and clear of both columns');
});

test('the demo is deterministic and does not crash on its first frame', () => {
  const a = createDemoGame();
  const b = createDemoGame();
  assert.deepEqual(a.getState(), b.getState());
  assert.deepEqual(a.update(1 / 60), []);
  assert.equal(a.getState().phase, 'playing');
});

test('the autopilot keeps the demo flying', () => {
  const state = autopilot(createDemoGame(), 30);
  assert.equal(state.phase, 'playing');
  assert.ok(state.score > DEMO_SCORE + 10, `kept scoring (score ${state.score})`);
});

test('generated courses are passable (autopilot survives several seeds)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = autopilot(createGame({ seed }), 40);
    assert.equal(state.phase, 'playing', `seed ${seed} ended at score ${state.score}`);
  }
});

test('the autopilot never flaps outside a running round', () => {
  const game = createGame({ seed: 1 });
  assert.equal(shouldAutoFlap(game.getState(), game.config), false);
});
