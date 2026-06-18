import { describe, it, expect } from 'vitest';
import type { TxOutput } from '@/store/slices/explorerSlice';
import { sortOutputs, groupOutputs } from '../outputDisplay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkOutput(overrides: Partial<TxOutput>): TxOutput {
  return {
    index: 0,
    address: 'WaddressDefault',
    amount: 1,
    script_type: 'pubkeyhash',
    label: '',
    is_spent: false,
    role: 'external_payment',
    is_mine: false,
    is_change: false,
    is_dust: false,
    data_hex: '',
    data_ascii: '',
    addresses: undefined,
    required_sigs: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sortOutputs
// ---------------------------------------------------------------------------

describe('sortOutputs', () => {
  it('returns empty array for empty input', () => {
    expect(sortOutputs([])).toEqual([]);
  });

  it('returns single output unchanged', () => {
    const o = mkOutput({ index: 0, role: 'external_payment' });
    expect(sortOutputs([o])).toEqual([o]);
  });

  it('orders the 11 priority levels correctly (R3 spec)', () => {
    // Mix all roles in reverse priority order. Sort must restore priority order.
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'nonstandard' }),
      mkOutput({ index: 1, role: 'data_carrier' }),
      mkOutput({ index: 2, role: 'change' }),
      mkOutput({ index: 3, role: 'self_send' }),
      mkOutput({ index: 4, role: 'multisig' }),
      mkOutput({ index: 5, role: 'external_payment' }),
      mkOutput({ index: 6, role: 'dev_fund' }),
      mkOutput({ index: 7, role: 'masternode_payment' }),
      mkOutput({ index: 8, role: 'stake_return' }),
      mkOutput({ index: 9, role: 'block_marker' }),
    ];
    const sorted = sortOutputs(inputs);
    expect(sorted.map((o) => o.role)).toEqual([
      'block_marker',
      'stake_return',
      'masternode_payment',
      'dev_fund',
      'external_payment',
      'multisig',
      'self_send',
      'change',
      'data_carrier',
      'nonstandard',
    ]);
  });

  it('places dust at priority 10 regardless of underlying role', () => {
    // is_dust overlay should override role priority. A dust external_payment
    // (would normally be priority 5) gets sorted below a non-dust nonstandard
    // (priority 11) — no wait, dust is priority 10, nonstandard is 11, so
    // dust still sorts BEFORE nonstandard. Let's test with a dust stake_return
    // which would otherwise be priority 2.
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'stake_return', is_dust: true }),
      mkOutput({ index: 1, role: 'external_payment', is_dust: false }),
      mkOutput({ index: 2, role: 'nonstandard', is_dust: false }),
      mkOutput({ index: 3, role: 'external_payment', is_dust: true }),
    ];
    const sorted = sortOutputs(inputs);
    // Expected: external_payment(non-dust)=5 < dust(10) < dust(10) < nonstandard(11)
    expect(sorted.map((o) => o.index)).toEqual([1, 0, 3, 2]);
  });

  it('sorts external_payment outputs by amount descending (tie-break)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'external_payment', amount: 5 }),
      mkOutput({ index: 1, role: 'external_payment', amount: 100 }),
      mkOutput({ index: 2, role: 'external_payment', amount: 25 }),
    ];
    const sorted = sortOutputs(inputs);
    expect(sorted.map((o) => o.amount)).toEqual([100, 25, 5]);
  });

  it('preserves protocol order via stable sort for non-tie-break buckets', () => {
    // Two stake_returns in protocol order [10, 5] — they MUST stay in [10, 5]
    // order (NOT amount-desc which would be [10, 5] coincidentally, so flip
    // the values to expose any incorrect amount-desc sort).
    const inputs: TxOutput[] = [
      mkOutput({ index: 1, role: 'stake_return', amount: 5 }),
      mkOutput({ index: 2, role: 'stake_return', amount: 10 }),
    ];
    const sorted = sortOutputs(inputs);
    // Stable sort: input order [5, 10] must be preserved (not amount-desc'd to [10, 5]).
    expect(sorted.map((o) => o.amount)).toEqual([5, 10]);
  });

  it('does not mutate input array', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'nonstandard' }),
      mkOutput({ index: 1, role: 'block_marker' }),
    ];
    const originalOrder = inputs.map((o) => o.index);
    sortOutputs(inputs);
    expect(inputs.map((o) => o.index)).toEqual(originalOrder);
  });

  it('treats unknown role as nonstandard (priority 11)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'future_unknown_role' }),
      mkOutput({ index: 1, role: 'external_payment' }),
    ];
    const sorted = sortOutputs(inputs);
    // external_payment (5) before unknown-treated-as-nonstandard (11)
    expect(sorted.map((o) => o.index)).toEqual([1, 0]);
  });

  it('treats undefined role as nonstandard', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: undefined }),
      mkOutput({ index: 1, role: 'external_payment' }),
    ];
    const sorted = sortOutputs(inputs);
    expect(sorted.map((o) => o.index)).toEqual([1, 0]);
  });
});

// ---------------------------------------------------------------------------
// groupOutputs
// ---------------------------------------------------------------------------

