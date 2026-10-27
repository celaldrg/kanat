/**
 * High score persistence and medals. Pure module; storage is injected.
 */

/** localStorage key for the best score. */
export const BEST_KEY = 'kanat.best';

/** Medal thresholds, highest first. */
export const MEDALS = Object.freeze([
  Object.freeze({ id: 'gold', min: 50 }),
  Object.freeze({ id: 'silver', min: 25 }),
  Object.freeze({ id: 'bronze', min: 10 }),
]);

/**
 * Read the stored best score.
 * @param {import('./storage.js').Storage} storage Helper from createStorage.
 * @returns {number} A non-negative integer; 0 when missing or corrupt.
 */
export function readBest(storage) {
  const value = Number.parseInt(storage.get(BEST_KEY, '0') ?? '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Persist a best score.
 * @param {import('./storage.js').Storage} storage Helper from createStorage.
 * @param {number} score
 * @returns {boolean} Whether the write succeeded.
 */
export function writeBest(storage, score) {
  return storage.set(BEST_KEY, String(Math.max(0, Math.floor(score))));
}

/**
 * Medal earned by a score.
 * @param {number} score
 * @returns {'gold' | 'silver' | 'bronze' | null}
 */
export function medalFor(score) {
  const medal = MEDALS.find((m) => score >= m.min);
  return medal ? medal.id : null;
}
