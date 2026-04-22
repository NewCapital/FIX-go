import { describe, it, expect } from 'vitest';
import {
  convertToDisplayUnit,
  getUnitLabel,
  formatBalance,
  truncateAddress,
  DISPLAY_UNIT_FIX,
  DISPLAY_UNIT_MFIX,
  DISPLAY_UNIT_UFIX,
} from '../format';

describe('convertToDisplayUnit', () => {
  it('returns amount unchanged for FIX unit', () => {
    expect(convertToDisplayUnit(1.5, DISPLAY_UNIT_FIX)).toBe(1.5);
  });

  it('multiplies by 1000 for mFIX unit', () => {
    expect(convertToDisplayUnit(1.5, DISPLAY_UNIT_MFIX)).toBe(1500);
  });

  it('multiplies by 1000000 for uFIX unit', () => {
    expect(convertToDisplayUnit(1.5, DISPLAY_UNIT_UFIX)).toBe(1500000);
  });

  it('handles zero amount', () => {
    expect(convertToDisplayUnit(0, DISPLAY_UNIT_MFIX)).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(convertToDisplayUnit(-2.0, DISPLAY_UNIT_MFIX)).toBe(-2000);
  });

  it('defaults to FIX for unknown unit', () => {
    expect(convertToDisplayUnit(1.5, 99)).toBe(1.5);
  });
});

describe('getUnitLabel', () => {
  it('returns FIX for unit 0', () => {
    expect(getUnitLabel(DISPLAY_UNIT_FIX)).toBe('FIX');
  });

  it('returns mFIX for unit 1', () => {
    expect(getUnitLabel(DISPLAY_UNIT_MFIX)).toBe('mFIX');
  });

  it('returns uFIX for unit 2', () => {
    expect(getUnitLabel(DISPLAY_UNIT_UFIX)).toBe('µFIX');
  });

  it('defaults to FIX for unknown unit', () => {
    expect(getUnitLabel(99)).toBe('FIX');
  });
});

describe('formatBalance', () => {
  it('formats with default 8 decimals and FIX suffix', () => {
    expect(formatBalance(1.5)).toBe('1.50000000 FIX');
  });

  it('formats with custom decimal places', () => {
    expect(formatBalance(1.5, 2)).toBe('1.50 FIX');
  });

  it('formats without unit suffix', () => {
    expect(formatBalance(1.5, 8, false)).toBe('1.50000000');
  });

  it('adds thousands separators', () => {
    expect(formatBalance(1234567.89, 2, false)).toBe('1,234,567.89');
  });

  it('handles zero', () => {
    expect(formatBalance(0, 8, false)).toBe('0.00000000');
  });

  it('handles negative amounts', () => {
    expect(formatBalance(-1.5, 8, false)).toBe('-1.50000000');
  });
});

describe('truncateAddress', () => {
  it('returns the address unchanged when shorter than start+end+3', () => {
    expect(truncateAddress('SHORT')).toBe('SHORT');
  });

  it('truncates a long address with default 10/10', () => {
    const addr = 'WYC3uuA3hG4yosQcEJWsSbsEGzUSDCNpz1';
    expect(truncateAddress(addr)).toBe('WYC3uuA3hG...GzUSDCNpz1');
  });

  it('truncates with custom startChars and endChars', () => {
    const addr = 'WYC3uuA3hG4yosQcEJWsSbsEGzUSDCNpz1';
    expect(truncateAddress(addr, 12, 10)).toBe('WYC3uuA3hG4y...GzUSDCNpz1');
  });

  it('does not truncate when address length is exactly the threshold', () => {
    // Threshold = startChars + endChars + 3
    // 10 + 10 + 3 = 23, so a 23-char address should NOT be truncated
    const addr = '12345678901234567890123';
    expect(truncateAddress(addr)).toBe(addr);
  });

  it('preserves original when length equals threshold + 1 (just above no-truncate boundary)', () => {
    // 10 + 10 + 3 = 23, so a 24-char address SHOULD be truncated
    const addr = '123456789012345678901234';
    expect(truncateAddress(addr)).toBe('1234567890...5678901234');
  });
});
