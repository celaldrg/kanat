/**
 * DOM side of the interface: translated text, overlays, header buttons and the
 * game-over panel. Only textContent and attributes are written (no innerHTML).
 */
import { translate } from './i18n.js';
import { overlayFor, medalView } from './view.js';

function queryElements(doc) {
  const byId = (id) => doc.getElementById(id);
  return {
    canvas: byId('game'),
    playArea: byId('play-area'),
    newGame: byId('btn-new'),
    pause: byId('btn-pause'),
    sound: byId('btn-sound'),
    lang: byId('btn-lang'),
    resume: byId('btn-resume'),
    again: byId('btn-again'),
    overlays: { ready: byId('overlay-ready'), paused: byId('overlay-paused'), over: byId('overlay-over') },
    readyBest: byId('ready-best'),
    overScore: byId('over-score'),
    overBest: byId('over-best'),
    medal: byId('medal'),
    medalName: byId('medal-name'),
    medalHint: byId('medal-hint'),
    newBest: byId('new-best'),
    announcer: byId('announcer'),
  };
}

function setLabel(node, text) {
  node.setAttribute('aria-label', text);
  node.title = text;
}

/**
 * Create the UI controller.
 * @param {Document} doc
 * @returns {{
 *   elements: ReturnType<typeof queryElements>,
 *   setLanguage(lang: string): void,
 *   setMuted(muted: boolean): void,
 *   sync(state: object, options: { demo: boolean }): void,
 * }}
 */
export function createUi(doc) {
  const el = queryElements(doc);
  let lang = 'en';
  let muted = false;
  let shown = { key: '' };
  const t = (key, params) => translate(lang, key, params);

  function applyStaticText() {
    doc.documentElement.lang = lang;
    doc.title = t('docTitle');
    for (const node of doc.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of doc.querySelectorAll('[data-i18n-label]')) setLabel(node, t(node.dataset.i18nLabel));
    el.lang.textContent = t('langButton');
    setLabel(el.lang, t('switchLang'));
    el.canvas.setAttribute('aria-label', t('canvasLabel'));
  }

  function applySoundButton() {
    el.sound.dataset.muted = String(muted);
    setLabel(el.sound, t(muted ? 'unmute' : 'mute'));
  }

  function showOverlay(name) {
    for (const [key, node] of Object.entries(el.overlays)) {
      const visible = key === name;
      node.classList.toggle('is-visible', visible);
      node.inert = !visible;
      node.setAttribute('aria-hidden', String(!visible));
    }
  }

  function fillGameOver(state) {
    const medal = medalView(state.medal);
    el.overScore.textContent = String(state.score);
    el.overBest.textContent = String(state.best);
    el.medal.className = `medal medal--${medal.tone}`;
    el.medalName.textContent = t(medal.nameKey);
    el.medalHint.textContent = t(medal.hintKey);
    el.newBest.hidden = !state.newBest;
  }

  function render(state, overlay) {
    const paused = state.phase === 'paused';
    showOverlay(overlay);
    el.playArea.dataset.phase = state.phase;
    el.readyBest.textContent = String(state.best);
    el.pause.disabled = !(paused || state.phase === 'playing');
    el.pause.dataset.paused = String(paused);
    setLabel(el.pause, t(paused ? 'resume' : 'pause'));
    if (overlay === 'over') fillGameOver(state);
  }

  return {
    elements: el,

    /** Switch every visible string to `lang` and update <html lang>. */
    setLanguage(next) {
      lang = next;
      applyStaticText();
      applySoundButton();
      shown = { key: '', overlay: shown.overlay };
    },

    /** Reflect the sound setting on the mute button. */
    setMuted(value) {
      muted = Boolean(value);
      applySoundButton();
    },

    /** Update overlays and buttons for a state snapshot; cheap when nothing changed. */
    sync(state, { demo }) {
      const overlay = overlayFor(state, { demo });
      const key = [overlay, state.phase, state.score, state.best, state.newBest].join('|');
      if (key === shown.key) return;
      const enteringOver = overlay === 'over' && shown.overlay !== 'over';
      render(state, overlay);
      if (enteringOver) el.announcer.textContent = t('announceOver', { score: state.score, best: state.best });
      shown = { key, overlay };
    },
  };
}
