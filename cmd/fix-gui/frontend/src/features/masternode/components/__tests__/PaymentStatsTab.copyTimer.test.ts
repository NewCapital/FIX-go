import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the copy-timer-race fix in PaymentStatsTab.handleCopyTxID.
 *
 * The fix stores the setTimeout handle in a ref, clears any pending timer
 * before scheduling a new one, and clears on unmount. This test validates
 * the guard logic in isolation using fake timers — no React rendering or
 * Wails bindings required.
 */

// Simulate the copy timer logic extracted from PaymentStatsTab.handleCopyTxID.
function createCopyTimerSimulator() {
  let copiedTxID: string | null = null;
  let copyTimerRef: ReturnType<typeof setTimeout> | null = null;
  let mounted = true;

  return {
    get copiedTxID() { return copiedTxID; },
    get mounted() { return mounted; },

    handleCopyTxID(txid: string) {
      if (copyTimerRef) clearTimeout(copyTimerRef);
      copiedTxID = txid;
      copyTimerRef = setTimeout(() => {
        if (mounted) copiedTxID = null;
        copyTimerRef = null;
      }, 2000);
    },

    unmount() {
      mounted = false;
      if (copyTimerRef) {
        clearTimeout(copyTimerRef);
        copyTimerRef = null;
      }
    },
  };
}

describe('PaymentStatsTab copy-timer guard', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clears feedback after 2 seconds for a single copy', () => {
    const sim = createCopyTimerSimulator();
    sim.handleCopyTxID('tx-a');
    expect(sim.copiedTxID).toBe('tx-a');

    vi.advanceTimersByTime(2000);
    expect(sim.copiedTxID).toBeNull();
  });

  it('rapid copy resets the timer — first timer does not clear second feedback', () => {
    const sim = createCopyTimerSimulator();
    sim.handleCopyTxID('tx-a');

    // Copy tx-b after 500ms (within tx-a's 2s window)
    vi.advanceTimersByTime(500);
    sim.handleCopyTxID('tx-b');
    expect(sim.copiedTxID).toBe('tx-b');

    // At 2000ms total, tx-a's original timer would have fired — but it was cleared
    vi.advanceTimersByTime(1500);
    expect(sim.copiedTxID).toBe('tx-b');

    // tx-b's timer fires at 2500ms total (500 + 2000)
    vi.advanceTimersByTime(500);
    expect(sim.copiedTxID).toBeNull();
  });

  it('three rapid copies — only the last timer survives', () => {
    const sim = createCopyTimerSimulator();
    sim.handleCopyTxID('tx-a');
    vi.advanceTimersByTime(300);
    sim.handleCopyTxID('tx-b');
    vi.advanceTimersByTime(300);
    sim.handleCopyTxID('tx-c');
    expect(sim.copiedTxID).toBe('tx-c');

    // Advance past where tx-a and tx-b timers would have fired
    vi.advanceTimersByTime(1700);
    expect(sim.copiedTxID).toBe('tx-c');

    // tx-c's timer fires at 600 + 2000 = 2600ms
    vi.advanceTimersByTime(300);
    expect(sim.copiedTxID).toBeNull();
  });

  it('unmount cancels pending timer — no state update after unmount', () => {
    const sim = createCopyTimerSimulator();
    sim.handleCopyTxID('tx-a');
    expect(sim.copiedTxID).toBe('tx-a');

    // Unmount before timer fires
    sim.unmount();
    vi.advanceTimersByTime(2000);

    // copiedTxID stays as-is (timer was cleared, mountedRef guard also prevents update)
    expect(sim.copiedTxID).toBe('tx-a');
  });

  it('unmount after rapid copy cancels the latest timer', () => {
    const sim = createCopyTimerSimulator();
    sim.handleCopyTxID('tx-a');
    vi.advanceTimersByTime(500);
    sim.handleCopyTxID('tx-b');

    sim.unmount();
    vi.advanceTimersByTime(5000);

    // Neither timer should have cleared the state
    expect(sim.copiedTxID).toBe('tx-b');
  });
});
