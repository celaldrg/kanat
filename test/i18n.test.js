import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage, otherLanguage, translate } from '../src/i18n.js';

test('English and Turkish define the same non-empty keys', () => {
  const en = Object.keys(STRINGS.en).sort();
  const tr = Object.keys(STRINGS.tr).sort();
  assert.deepEqual(tr, en);
  for (const lang of LANGUAGES) {
    for (const [key, value] of Object.entries(STRINGS[lang])) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('placeholders match between languages', () => {
  const names = (text) => (text.match(/\{\w+\}/g) ?? []).sort();
  for (const key of Object.keys(STRINGS.en)) {
    assert.deepEqual(names(STRINGS.tr[key]), names(STRINGS.en[key]), key);
  }
});

test('the language button shows the other language', () => {
  assert.equal(translate('en', 'langButton'), 'TR');
  assert.equal(translate('tr', 'langButton'), 'EN');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
});

test('normalizeLanguage accepts saved values and falls back to English', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('TR-tr'), 'tr');
  assert.equal(normalizeLanguage('en-GB'), 'en');
  assert.equal(normalizeLanguage(null), DEFAULT_LANGUAGE);
  assert.equal(normalizeLanguage('de'), DEFAULT_LANGUAGE);
});

test('translate fills placeholders and falls back sensibly', () => {
  assert.equal(translate('en', 'announceOver', { score: 12, best: 30 }), 'Game over. Score 12. Best 30.');
  assert.equal(translate('tr', 'announceOver', { score: 12, best: 30 }), 'Oyun bitti. Skor 12. En iyi 30.');
  assert.equal(translate('xx', 'newGame'), 'New game', 'unknown language uses English');
  assert.equal(translate('en', 'noSuchKey'), 'noSuchKey', 'unknown key returns the key');
  assert.equal(translate('en', 'announceOver'), 'Game over. Score {score}. Best {best}.', 'missing params stay visible');
});
