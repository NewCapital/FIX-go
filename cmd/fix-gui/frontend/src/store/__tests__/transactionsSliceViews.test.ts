import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for the saved-views logic in the transactions slice.
 *
 * These tests reproduce the slice's view actions in isolation rather than
 * importing useStore directly — the same pattern as receiveSlice.test.ts and
 * walletSlice.test.ts, both blocked by transitive @wailsjs imports that don't
 * resolve in the vitest environment.
 *
 * The reproductions mirror the actual slice code in
 * cmd/fix-gui/frontend/src/store/slices/transactionsSlice.ts. If the slice
 * changes shape, these reproductions must change in lockstep.
 */

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'range';
// Phase 3 multi-select: 'all' and 'mostCommon' dropped from the union; an
// empty `typeFilter` array is the "match-all" state in the new model.
type TypeFilter =
  | 'received' | 'sent' | 'toYourself'
  | 'mined' | 'minted' | 'masternode' | 'consolidation' | 'other';
type WatchOnlyFilter = 'all' | 'yes' | 'no';
type SortColumn = 'date' | 'type' | 'address' | 'amount';
type SortDirection = 'asc' | 'desc';

interface ViewFilterSnapshot {
  dateFilter: DateFilter;
  dateRangeFrom: string;
  dateRangeTo: string;
  typeFilter: TypeFilter[];
  searchText: string;
  minAmount: string;
  maxAmount: string;
  watchOnlyFilter: WatchOnlyFilter;
}

interface TransactionView {
  id: string;
  name: string;
  isDefault: boolean;
  filters: ViewFilterSnapshot;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}

interface SliceState extends ViewFilterSnapshot {
  views: TransactionView[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  currentPage: number;
  fetchPageCalls: number;
}

const STORAGE_KEY_VIEWS = 'fix_transactionViews';

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  return {
    from: lastWeek.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
}

function buildDefaultViews(): TransactionView[] {
  const range = getDefaultDateRange();
  const baseFilters: ViewFilterSnapshot = {
    dateFilter: 'all',
    dateRangeFrom: range.from,
    dateRangeTo: range.to,
    typeFilter: [],
    searchText: '',
    minAmount: '',
            maxAmount: '',
    watchOnlyFilter: 'all',
  };
  const mk = (id: string, name: string, typeFilter: TypeFilter[]): TransactionView => ({
    id,
    name,
    isDefault: true,
    filters: { ...baseFilters, typeFilter },
    sortColumn: 'date',
    sortDirection: 'desc',
  });
  return [
    mk('default-all', 'All', []),
    mk('default-received', 'Received', ['received']),
    mk('default-sent', 'Sent', ['sent']),
    mk('default-staking', 'Staking rewards', ['minted']),
    mk('default-masternode', 'Masternode rewards', ['masternode']),
  ];
}

function loadViewsFromStorage(): TransactionView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEWS);
    if (!raw) return buildDefaultViews();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return buildDefaultViews();
    return parsed as TransactionView[];
  } catch {
    return buildDefaultViews();
  }
}

function persistViews(views: TransactionView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_VIEWS, JSON.stringify(views));
  } catch {
    // Silently fail
  }
}

function generateViewId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through
  }
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Action reproductions
function saveCurrentAs(state: SliceState, name: string): SliceState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const newView: TransactionView = {
    id: generateViewId(),
    name: trimmed,
    isDefault: false,
    filters: {
      dateFilter: state.dateFilter,
      dateRangeFrom: state.dateRangeFrom,
      dateRangeTo: state.dateRangeTo,
      typeFilter: state.typeFilter,
      searchText: state.searchText,
      minAmount: state.minAmount,
      maxAmount: state.maxAmount,
      watchOnlyFilter: state.watchOnlyFilter,
    },
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
  };
  const nextViews = [...state.views, newView];
  persistViews(nextViews);
  return { ...state, views: nextViews };
}

