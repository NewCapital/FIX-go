import { describe, it, expect } from 'vitest';
import { isoToDisplay, displayToIso } from '../dateFormat';

describe('isoToDisplay', () => {
  it('converts a valid ISO date to DD/MM/YYYY', () => {
    expect(isoToDisplay('2026-05-22')).toBe('22/05/2026');
  });

  it('preserves zero-padded month and day', () => {
    expect(isoToDisplay('2026-01-05')).toBe('05/01/2026');
  });

  it('returns empty string for empty input', () => {
    expect(isoToDisplay('')).toBe('');
  });

  it('returns empty string for malformed ISO', () => {
    expect(isoToDisplay('2026/05/22')).toBe('');
    expect(isoToDisplay('2026-5-22')).toBe('');
    expect(isoToDisplay('not-a-date')).toBe('');
  });
});

describe('displayToIso', () => {
  it('parses zero-padded DD/MM/YYYY to ISO', () => {
    expect(displayToIso('22/05/2026')).toBe('2026-05-22');
  });

  it('parses unpadded D/M/YYYY to padded ISO', () => {
    expect(displayToIso('5/1/2026')).toBe('2026-01-05');
  });

  it('trims surrounding whitespace', () => {
    expect(displayToIso('  22/05/2026  ')).toBe('2026-05-22');
  });

  it('rejects malformed strings', () => {
    expect(displayToIso('22-05-2026')).toBeNull();
    expect(displayToIso('2026/05/22')).toBeNull();
    expect(displayToIso('22/05/26')).toBeNull(); // 2-digit year not allowed
    expect(displayToIso('not-a-date')).toBeNull();
    expect(displayToIso('')).toBeNull();
  });

  it('rejects month outside 1-12', () => {
    expect(displayToIso('01/00/2026')).toBeNull();
    expect(displayToIso('01/13/2026')).toBeNull();
  });

  it('rejects day outside the actual month length', () => {
    expect(displayToIso('32/01/2026')).toBeNull(); // Jan has 31 days
    expect(displayToIso('31/02/2026')).toBeNull(); // Feb has 28 in 2026
    expect(displayToIso('30/02/2024')).toBeNull(); // Feb has 29 in leap 2024
    expect(displayToIso('31/04/2026')).toBeNull(); // Apr has 30 days
  });

  it('accepts Feb 29 on a leap year', () => {
    expect(displayToIso('29/02/2024')).toBe('2024-02-29');
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(displayToIso('29/02/2026')).toBeNull();
  });

  it('round-trips through isoToDisplay', () => {
    const iso = '2026-05-22';
    const display = isoToDisplay(iso);
    expect(displayToIso(display)).toBe(iso);
  });
});
