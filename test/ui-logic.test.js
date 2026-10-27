import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlayFor, primaryActionFor, medalView, OVER_PANEL_DELAY, RESTART_DELAY } from '../src/view.js';
import { actionForKey } from '../src/controls.js';
import { backingStore, MAX_PIXEL_RATIO } from '../src/viewport.js';
import { DAY, DUSK, hexToRgb, mixColor, paletteAt, css } from '../src/palette.js';
import { STRINGS } from '../src/i18n.js';
import { createGame } from '../src/engine.js';

const at = (phase, overTime = 0) => ({ phase, overTime });

test('overlays follow the game phase; the game-over panel waits a moment', () => {
  assert.equal(overlayFor(at('ready')), 'ready');
  assert.equal(overlayFor(at('playing')), null);
  assert.equal(overlayFor(at('paused')), 'paused');
  assert.equal(overlayFor(at('over', 0)), null);
  assert.equal(overlayFor(at('over', OVER_PANEL_DELAY)), 'over');
  assert.equal(overlayFor(at('over', 5), { demo: true }), null, 'the demo never shows the panel');
});

test('the primary input flaps, resumes, or restarts after a short delay', () => {
  assert.equal(primaryActionFor(at('ready')), 'flap');
  assert.equal(primaryActionFor(at('playing')), 'flap');
  assert.equal(primaryActionFor(at('paused')), 'resume');
  assert.equal(primaryActionFor(at('over', RESTART_DELAY / 2)), 'none');
  assert.equal(primaryActionFor(at('over', RESTART_DELAY)), 'newGame');
  assert.equal(primaryActionFor(at('playing'), { demo: true }), 'newGame');
});

test('a full round through the view logic: ready, flap, crash, panel, restart', () => {
  const game = createGame({ seed: 3 });
  const press = () => {
    const action = primaryActionFor(game.getState());
    if (action === 'flap') game.flap();
    return action;
  };
  assert.equal(press(), 'flap');
  assert.equal(game.getState().phase, 'playing');
  for (let i = 0; i < 600 && game.getState().phase !== 'over'; i++) game.update(1 / 60);
  assert.equal(game.getState().phase, 'over', 'without more flaps the plane falls');
  assert.equal(press(), 'none', 'an instant tap after the crash does not restart');
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.equal(overlayFor(game.getState()), 'over');
  assert.equal(press(), 'newGame');
});

test('medal labels exist in both languages', () => {
  for (const medal of ['gold', 'silver', 'bronze', null]) {
    const view = medalView(medal);
    assert.equal(view.tone, medal ?? 'none');
    for (const lang of ['en', 'tr']) {
      assert.ok(STRINGS[lang][view.nameKey], `${lang} ${view.nameKey}`);
      assert.ok(STRINGS[lang][view.hintKey], `${lang} ${view.hintKey}`);
    }
  }
  assert.equal(medalView('platinum').tone, 'none');
});

test('keys map to game actions', () => {
  for (const code of ['Space', 'ArrowUp', 'KeyW']) assert.equal(actionForKey(code, ''), 'primary', code);
  for (const code of ['KeyP', 'Escape']) assert.equal(actionForKey(code, ''), 'pause', code);
  assert.equal(actionForKey('KeyA', 'a'), null);
  assert.equal(actionForKey('Enter', 'Enter'), null);
  assert.equal(actionForKey('', ' '), 'primary', 'falls back to event.key');
  assert.equal(actionForKey('', 'Esc'), 'pause');
});

test('the canvas backing store follows devicePixelRatio, within limits', () => {
  const world = { width: 360, height: 640 };
  assert.deepEqual(backingStore(360, 640, 1, world), { width: 360, height: 640, scaleX: 1, scaleY: 1 });
  const retina = backingStore(311, 553, 2, world);
  assert.equal(retina.width, 622);
  assert.equal(retina.height, 1106);
  assert.ok(Math.abs(retina.scaleX - 622 / 360) < 1e-9);
  assert.equal(backingStore(100, 100, 8, world).width, 100 * MAX_PIXEL_RATIO);
  assert.equal(backingStore(100, 100, 0, world).width, 100, 'a missing ratio counts as 1');
  assert.equal(backingStore(0, 0, 2, world).width, 1, 'never zero');
});

test('the sky palette blends from day to dusk', () => {
  assert.deepEqual(hexToRgb('#a78bfa'), [167, 139, 250]);
  assert.deepEqual(mixColor('#000000', '#ffffff', 0.5), [128, 128, 128]);
  assert.deepEqual(mixColor('#000000', '#ffffff', 2), [255, 255, 255], 'clamped');
  assert.deepEqual(paletteAt(0).skyTop, hexToRgb(DAY.skyTop));
  assert.deepEqual(paletteAt(1).skyTop, hexToRgb(DUSK.skyTop));
  assert.deepEqual(Object.keys(DUSK).sort(), Object.keys(DAY).sort());
  assert.equal(css([1, 2, 3], 0.5), 'rgba(1, 2, 3, 0.5)');
});
