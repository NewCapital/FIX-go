import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for the search-history logic in the explorer slice.
 *
 * Reproduces the slice's localStorage shape-guard, dedup, cap, and round-trip
 * behavior in isolation — same pattern as transactionsSliceViews.test.ts
 * (transitive @wailsjs imports don't resolve in vitest).
 *
 * The reproductions mirror the actual slice code in
 * cmd/fix-gui/frontend/src/store/slices/explorerSlice.ts. If the slice
 * changes shape, these reproductions must change in lockstep.
 */

type SearchHistoryItemType = 'block' | 'transaction' | 'address';

interface SearchHistoryItem {
  query: string;
  type: SearchHistoryItemType;
  timestamp: number;
  label?: string;
}

const STORAGE_KEY_SEARCH_HISTORY = 'fix_explorerSearchHistory';
const MAX_SEARCH_HISTORY = 10;
const VALID_TYPES: readonly SearchHistoryItemType[] = ['block', 'transaction', 'address'];

function isValidSearchHistoryItem(v: unknown): v is SearchHistoryItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.query !== 'string' || o.query === '') return false;
  if (typeof o.type !== 'string' || !VALID_TYPES.includes(o.type as SearchHistoryItemType)) return false;
  if (typeof o.timestamp !== 'number' || !Number.isFinite(o.timestamp)) return false;
  if (o.label !== undefined && typeof o.label !== 'string') return false;
  return true;
}

function loadSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSearchHistoryItem).slice(0, MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

function persistSearchHistory(arr: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(arr));
  } catch {
    // silently swallow quota/disabled storage errors
  }
}

interface SliceState {
  searchHistory: SearchHistoryItem[];
}

function addToSearchHistory(state: SliceState, item: SearchHistoryItem): SliceState {
  const deduped = state.searchHistory.filter((e) => e.query !== item.query);
  const next = [item, ...deduped].slice(0, MAX_SEARCH_HISTORY);
  persistSearchHistory(next);
  return { ...state, searchHistory: next };
}

function clearSearchHistory(state: SliceState): SliceState {
  persistSearchHistory([]);
  return { ...state, searchHistory: [] };
}

const mk = (query: string, type: SearchHistoryItemType, timestamp = 1000, label?: string): SearchHistoryItem => ({
  query,
  type,
  timestamp,
  ...(label !== undefined ? { label } : {}),
});

describe('explorer slice — search history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('addToSearchHistory', () => {
    it('adds an item, newest first', () => {
      let state: SliceState = { searchHistory: [] };
      state = addToSearchHistory(state, mk('a', 'block', 1));
      state = addToSearchHistory(state, mk('b', 'transaction', 2));
      expect(state.searchHistory.map((e) => e.query)).toEqual(['b', 'a']);
    });

    it('dedupes on query: re-add moves to top, no duplicate', () => {
      let state: SliceState = { searchHistory: [] };
      state = addToSearchHistory(state, mk('a', 'block', 1));
      state = addToSearchHistory(state, mk('b', 'transaction', 2));
      state = addToSearchHistory(state, mk('a', 'block', 3));
      expect(state.searchHistory.map((e) => e.query)).toEqual(['a', 'b']);
      expect(state.searchHistory).toHaveLength(2);
    });

    it('caps at MAX_SEARCH_HISTORY (10) entries', () => {
      let state: SliceState = { searchHistory: [] };
      for (let i = 0; i < 15; i++) {
        state = addToSearchHistory(state, mk(`q${i}`, 'block', i));
      }
      expect(state.searchHistory).toHaveLength(10);
      // newest 10 retained (q14 down to q5)
      expect(state.searchHistory[0].query).toBe('q14');
      expect(state.searchHistory[9].query).toBe('q5');
    });
  });

  describe('clearSearchHistory', () => {
    it('wipes state and persists empty array', () => {
      let state: SliceState = { searchHistory: [mk('a', 'block')] };
      state = clearSearchHistory(state);
      expect(state.searchHistory).toEqual([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY)!)).toEqual([]);
    });
  });

  describe('loadSearchHistory', () => {
    it('returns [] when localStorage is empty', () => {
      expect(loadSearchHistory()).toEqual([]);
    });

    it('returns [] when localStorage value is corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, 'not-json');
      expect(loadSearchHistory()).toEqual([]);
    });

    it('returns [] when localStorage value is not an array', () => {
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify({ foo: 'bar' }));
      expect(loadSearchHistory()).toEqual([]);
    });

    it('filters out entries failing isValidSearchHistoryItem shape guard', () => {
      const mixed = [
        mk('a', 'block', 1),
        { query: 'b', type: 'unknown', timestamp: 2 }, // bad type
        mk('c', 'address', 3),
        { query: '', type: 'block', timestamp: 4 }, // empty query
        { query: 'e', type: 'block' }, // missing timestamp
      ];
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(mixed));
      const loaded = loadSearchHistory();
      expect(loaded.map((e) => e.query)).toEqual(['a', 'c']);
    });

    it('accepts valid persisted entries', () => {
      const items = [mk('a', 'block', 1, '12345'), mk('b', 'transaction', 2)];
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(items));
      expect(loadSearchHistory()).toEqual(items);
    });
  });

  describe('isValidSearchHistoryItem', () => {
    it('rejects missing query', () => {
      expect(isValidSearchHistoryItem({ type: 'block', timestamp: 1 })).toBe(false);
    });
    it('rejects missing type', () => {
      expect(isValidSearchHistoryItem({ query: 'a', timestamp: 1 })).toBe(false);
    });
    it('rejects missing timestamp', () => {
      expect(isValidSearchHistoryItem({ query: 'a', type: 'block' })).toBe(false);
    });
    it('rejects unknown type value', () => {
      expect(isValidSearchHistoryItem({ query: 'a', type: 'badtype', timestamp: 1 })).toBe(false);
    });
    it('accepts valid item without label', () => {
      expect(isValidSearchHistoryItem(mk('a', 'block', 1))).toBe(true);
    });
    it('accepts valid item with label', () => {
      expect(isValidSearchHistoryItem(mk('a', 'block', 1, 'lbl'))).toBe(true);
    });
    it('rejects non-string label', () => {
      expect(isValidSearchHistoryItem({ query: 'a', type: 'block', timestamp: 1, label: 42 })).toBe(false);
    });
  });

  describe('persistSearchHistory', () => {
    it('writes to localStorage', () => {
      persistSearchHistory([mk('a', 'block', 1)]);
      const raw = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toHaveLength(1);
    });

    it('silently swallows storage errors', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceeded');
      };
      expect(() => persistSearchHistory([mk('a', 'block', 1)])).not.toThrow();
      Storage.prototype.setItem = original;
    });
  });

  describe('round-trip', () => {
    it('add 3 items → persist → load → identical array', () => {
      let state: SliceState = { searchHistory: [] };
      state = addToSearchHistory(state, mk('a', 'block', 1, '100'));
      state = addToSearchHistory(state, mk('b', 'transaction', 2));
      state = addToSearchHistory(state, mk('c', 'address', 3));
      const loaded = loadSearchHistory();
      expect(loaded).toEqual(state.searchHistory);
    });
  });
});
