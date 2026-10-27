/**
 * Seeded pseudo-random number generator (mulberry32).
 * Pure module: no DOM, no globals.
 */

/**
 * Create a deterministic random source.
 * @param {number} [seed=1] Any number; it is reduced to an unsigned 32-bit integer.
 * @returns {() => number} Function returning floats in [0, 1).
 */
export function createRng(seed = 1) {
  let a = Number(seed) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw a float in [min, max) from a random source.
 * @param {() => number} rng Random source returning [0, 1).
 * @param {number} min Lower bound (inclusive).
 * @param {number} max Upper bound (exclusive).
 * @returns {number}
 */
export function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}
