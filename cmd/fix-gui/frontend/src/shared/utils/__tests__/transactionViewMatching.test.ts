import { describe, it, expect } from 'vitest';
import {
  matchesViewSnapshot,
  type CurrentTransactionsState,
  type ViewSnapshot,
} from '../transactionViewMatching';

const baseCurrent: CurrentTransactionsState = {
  dateFilter: 'all',
  dateRangeFrom: '2026-05-13',
  dateRangeTo: '2026-05-20',
  typeFilter: [],
  searchText: '',
  minAmount: '',
  maxAmount: '',
  watchOnlyFilter: 'all',
  sortColumn: 'date',
  sortDirection: 'desc',
};

const baseView: ViewSnapshot = {
  filters: {
    dateFilter: 'all',
    dateRangeFrom: '2026-05-13',
    dateRangeTo: '2026-05-20',
    typeFilter: [],
    searchText: '',
    minAmount: '',
    maxAmount: '',
    watchOnlyFilter: 'all',
  },
  sortColumn: 'date',
  sortDirection: 'desc',
};

describe('matchesViewSnapshot', () => {
  it('returns true for identical state and view', () => {
    expect(matchesViewSnapshot(baseCurrent, baseView)).toBe(true);
  });

  it('returns false when typeFilter differs (empty vs single entry)', () => {
    const view: ViewSnapshot = {
      ...baseView,
      filters: { ...baseView.filters, typeFilter: ['received'] },
    };
    expect(matchesViewSnapshot(baseCurrent, view)).toBe(false);
  });

  it('returns true for matching multi-entry typeFilter arrays in same order', () => {
    const current: CurrentTransactionsState = {
      ...baseCurrent,
      typeFilter: ['sent', 'received'],
    };
    const view: ViewSnapshot = {
      ...baseView,
      filters: { ...baseView.filters, typeFilter: ['sent', 'received'] },
    };
    expect(matchesViewSnapshot(current, view)).toBe(true);
  });

  it('returns false when typeFilter array differs by one element (length mismatch)', () => {
    const current: CurrentTransactionsState = {
      ...baseCurrent,
      typeFilter: ['sent'],
    };
    const view: ViewSnapshot = {
      ...baseView,
      filters: { ...baseView.filters, typeFilter: ['sent', 'received'] },
    };
    expect(matchesViewSnapshot(current, view)).toBe(false);
  });

  it('returns true when typeFilter arrays differ only by order (set-equality)', () => {
    // Set-equality, order-insensitive: the checkbox editor's click-order does
    // not affect view matching. A user clicking [Sent, Received] must match
    // the same saved view as a snapshot stored as [Received, Sent]. Both
    // sides are deduped at write-time, so length-match + one-sided includes
    // is a sufficient set comparison.
    const current: CurrentTransactionsState = {
      ...baseCurrent,
      typeFilter: ['sent', 'received'],
    };
    const view: ViewSnapshot = {
      ...baseView,
      filters: { ...baseView.filters, typeFilter: ['received', 'sent'] },
    };
    expect(matchesViewSnapshot(current, view)).toBe(true);
  });

  it('returns false when sortColumn differs', () => {
    const view: ViewSnapshot = { ...baseView, sortColumn: 'amount' };
    expect(matchesViewSnapshot(baseCurrent, view)).toBe(false);
  });

  it('returns false when sortDirection differs', () => {
    const view: ViewSnapshot = { ...baseView, sortDirection: 'asc' };
    expect(matchesViewSnapshot(baseCurrent, view)).toBe(false);
  });

  it('ignores dateRangeFrom/To when dateFilter is not "range"', () => {
    const current: CurrentTransactionsState = {
      ...baseCurrent,
      dateRangeFrom: '2020-01-01',
      dateRangeTo: '2020-01-07',
    };
    // dateFilter is 'all' on both, so range fields should be ignored.
    expect(matchesViewSnapshot(current, baseView)).toBe(true);
  });

  it('compares dateRangeFrom/To when dateFilter is "range"', () => {
    const current: CurrentTransactionsState = {
      ...baseCurrent,
      dateFilter: 'range',
      dateRangeFrom: '2026-05-01',
      dateRangeTo: '2026-05-15',
    };
    const view: ViewSnapshot = {
      ...baseView,
      filters: {
        ...baseView.filters,
        dateFilter: 'range',
        dateRangeFrom: '2026-05-01',
        dateRangeTo: '2026-05-15',
      },
    };
    expect(matchesViewSnapshot(current, view)).toBe(true);

    const viewDiffRange: ViewSnapshot = {
      ...view,
      filters: { ...view.filters, dateRangeFrom: '2026-04-01' },
    };
    expect(matchesViewSnapshot(current, viewDiffRange)).toBe(false);
  });

  it('returns false when searchText differs', () => {
    const current: CurrentTransactionsState = { ...baseCurrent, searchText: 'foo' };
    expect(matchesViewSnapshot(current, baseView)).toBe(false);
  });

  it('returns false when minAmount differs', () => {
    const current: CurrentTransactionsState = { ...baseCurrent, minAmount: '10' };
    expect(matchesViewSnapshot(current, baseView)).toBe(false);
  });

  it('returns false when maxAmount differs', () => {
    // Phase 4 amount-upper-bound: snapshot equality must compare both bounds
    // independently. baseView has maxAmount '' (unbounded); current with '10'
    // is a different effective filter.
    const current: CurrentTransactionsState = { ...baseCurrent, maxAmount: '10' };
    expect(matchesViewSnapshot(current, baseView)).toBe(false);
  });

  it('returns true when both amount bounds match (saved view round-trip)', () => {
    const current: CurrentTransactionsState = { ...baseCurrent, minAmount: '5', maxAmount: '10' };
    const view: ViewSnapshot = {
      ...baseView,
      filters: { ...baseView.filters, minAmount: '5', maxAmount: '10' },
    };
    expect(matchesViewSnapshot(current, view)).toBe(true);
  });

  it('returns false when watchOnlyFilter differs', () => {
    const current: CurrentTransactionsState = { ...baseCurrent, watchOnlyFilter: 'yes' };
    expect(matchesViewSnapshot(current, baseView)).toBe(false);
  });
});
