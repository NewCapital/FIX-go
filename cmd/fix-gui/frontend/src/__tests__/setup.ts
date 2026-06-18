import '@testing-library/jest-dom';

// jsdom 28.x (current devDependency) does not expose localStorage /
// sessionStorage as globals in the vitest jsdom environment. Several slice
// unit tests (transactionsSliceViews, transactionsSliceFilters,
// explorerSliceSearchHistory) reproduce slice logic that persists to
// localStorage, so provide a minimal in-memory Storage polyfill here.
// Production code uses the real webview localStorage; this only affects tests.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createMemoryStorage(),
    configurable: true,
  });
}
