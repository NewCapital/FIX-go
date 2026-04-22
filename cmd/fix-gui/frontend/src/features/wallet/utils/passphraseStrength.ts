export type StrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong';

const LENGTH_THRESHOLDS = [8, 12, 16, 20];
const CHAR_PATTERNS: RegExp[] = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/];
const LEVEL_THRESHOLDS: [number, StrengthLevel][] = [
  [70, 'very-strong'],
  [50, 'strong'],
  [30, 'medium'],
];

/**
 * Evaluates passphrase strength based on length and character variety.
 * Returns a score from 0-100 and a strength level.
 */
export function evaluatePassphraseStrength(passphrase: string): { score: number; level: StrengthLevel } {
  if (!passphrase) {
    return { score: 0, level: 'weak' };
  }

  let score = 0;

  // Length scoring (up to 40 points)
  for (const threshold of LENGTH_THRESHOLDS) {
    if (passphrase.length >= threshold) score += 10;
  }

  // Character variety (up to 40 points)
  for (const pattern of CHAR_PATTERNS) {
    if (pattern.test(passphrase)) score += 10;
  }

  // Bonus for mixed character positions (up to 20 points)
  if (passphrase.length >= 3) {
    const middle = passphrase.slice(1, -1);
    if (/[A-Z]/.test(middle)) score += 10;
    if (/\d/.test(middle)) score += 10;
  }

  score = Math.min(100, score);

  const level = LEVEL_THRESHOLDS.find(([threshold]) => score >= threshold)?.[1] ?? 'weak';

  return { score, level };
}
