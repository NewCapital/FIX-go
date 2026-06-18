import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for transactionsSlice filter-state and pagination helpers.
 *
 * Reproductions of slice logic in isolation (same pattern as
 * transactionsSliceViews.test.ts) because `useStore` cannot be imported
 * into vitest due to transitive `@wailsjs` imports that don't resolve in
 * the test environment.
 *
 * If the slice helpers change shape, these reproductions must change in
 * lockstep. Coverage:
 *   - loadTypeFilter()    -- B6: default to All (empty array)
 *   - recomputePageForNewSize()  -- U7: preserve viewport position on page-size change
 */

const STORAGE_KEY_TYPE_FILTER = 'fix_transactionTypeFilter';

type TypeFilter =
  | 'received' | 'sent' | 'toYourself'
  | 'mined' | 'minted' | 'masternode' | 'consolidation' | 'other';

const validTypeFilters: readonly TypeFilter[] = [
  'received', 'sent', 'toYourself',
  'mined', 'minted', 'masternode', 'consolidation', 'other',
];

// Reproduction of transactionsSlice.ts loadTypeFilter() (B6 spec):
// - Missing key       → []  (match-all = Views: All)
// - Valid JSON array  → array filtered to known TypeFilter members
// - Anything else     → []  (legacy single-string from Phase 2, corrupt JSON, garbage)
function loadTypeFilter(): TypeFilter[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TYPE_FILTER);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is TypeFilter =>
        typeof v === 'string' && (validTypeFilters as readonly string[]).includes(v),
      );
    }
    return [];
  } catch {
    return [];
  }
}

// Reproduction of setPageSize page-recompute (U7 spec):
// Keeps the topmost visible row of the current viewport in view after the
// page-size change.
//
// Formula: newPage = max(1, ceil((currentPage - 1) * oldPageSize / newSize) + 1)
function recomputePageForNewSize(currentPage: number, oldPageSize: number, newSize: number): number {
  if (currentPage <= 1) return 1;
  const topRowIndex = (currentPage - 1) * oldPageSize; // zero-based index of first row in viewport
  return Math.max(1, Math.floor(topRowIndex / newSize) + 1);
}

describe('loadTypeFilter (B6 — default to All)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns [] when localStorage is empty', () => {
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns valid filter array when stored as JSON array', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, JSON.stringify(['received']));
    expect(loadTypeFilter()).toEqual(['received']);
  });

  it('returns multi-element array intact', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, JSON.stringify(['received', 'sent']));
    expect(loadTypeFilter()).toEqual(['received', 'sent']);
  });

  it('drops unknown filter keys from the array', () => {
    localStorage.setItem(
      STORAGE_KEY_TYPE_FILTER,
      JSON.stringify(['received', 'bogus', 'sent']),
    );
    expect(loadTypeFilter()).toEqual(['received', 'sent']);
  });

  it('returns [] for legacy single-string "received" (Phase 2 stale persistence)', () => {
    // This is the B6 fix: a legacy single-string value from the Phase 2
    // single-select era resolves to match-all (Views: All) instead of being
    // migrated to ['received'] (which is what produced the misleading
    // "Views: Received" initial state the user reported).
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, 'received');
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns [] for legacy "all" sentinel', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, 'all');
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns [] for legacy "mostCommon" sentinel', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, 'mostCommon');
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, '{not-valid-json');
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns [] for JSON object (not array)', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, JSON.stringify({ filter: 'received' }));
    expect(loadTypeFilter()).toEqual([]);
  });

  it('returns [] for empty array', () => {
    localStorage.setItem(STORAGE_KEY_TYPE_FILTER, JSON.stringify([]));
    expect(loadTypeFilter()).toEqual([]);
  });
});

describe('recomputePageForNewSize (U7 — preserve viewport on page-size change)', () => {
  it('returns 1 when currentPage is 1 regardless of size change', () => {
    expect(recomputePageForNewSize(1, 25, 50)).toBe(1);
    expect(recomputePageForNewSize(1, 100, 25)).toBe(1);
  });

  it('page=3 pageSize=25 → pageSize=50 yields page=2 (rows 51-75 → page 2 starts at row 51)', () => {
    // Top row of viewport at page 3 with size 25 = row index 50 (zero-based)
    // In new pagination (size 50): row 50 is the first row of page 2 (rows 50-99)
    expect(recomputePageForNewSize(3, 25, 50)).toBe(2);
  });

  it('page=10 pageSize=25 → pageSize=100 yields page=3 (top row 225 lands in page 3)', () => {
    // Top row = (10-1) * 25 = 225 (zero-based)
    // New pagination size 100: page 3 covers rows 200-299, row 225 is in page 3
    expect(recomputePageForNewSize(10, 25, 100)).toBe(3);
  });

  it('page=5 pageSize=50 → pageSize=25 yields page=9 (top row 200 → page 9 starts at row 200)', () => {
    // Top row = (5-1) * 50 = 200
    // New size 25: page 9 covers rows 200-224
    expect(recomputePageForNewSize(5, 50, 25)).toBe(9);
  });

  it('page=2 pageSize=100 → pageSize=250 yields page=1 (top row 100 → page 1 covers 0-249)', () => {
    expect(recomputePageForNewSize(2, 100, 250)).toBe(1);
  });

  it('never returns 0 or negative for edge inputs', () => {
    expect(recomputePageForNewSize(1, 25, 25)).toBe(1);
    expect(recomputePageForNewSize(0, 25, 50)).toBe(1);
  });
});
