/**
 * Pointer and keyboard wiring. The key mapping itself lives in controls.js.
 */
import { actionForKey } from './controls.js';

const isControl = (target) => target instanceof Element && target.closest('button, a') !== null;

/**
 * Listen for game input.
 * - Tap / click on the play area (outside buttons): primary action.
 * - Space, ArrowUp, W: primary action. P, Escape: pause toggle.
 * - onGesture runs before the action on inputs that count as a user gesture (for audio).
 * @param {{ playArea: HTMLElement, onPrimary: () => void, onPause: () => void, onGesture: () => void }} handlers
 * @returns {void}
 */
export function bindInput({ playArea, onPrimary, onPause, onGesture }) {
  playArea.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (isControl(event.target)) return;
    event.preventDefault();
    if (event.pointerType === 'mouse') onGesture();
    onPrimary();
  });

  window.addEventListener('pointerup', onGesture);

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = actionForKey(event.code, event.key);
    if (!action) return;
    if (action === 'primary' && event.key === ' ' && isControl(event.target)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.key !== 'Escape') onGesture();
    if (action === 'primary') onPrimary();
    else onPause();
  });
}
