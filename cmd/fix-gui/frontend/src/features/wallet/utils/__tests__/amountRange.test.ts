import { describe, it, expect } from 'vitest';
import { isAmountRangeInverted } from '../amountRange';

describe('isAmountRangeInverted', () => {
  it('returns false when both bounds are empty (no filter active)', () => {
    expect(isAmountRangeInverted('', '')).toBe(false);
  });

  it('returns false when only From is set (To unbounded)', () => {
    expect(isAmountRangeInverted('100', '')).toBe(false);
  });

  it('returns false when only To is set (From unbounded)', () => {
    expect(isAmountRangeInverted('', '500')).toBe(false);
  });

  it('returns false when From equals To (valid degenerate range)', () => {
    expect(isAmountRangeInverted('100', '100')).toBe(false);
  });

  it('returns false when From < To (valid ascending range)', () => {
    expect(isAmountRangeInverted('100', '500')).toBe(false);
  });

  it('returns true when From > To (inverted range)', () => {
    expect(isAmountRangeInverted('500', '100')).toBe(true);
  });

  it('returns true for decimal inverted range', () => {
    expect(isAmountRangeInverted('0.5', '0.25')).toBe(true);
  });

  it('returns false for decimal valid range', () => {
    expect(isAmountRangeInverted('0.25', '0.5')).toBe(false);
  });

  it('returns false when both inputs are non-numeric (defense-in-depth)', () => {
    expect(isAmountRangeInverted('abc', 'xyz')).toBe(false);
  });

  it('returns false when From is non-numeric (NaN guard)', () => {
    expect(isAmountRangeInverted('abc', '100')).toBe(false);
  });

  it('returns true for large inverted values', () => {
    expect(isAmountRangeInverted('1000000', '999999.99')).toBe(true);
  });
});
