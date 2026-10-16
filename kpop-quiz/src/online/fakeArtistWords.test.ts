import { describe, it, expect } from 'vitest';
import { FAKE_ARTIST_CATEGORIES, FAKE_ARTIST_WORDS } from './fakeArtistWords';
import { isKidSafe } from './rudeWords';
import { CHOICES } from '../components/online/fakeArtistLogic';

describe('Fake Artist words', () => {
  it('has about 150 words, no repeats', () => {
    expect(FAKE_ARTIST_WORDS.length).toBeGreaterThanOrEqual(140);
    expect(FAKE_ARTIST_WORDS.filter((w, i) => FAKE_ARTIST_WORDS.indexOf(w) !== i)).toEqual([]);
  });

  it('has enough words per category for the fake’s 6-word guess (12+)', () => {
    for (const c of FAKE_ARTIST_CATEGORIES) expect(c.words.length, c.category).toBeGreaterThanOrEqual(Math.max(12, CHOICES));
    expect(new Set(FAKE_ARTIST_CATEGORIES.map(c => c.category)).size).toBe(FAKE_ARTIST_CATEGORIES.length);
  });

  it('is lower case, letters and single spaces, kid-safe', () => {
    for (const w of FAKE_ARTIST_WORDS) {
      expect(w).toMatch(/^[a-z]+( [a-z]+)*$/);
      expect(isKidSafe(w), w).toBe(true);
    }
  });
});
