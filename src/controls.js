/**
 * Keyboard mapping. Pure module.
 */

const PRIMARY_CODES = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAUSE_CODES = new Set(['KeyP', 'Escape']);
const PRIMARY_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'Up', 'w', 'W']);
const PAUSE_KEYS = new Set(['p', 'P', 'Escape', 'Esc']);

/**
 * Game action for a key press. Uses KeyboardEvent.code first (layout independent)
 * and falls back to KeyboardEvent.key.
 * @param {string} code KeyboardEvent.code, may be empty.
 * @param {string} key KeyboardEvent.key.
 * @returns {'primary' | 'pause' | null}
 */
export function actionForKey(code, key) {
  if (PRIMARY_CODES.has(code)) return 'primary';
  if (PAUSE_CODES.has(code)) return 'pause';
  if (code) return null;
  if (PRIMARY_KEYS.has(key)) return 'primary';
  if (PAUSE_KEYS.has(key)) return 'pause';
  return null;
}
