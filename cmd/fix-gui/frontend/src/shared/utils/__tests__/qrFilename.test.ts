import { describe, it, expect } from 'vitest';
import { buildQRFilename } from '../qrFilename';

describe('buildQRFilename', () => {
  // --- 4 context combinations ---

  it('returns label + amount when both provided', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', 'Coffee Shop', 50))
      .toBe('fix-qr-Coffee-Shop-50FIX.png');
  });

  it('returns label only when no amount', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', 'My Donation'))
      .toBe('fix-qr-My-Donation.png');
  });

  it('returns amount + address prefix when no label', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', undefined, 100))
      .toBe('fix-qr-100FIX-WPb3GHXn.png');
  });

  it('returns address prefix when neither label nor amount', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh'))
      .toBe('fix-qr-WPb3GHXn.png');
  });

  // --- Edge cases ---

  it('falls back to "qr" when address is undefined', () => {
    expect(buildQRFilename(undefined)).toBe('fix-qr-qr.png');
  });

  it('falls back to "qr" when address is empty', () => {
    expect(buildQRFilename('')).toBe('fix-qr-qr.png');
  });

  it('ignores zero amount', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', undefined, 0))
      .toBe('fix-qr-WPb3GHXn.png');
  });

  it('ignores negative amount', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', undefined, -5))
      .toBe('fix-qr-WPb3GHXn.png');
  });

  it('ignores empty label', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', ''))
      .toBe('fix-qr-WPb3GHXn.png');
  });

  it('ignores whitespace-only label', () => {
    expect(buildQRFilename('WPb3GHXnAbCdEfGh', '   '))
      .toBe('fix-qr-WPb3GHXn.png');
  });

  // --- Label sanitization ---

  it('sanitizes special characters in label', () => {
    expect(buildQRFilename('WPb3GHXn', 'hello/world:test!'))
      .toBe('fix-qr-hello-world-test.png');
  });

  it('collapses consecutive hyphens from sanitization', () => {
    expect(buildQRFilename('WPb3GHXn', 'a---b///c'))
      .toBe('fix-qr-a-b-c.png');
  });

  it('truncates long labels to 40 characters', () => {
    const longLabel = 'A'.repeat(60);
    const result = buildQRFilename('WPb3GHXn', longLabel);
    // "fix-qr-" + 40 A's + ".png"
    expect(result).toBe(`fix-qr-${'A'.repeat(40)}.png`);
  });

  // --- Amount formatting ---

  it('strips trailing zeros from amount', () => {
    expect(buildQRFilename('WPb3GHXn', 'Test', 50.0))
      .toBe('fix-qr-Test-50FIX.png');
  });

  it('preserves significant decimals in amount', () => {
    expect(buildQRFilename('WPb3GHXn', undefined, 0.005))
      .toBe('fix-qr-0.005FIX-WPb3GHXn.png');
  });
});
