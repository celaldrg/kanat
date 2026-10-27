/**
 * Kanat game engine: physics, gates, scoring and collisions.
 * Pure module: no DOM, window or storage access at import time. Randomness comes
 * from an injectable seeded RNG and time only from update(dt), so runs are
 * reproducible and testable in Node.
 */
import { createRng, randomBetween } from './rng.js';
import { circleHitsObstacle } from './collision.js';
import { makeConfig, difficultyAt, skyProgress } from './config.js';
import { readBest, writeBest, medalFor } from './score.js';

/** Length of one simulation step in seconds (120 Hz). */
export const FIXED_STEP = 1 / 120;
const STEP_EPSILON = 1e-9;

/** Game phases. */
export const PHASES = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
});

/**
 * @typedef {object} InitialState Preset applied to the first round (used by the demo).
 * @property {'ready' | 'playing' | 'paused'} [phase]
 * @property {number} [score]
 * @property {number} [distance] Scrolled distance, drives background parallax.
 * @property {number} [untilSpawn] Scroll distance left before the next gate spawns.
 * @property {{ y?: number, vy?: number }} [player]
 * @property {Array<{ x: number, gapY: number, gap?: number, variant?: number }>} [obstacles]
 */

/**
 * @typedef {object} GameOptions
 * @property {number} [seed=1] Seed for the built-in RNG.
 * @property {() => number} [rng] Custom random source in [0, 1); overrides `seed`.
 * @property {Partial<import('./config.js').DEFAULT_CONFIG>} [config] Tuning overrides.
 * @property {import('./storage.js').Storage} [storage] Persists the best score; omitted = memory only.
 * @property {InitialState} [initialState]
 */

/**
 * Nose angle for a vertical velocity: tilted up while rising, down while falling.
 * @param {number} vy Vertical velocity in px/s (positive = down).
 * @param {{ maxFallSpeed: number, minRotation: number, maxRotation: number }} cfg
 * @returns {number} Angle in radians, clamped to [minRotation, maxRotation].
 */
export function rotationFromVelocity(vy, cfg) {
  const angle = (vy / cfg.maxFallSpeed) * cfg.maxRotation;
  return Math.min(Math.max(angle, cfg.minRotation), cfg.maxRotation);
}

function newRoundState(cfg) {
  return {
    phase: PHASES.READY,
    score: 0,
    newBest: false,
    clock: 0,
    elapsed: 0,
    overTime: 0,
    distance: 0,
    speed: difficultyAt(0, cfg).speed,
    untilSpawn: cfg.firstSpawnDistance,
    lastGapY: cfg.startY,
    nextId: 1,
    player: { x: cfg.playerX, y: cfg.startY, vy: 0, r: cfg.playerRadius },
    obstacles: [],
  };
}

function addGate(state, cfg, { x, gapY, gap, variant }) {
  state.obstacles.push({
    id: state.nextId++,
    x,
    width: cfg.obstacleWidth,
    gapY,
    gap,
    passed: x + cfg.obstacleWidth < state.player.x,
    variant,
  });
  state.lastGapY = gapY;
}

function applyPreset(state, preset, cfg) {
  const allowed = [PHASES.READY, PHASES.PLAYING, PHASES.PAUSED];
  if (preset.phase !== undefined && !allowed.includes(preset.phase)) {
    throw new TypeError(`Invalid preset phase: ${preset.phase}`);
  }
  state.phase = preset.phase ?? state.phase;
  state.score = preset.score ?? state.score;
  state.distance = preset.distance ?? state.distance;
  state.untilSpawn = preset.untilSpawn ?? state.untilSpawn;
  state.speed = difficultyAt(state.score, cfg).speed;
  Object.assign(state.player, preset.player);
  const { gap } = difficultyAt(state.score, cfg);
  for (const gate of preset.obstacles ?? []) {
    addGate(state, cfg, { x: gate.x, gapY: gate.gapY, gap: gate.gap ?? gap, variant: gate.variant ?? 0.5 });
  }
}

/**
 * Choose the centre of the next gap: inside the play field (keeping gapMargin from
 * ceiling and ground) and at most maxGapShift away from the previous gap.
 * @param {() => number} rng Random source in [0, 1).
 * @param {number} gap Gap height in px.
 * @param {number} previousY Centre of the previous gap.
 * @param {ReturnType<typeof makeConfig>} cfg
 * @returns {number}
 */
export function pickGapY(rng, gap, previousY, cfg) {
  const lowest = cfg.gapMargin + gap / 2;
  const highest = cfg.groundY - cfg.gapMargin - gap / 2;
  const min = Math.max(lowest, previousY - cfg.maxGapShift);
  const max = Math.min(highest, previousY + cfg.maxGapShift);
  const value = randomBetween(rng, min, max);
  return Math.min(Math.max(value, lowest), highest);
}

function spawnGate(state, cfg, rng, x) {
  const { gap } = difficultyAt(state.score, cfg);
  const gapY = pickGapY(rng, gap, state.lastGapY, cfg);
  addGate(state, cfg, { x, gapY, gap, variant: rng() });
}

function scrollGates(state, cfg, rng, dx) {
  for (const gate of state.obstacles) gate.x -= dx;
  state.distance += dx;
  state.untilSpawn -= dx;
  if (state.untilSpawn <= 0) {
    spawnGate(state, cfg, rng, cfg.width + cfg.spawnMargin + state.untilSpawn);
    state.untilSpawn += cfg.spacing;
  }
  state.obstacles = state.obstacles.filter((gate) => gate.x + gate.width > -cfg.spawnMargin);
}

