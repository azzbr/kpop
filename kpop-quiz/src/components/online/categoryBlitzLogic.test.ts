import { describe, it, expect } from 'vitest';
import { isValidBlitz, buildReview, struck, strikeNeeded, finalRoundScores, pickRound, voteId, answerKey } from './categoryBlitzLogic';
import { createRng } from '../../games/engine/rng';

describe('Category Blitz', () => {
  it('checks the letter, ignoring the/a/an', () => {
    expect(isValidBlitz('Bear', 'B')).toBe(true);
    expect(isValidBlitz('the bear', 'B')).toBe(true);
    expect(isValidBlitz('a banana', 'B')).toBe(true);
    expect(isValidBlitz('apple', 'B')).toBe(false);
    expect(isValidBlitz('b', 'B')).toBe(false);
    expect(isValidBlitz('', 'B')).toBe(false);
    expect(isValidBlitz('butt', 'B')).toBe(false);
    expect(answerKey('The Big Ben')).toBe('bigben');
  });

  it('scores duplicates 1, uniques 2, wrong letter and empty 0', () => {
    const r = buildReview({ a: ['bear', 'banana', '', 'apple', 'blue'], b: ['BEAR', 'blueberry', 'bus', '', 'the blue'] }, 'B');
    expect(r[0]).toEqual([{ key: 'bear', text: 'bear', authors: ['a', 'b'], valid: true, pts: 1 }]);
    expect(r[1].map(x => x.pts)).toEqual([2, 2]);
    expect(r[2].map(x => [x.text, x.pts])).toEqual([['bus', 2]]);
    expect(r[3]).toEqual([{ key: 'apple', text: 'apple', authors: ['a'], valid: false, pts: 0 }]);
    expect(r[4][0].authors).toEqual(['a', 'b']);
  });

  it('hides unkind answers', () => {
    expect(buildReview({ a: ['stupid'] }, 'S', 1)[0]).toEqual([]);
  });

  it('needs half the other players to strike', () => {
    expect(strikeNeeded(['a'], ['a', 'b'])).toBe(1);
    expect(strikeNeeded(['a'], ['a', 'b', 'c'])).toBe(1);
    expect(strikeNeeded(['a'], ['a', 'b', 'c', 'd', 'e'])).toBe(2);
    expect(strikeNeeded(['a', 'b'], ['a', 'b'])).toBe(Infinity);
    expect(struck(['b'], ['a'], ['a', 'b'])).toBe(true);
    expect(struck(['b'], ['a'], ['a', 'b', 'c', 'd', 'e'])).toBe(false);
    expect(struck(['b', 'c'], ['a'], ['a', 'b', 'c', 'd', 'e'])).toBe(true);
  });

  it('ignores authors voting on their own answer', () => {
    expect(struck(['a'], ['a'], ['a', 'b', 'c'])).toBe(false);
    expect(struck(['a', 'b'], ['a', 'b'], ['a', 'b'])).toBe(false);
  });

  it('a strike applies to every author', () => {
    const r = buildReview({ a: ['bat'], b: ['bat'], c: ['bee'] }, 'B', 1);
    const res = finalRoundScores(r, { [voteId(0, 'bat')]: ['c'] }, ['a', 'b', 'c']);
    expect(res.points).toEqual({ a: 0, b: 0, c: 2 });
    expect(res.struck).toEqual(['0:bat']);
    expect(res.cells.a).toEqual([0]);
  });

  it('picks fresh letters and categories, at most one food', () => {
    const rng = createRng(5);
    const r1 = pickRound(rng, [], []);
    const r2 = pickRound(rng, [r1.letter], r1.cats.map(c => c.id));
    expect(r1.cats).toHaveLength(5);
    expect(r2.letter).not.toBe(r1.letter);
    expect(r2.cats.some(c => r1.cats.includes(c))).toBe(false);
    for (let i = 0; i < 50; i++) expect(pickRound(rng, [], []).cats.filter(c => c.food).length).toBeLessThanOrEqual(1);
  });
});
