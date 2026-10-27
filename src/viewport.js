/**
 * Canvas sizing for crisp drawing on high-DPI screens. Pure module.
 */

/** Upper bound for the device pixel ratio, to keep the backing store small on 4x screens. */
export const MAX_PIXEL_RATIO = 3;

/**
 * Backing-store size and drawing scale for a canvas shown at a CSS size.
 * @param {number} cssWidth Displayed width in CSS pixels.
 * @param {number} cssHeight Displayed height in CSS pixels.
 * @param {number} pixelRatio window.devicePixelRatio.
 * @param {{ width: number, height: number }} world Logical size of the game field.
 * @returns {{ width: number, height: number, scaleX: number, scaleY: number }}
 */
export function backingStore(cssWidth, cssHeight, pixelRatio, world) {
  const ratio = Math.min(Math.max(pixelRatio || 1, 1), MAX_PIXEL_RATIO);
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  return { width, height, scaleX: width / world.width, scaleY: height / world.height };
}
