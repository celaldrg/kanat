import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { createStorage } from '../src/storage.js';
import { BEST_KEY, readBest, writeBest, medalFor } from '../src/score.js';

/** Minimal in-memory stand-in for window.localStorage. */
function fakeLocalStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

/** A round already in flight with the given score, falling towards the ground. */
function roundWithScore(score, storage) {
  return createGame({
    storage,
    initialState: { phase: 'playing', score, untilSpawn: 1e6, player: { y: 500, vy: 600 } },
  });
}

/** Run the game to game over and return all events. */
function playToEnd(game) {
  const events = [];
  for (let i = 0; i < 600 && game.getState().phase !== 'over'; i++) events.push(...game.update(1 / 60));
  return events;
}

test('best score is written to and read from a fake localStorage', () => {
  const local = fakeLocalStorage();
  const storage = createStorage(local);
  assert.equal(readBest(storage), 0, 'nothing stored yet');
  assert.equal(writeBest(storage, 17), true);
  assert.equal(local.getItem(BEST_KEY), '17');
  assert.equal(readBest(createStorage(local)), 17);
});

test('corrupt stored values read as 0', () => {
  const local = fakeLocalStorage();
  for (const bad of ['abc', '-5', '', 'NaN']) {
    local.setItem(BEST_KEY, bad);
    assert.equal(readBest(createStorage(local)), 0, `value ${JSON.stringify(bad)}`);
  }
});

test('a new best is reported and persisted when the round ends', () => {
  const local = fakeLocalStorage();
  const game = roundWithScore(7, createStorage(local));
  const events = playToEnd(game);
  const state = game.getState();
  assert.equal(state.phase, 'over');
  assert.deepEqual(events, ['hit', 'newBest']);
  assert.equal(state.best, 7);
  assert.equal(state.newBest, true);
  assert.equal(local.getItem(BEST_KEY), '7');

  const nextVisit = createGame({ storage: createStorage(local) });
  assert.equal(nextVisit.getState().best, 7, 'read back by a fresh game');
});

test('a lower score does not overwrite the best', () => {
  const local = fakeLocalStorage();
  local.setItem(BEST_KEY, '20');
  const game = roundWithScore(5, createStorage(local));
  const events = playToEnd(game);
  assert.deepEqual(events, ['hit']);
  assert.equal(game.getState().best, 20);
  assert.equal(game.getState().newBest, false);
  assert.equal(local.getItem(BEST_KEY), '20');
});

test('the best score persists through the default globalThis.localStorage', () => {
  const local = fakeLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  try {
    playToEnd(roundWithScore(11, createStorage()));
    assert.equal(local.getItem(BEST_KEY), '11');
    assert.equal(createGame({ storage: createStorage() }).getState().best, 11);
  } finally {
    delete globalThis.localStorage;
  }
});

test('a broken localStorage does not stop the game; best stays in memory', () => {
  const broken = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  const game = roundWithScore(9, createStorage(broken));
  assert.equal(game.getState().best, 0);
  const events = playToEnd(game);
  assert.deepEqual(events, ['hit', 'newBest']);
  assert.equal(game.getState().best, 9);
});

test('medals: bronze from 10, silver from 25, gold from 50', () => {
  assert.equal(medalFor(0), null);
  assert.equal(medalFor(9), null);
  assert.equal(medalFor(10), 'bronze');
  assert.equal(medalFor(24), 'bronze');
  assert.equal(medalFor(25), 'silver');
  assert.equal(medalFor(49), 'silver');
  assert.equal(medalFor(50), 'gold');
  assert.equal(medalFor(120), 'gold');
});
