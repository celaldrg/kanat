/**
 * Small view decisions shared by the UI: which overlay to show, what a tap or
 * Space press means right now, and how a medal is labelled. Pure module.
 */

/** Seconds after a crash before the game-over panel appears. */
export const OVER_PANEL_DELAY = 0.5;
/** Seconds after a crash before a tap or Space starts a new round (avoids accidental restarts). */
export const RESTART_DELAY = 0.6;

const MEDAL_VIEWS = Object.freeze({
  gold: Object.freeze({ nameKey: 'medalGold', hintKey: 'medalTop' }),
  silver: Object.freeze({ nameKey: 'medalSilver', hintKey: 'nextGold' }),
  bronze: Object.freeze({ nameKey: 'medalBronze', hintKey: 'nextSilver' }),
  none: Object.freeze({ nameKey: 'medalNone', hintKey: 'nextBronze' }),
});

/**
 * Overlay for a state snapshot.
 * @param {{ phase: string, overTime: number }} state
 * @param {{ demo?: boolean }} [options] The demo scene never shows the game-over panel.
 * @returns {'ready' | 'paused' | 'over' | null}
 */
export function overlayFor(state, { demo = false } = {}) {
  if (state.phase === 'ready') return 'ready';
  if (state.phase === 'paused') return 'paused';
  if (state.phase === 'over' && !demo && state.overTime >= OVER_PANEL_DELAY) return 'over';
  return null;
}

/**
 * Meaning of the primary input (tap, click, Space, ArrowUp, W).
 * @param {{ phase: string, overTime: number }} state
 * @param {{ demo?: boolean }} [options] In the demo any primary input leaves for a real game.
 * @returns {'flap' | 'resume' | 'newGame' | 'none'}
 */
export function primaryActionFor(state, { demo = false } = {}) {
  if (demo) return 'newGame';
  if (state.phase === 'paused') return 'resume';
  if (state.phase === 'over') return state.overTime >= RESTART_DELAY ? 'newGame' : 'none';
  return 'flap';
}

/**
 * i18n keys and CSS modifier for a medal.
 * @param {'gold' | 'silver' | 'bronze' | null} medal
 * @returns {{ tone: string, nameKey: string, hintKey: string }}
 */
export function medalView(medal) {
  const tone = medal && Object.hasOwn(MEDAL_VIEWS, medal) ? medal : 'none';
  return { tone, ...MEDAL_VIEWS[tone] };
}
