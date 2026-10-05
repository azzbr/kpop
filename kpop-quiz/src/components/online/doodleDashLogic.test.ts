import { describe, it, expect } from 'vitest';
import { isRightGuess, guessPoints, wordShape, drawOrder, addBatch, doodleRanking, allGuessed, ROUND_MS, MAX_DRAWERS } from './doodleDashLogic';
import { createRng } from '../../games/engine/rng';
import { DOODLE_WORDS } from '../../online/doodleWords';

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

  it('gives 100–200 points, more for speed', () => {
    expect(guessPoints(ROUND_MS)).toBe(200);
    expect(guessPoints(0)).toBe(100);
    expect(guessPoints(-50)).toBe(100);
    expect(guessPoints(ROUND_MS / 2)).toBe(150);
  });

  it('shows the word shape, not the word', () => {
    expect(wordShape('ice cream')).toEqual([3, 5]);
    expect(wordShape('cat')).toEqual([3]);
  });

  it('picks each drawer once, at most MAX_DRAWERS', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const o = drawOrder(ids, createRng(1));
    expect(o).toHaveLength(MAX_DRAWERS);
    expect(new Set(o).size).toBe(MAX_DRAWERS);
    expect(drawOrder(['a', 'b'], createRng(2)).sort()).toEqual(['a', 'b']);
  });

  it('keeps the picture for late devices and trims the oldest when huge', () => {
    let log = addBatch([], { pts: [[0, 0, 1]], c: '#000', w: 5 });
    log = addBatch(log, { pts: [[0.5, 0.5, 0], [0.6, 0.6, 0]], c: '#000', w: 5 }, 2);
    expect(log).toHaveLength(1);
    expect(log[0].pts).toHaveLength(2);
  });

  it('ranks by score with ties sharing a place, and ends when all guessed', () => {
    expect(doodleRanking({ a: 200, b: 200, c: 25 }, ['a', 'b', 'c'])).toEqual([['a', 'b'], 'c']);
    expect(allGuessed(['a', 'b'], { a: true })).toBe(false);
    expect(allGuessed(['a', 'b'], { a: true, b: true })).toBe(true);
    expect(allGuessed([], {})).toBe(false);
  });
});
