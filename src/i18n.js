/**
 * User interface strings in English and Turkish. Pure module.
 * Placeholders use {name} and are filled by translate().
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);
export const DEFAULT_LANGUAGE = 'en';

/** All visible strings, keyed by language. Both tables must have the same keys. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    docTitle: 'Kanat · one-tap paper plane game',
    title: 'Kanat',
    tagline: 'Thread the stone gates from day into dusk.',
    newGame: 'New game',
    pause: 'Pause',
    resume: 'Resume',
    mute: 'Mute sound',
    unmute: 'Unmute sound',
    langButton: 'TR',
    switchLang: 'TR – switch to Turkish',
    canvasLabel: 'Kanat play area: a paper plane flying between stone gates',
    tapToFly: 'Tap or press Space to fly',
    keysHint: 'Space, ↑ or W to flap · P or Esc to pause',
    best: 'Best',
    score: 'Score',
    paused: 'Paused',
    resumeHint: 'Tap or press P to continue',
    gameOver: 'Game over',
    newBest: 'New best!',
    playAgain: 'Play again',
    restartHint: 'or press Space',
    medalGold: 'Gold medal',
    medalSilver: 'Silver medal',
    medalBronze: 'Bronze medal',
    medalNone: 'No medal yet',
    nextBronze: 'Bronze at 10 points',
    nextSilver: 'Silver at 25 points',
    nextGold: 'Gold at 50 points',
    medalTop: 'The highest medal in the sky',
    announceOver: 'Game over. Score {score}. Best {best}.',
    source: 'Source on GitHub',
  }),
  tr: Object.freeze({
    docTitle: 'Kanat · tek dokunuşluk kağıt uçak oyunu',
    title: 'Kanat',
    tagline: 'Gündüzden alacakaranlığa taş kapılardan geç.',
    newGame: 'Yeni oyun',
    pause: 'Duraklat',
    resume: 'Devam et',
    mute: 'Sesi kapat',
    unmute: 'Sesi aç',
    langButton: 'EN',
    switchLang: 'EN – İngilizceye geç',
    canvasLabel: 'Kanat oyun alanı: taş kapılar arasında uçan bir kağıt uçak',
    tapToFly: 'Uçmak için dokun ya da Boşluk tuşuna bas',
    keysHint: 'Kanat çırpmak için Boşluk, ↑ ya da W · Duraklatmak için P ya da Esc',
    best: 'En iyi',
    score: 'Skor',
    paused: 'Duraklatıldı',
    resumeHint: 'Devam etmek için dokun ya da P tuşuna bas',
    gameOver: 'Oyun bitti',
    newBest: 'Yeni rekor!',
    playAgain: 'Tekrar oyna',
    restartHint: 'ya da Boşluk tuşuna bas',
    medalGold: 'Altın madalya',
    medalSilver: 'Gümüş madalya',
    medalBronze: 'Bronz madalya',
    medalNone: 'Henüz madalya yok',
    nextBronze: 'Bronz: 10 puan',
    nextSilver: 'Gümüş: 25 puan',
    nextGold: 'Altın: 50 puan',
    medalTop: 'Gökyüzünün en yüksek madalyası',
    announceOver: 'Oyun bitti. Skor {score}. En iyi {best}.',
    source: "Kaynak kodu GitHub'da",
  }),
});

/**
 * Reduce any value (a saved setting, "tr-TR", null) to a supported language.
 * @param {unknown} value
 * @returns {'en' | 'tr'}
 */
export function normalizeLanguage(value) {
  const short = String(value ?? '').trim().slice(0, 2).toLowerCase();
  return LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
}

/**
 * The language the toggle button switches to.
 * @param {string} lang Current language.
 * @returns {'en' | 'tr'}
 */
export function otherLanguage(lang) {
  return normalizeLanguage(lang) === 'en' ? 'tr' : 'en';
}

/**
 * Look up a string and fill its {placeholders}. Falls back to English, then to the key.
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = STRINGS[normalizeLanguage(lang)];
  const template = table[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}
