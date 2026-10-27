/**
 * Entry point: wires the pure engine to the canvas renderer, the DOM overlays,
 * input, sound and saved settings, then runs the animation loop.
 */
import { createGame } from './engine.js';
import { createDemoGame, shouldAutoFlap } from './demo.js';
import { createStorage } from './storage.js';
import { createRenderer } from './render.js';
import { createUi } from './ui.js';
import { createAudio } from './audio.js';
import { bindInput } from './input.js';
import { normalizeLanguage, otherLanguage } from './i18n.js';
import { primaryActionFor } from './view.js';

const LANG_KEY = 'kanat.lang';
const MUTED_KEY = 'kanat.muted';
/** Seconds the demo lingers on a crash before it starts over. */
const DEMO_RESTART_AFTER = 1;

function randomSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0];
}

function start() {
  const storage = createStorage();
  const ui = createUi(document);
  const { elements } = ui;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const audio = createAudio({ muted: storage.get(MUTED_KEY, '0') === '1' });
  let demo = new URLSearchParams(window.location.search).has('demo');
  let game = demo ? createDemoGame() : createGame({ seed: randomSeed(), storage });
  let lang = normalizeLanguage(storage.get(LANG_KEY, 'en'));
  let lastTime = null;

  const renderer = createRenderer(elements.canvas, {
    world: game.config,
    reducedMotion: () => motionQuery.matches,
  });

  function newGame() {
    demo = false;
    game = createGame({ seed: randomSeed(), storage });
  }

  function primary() {
    const action = primaryActionFor(game.getState(), { demo });
    if (action === 'newGame') newGame();
    else if (action === 'resume') game.resume();
    else if (action === 'flap' && game.flap()) audio.play('flap');
  }

  function handleEvents(events, now) {
    for (const event of events) {
      if (event === 'hit') renderer.crash(now);
      audio.play(event === 'newBest' ? 'best' : event);
    }
  }

  function frame(now) {
    const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
    lastTime = now;
    if (demo && shouldAutoFlap(game.getState(), game.config)) game.flap();
    handleEvents(game.update(dt), now);
    const state = game.getState();
    if (demo && state.phase === 'over' && state.overTime >= DEMO_RESTART_AFTER) game = createDemoGame();
    renderer.draw(state, now);
    ui.sync(state, { demo });
    window.requestAnimationFrame(frame);
  }

  function fitCanvas() {
    const box = elements.canvas.getBoundingClientRect();
    renderer.resize(box.width, box.height, window.devicePixelRatio);
    renderer.draw(game.getState(), window.performance.now());
  }

  /** Drop keyboard focus after a mouse or touch click so Space keeps flapping. */
  function onClick(button, handler) {
    button.addEventListener('click', (event) => {
      handler();
      if (event.detail > 0) button.blur();
    });
  }

  onClick(elements.newGame, newGame);
  onClick(elements.again, newGame);
  onClick(elements.resume, () => game.resume());
  onClick(elements.pause, () => game.togglePause());
  onClick(elements.sound, () => {
    audio.setMuted(!audio.isMuted());
    storage.set(MUTED_KEY, audio.isMuted() ? '1' : '0');
    audio.unlock();
    ui.setMuted(audio.isMuted());
  });
  onClick(elements.lang, () => {
    lang = otherLanguage(lang);
    storage.set(LANG_KEY, lang);
    ui.setLanguage(lang);
  });

  bindInput({
    playArea: elements.playArea,
    onPrimary: primary,
    onPause: () => game.togglePause(),
    onGesture: () => audio.unlock(),
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
    lastTime = null;
  });

  new ResizeObserver(fitCanvas).observe(elements.canvas);
  ui.setLanguage(lang);
  ui.setMuted(audio.isMuted());
  ui.sync(game.getState(), { demo });
  fitCanvas();
  document.documentElement.classList.add('animate');
  window.requestAnimationFrame(frame);
}

start();
