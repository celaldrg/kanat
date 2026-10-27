/**
 * Scene colours and the day-to-dusk blend. Pure module.
 * Colours are [r, g, b] arrays so they can be mixed; css() turns them into strings.
 */

/** Morning palette (score 0). */
export const DAY = Object.freeze({
  skyTop: '#6f9cf5',
  skyMid: '#b8c4fb',
  skyBottom: '#fde3c8',
  sun: '#fff1b8',
  cloud: '#ffffff',
  star: '#ffffff',
  hillFar: '#a4b2ec',
  hillNear: '#7f8bd6',
  stoneLight: '#e6e1ec',
  stoneMid: '#bfb6cc',
  stoneDark: '#8a809b',
  mortar: '#6b6280',
  vine: '#3f7d58',
  leaf: '#62b072',
  gem: '#a78bfa',
  ground: '#4a3d63',
  groundDark: '#3a2f50',
  moss: '#7bbf7a',
  mossLight: '#a9df98',
});

/** Dusk palette (score skyFullAtScore and above). */
export const DUSK = Object.freeze({
  skyTop: '#17153b',
  skyMid: '#5a2d82',
  skyBottom: '#f2874f',
  sun: '#ffa45c',
  cloud: '#f5b49c',
  star: '#fff3d6',
  hillFar: '#4b3572',
  hillNear: '#2e2150',
  stoneLight: '#b3a6c2',
  stoneMid: '#82759a',
  stoneDark: '#4d4360',
  mortar: '#352c45',
  vine: '#2c5a45',
  leaf: '#45905f',
  gem: '#d8ccff',
  ground: '#271f3a',
  groundDark: '#1c162b',
  moss: '#4f7f5c',
  mossLight: '#73a87d',
});

/**
 * Parse "#rrggbb" into [r, g, b].
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Linear blend of two hex colours.
 * @param {string} from
 * @param {string} to
 * @param {number} t 0 = from, 1 = to (clamped).
 * @returns {[number, number, number]} Rounded channels.
 */
export function mixColor(from, to, t) {
  const k = Math.min(Math.max(t, 0), 1);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
}

/**
 * The full scene palette for a sky progress value.
 * @param {number} progress 0 = day, 1 = dusk (from getState().sky).
 * @returns {Record<keyof typeof DAY, [number, number, number]>}
 */
export function paletteAt(progress) {
  const palette = {};
  for (const key of Object.keys(DAY)) palette[key] = mixColor(DAY[key], DUSK[key], progress);
  return palette;
}

/**
 * CSS colour string for a palette entry.
 * @param {[number, number, number]} rgb
 * @param {number} [alpha=1]
 * @returns {string}
 */
export function css(rgb, alpha = 1) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
