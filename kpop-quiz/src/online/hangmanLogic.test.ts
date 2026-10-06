import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { isClean } from '../utils/cleanText';
import { HM_LEN, hmCheck, hmFailed, hmGenerate, hmGuess, hmInit, hmLives, hmPool, hmProgress, hmSolved } from './hangmanLogic';

describe('Hangman', () => {
  it('every word is clean, a single word, and there are plenty per difficulty', () => {
    for (const d of Object.keys(HM_LEN)) {
      const pool = hmPool(d);
      expect(pool.length, d).toBeGreaterThanOrEqual(8);
      for (const w of pool) {
        expect(isClean(w), w).toBe(true);
        expect(w).toMatch(/^[a-z]+$/);
      }
    }
  });

  it('rounds of a game never repeat a word', () => {
    for (const d of Object.keys(HM_LEN)) {
      const words = [1, 2, 3, 4, 5].map(round => hmGenerate(d, createRng(round), { gameSeed: 42, round }).word);
      expect(new Set(words).size).toBe(5);
      for (const w of words) expect(isClean(w)).toBe(true);
    }
  });

  it('guessing every letter solves it; six misses and you are out', () => {
    const p = { word: 'PANDA' };
    let s = hmInit();
    for (const l of 'PAND') s = hmGuess(p, s, l);
    expect(hmSolved(p, s)).toBe(true);
    expect(hmProgress(p, s)).toBe(1);
    expect(hmCheck(p, s.guessed)).toBe(true);
    expect(hmCheck(p, ['P', 'A'])).toBe(false);

    let t = hmInit();
    for (const l of 'QWERTY') t = hmGuess(p, t, l);
    expect(hmLives(p, t)).toBe(0);
    expect(hmFailed(p, t)).toBe(true);
    expect(hmGuess(p, t, 'P')).toBe(t);
    expect(hmCheck(p, [...t.guessed, 'P', 'A', 'N', 'D'])).toBe(false);
  });
});
