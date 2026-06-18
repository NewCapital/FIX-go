import { describe, it, expect } from 'vitest';
import { classifyExplorerQuery } from '../parseExplorerSearchQuery';

/**
 * Tests for the Explorer search-bar input classifier.
 *
 * Classification priority (mirrors backend SearchExplorer dispatch order in
 * internal/gui/core/go_client.go:767-814):
 *   1. empty / whitespace-only → invalid:empty
 *   2. all-digits, fits uint32 → block_height
 *   3. all-digits, overflows uint32 → invalid:unknown (overflow_height tracked
 *      via the dedicated `overflow_height` reason for richer UX hints)
 *   4. 64 hex chars → block_or_tx_hash (backend disambiguates first-wins)
 *   5. FIX address regex `/^[Wamn][a-km-zA-HJ-NP-Z1-9]{33}$/` → address
 *   6. 1-63 hex chars → invalid:short_hash
 *   7. 65+ hex chars → invalid:long_hash
 *   8. fallthrough → invalid:unknown
 *
 * The frontend classifier is intentionally tighter than the backend permissive
 * length filter (>=26 && <=35 for DecodeAddress) — only the canonical 34-char
 * FIX address is classified as `address` so the user gets accurate type-badge
 * feedback. Anything not matching falls through to invalid.
 */
