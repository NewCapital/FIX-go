import { describe, it, expect } from 'vitest';
import { buildFIXURI, MAX_QR_DATA_LENGTH } from '../fixUri';

describe('buildFIXURI', () => {
  it('returns plain address URI when no optional params provided', () => {
    expect(buildFIXURI('TW1abc123')).toBe('fix:TW1abc123');
  });

  it('appends amount parameter', () => {
    expect(buildFIXURI('TW1abc123', 1.5)).toBe('fix:TW1abc123?amount=1.5');
  });

  it('appends label parameter with URL encoding', () => {
    expect(buildFIXURI('TW1abc123', undefined, 'Invoice #42')).toBe(
      'fix:TW1abc123?label=Invoice%20%2342'
    );
  });

  it('appends message parameter with URL encoding', () => {
    expect(buildFIXURI('TW1abc123', undefined, undefined, 'Pay me')).toBe(
      'fix:TW1abc123?message=Pay%20me'
    );
  });

  it('combines all parameters', () => {
    const uri = buildFIXURI('TW1abc123', 100, 'Test', 'Hello');
    expect(uri).toBe('fix:TW1abc123?amount=100&label=Test&message=Hello');
  });

  it('skips zero amount', () => {
    expect(buildFIXURI('TW1abc123', 0)).toBe('fix:TW1abc123');
  });

  it('skips negative amount', () => {
    expect(buildFIXURI('TW1abc123', -5)).toBe('fix:TW1abc123');
  });

  it('skips empty label', () => {
    expect(buildFIXURI('TW1abc123', undefined, '')).toBe('fix:TW1abc123');
  });

  it('skips empty message', () => {
    expect(buildFIXURI('TW1abc123', undefined, undefined, '')).toBe('fix:TW1abc123');
  });
});

describe('MAX_QR_DATA_LENGTH', () => {
  it('is 350 characters (Level H + logo overlay on 200px canvas)', () => {
    expect(MAX_QR_DATA_LENGTH).toBe(350);
  });
});
