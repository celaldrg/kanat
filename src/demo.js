/**
 * Deterministic mid-game scene for the README screenshot (`?demo`) and a tiny
 * autopilot that keeps the plane flying through the gates. Pure module.
 */
import { createGame, FIXED_STEP } from './engine.js';
import { makeConfig, difficultyAt } from './config.js';
import { circleHitsObstacle } from './collision.js';

/** Score shown in the demo scene. */
export const DEMO_SCORE = 12;
/** Seed used for the gates that spawn after the preset ones. */
export const DEMO_SEED = 2026;
/** Autopilot look-ahead in fixed steps (0.75 s). */
const PILOT_STEPS = 90;
/** Steps the first glide decision covers (one 60 Hz frame) and the later decision spacing. */
const PILOT_FIRST = 2;
const PILOT_SEGMENT = 8;
/** Extra clearance in px the autopilot keeps from gates, ceiling and ground. */
const PILOT_MARGIN = 3;

/**
 * Preset for the demo: score 12, two gates on screen and the plane threading the first gap.
 * @param {ReturnType<typeof makeConfig>} cfg
 * @returns {import('./engine.js').InitialState}
 */
export function demoInitialState(cfg) {
  const { gap } = difficultyAt(DEMO_SCORE, cfg);
  const current = { x: cfg.playerX - 54, gapY: 330, gap, variant: 0.3 };
  const next = { x: current.x + cfg.spacing, gapY: 250, gap, variant: 0.75 };
  return {
    phase: 'playing',
    score: DEMO_SCORE,
    distance: DEMO_SCORE * cfg.spacing + cfg.width,
    untilSpawn: next.x + cfg.spacing - (cfg.width + cfg.spawnMargin),
    player: { y: current.gapY - 8, vy: -150 },
    obstacles: [current, next],
  };
}

/**
 * Create a game that starts in the demo scene. It never persists a best score.
 * @param {{ seed?: number, config?: object }} [options]
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame(options = {}) {
  const cfg = makeConfig(options.config);
  return createGame({
    seed: options.seed ?? DEMO_SEED,
    config: options.config,
    initialState: demoInitialState(cfg),
  });
}

function crashes(state, cfg, circle, step) {
  if (circle.y - circle.r <= 0 || circle.y + circle.r >= cfg.groundY) return true;
  const shift = state.speed * FIXED_STEP * step;
  return state.obstacles.some((gate) => circleHitsObstacle(circle, { ...gate, x: gate.x - shift }, cfg.groundY));
}

/**
 * Depth-first search over flap decisions: can the plane survive until the end of
 * the look-ahead if it flaps (or not) at `step` and then plays well?
 */
function canSurvive(state, cfg, plane, step, length, flap) {
  const r = state.player.r + PILOT_MARGIN;
  let { y, vy } = plane;
  if (flap) vy = cfg.flapImpulse;
  const end = Math.min(step + length, PILOT_STEPS);
  for (let i = step; i < end; i++) {
    vy = Math.min(vy + cfg.gravity * FIXED_STEP, cfg.maxFallSpeed);
    y += vy * FIXED_STEP;
    if (crashes(state, cfg, { x: state.player.x, y, r }, i + 1)) return false;
  }
  if (end >= PILOT_STEPS) return true;
  const next = { y, vy };
  return canSurvive(state, cfg, next, end, PILOT_SEGMENT, false) || canSurvive(state, cfg, next, end, PILOT_SEGMENT, true);
}

/**
 * Autopilot decision for the demo: glide while some later flap sequence stays
 * safe; otherwise flap (unless already climbing into a hopeless spot).
 * @param {ReturnType<ReturnType<typeof createGame>['getState']>} state Snapshot from getState().
 * @param {ReturnType<typeof makeConfig>} cfg Config of the same game (game.config).
 * @returns {boolean}
 */
export function shouldAutoFlap(state, cfg) {
  if (state.phase !== 'playing') return false;
  if (canSurvive(state, cfg, state.player, 0, PILOT_FIRST, false)) return false;
  return state.player.vy >= 0 || canSurvive(state, cfg, state.player, 0, PILOT_FIRST, true);
}
