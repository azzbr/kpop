import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { SCRAMBLE_WORDS, WORDS_PER_ROUND, scramble, wordPoints, rating } from './wordScrambleLogic';

describe('word scramble words', () => {
  it('has enough unique, capital-letter words for a round', () => {
    expect(SCRAMBLE_WORDS.length).toBeGreaterThanOrEqual(WORDS_PER_ROUND);
    const words = SCRAMBLE_WORDS.map(w => w.word);
    expect(new Set(words).size).toBe(words.length);
    for (const w of SCRAMBLE_WORDS) {
      expect(w.word).toMatch(/^[A-Z]{4,10}$/);
      expect(w.hint.toUpperCase()).not.toContain(w.word); // the hint doesn't give the answer away
    }
  });

  it('has no K-Pop wording', () => {
    expect(JSON.stringify(SCRAMBLE_WORDS)).not.toMatch(/k-?pop|idol/i);
  });
});

describe('scramble', () => {
  it('uses exactly the same letters and never shows the word itself', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const { word } of SCRAMBLE_WORDS) {
        const s = scramble(word, createRng(seed));
        expect(s.join('')).not.toBe(word);
        expect([...s].sort().join('')).toBe([...word].sort().join(''));
      }
    }
  });
});

describe('points and rating', () => {
  it('points reward speed and streaks', () => {
    expect(wordPoints(5, 0)).toBe(100);
    expect(wordPoints(15, 0)).toBe(150);
    expect(wordPoints(15, 2)).toBe(190);
    expect(wordPoints(0, 0)).toBe(100);
  });

  it('rating is based on words solved, never over 100 %', () => {
    expect(rating(10, 10)).toContain('Wizard');
    expect(rating(12, 10)).toContain('Wizard'); // clamped, no crash
    expect(rating(7, 10)).toContain('Super Speller');
    expect(rating(0, 10)).toContain('Keep practising');
    for (let n = 0; n <= 10; n++) expect(rating(n, 10)).not.toMatch(/k-?pop/i);
  });
});
