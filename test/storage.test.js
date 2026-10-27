import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

/** Minimal in-memory stand-in for window.localStorage. */
function fakeLocalStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

/** A storage whose every access throws, like Safari private mode or a full quota. */
const throwingStorage = {
  getItem() {
    throw new Error('SecurityError: storage disabled');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

/** Temporarily replace globalThis.localStorage with a property descriptor. */
function withGlobalStorage(descriptor, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('values round-trip through an injected store', () => {
  const store = fakeLocalStorage();
  const storage = createStorage(store);
  assert.equal(storage.set('lang', 'tr'), true);
  assert.equal(storage.get('lang'), 'tr');
  assert.equal(store.getItem('lang'), 'tr');
  assert.equal(storage.set('n', 5), true);
  assert.equal(storage.get('n'), '5', 'values are stored as strings');
});

test('missing keys return the fallback', () => {
  const storage = createStorage(fakeLocalStorage());
  assert.equal(storage.get('nope'), null);
  assert.equal(storage.get('nope', 'en'), 'en');
});

test('the helper never throws when localStorage throws', () => {
  const storage = createStorage(throwingStorage);
  assert.doesNotThrow(() => storage.get('kanat.best'));
  assert.doesNotThrow(() => storage.set('kanat.best', 3));
  assert.equal(storage.get('kanat.best', '0'), '0');
  assert.equal(storage.set('kanat.best', 3), false);
});

test('a null store (storage unavailable) is handled', () => {
  const storage = createStorage(null);
  assert.equal(storage.get('k', 'x'), 'x');
  assert.equal(storage.set('k', 'v'), false);
});

test('by default it uses globalThis.localStorage, looked up lazily', () => {
  const store = fakeLocalStorage();
  const storage = createStorage();
  withGlobalStorage({ value: store, writable: true }, () => {
    assert.equal(storage.set('kanat.lang', 'tr'), true);
    assert.equal(storage.get('kanat.lang'), 'tr');
  });
  assert.equal(store.getItem('kanat.lang'), 'tr');
});

test('by default it survives a localStorage getter that throws', () => {
  const storage = createStorage();
  withGlobalStorage(
    {
      get() {
        throw new Error('SecurityError: access denied');
      },
    },
    () => {
      assert.equal(storage.get('k', 'fallback'), 'fallback');
      assert.equal(storage.set('k', 'v'), false);
    },
  );
});

test('importing the module does not touch localStorage', async () => {
  let touched = false;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      touched = true;
      throw new Error('should not be read at import time');
    },
  });
  try {
    await import('../src/storage.js?fresh-import');
  } finally {
    delete globalThis.localStorage;
  }
  assert.equal(touched, false);
});
