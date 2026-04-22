import { describe, it, expect } from 'vitest';

/**
 * Tests for the fetch-race-condition guard in PaymentStatsTab.
 *
 * The fix uses a request-ID counter (fetchIdRef) to ensure that only the most
 * recently issued fetch commits its result to state. This test validates the
 * guard logic in isolation — no React rendering or Wails bindings required.
 */

// Simulate the fetch-ID guard logic extracted from PaymentStatsTab.fetchData.
// Each "fetch" increments the counter, captures the local ID, then checks
// whether localId still matches fetchIdRef when the response arrives.
function simulateFetchRace(resolveOrder: number[]): number[] {
  let fetchIdRef = 0;
  const appliedResults: number[] = [];

  // Issue N fetches (0..N-1), each captures its local ID.
  const fetches = resolveOrder.map((_, issueIndex) => {
    const localFetchId = ++fetchIdRef;
    return { issueIndex, localFetchId };
  });

  // Resolve fetches in the specified order. Only the fetch whose localFetchId
  // matches the current fetchIdRef should apply its result.
  for (const resolveIndex of resolveOrder) {
    const fetch = fetches[resolveIndex];
    if (fetch.localFetchId === fetchIdRef) {
      appliedResults.push(fetch.issueIndex);
    }
  }

  return appliedResults;
}

describe('PaymentStatsTab fetch-race guard', () => {
  it('applies result when a single fetch resolves', () => {
    // Issue 1 fetch, resolve it.
    const applied = simulateFetchRace([0]);
    expect(applied).toEqual([0]);
  });

  it('applies only the latest fetch when two resolve in order', () => {
    // Issue 2 fetches; resolve in issue order (0 then 1).
    // Fetch 0 has localId=1, fetchIdRef=2 at resolve time → skipped.
    // Fetch 1 has localId=2, fetchIdRef=2 → applied.
    const applied = simulateFetchRace([0, 1]);
    expect(applied).toEqual([1]);
  });

  it('applies only the latest fetch when two resolve out of order', () => {
    // Issue 2 fetches; resolve in reverse order (1 then 0).
    // Fetch 1 has localId=2, fetchIdRef=2 → applied.
    // Fetch 0 has localId=1, fetchIdRef=2 → skipped (stale).
    const applied = simulateFetchRace([1, 0]);
    expect(applied).toEqual([1]);
  });

  it('applies only the latest when three fetches resolve out of order', () => {
    // Issue 3 fetches; resolve middle first, then first, then last.
    // Only fetch 2 (localId=3, fetchIdRef=3) should apply.
    const applied = simulateFetchRace([1, 0, 2]);
    expect(applied).toEqual([2]);
  });

  it('applies only the latest when spam-clicking produces many fetches', () => {
    // Issue 5 fetches; resolve in arbitrary order.
    // Only fetch 4 (localId=5) should apply regardless of resolve order.
    const applied = simulateFetchRace([3, 1, 4, 0, 2]);
    expect(applied).toEqual([4]);
  });

  it('never applies a stale response even when latest resolves first', () => {
    // Issue 3 fetches; latest resolves first, then the earlier two.
    const applied = simulateFetchRace([2, 0, 1]);
    expect(applied).toEqual([2]);
  });
});
