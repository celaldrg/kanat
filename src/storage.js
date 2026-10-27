/**
 * Tiny localStorage wrapper. Every access is wrapped in try/catch so private
 * browsing, blocked storage or a full quota never crash the game.
 * Nothing is touched at import time.
 */

/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} Backing */
/** @typedef {{ get(key: string, fallback?: string | null): string | null, set(key: string, value: unknown): boolean }} Storage */

/**
 * Create a storage helper.
 * @param {Backing | null} [backing] Store to use; defaults to `globalThis.localStorage`, looked up on every call.
 * @returns {Storage}
 */
export function createStorage(backing) {
  const resolve = () => (backing === undefined ? globalThis.localStorage : backing) ?? null;
  return {
    get(key, fallback = null) {
      try {
        const store = resolve();
        const value = store ? store.getItem(key) : null;
        return value ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        const store = resolve();
        if (!store) return false;
        store.setItem(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}
