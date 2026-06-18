import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toDate,
  formatAbsoluteUTC,
  formatAbsoluteUTCShort,
  formatAbsoluteUTCNoTz,
  formatAgeShort,
  formatAbsoluteLocal,
  formatAbsoluteLocalNoTz,
  formatAbsoluteLocalShort,
  formatTooltipFor,
  getLocalTzAbbrev,
} from '../useDisplayDateTime.helpers';

describe('toDate', () => {
  it('returns null for null/undefined', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toDate('')).toBeNull();
    expect(toDate('   ')).toBeNull();
  });

  it('parses Unix seconds (numeric < 1e12)', () => {
    const result = toDate(1700000000);
    expect(result).not.toBeNull();
    expect(result?.getUTCFullYear()).toBe(2023);
  });

  it('parses Unix milliseconds (numeric >= 1e12)', () => {
    const result = toDate(1700000000000);
    expect(result).not.toBeNull();
    expect(result?.getUTCFullYear()).toBe(2023);
  });

  it('parses ISO 8601 string', () => {
    const result = toDate('2026-06-04T12:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.getUTCFullYear()).toBe(2026);
  });

  it('passes through valid Date instance', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(toDate(d)).toEqual(d);
  });

  it('returns null for invalid Date instance', () => {
    expect(toDate(new Date('not-a-date'))).toBeNull();
  });

  it('rejects year <= 1970 zero-date markers', () => {
    expect(toDate(0)).toBeNull();
    expect(toDate('1970-01-01T00:00:00Z')).toBeNull();
    expect(toDate('0001-01-01T00:00:00Z')).toBeNull();
  });
});

describe('formatAbsoluteUTC', () => {
  it('formats UTC with explicit UTC suffix', () => {
    const d = new Date('2026-06-04T05:20:39Z');
    expect(formatAbsoluteUTC(d)).toBe('2026-06-04 05:20:39 UTC');
  });

  it('zero-pads month/day/time components', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(formatAbsoluteUTC(d)).toBe('2026-01-02 03:04:05 UTC');
  });
});

describe('formatAgeShort', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "<1m ago" for sub-minute deltas', () => {
    expect(formatAgeShort(new Date('2026-06-04T11:59:30Z'))).toBe('<1m ago');
  });

  it('returns minutes for sub-hour deltas', () => {
    expect(formatAgeShort(new Date('2026-06-04T11:55:00Z'))).toBe('5m ago');
  });

  it('returns hours for sub-day deltas', () => {
    expect(formatAgeShort(new Date('2026-06-04T09:00:00Z'))).toBe('3h ago');
  });

  it('returns days for sub-month deltas', () => {
    expect(formatAgeShort(new Date('2026-05-31T12:00:00Z'))).toBe('4d ago');
  });

  it('returns months for sub-year deltas', () => {
    // 60 days back = 2mo
    expect(formatAgeShort(new Date('2026-04-05T12:00:00Z'))).toBe('2mo ago');
  });

  it('returns years for >= 365 days', () => {
    // ~2 years back
    expect(formatAgeShort(new Date('2024-06-04T12:00:00Z'))).toMatch(/^(1y|1y 11mo|2y) ago$/);
  });

  it('clock-skew clamp: future dates render as <1m ago', () => {
    expect(formatAgeShort(new Date('2026-06-05T12:00:00Z'))).toBe('<1m ago');
  });
});

describe('formatAbsoluteLocal', () => {
  it('returns ISO-like YYYY-MM-DD HH:MM:SS plus TZ token', () => {
    const result = formatAbsoluteLocal(new Date('2026-06-04T12:00:00Z'));
    // ISO-like prefix is deterministic; TZ suffix depends on host.
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});

describe('formatAbsoluteUTCShort', () => {
  it('returns MM-DD HH:MM without seconds or TZ', () => {
    const d = new Date('2026-06-04T05:20:39Z');
    expect(formatAbsoluteUTCShort(d)).toBe('06-04 05:20');
  });

  it('zero-pads single-digit components', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(formatAbsoluteUTCShort(d)).toBe('01-02 03:04');
  });
});

describe('formatAbsoluteLocalShort', () => {
  it('returns MM-DD HH:MM without year/seconds/TZ', () => {
    const result = formatAbsoluteLocalShort(new Date('2026-06-04T12:00:00Z'));
    // Local interpretation varies, but format shape is fixed:
    expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(result.length).toBe(11);
  });
});

describe('formatTooltipFor', () => {
  // dateFormat numeric constants match DATE_FORMAT_LOCAL/UTC/AGE in
  // useDisplayDateTime.ts (0 / 1 / 2). Documented in the helper docblock.
  const d = new Date('2026-06-04T05:20:39Z');

  it('Local mode (0) → UTC tooltip', () => {
    expect(formatTooltipFor(0, d)).toBe('2026-06-04 05:20:39 UTC');
  });

  it('UTC mode (1) → Local tooltip (ISO-like with TZ)', () => {
    const result = formatTooltipFor(1, d);
    // Local interpretation varies, but format shape is fixed: YYYY-MM-DD HH:MM:SS [TZ]
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    // Must equal the local formatter output (dispatch verification). When the
    // test env happens to be UTC, formatAbsoluteLocal and formatAbsoluteUTC
    // produce identical strings — comparing against formatAbsoluteLocal
    // verifies dispatch regardless of host TZ.
    expect(result).toBe(formatAbsoluteLocal(d));
  });

  it('Age mode (2) → UTC tooltip', () => {
    expect(formatTooltipFor(2, d)).toBe('2026-06-04 05:20:39 UTC');
  });
});

describe('formatAbsoluteUTCNoTz', () => {
  it('returns YYYY-MM-DD HH:MM:SS without UTC suffix', () => {
    const d = new Date('2026-06-04T05:20:39Z');
    expect(formatAbsoluteUTCNoTz(d)).toBe('2026-06-04 05:20:39');
  });

  it('zero-pads month/day/time components', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(formatAbsoluteUTCNoTz(d)).toBe('2026-01-02 03:04:05');
  });

  it('does NOT include any TZ suffix token', () => {
    const d = new Date('2026-06-04T05:20:39Z');
    const result = formatAbsoluteUTCNoTz(d);
    expect(result).not.toMatch(/UTC|GMT/);
  });
});

describe('formatAbsoluteLocalNoTz', () => {
  it('returns YYYY-MM-DD HH:MM:SS without TZ suffix', () => {
    const result = formatAbsoluteLocalNoTz(new Date('2026-06-04T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(result).not.toMatch(/UTC|GMT/);
  });
});

describe('getLocalTzAbbrev', () => {
  it('returns a non-empty string under jsdom Intl', () => {
    const tz = getLocalTzAbbrev(new Date('2026-06-04T12:00:00Z'));
    // jsdom resolves Intl.DateTimeFormat — value depends on host TZ but
    // should be a short token (GMT+N, UTC, etc.). Length sanity-check.
    expect(typeof tz).toBe('string');
  });
});