function applyView(state: SliceState, id: string): SliceState {
  const view = state.views.find((v) => v.id === id);
  if (!view) return state;
  // Range fields are only overwritten when the view's dateFilter is 'range';
  // otherwise the user's last custom range is preserved.
  const next: SliceState = {
    ...state,
    dateFilter: view.filters.dateFilter,
    typeFilter: view.filters.typeFilter,
    searchText: view.filters.searchText,
    minAmount: view.filters.minAmount,
    maxAmount: view.filters.maxAmount,
    watchOnlyFilter: view.filters.watchOnlyFilter,
    sortColumn: view.sortColumn,
    sortDirection: view.sortDirection,
    currentPage: 1,
    fetchPageCalls: state.fetchPageCalls + 1,
  };
  if (view.filters.dateFilter === 'range') {
    next.dateRangeFrom = view.filters.dateRangeFrom;
    next.dateRangeTo = view.filters.dateRangeTo;
  }
  return next;
}

const VALID_DATE_FILTERS: readonly string[] = [
  'all', 'today', 'week', 'month', 'lastMonth', 'year', 'range',
];
const VALID_TYPE_FILTERS: readonly string[] = [
  'received', 'sent', 'toYourself',
  'mined', 'minted', 'masternode', 'consolidation', 'other',
];
const VALID_WATCH_ONLY_FILTERS: readonly string[] = ['all', 'yes', 'no'];
const VALID_SORT_COLUMNS: readonly string[] = ['date', 'type', 'address', 'amount'];
const VALID_SORT_DIRECTIONS: readonly string[] = ['asc', 'desc'];

function isValidTransactionView(v: unknown): v is TransactionView {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return false;
  if (typeof o.name !== 'string') return false;
  if (typeof o.isDefault !== 'boolean') return false;
  if (!o.filters || typeof o.filters !== 'object') return false;
  const f = o.filters as Record<string, unknown>;
  if (typeof f.dateFilter !== 'string' || !VALID_DATE_FILTERS.includes(f.dateFilter)) return false;
  if (typeof f.dateRangeFrom !== 'string') return false;
  if (typeof f.dateRangeTo !== 'string') return false;
  if (!Array.isArray(f.typeFilter)) return false;
  if (!f.typeFilter.every((v: unknown) => typeof v === 'string' && VALID_TYPE_FILTERS.includes(v))) return false;
  if (typeof f.searchText !== 'string') return false;
  if (typeof f.minAmount !== 'string') return false;
  // Phase 4 max-amount migration: accept missing (undefined) — coerced to ''
  // by loadViewsWithShapeGuard before being returned. Mirrors slice impl.
  if (f.maxAmount !== undefined && typeof f.maxAmount !== 'string') return false;
  if (typeof f.watchOnlyFilter !== 'string' || !VALID_WATCH_ONLY_FILTERS.includes(f.watchOnlyFilter)) return false;
  if (typeof o.sortColumn !== 'string' || !VALID_SORT_COLUMNS.includes(o.sortColumn)) return false;
  if (typeof o.sortDirection !== 'string' || !VALID_SORT_DIRECTIONS.includes(o.sortDirection)) return false;
  return true;
}

function loadViewsWithShapeGuard(): TransactionView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEWS);
    if (!raw) return buildDefaultViews();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return buildDefaultViews();
    const valid = parsed.filter(isValidTransactionView);
    if (valid.length === 0) return buildDefaultViews();
    // Phase 4 max-amount migration mirror (slice loadViewsFromStorage).
    return valid.map((v: TransactionView) => (
      typeof v.filters.maxAmount === 'string'
        ? v
        : { ...v, filters: { ...v.filters, maxAmount: '' } }
    ));
  } catch {
    return buildDefaultViews();
  }
}

function renameView(state: SliceState, id: string, newName: string): SliceState {
  const trimmed = newName.trim();
  if (!trimmed) return state;
  const target = state.views.find((v) => v.id === id);
  if (!target || target.isDefault) return state;
  const nextViews = state.views.map((v) => (v.id === id ? { ...v, name: trimmed } : v));
  persistViews(nextViews);
  return { ...state, views: nextViews };
}

