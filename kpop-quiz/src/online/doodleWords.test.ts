import { describe, it, expect } from 'vitest';
import { DOODLE_CATEGORIES, DOODLE_WORDS, pickScrambleWords } from './doodleWords';
import { isKidSafe } from './rudeWords';

describe('Doodle word bank', () => {
  it('has no duplicates anywhere', () => {
    const dupes = DOODLE_WORDS.filter((w, i) => DOODLE_WORDS.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });

  it('has at least 20 words in every category, and unique category names', () => {
    for (const c of DOODLE_CATEGORIES) expect(c.words.length, c.category).toBeGreaterThanOrEqual(20);
    expect(new Set(DOODLE_CATEGORIES.map(c => c.category)).size).toBe(DOODLE_CATEGORIES.length);
  });

  it('is lower case, trimmed, letters and single spaces only, never empty', () => {
    for (const w of DOODLE_WORDS) {
      expect(w, w).toMatch(/^[a-z]+( [a-z]+)*$/);
      expect(w.trim()).toBe(w);
    }
  });

  it('is kid-safe and no longer K-pop themed', () => {
    for (const w of DOODLE_WORDS) expect(isKidSafe(w), w).toBe(true);
    expect(DOODLE_CATEGORIES.some(c => /k-?pop/i.test(c.category))).toBe(false);
    expect(DOODLE_WORDS).not.toContain('idol');
    expect(DOODLE_CATEGORIES.find(c => c.category === 'Music & Instruments')).toBeTruthy();
  });

  it('still gives Word Scramble single comfy-length words', () => {
    for (const s of pickScrambleWords(30)) expect(s.word).toMatch(/^[a-z]{4,8}$/);
  });
});
