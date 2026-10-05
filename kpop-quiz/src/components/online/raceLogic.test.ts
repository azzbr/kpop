import { describe, expect, it } from 'vitest';
import { answerLength, checkGuess, everyoneDone, everyoneHere, placesOf, rankScores, speedPoints } from './raceLogic';
import { RIDDLES } from '../../online/riddles';
import { EMOJI_PUZZLES } from '../../online/emojiPuzzles';

describe('checkGuess', () => {
  it('forgives case, punctuation, articles and a small typo for riddles', () => {
    expect(checkGuess('A Piano!', 'piano')).toBe(true);
    expect(checkGuess('the  clock', 'clock', ['watch'])).toBe(true);
    expect(checkGuess('watch', 'clock', ['watch'])).toBe(true);
    expect(checkGuess('telefone', 'telephone', ['phone'])).toBe(true);
    expect(checkGuess('candl', 'candle')).toBe(true);
    expect(checkGuess('egs', 'egg')).toBe(false); // short words must be exact
    expect(checkGuess('table', 'clock')).toBe(false);
    expect(checkGuess('   ', 'clock')).toBe(false);
  });

  it('is strict for Word Scramble (the letters are on screen)', () => {
    expect(checkGuess('TIGER', 'tiger', [], 'words', false)).toBe(true);
    expect(checkGuess('tigre', 'tiger', [], 'words', false)).toBe(false);
    expect(checkGuess('ice cream', 'icecream', [], 'words', false)).toBe(true);
  });

  it('matches digits exactly, keeping leading zeros', () => {
    expect(checkGuess('144', '144', [], 'digits')).toBe(true);
    expect(checkGuess('0472', '0472', [], 'digits')).toBe(true);
    expect(checkGuess('472', '0472', [], 'digits')).toBe(false);
    expect(checkGuess('145', '144', [], 'digits')).toBe(false);
    expect(checkGuess('', '0', [], 'digits')).toBe(false);
  });

  it('accepts every riddle and emoji answer and its alternatives as typed', () => {
    for (const r of RIDDLES) for (const a of [r.answer, ...(r.alt ?? [])]) expect(checkGuess(a.toUpperCase(), r.answer, r.alt)).toBe(true);
    for (const p of EMOJI_PUZZLES) for (const a of [p.answer, ...(p.alt ?? [])]) expect(checkGuess(a.toUpperCase(), p.answer, p.alt)).toBe(true);
  });

  it('every riddle and emoji answer can be typed on the letters keyboard', () => {
    for (const a of [...RIDDLES.flatMap(r => [r.answer, ...(r.alt ?? [])]), ...EMOJI_PUZZLES.flatMap(p => [p.answer, ...(p.alt ?? [])])]) {
      expect(a).toMatch(/^[a-z0-9 '\-.,!&]+$/i);
    }
  });
});

describe('scoring and ranking', () => {
  it('speed points run from 200 down to 100', () => {
    expect(speedPoints(10000, 10000)).toBe(200);
    expect(speedPoints(5000, 10000)).toBe(150);
    expect(speedPoints(-50, 10000)).toBe(100);
    expect(speedPoints(99999, 10000)).toBe(200);
  });

  it('ranks best first with ties sharing a rung and zero-scorers last', () => {
    const r = rankScores({ a: 300, b: 500, c: 300 }, ['a', 'b', 'c', 'd']);
    expect(r).toEqual([['b'], ['a', 'c'], ['d']]);
    expect(placesOf(r)).toEqual({ b: 1, a: 2, c: 2, d: 4 });
  });

  it('includes scorers who left the room', () => {
    expect(rankScores({ gone: 100 }, ['a'])).toEqual([['gone'], ['a']]);
  });

  it('knows when everyone has answered or arrived', () => {
    expect(everyoneDone(['a', 'b'], { a: true })).toBe(false);
    expect(everyoneDone(['a', 'b'], { a: true, b: true })).toBe(true);
    expect(everyoneDone([], {})).toBe(false);
    expect(everyoneHere(['h', 'a'], 'h', new Set())).toBe(false);
    expect(everyoneHere(['h', 'a'], 'h', new Set(['a']))).toBe(true);
  });

  it('counts answer letters', () => {
    expect(answerLength('ice cream')).toBe(8);
  });
});
