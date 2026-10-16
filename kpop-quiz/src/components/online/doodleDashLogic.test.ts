import { describe, it, expect } from 'vitest';
import {
  isRightGuess, isCloseGuess, editDistance, guessPoints, drawerGain, wordShape, drawOrder, doodleRanking, allGuessed,
  wordLevel, wordPool, pickChoices, hintOrder, hintPattern, hintsDue, maxHints, parseConfig,
  ROUND_MS, FIRST_BONUS, DRAWER_MAX,
} from './doodleDashLogic';
import { createRng } from '../../games/engine/rng';
import { DOODLE_CATEGORIES, DOODLE_WORDS } from '../../online/doodleWords';

describe('Doodle Dash logic', () => {
  it('matches guesses ignoring case, spaces and punctuation', () => {
    expect(isRightGuess('Ice Cream!', 'ice cream')).toBe(true);
    expect(isRightGuess('icecream', 'ice cream')).toBe(true);
    expect(isRightGuess('ice', 'ice cream')).toBe(false);
    expect(isRightGuess('   ', '')).toBe(false);
  });

  it('every word can be typed on the on-screen keyboard (letters and spaces)', () => {
    for (const w of DOODLE_WORDS) expect(w).toMatch(/^[a-z ]+$/i);
  });

  it('spots "so close" guesses: one letter off or plural/singular, never the word', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(isCloseGuess('cta', 'cat')).toBe(false); // a swap is 2 edits
    expect(isCloseGuess('car', 'cat')).toBe(true);
    expect(isCloseGuess('cats', 'cat')).toBe(true);
    expect(isCloseGuess('drum', 'drumsticks')).toBe(false);
    expect(isCloseGuess('glove', 'gloves')).toBe(true);
    expect(isCloseGuess('cherries', 'cherry')).toBe(true);
    expect(isCloseGuess('box', 'bus')).toBe(false);
    expect(isCloseGuess('Ice Creams', 'ice cream')).toBe(true);
    expect(isCloseGuess('cat', 'cat')).toBe(false);
    expect(isCloseGuess('', 'cat')).toBe(false);
  });

  it('gives more points for faster guesses, a bonus for the first, and caps the drawer', () => {
    expect(guessPoints(ROUND_MS)).toBe(200);
    expect(guessPoints(0)).toBe(100);
    expect(guessPoints(-50)).toBe(100);
    expect(guessPoints(ROUND_MS / 2)).toBe(150);
    expect(guessPoints(ROUND_MS, 0)).toBe(200 + FIRST_BONUS);
    let d = 0;
    for (let n = 0; n < 30; n++) d += drawerGain(n);
    expect(d).toBe(DRAWER_MAX);
    expect(drawerGain(0)).toBeGreaterThan(0);
  });

  it('shows the word shape and letter hints, never the whole word', () => {
    expect(wordShape('ice cream')).toEqual([3, 5]);
    expect(hintPattern('ice cream', [])).toBe('___ _____');
    expect(hintPattern('panda', [2])).toBe('__n__');
    expect(maxHints('cat')).toBe(1);
    expect(maxHints('ox')).toBe(0);
    expect(maxHints('rainbow')).toBe(2);
    for (const w of DOODLE_WORDS) {
      const h = hintOrder(w, createRng(w.length));
      expect(new Set(h).size).toBe(h.length);
      for (const i of h) expect(w[i]).toMatch(/[a-z]/);
      expect(hintPattern(w, h)).toContain('_');
    }
    expect(hintsDue(0)).toBe(0);
    expect(hintsDue(30_000)).toBe(1);
    expect(hintsDue(79_000)).toBe(2);
  });

  it('offers three different words, easy → hard, in every category and difficulty', () => {
    const rand = createRng(7);
    for (const cat of ['mixed', ...DOODLE_CATEGORIES.map(c => c.category)]) {
      const pool = wordPool(cat);
      for (const diff of ['mixed', 'easy', 'medium', 'hard'] as const) {
        const ch = pickChoices(pool, [], diff, rand);
        expect(ch).toHaveLength(3);
        expect(new Set(ch.map(c => c.word)).size).toBe(3);
        if (cat !== 'mixed') for (const c of ch) expect(c.category).toBe(cat);
      }
    }
    const mixed = pickChoices(wordPool('mixed'), [], 'mixed', rand).map(c => wordLevel(c.word));
    expect(mixed).toEqual(['easy', 'medium', 'hard']);
    expect(pickChoices(wordPool('mixed'), [], 'hard', rand).every(c => wordLevel(c.word) === 'hard')).toBe(true);
    // Used words are avoided while there are others.
    const animals = wordPool('Animals');
    const used = animals.slice(0, animals.length - 3).map(p => p.word);
    expect(pickChoices(animals, used, 'mixed', rand).every(c => !used.includes(c.word))).toBe(true);
  });

  it('reads host options with safe defaults', () => {
    expect(parseConfig({})).toEqual({ category: 'mixed', difficulty: 'mixed', laps: 1, board: false });
    expect(parseConfig({ category: 'Animals', difficulty: 'hard', laps: '3', board: '1' })).toEqual({ category: 'Animals', difficulty: 'hard', laps: 3, board: true });
    expect(parseConfig({ category: 'Music & K-pop', laps: '9' })).toMatchObject({ category: 'mixed', laps: 3 });
  });

  it('lets everyone draw once per lap, never twice in a row, with no cap', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const o = drawOrder(ids, 1, createRng(1));
    expect(o).toHaveLength(10);
    expect(new Set(o).size).toBe(10);
    for (let seed = 0; seed < 50; seed++) {
      const o3 = drawOrder(['a', 'b', 'c'], 3, createRng(seed));
      expect(o3).toHaveLength(9);
      for (let i = 0; i < 3; i++) expect(o3.slice(i * 3, i * 3 + 3).sort()).toEqual(['a', 'b', 'c']);
      for (let i = 1; i < o3.length; i++) expect(o3[i]).not.toBe(o3[i - 1]);
    }
  });

  it('ranks by score with ties sharing a place, and ends when all guessed', () => {
    expect(doodleRanking({ a: 200, b: 200, c: 25 }, ['a', 'b', 'c'])).toEqual([['a', 'b'], 'c']);
    expect(allGuessed(['a', 'b'], { a: true })).toBe(false);
    expect(allGuessed(['a', 'b'], { a: true, b: true })).toBe(true);
    expect(allGuessed(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(allGuessed([], {})).toBe(false);
  });
});