describe('groupOutputs', () => {
  it('returns empty array for empty input', () => {
    expect(groupOutputs([])).toEqual([]);
  });

  it('returns all singles when no grouping applies', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'external_payment' }),
      mkOutput({ index: 1, role: 'masternode_payment' }),
    ];
    const items = groupOutputs(inputs);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('single');
    expect(items[1].kind).toBe('single');
  });

  it('renders a single stake_return as a single (no group when count == 1)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'stake_return' }),
      mkOutput({ index: 1, role: 'masternode_payment' }),
    ];
    const items = groupOutputs(inputs);
    expect(items.map((i) => i.kind)).toEqual(['single', 'single']);
  });

  it('groups 2 stake_returns into stake_split', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'stake_return', amount: 10 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 11 }),
      mkOutput({ index: 2, role: 'masternode_payment' }),
    ];
    const items = groupOutputs(inputs);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('stake_split');
    if (items[0].kind === 'stake_split') {
      expect(items[0].outputs).toHaveLength(2);
      expect(items[0].outputs.map((o) => o.index)).toEqual([0, 1]);
    }
    expect(items[1].kind).toBe('single');
  });

  it('groups ALL stake_returns when count > 2 (edge case, group all per design)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'stake_return' }),
      mkOutput({ index: 1, role: 'stake_return' }),
      mkOutput({ index: 2, role: 'stake_return' }),
      mkOutput({ index: 3, role: 'external_payment' }),
    ];
    const items = groupOutputs(inputs);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('stake_split');
    if (items[0].kind === 'stake_split') {
      expect(items[0].outputs).toHaveLength(3);
    }
  });

  it('renders dust as singles when total dust count < 3', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'external_payment', amount: 100 }),
      mkOutput({ index: 1, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 2, role: 'nonstandard', is_dust: true }),
    ];
    const items = groupOutputs(inputs);
    // 1 single non-dust + 2 single dust (no collapse)
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.kind === 'single')).toBe(true);
  });

  it('collapses dust when total dust count == 3 (visible=2, collapsed=1)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'external_payment', amount: 100 }),
      mkOutput({ index: 1, role: 'external_payment', is_dust: true }),
      mkOutput({ index: 2, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 3, role: 'nonstandard', is_dust: true }),
    ];
    const items = groupOutputs(inputs);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('single');
    expect(items[1].kind).toBe('dust_collapse');
    if (items[1].kind === 'dust_collapse') {
      expect(items[1].visible).toHaveLength(2);
      expect(items[1].collapsed).toHaveLength(1);
      // first 2 in sorted order are visible
      expect(items[1].visible.map((o) => o.index)).toEqual([1, 2]);
      expect(items[1].collapsed.map((o) => o.index)).toEqual([3]);
    }
  });

  it('collapses dust when total dust count == 5 (visible=2, collapsed=3)', () => {
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 1, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 2, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 3, role: 'nonstandard', is_dust: true }),
      mkOutput({ index: 4, role: 'nonstandard', is_dust: true }),
    ];
    const items = groupOutputs(inputs);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('dust_collapse');
    if (items[0].kind === 'dust_collapse') {
      expect(items[0].visible).toHaveLength(2);
      expect(items[0].collapsed).toHaveLength(3);
    }
  });

  it('handles mixed scenario: block_marker + stake_split + external + dust_collapse', () => {
    // Note: dust outputs sort to priority 10. We pass already-sorted input
    // (caller's responsibility) so the dust outputs are at the END of the list.
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker' }),
      mkOutput({ index: 1, role: 'stake_return' }),
      mkOutput({ index: 2, role: 'stake_return' }),
      mkOutput({ index: 3, role: 'external_payment', amount: 100 }),
      mkOutput({ index: 4, role: 'external_payment', is_dust: true }),
      mkOutput({ index: 5, role: 'external_payment', is_dust: true }),
      mkOutput({ index: 6, role: 'external_payment', is_dust: true }),
    ];
    const items = groupOutputs(inputs);
    // Expected: [block_marker single, stake_split(2), external single, dust_collapse(2 visible + 1 collapsed)]
    expect(items.map((i) => i.kind)).toEqual([
      'single',
      'stake_split',
      'single',
      'dust_collapse',
    ]);
  });

  it('does not group 2 stake_returns when they are dust (dust takes precedence in collapse decision)', () => {
    // Edge case: stake_returns that are also dust. The implementation must
    // pick one grouping (stake_split OR dust_collapse) — by design, stake_split
    // wins because it carries semantic meaning ("these are paired"), while dust
    // is just a "tiny" flag. Test that 2 dust stake_returns still group as
    // stake_split, AND that the dust count from those 2 does NOT contribute to
    // the dust_collapse threshold (otherwise the outputs would be in BOTH a
    // stake_split AND a dust_collapse, which doesn't make sense).
    const inputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'stake_return', is_dust: true }),
      mkOutput({ index: 1, role: 'stake_return', is_dust: true }),
      mkOutput({ index: 2, role: 'nonstandard', is_dust: true }),
    ];
    const items = groupOutputs(inputs);
    // Expected: stake_split(2 dust stake_returns) + single(1 nonstandard dust)
    // NOT: dust_collapse with 3 dust outputs
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('stake_split');
    expect(items[1].kind).toBe('single');
  });
});