describe('classifyExplorerQuery', () => {
  describe('empty / whitespace', () => {
    it('empty string → invalid:empty', () => {
      expect(classifyExplorerQuery('')).toEqual({ type: 'invalid', reason: 'empty' });
    });

    it('whitespace-only → invalid:empty', () => {
      expect(classifyExplorerQuery('   ')).toEqual({ type: 'invalid', reason: 'empty' });
    });

    it('tabs and newlines → invalid:empty', () => {
      expect(classifyExplorerQuery('\t\n  ')).toEqual({ type: 'invalid', reason: 'empty' });
    });
  });

  describe('block height', () => {
    it('numeric "0" → block_height value 0', () => {
      expect(classifyExplorerQuery('0')).toEqual({ type: 'block_height', value: 0 });
    });

    it('numeric "1" → block_height value 1', () => {
      expect(classifyExplorerQuery('1')).toEqual({ type: 'block_height', value: 1 });
    });

    it('numeric "1234567" → block_height value 1234567', () => {
      expect(classifyExplorerQuery('1234567')).toEqual({ type: 'block_height', value: 1234567 });
    });

    it('uint32 max boundary "4294967295" → block_height', () => {
      expect(classifyExplorerQuery('4294967295')).toEqual({ type: 'block_height', value: 4294967295 });
    });

    it('trims surrounding whitespace before classifying', () => {
      expect(classifyExplorerQuery('  1000  ')).toEqual({ type: 'block_height', value: 1000 });
    });

    it('overflow uint32 "4294967296" → invalid:overflow_height', () => {
      expect(classifyExplorerQuery('4294967296')).toEqual({ type: 'invalid', reason: 'overflow_height' });
    });

    it('absurdly large "99999999999" → invalid:overflow_height', () => {
      expect(classifyExplorerQuery('99999999999')).toEqual({ type: 'invalid', reason: 'overflow_height' });
    });
  });

  describe('64-hex block_or_tx_hash', () => {
    it('64 lowercase hex chars → block_or_tx_hash', () => {
      const s = 'a'.repeat(64);
      expect(classifyExplorerQuery(s)).toEqual({ type: 'block_or_tx_hash', value: s });
    });

    it('64 uppercase hex chars → block_or_tx_hash', () => {
      const s = 'F'.repeat(64);
      expect(classifyExplorerQuery(s)).toEqual({ type: 'block_or_tx_hash', value: s });
    });

    it('64 mixed-case hex chars → block_or_tx_hash', () => {
      const s = 'aF0123456789bcdeF0123456789aF0123456789bcdeF0123456789aF01234567';
      expect(classifyExplorerQuery(s)).toEqual({ type: 'block_or_tx_hash', value: s });
    });

    it('trims surrounding whitespace before classifying hash', () => {
      const s = 'a'.repeat(64);
      expect(classifyExplorerQuery(`  ${s}  `)).toEqual({ type: 'block_or_tx_hash', value: s });
    });
  });

  describe('FIX address — all 4 prefixes', () => {
    it('W-prefix (mainnet) → address', () => {
      // Base58 alphabet excludes 0/O/I/l; using 'A' chars which are valid.
      const addr = 'W' + 'A'.repeat(33);
      expect(classifyExplorerQuery(addr)).toEqual({ type: 'address', value: addr });
    });

    it('m-prefix (testnet) → address', () => {
      const addr = 'm' + 'A'.repeat(33);
      expect(classifyExplorerQuery(addr)).toEqual({ type: 'address', value: addr });
    });

    it('n-prefix (testnet) → address', () => {
      const addr = 'n' + 'A'.repeat(33);
      expect(classifyExplorerQuery(addr)).toEqual({ type: 'address', value: addr });
    });

    it('a-prefix (recipient convention) → address', () => {
      const addr = 'a' + 'A'.repeat(33);
      expect(classifyExplorerQuery(addr)).toEqual({ type: 'address', value: addr });
    });
  });

  describe('invalid:short_hash (hex but wrong length)', () => {
    it('63 hex chars → invalid:short_hash', () => {
      expect(classifyExplorerQuery('a'.repeat(63))).toEqual({ type: 'invalid', reason: 'short_hash' });
    });

    it('40 hex chars → invalid:short_hash', () => {
      expect(classifyExplorerQuery('f'.repeat(40))).toEqual({ type: 'invalid', reason: 'short_hash' });
    });
  });

  describe('invalid:long_hash (hex but too long)', () => {
    it('65 hex chars → invalid:long_hash', () => {
      expect(classifyExplorerQuery('a'.repeat(65))).toEqual({ type: 'invalid', reason: 'long_hash' });
    });

    it('128 hex chars → invalid:long_hash', () => {
      expect(classifyExplorerQuery('a'.repeat(128))).toEqual({ type: 'invalid', reason: 'long_hash' });
    });
  });

  describe('invalid:unknown (catch-all)', () => {
    it('too-short FIX-prefixed string → invalid:unknown', () => {
      // 21 chars: too short for address, not hex (W is not hex), not numeric.
      expect(classifyExplorerQuery('W' + 'A'.repeat(20))).toEqual({ type: 'invalid', reason: 'unknown' });
    });

    it('wrong-prefix base58-shaped (D-prefix) → invalid:short_hash (D + 33 hex chars = 34 hex)', () => {
      // D and A are both hex digits, so DAAA...A is 34 hex chars → short_hash branch.
      // This is the same outcome as the Bitcoin-style 1-prefix test below.
      const s = 'D' + 'A'.repeat(33);
      expect(classifyExplorerQuery(s)).toEqual({ type: 'invalid', reason: 'short_hash' });
    });

    it('Bitcoin-style 1-prefix → invalid:unknown', () => {
      const s = '1' + 'A'.repeat(33);
      // "1" + 33 alphanumeric is not all-digits AND not all-hex (A is hex but 33 is wrong length).
      // Length 34, hex-shape: 1 is decimal digit AND hex digit, A is hex digit → all chars hex.
      // But length 34 != 64, so this hits short_hash, not unknown.
      // Update: regex check is HEX_REGEX.test(s) AND length 64. 34 hex chars → short_hash.
      // Adjust expectation:
      expect(classifyExplorerQuery(s)).toEqual({ type: 'invalid', reason: 'short_hash' });
    });

    it('plain text "alice" → invalid:unknown', () => {
      expect(classifyExplorerQuery('alice')).toEqual({ type: 'invalid', reason: 'unknown' });
    });

    it('partial numeric with letter "123abc" → invalid:short_hash (hex-shaped)', () => {
      // 123abc is all hex digits (1-9, a-f), length 6 → short_hash branch.
      expect(classifyExplorerQuery('123abc')).toEqual({ type: 'invalid', reason: 'short_hash' });
    });

    it('non-hex non-numeric short string "xyz" → invalid:unknown', () => {
      expect(classifyExplorerQuery('xyz')).toEqual({ type: 'invalid', reason: 'unknown' });
    });

    it('special chars "$$$$$$" → invalid:unknown', () => {
      expect(classifyExplorerQuery('$$$$$$')).toEqual({ type: 'invalid', reason: 'unknown' });
    });

    it('negative number "-100" → invalid:unknown', () => {
      // Leading dash makes it not match digit regex.
      expect(classifyExplorerQuery('-100')).toEqual({ type: 'invalid', reason: 'unknown' });
    });

    it('decimal "12.5" → invalid:unknown (not integer block height, not hex, not address)', () => {
      expect(classifyExplorerQuery('12.5')).toEqual({ type: 'invalid', reason: 'unknown' });
    });
  });
});
