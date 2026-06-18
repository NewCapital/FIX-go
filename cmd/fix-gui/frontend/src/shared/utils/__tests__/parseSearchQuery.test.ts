import { describe, it, expect } from 'vitest';
import { parseSearchQuery, isBarePositiveNumber } from '../parseSearchQuery';

describe('parseSearchQuery', () => {
  // TXID detection was removed in code review round 2: backend SearchText
  // only matches address+label substrings, so routing TXIDs to setSearchText
  // would silently return no results. All hex-shaped inputs now fall through
  // to the plain search branch and are treated as label/address substrings.
  describe('TXID-shaped input falls through to search (no dedicated TXID match)', () => {
    it('64 lowercase hex chars falls through to search', () => {
      const s = 'a'.repeat(64);
      expect(parseSearchQuery(s)).toEqual({ type: 'search', value: s });
    });

    it('64 uppercase hex chars falls through to search', () => {
      const s = 'F'.repeat(64);
      expect(parseSearchQuery(s)).toEqual({ type: 'search', value: s });
    });

    it('63 hex chars falls through to search', () => {
      const s = 'a'.repeat(63);
      expect(parseSearchQuery(s)).toEqual({ type: 'search', value: s });
    });

    it('65 hex chars falls through to search', () => {
      const s = 'a'.repeat(65);
      expect(parseSearchQuery(s)).toEqual({ type: 'search', value: s });
    });
  });

  describe('FIX address detection', () => {
    it('detects valid FIX address (W-prefix + 33 base58)', () => {
      const addr = 'W' + 'A'.repeat(33);
      expect(parseSearchQuery(addr)).toEqual({ type: 'address', value: addr });
    });

    it('detects valid FIX address (a-prefix + 33 base58)', () => {
      const addr = 'a' + 'A'.repeat(33);
      expect(parseSearchQuery(addr)).toEqual({ type: 'address', value: addr });
    });

    it('rejects Bitcoin-style address (1-prefix) as search', () => {
      const addr = '1' + 'A'.repeat(33);
      expect(parseSearchQuery(addr)).toEqual({ type: 'search', value: addr });
    });

    it('rejects D-prefix (stale legacy doc) as search', () => {
      const addr = 'D' + 'A'.repeat(33);
      expect(parseSearchQuery(addr)).toEqual({ type: 'search', value: addr });
    });

    it('rejects too-short FIX-prefixed string as search', () => {
      const s = 'W' + 'A'.repeat(20);
      expect(parseSearchQuery(s)).toEqual({ type: 'search', value: s });
    });
  });

  describe('Min amount detection', () => {
    it('detects ">50" as min_amount 50', () => {
      expect(parseSearchQuery('>50')).toEqual({ type: 'min_amount', value: 50 });
    });

    it('detects ">=100" as min_amount 100', () => {
      expect(parseSearchQuery('>=100')).toEqual({ type: 'min_amount', value: 100 });
    });

    it('detects "> 100" (with whitespace) as min_amount 100', () => {
      expect(parseSearchQuery('> 100')).toEqual({ type: 'min_amount', value: 100 });
    });

    it('detects decimal ">12.5" as min_amount 12.5', () => {
      expect(parseSearchQuery('>12.5')).toEqual({ type: 'min_amount', value: 12.5 });
    });

    it('rejects ">0" (non-positive) as search', () => {
      expect(parseSearchQuery('>0')).toEqual({ type: 'search', value: '>0' });
    });

    it('plain "0.5" (no comparator) falls through to search', () => {
      expect(parseSearchQuery('0.5')).toEqual({ type: 'search', value: '0.5' });
    });
  });

  describe('Fallthrough cases', () => {
    it('empty string returns search empty', () => {
      expect(parseSearchQuery('')).toEqual({ type: 'search', value: '' });
    });

    it('whitespace-only returns search empty', () => {
      expect(parseSearchQuery('   ')).toEqual({ type: 'search', value: '' });
    });

    it('regular label text returns search', () => {
      expect(parseSearchQuery('alice')).toEqual({ type: 'search', value: 'alice' });
    });

    it('trims surrounding whitespace', () => {
      expect(parseSearchQuery('  alice  ')).toEqual({ type: 'search', value: 'alice' });
    });
  });
});

describe('isBarePositiveNumber', () => {
  it('returns true for bare positive integer', () => {
    expect(isBarePositiveNumber('100')).toBe(true);
  });

  it('returns true for bare positive decimal', () => {
    expect(isBarePositiveNumber('0.5')).toBe(true);
  });

  it('returns true for value with surrounding whitespace', () => {
    expect(isBarePositiveNumber('  42  ')).toBe(true);
  });

  it('returns false for zero (not positive)', () => {
    expect(isBarePositiveNumber('0')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBarePositiveNumber('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isBarePositiveNumber('   ')).toBe(false);
  });

  it('returns false for negative number (regex rejects leading dash)', () => {
    expect(isBarePositiveNumber('-50')).toBe(false);
  });

  it('returns false for value with operator prefix (handled by parseSearchQuery)', () => {
    expect(isBarePositiveNumber('>100')).toBe(false);
  });

  it('returns false for non-numeric text', () => {
    expect(isBarePositiveNumber('alice')).toBe(false);
  });

  it('returns false for hex-shaped string', () => {
    expect(isBarePositiveNumber('a'.repeat(64))).toBe(false);
  });

  it('returns false for trailing dot', () => {
    expect(isBarePositiveNumber('100.')).toBe(false);
  });
});
