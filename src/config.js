/**
 * Tunable game constants and the difficulty curve. Pure module.
 * World units are logical pixels of a 360 x 640 portrait field.
 */

/** Default tuning. Speeds are px/s, accelerations px/s^2, angles radians. */
export const DEFAULT_CONFIG = Object.freeze({
  width: 360,
  height: 640,
  groundHeight: 72,
  playerX: 110,
  playerRadius: 13,
  startY: 290,
  gravity: 1500,
  flapImpulse: -420,
  maxFallSpeed: 600,
  minRotation: -0.45,
  maxRotation: 1.2,
  obstacleWidth: 62,
  spacing: 210,
  firstSpawnDistance: 140,
  spawnMargin: 20,
  gapMargin: 60,
  maxGapShift: 110,
  baseSpeed: 150,
  speedPerPoint: 2.5,
  maxSpeed: 220,
  baseGap: 165,
  gapShrinkPerPoint: 1.5,
  minGap: 125,
  skyFullAtScore: 50,
  bobAmplitude: 6,
  bobSpeed: 3.5,
  maxFrameTime: 0.25,
});

/**
 * Merge overrides into the defaults and add derived values.
 * @param {Partial<typeof DEFAULT_CONFIG>} [overrides]
 * @returns {Readonly<typeof DEFAULT_CONFIG & { groundY: number }>}
 * @throws {TypeError} When an override key is unknown (catches typos).
 */
export function makeConfig(overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_CONFIG, key)) throw new TypeError(`Unknown config key: ${key}`);
  }
  const merged = { ...DEFAULT_CONFIG, ...overrides };
  return Object.freeze({ ...merged, groundY: merged.height - merged.groundHeight });
}

/**
 * Scroll speed and gap size for a score; both are capped.
 * @param {number} score
 * @param {typeof DEFAULT_CONFIG} cfg
 * @returns {{ speed: number, gap: number }}
 */
export function difficultyAt(score, cfg) {
  return {
    speed: Math.min(cfg.baseSpeed + score * cfg.speedPerPoint, cfg.maxSpeed),
    gap: Math.max(cfg.baseGap - score * cfg.gapShrinkPerPoint, cfg.minGap),
  };
}

/**
 * How far the sky has shifted from day (0) to dusk (1).
 * @param {number} score
 * @param {typeof DEFAULT_CONFIG} cfg
 * @returns {number} Value in [0, 1].
 */
export function skyProgress(score, cfg) {
  return Math.min(Math.max(score / cfg.skyFullAtScore, 0), 1);
}
