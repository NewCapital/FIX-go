import { describe, it, expect } from 'vitest';
import type { TxOutput } from '@/store/slices/explorerSlice';
import { deriveCoinstakeReward } from '../rewardBreakdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkOutput(overrides: Partial<TxOutput>): TxOutput {
  return {
    index: 0,
    address: 'WaddressDefault',
    amount: 0,
    script_type: 'pubkeyhash',
    label: '',
    is_spent: false,
    role: 'nonstandard',
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
// deriveCoinstakeReward
// ---------------------------------------------------------------------------

describe('deriveCoinstakeReward', () => {
  it('canonical PoS layout: 1 stake + 1 MN + 1 dev + 1 block_marker', () => {
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker', amount: 0 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 100 }),
      mkOutput({ index: 2, role: 'masternode_payment', amount: 5 }),
      mkOutput({ index: 3, role: 'dev_fund', amount: 2 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.stake).toHaveLength(1);
    expect(reward.masternode).toHaveLength(1);
    expect(reward.dev).toHaveLength(1);
    expect(reward.stakeTotal).toBe(100);
    expect(reward.masternodeTotal).toBe(5);
    expect(reward.devTotal).toBe(2);
    expect(reward.total).toBe(107);
  });

  it('stake-split N=2: two stake_return outputs aggregate into the stake bucket', () => {
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker', amount: 0 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 50.75 }),
      mkOutput({ index: 2, role: 'stake_return', amount: 50.75 }),
      mkOutput({ index: 3, role: 'masternode_payment', amount: 5 }),
      mkOutput({ index: 4, role: 'dev_fund', amount: 2 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.stake).toHaveLength(2);
    expect(reward.stakeTotal).toBe(101.5);
    expect(reward.masternodeTotal).toBe(5);
    expect(reward.devTotal).toBe(2);
    expect(reward.total).toBe(108.5);
    // Order preservation: input order is preserved within the bucket.
    expect(reward.stake[0].index).toBe(1);
    expect(reward.stake[1].index).toBe(2);
  });

  it('missing MN output: masternode bucket is empty, total excludes MN', () => {
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker', amount: 0 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 100 }),
      mkOutput({ index: 2, role: 'dev_fund', amount: 2 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.masternode).toHaveLength(0);
    expect(reward.masternodeTotal).toBe(0);
    expect(reward.stakeTotal).toBe(100);
    expect(reward.devTotal).toBe(2);
    expect(reward.total).toBe(102);
  });

  it('missing dev output: dev bucket is empty, total excludes dev', () => {
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker', amount: 0 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 100 }),
      mkOutput({ index: 2, role: 'masternode_payment', amount: 5 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.dev).toHaveLength(0);
    expect(reward.devTotal).toBe(0);
    expect(reward.stakeTotal).toBe(100);
    expect(reward.masternodeTotal).toBe(5);
    expect(reward.total).toBe(105);
  });

  it('missing both MN and dev: only stake bucket populated', () => {
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'block_marker', amount: 0 }),
      mkOutput({ index: 1, role: 'stake_return', amount: 100 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.stake).toHaveLength(1);
    expect(reward.masternode).toHaveLength(0);
    expect(reward.dev).toHaveLength(0);
    expect(reward.stakeTotal).toBe(100);
    expect(reward.masternodeTotal).toBe(0);
    expect(reward.devTotal).toBe(0);
    expect(reward.total).toBe(100);
  });

  it('empty outputs: all buckets empty, all totals zero', () => {
    const reward = deriveCoinstakeReward([]);
    expect(reward.stake).toHaveLength(0);
    expect(reward.masternode).toHaveLength(0);
    expect(reward.dev).toHaveLength(0);
    expect(reward.stakeTotal).toBe(0);
    expect(reward.masternodeTotal).toBe(0);
    expect(reward.devTotal).toBe(0);
    expect(reward.total).toBe(0);
  });

  it('non-reward roles (change, external_payment, etc.) are silently skipped', () => {
    // Defense-in-depth: a malformed coinstake or a non-coinstake transaction
    // accidentally fed to the helper should produce empty buckets rather than
    // miscategorize outputs.
    const outputs: TxOutput[] = [
      mkOutput({ index: 0, role: 'external_payment', amount: 50 }),
      mkOutput({ index: 1, role: 'change', amount: 10 }),
      mkOutput({ index: 2, role: 'self_send', amount: 5 }),
      mkOutput({ index: 3, role: 'data_carrier', amount: 0 }),
      mkOutput({ index: 4, role: 'multisig', amount: 20 }),
      mkOutput({ index: 5, role: 'nonstandard', amount: 1 }),
    ];
    const reward = deriveCoinstakeReward(outputs);
    expect(reward.stake).toHaveLength(0);
    expect(reward.masternode).toHaveLength(0);
    expect(reward.dev).toHaveLength(0);
    expect(reward.total).toBe(0);
  });
});