function deleteView(state: SliceState, id: string): SliceState {
  const target = state.views.find((v) => v.id === id);
  if (!target || target.isDefault) return state;
  const nextViews = state.views.filter((v) => v.id !== id);
  persistViews(nextViews);
  return { ...state, views: nextViews };
}

function freshState(): SliceState {
  const range = getDefaultDateRange();
  return {
    dateFilter: 'all',
    dateRangeFrom: range.from,
    dateRangeTo: range.to,
    typeFilter: [],
    searchText: '',
    minAmount: '',
            maxAmount: '',
    watchOnlyFilter: 'all',
    sortColumn: 'date',
    sortDirection: 'desc',
    currentPage: 1,
    views: loadViewsFromStorage(),
    fetchPageCalls: 0,
  };
}

describe('Transactions Slice — saved views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('seeds 5 default views on empty localStorage', () => {
    const views = loadViewsFromStorage();
    expect(views).toHaveLength(5);
    expect(views.map((v) => v.id)).toEqual([
      'default-all',
      'default-received',
      'default-sent',
      'default-staking',
      'default-masternode',
    ]);
    expect(views.every((v) => v.isDefault === true)).toBe(true);
  });

  it('re-seeds defaults on corrupt localStorage', () => {
    localStorage.setItem(STORAGE_KEY_VIEWS, 'not-json{{{');
    const views = loadViewsFromStorage();
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });

  it('re-seeds defaults on empty-array localStorage', () => {
    localStorage.setItem(STORAGE_KEY_VIEWS, '[]');
    const views = loadViewsFromStorage();
    expect(views).toHaveLength(5);
  });

  it('default views carry expected typeFilter values (Phase 3 multi-select arrays)', () => {
    const views = buildDefaultViews();
    expect(views.find((v) => v.id === 'default-received')?.filters.typeFilter).toEqual(['received']);
    expect(views.find((v) => v.id === 'default-sent')?.filters.typeFilter).toEqual(['sent']);
    expect(views.find((v) => v.id === 'default-staking')?.filters.typeFilter).toEqual(['minted']);
    expect(views.find((v) => v.id === 'default-masternode')?.filters.typeFilter).toEqual(['masternode']);
    // default-all encodes match-all as an empty selection slice (Phase 3).
    expect(views.find((v) => v.id === 'default-all')?.filters.typeFilter).toEqual([]);
  });

  it('saveCurrentAs appends new view with isDefault=false and persists', () => {
    let state = freshState();
    state.typeFilter = ['sent'];
    state.searchText = 'hello';

    state = saveCurrentAs(state, 'My View');

    expect(state.views).toHaveLength(6);
    const last = state.views[5];
    expect(last.name).toBe('My View');
    expect(last.isDefault).toBe(false);
    expect(last.id).toBeTruthy();
    expect(last.filters.typeFilter).toEqual(['sent']);
    expect(last.filters.searchText).toBe('hello');

    // Persisted
    const reloaded = loadViewsFromStorage();
    expect(reloaded).toHaveLength(6);
    expect(reloaded[5].name).toBe('My View');
  });

  it('saveCurrentAs rejects whitespace-only names', () => {
    let state = freshState();
    state = saveCurrentAs(state, '   ');
    expect(state.views).toHaveLength(5);
    expect(localStorage.getItem(STORAGE_KEY_VIEWS)).toBeNull();
  });

  it('saveCurrentAs trims name whitespace', () => {
    let state = freshState();
    state = saveCurrentAs(state, '  Trimmed  ');
    expect(state.views[5].name).toBe('Trimmed');
  });

  it('applyView copies snapshot fields and increments fetchPage call counter', () => {
    let state = freshState();
    state.currentPage = 7;

    state = applyView(state, 'default-received');

    expect(state.typeFilter).toEqual(['received']);
    expect(state.sortColumn).toBe('date');
    expect(state.sortDirection).toBe('desc');
    expect(state.currentPage).toBe(1);
    expect(state.fetchPageCalls).toBe(1);
  });

  it('applyView is a no-op for unknown id', () => {
    let state = freshState();
    state.currentPage = 7;
    state.typeFilter = ['sent'];

    state = applyView(state, 'no-such-view');

    expect(state.currentPage).toBe(7);
    expect(state.typeFilter).toEqual(['sent']);
    expect(state.fetchPageCalls).toBe(0);
  });

  it('renameView updates user-view name and persists', () => {
    let state = freshState();
    state = saveCurrentAs(state, 'Original');
    const userId = state.views[5].id;

    state = renameView(state, userId, 'Updated');

    expect(state.views[5].name).toBe('Updated');
    const reloaded = loadViewsFromStorage();
    expect(reloaded[5].name).toBe('Updated');
  });

  it('renameView is a no-op for default views', () => {
    let state = freshState();
    state = renameView(state, 'default-all', 'Hacked');
    expect(state.views[0].name).toBe('All');
  });

  it('renameView rejects whitespace-only newName', () => {
    let state = freshState();
    state = saveCurrentAs(state, 'Original');
    const userId = state.views[5].id;
    state = renameView(state, userId, '   ');
    expect(state.views[5].name).toBe('Original');
  });

  it('deleteView removes user view and persists', () => {
    let state = freshState();
    state = saveCurrentAs(state, 'Doomed');
    const userId = state.views[5].id;
    expect(state.views).toHaveLength(6);

    state = deleteView(state, userId);

    expect(state.views).toHaveLength(5);
    expect(state.views.find((v) => v.id === userId)).toBeUndefined();
    const reloaded = loadViewsFromStorage();
    expect(reloaded).toHaveLength(5);
  });

  it('deleteView is a no-op for default views', () => {
    let state = freshState();
    state = deleteView(state, 'default-all');
    expect(state.views).toHaveLength(5);
    expect(state.views[0].id).toBe('default-all');
  });

  it('deleteView is a no-op for unknown id', () => {
    let state = freshState();
    state = deleteView(state, 'no-such-id');
    expect(state.views).toHaveLength(5);
  });

  it('applyView preserves user dateRange when view dateFilter is not "range"', () => {
    let state = freshState();
    state.dateRangeFrom = '2024-01-01';
    state.dateRangeTo = '2024-01-31';

    state = applyView(state, 'default-received'); // dateFilter='all'

    expect(state.dateFilter).toBe('all');
    expect(state.typeFilter).toEqual(['received']);
    // Range fields preserved — would otherwise be silently overwritten by the
    // default 7-day seed range from buildDefaultViews().
    expect(state.dateRangeFrom).toBe('2024-01-01');
    expect(state.dateRangeTo).toBe('2024-01-31');
  });

  it('applyView overwrites dateRange only when view dateFilter is "range"', () => {
    let state = freshState();
    state.dateRangeFrom = '2024-01-01';
    state.dateRangeTo = '2024-01-31';

    const rangeView: TransactionView = {
      id: 'user-range',
      name: 'Q1',
      isDefault: false,
      filters: {
        dateFilter: 'range',
        dateRangeFrom: '2025-01-01',
        dateRangeTo: '2025-03-31',
        typeFilter: [],
        searchText: '',
        minAmount: '',
            maxAmount: '',
        watchOnlyFilter: 'all',
      },
      sortColumn: 'date',
      sortDirection: 'desc',
    };
    state.views = [...state.views, rangeView];

    state = applyView(state, 'user-range');

    expect(state.dateFilter).toBe('range');
    expect(state.dateRangeFrom).toBe('2025-01-01');
    expect(state.dateRangeTo).toBe('2025-03-31');
  });

  it('loadViewsWithShapeGuard drops structurally-invalid entries', () => {
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        { id: 'broken-no-filters' }, // missing .filters
        {
          id: 'valid-1',
          name: 'Valid',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: ['sent'],
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
      ]),
    );

    const views = loadViewsWithShapeGuard();
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('valid-1');
  });

  it('loadViewsWithShapeGuard re-seeds defaults when ALL entries are invalid', () => {
    localStorage.setItem(STORAGE_KEY_VIEWS, JSON.stringify([{ id: 'broken' }]));
    const views = loadViewsWithShapeGuard();
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });

  it('loadViewsWithShapeGuard rejects entries with unrecognized enum values', () => {
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        {
          id: 'stale-enum',
          name: 'Stale',
          isDefault: false,
          filters: {
            dateFilter: 'quarter', // not in DateFilter union
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: [],
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
        {
          id: 'bad-sort',
          name: 'BadSort',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: [],
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'fee', // not in SortColumn union
          sortDirection: 'desc',
        },
      ]),
    );
    const views = loadViewsWithShapeGuard();
    // Both entries are structurally valid but carry stale enum tokens —
    // shape guard rejects them, so we fall back to defaults.
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });

  it('loadViewsWithShapeGuard rejects Phase 2 single-string typeFilter (pre-multi-select)', () => {
    // Regression lock for the Phase 3 merge: any localStorage entry written
    // before the multi-select migration has `typeFilter: 'sent'` (string) —
    // the new shape guard requires an array, so these entries fall through
    // to defaults instead of throwing or coercing.
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        {
          id: 'phase2-legacy',
          name: 'Legacy',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: 'sent',
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
      ]),
    );
    const views = loadViewsWithShapeGuard();
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });

  it('loadViewsWithShapeGuard MIGRATES (does not reject) entries missing maxAmount (Phase 4)', () => {
    // Regression lock for the Phase 4 max-amount migration: localStorage
    // entries written by Phase 3 (and earlier) have no `maxAmount` field.
    // The shape guard accepts undefined here and loadViewsWithShapeGuard
    // coerces missing → '' before returning, preserving the user's saved
    // view (instead of silently wiping it on upgrade). Codex flagged the
    // original strict-reject behavior as a data-loss regression.
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        {
          id: 'phase3-no-max',
          name: 'NoMax',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: ['sent'],
            searchText: '',
            minAmount: '5',
            // maxAmount: <missing — Phase 3-and-earlier writers did not set it>
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
      ]),
    );
    const views = loadViewsWithShapeGuard();
    // Preserved (not wiped): 1 user view, no fall-back to the 5 defaults.
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('phase3-no-max');
    // Migrated: maxAmount coerced to ''.
    expect(views[0].filters.maxAmount).toBe('');
    // minAmount preserved as-is.
    expect(views[0].filters.minAmount).toBe('5');
  });

  it('loadViewsWithShapeGuard rejects entries with non-string maxAmount type (defensive)', () => {
    // Defense-in-depth: a forged or schema-drifted entry with maxAmount of a
    // non-string non-undefined type (number/null/array) must still be
    // rejected — the migration accepts undefined only.
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        {
          id: 'bad-maxtype',
          name: 'BadType',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: [],
            searchText: '',
            minAmount: '',
            maxAmount: 10, // number, not string → rejected
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
      ]),
    );
    const views = loadViewsWithShapeGuard();
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });

  it('loadViewsWithShapeGuard rejects array entries with legacy "all" or "mostCommon" tokens', () => {
    localStorage.setItem(
      STORAGE_KEY_VIEWS,
      JSON.stringify([
        {
          id: 'legacy-all-array',
          name: 'LegacyAll',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: ['all'], // Phase 3 dropped 'all' from VALID_TYPE_FILTERS
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
        {
          id: 'legacy-mostcommon-array',
          name: 'LegacyMC',
          isDefault: false,
          filters: {
            dateFilter: 'all',
            dateRangeFrom: '2024-01-01',
            dateRangeTo: '2024-01-07',
            typeFilter: ['mostCommon'],
            searchText: '',
            minAmount: '',
            maxAmount: '',
            watchOnlyFilter: 'all',
          },
          sortColumn: 'date',
          sortDirection: 'desc',
        },
      ]),
    );
    const views = loadViewsWithShapeGuard();
    expect(views).toHaveLength(5);
    expect(views[0].id).toBe('default-all');
  });
});