function applyGravity(player, cfg, h) {
  player.vy = Math.min(player.vy + cfg.gravity * h, cfg.maxFallSpeed);
  player.y += player.vy * h;
}

function hasCrashed(state, cfg) {
  const p = state.player;
  if (p.y - p.r <= 0 || p.y + p.r >= cfg.groundY) return true;
  return state.obstacles.some((gate) => circleHitsObstacle(p, gate, cfg.groundY));
}

function awardPasses(state, events) {
  for (const gate of state.obstacles) {
    if (!gate.passed && gate.x + gate.width < state.player.x) {
      gate.passed = true;
      state.score += 1;
      events.push('score');
    }
  }
}

function clampToGround(player, cfg) {
  if (player.y + player.r >= cfg.groundY) player.y = cfg.groundY - player.r;
}

function stepReady(state, cfg, h) {
  state.clock += h;
  state.distance += state.speed * h;
  state.player.y = cfg.startY + Math.sin(state.clock * cfg.bobSpeed) * cfg.bobAmplitude;
}

function stepPlaying(state, cfg, rng, h, events) {
  state.clock += h;
  state.elapsed += h;
  state.speed = difficultyAt(state.score, cfg).speed;
  applyGravity(state.player, cfg, h);
  scrollGates(state, cfg, rng, state.speed * h);
  if (hasCrashed(state, cfg)) {
    clampToGround(state.player, cfg);
    state.phase = PHASES.OVER;
    events.push('hit');
    return;
  }
  awardPasses(state, events);
}

function stepOver(state, cfg, h) {
  state.clock += h;
  state.overTime += h;
  if (state.player.y + state.player.r < cfg.groundY) applyGravity(state.player, cfg, h);
  clampToGround(state.player, cfg);
}

function snapshot(state, cfg, best) {
  const p = state.player;
  return {
    phase: state.phase,
    score: state.score,
    best,
    newBest: state.newBest,
    medal: medalFor(state.score),
    clock: state.clock,
    elapsed: state.elapsed,
    overTime: state.overTime,
    distance: state.distance,
    speed: state.speed,
    sky: skyProgress(state.score, cfg),
    width: cfg.width,
    height: cfg.height,
    groundY: cfg.groundY,
    player: { x: p.x, y: p.y, vy: p.vy, r: p.r, rotation: rotationFromVelocity(p.vy, cfg) },
    obstacles: state.obstacles.map((gate) => ({ ...gate })),
  };
}

/**
 * Create a game. Drive it with flap() on input and update(dt) every frame;
 * read getState() to render.
 * @param {GameOptions} [options]
 * @returns {{
 *   config: ReturnType<typeof makeConfig>,
 *   flap(): boolean,
 *   update(dt: number): string[],
 *   pause(): boolean,
 *   resume(): boolean,
 *   togglePause(): boolean,
 *   restart(seed?: number): void,
 *   getState(): ReturnType<typeof snapshot>,
 * }}
 */
export function createGame(options = {}) {
  const cfg = makeConfig(options.config);
  const storage = options.storage ?? null;
  let rng = options.rng ?? createRng(options.seed ?? 1);
  let best = storage ? readBest(storage) : 0;
  let accumulator = 0;
  let state = newRoundState(cfg);
  if (options.initialState) applyPreset(state, options.initialState, cfg);

  function finishRound(events) {
    if (state.score <= best) return;
    best = state.score;
    state.newBest = true;
    if (storage) writeBest(storage, best);
    events.push('newBest');
  }

  /** Pause a running round. Returns true if the phase changed. */
  function pause() {
    if (state.phase !== PHASES.PLAYING) return false;
    state.phase = PHASES.PAUSED;
    return true;
  }

  /** Resume a paused round. Returns true if the phase changed. */
  function resume() {
    if (state.phase !== PHASES.PAUSED) return false;
    state.phase = PHASES.PLAYING;
    accumulator = 0;
    return true;
  }

  function step(events) {
    if (state.phase === PHASES.READY) stepReady(state, cfg, FIXED_STEP);
    else if (state.phase === PHASES.OVER) stepOver(state, cfg, FIXED_STEP);
    else {
      stepPlaying(state, cfg, rng, FIXED_STEP, events);
      if (state.phase === PHASES.OVER) finishRound(events);
    }
  }

  return {
    config: cfg,

    /** Flap the wings; starts the round from the ready screen. Returns true if it flapped. */
    flap() {
      if (state.phase === PHASES.READY) state.phase = PHASES.PLAYING;
      if (state.phase !== PHASES.PLAYING) return false;
      state.player.vy = cfg.flapImpulse;
      return true;
    },

    /**
     * Advance time by dt seconds in fixed steps (frame-rate independent).
     * Returns the events of this call: 'score', 'hit', 'newBest'.
     */
    update(dt) {
      const events = [];
      if (!(dt > 0) || state.phase === PHASES.PAUSED) return events;
      accumulator += Math.min(dt, cfg.maxFrameTime);
      while (accumulator + STEP_EPSILON >= FIXED_STEP) {
        accumulator -= FIXED_STEP;
        step(events);
      }
      return events;
    },

    pause,
    resume,

    /** Pause or resume. Returns true if the phase changed. */
    togglePause() {
      return state.phase === PHASES.PAUSED ? resume() : pause();
    },

    /** Start a new round on the ready screen; an optional seed reseeds the RNG. */
    restart(seed) {
      if (seed !== undefined) rng = createRng(seed);
      state = newRoundState(cfg);
      accumulator = 0;
    },

    /** Read-only snapshot of the current state for rendering. */
    getState() {
      return snapshot(state, cfg, best);
    },
  };
}
