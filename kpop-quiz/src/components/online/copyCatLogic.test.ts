import { describe, it, expect } from 'vitest';
import { extendSeq, isCorrect, judgeRound, isOver, finalists, copyCatRanking, answerDeadline, inputTime, NET_GRACE_MS, PAD_COUNT, MAX_ROUNDS } from './copyCatLogic';
import { createRng } from '../../games/engine/rng';

describe('Copy Cat logic', () => {
  it('grows the sequence one pad at a time', () => {
    const rng = createRng(3);
    let s: number[] = [];
    for (let i = 0; i < 6; i++) s = extendSeq(s, rng);
    expect(s).toHaveLength(6);
    expect(s.every(v => v >= 0 && v < PAD_COUNT)).toBe(true);
  });

  it('knocks out wrong, short and missing answers', () => {
    expect(isCorrect([1, 2], [1, 2])).toBe(true);
    expect(isCorrect([1], [1, 2])).toBe(false);
    expect(isCorrect(undefined, [1])).toBe(false);
    expect(judgeRound(['a', 'b', 'c'], { a: [0, 1], b: [0, 2] }, [0, 1])).toEqual({ out: ['b', 'c'], alive: ['a'] });
  });

  it('ends with one left or at the round limit', () => {
    expect(isOver(1, 3)).toBe(true);
    expect(isOver(2, 3)).toBe(false);
    expect(isOver(3, MAX_ROUNDS)).toBe(true);
    expect(finalists([], ['a', 'b'])).toEqual(['a', 'b']);
    expect(finalists(['c'], ['a'])).toEqual(['c']);
  });

  it('ranks by knock-out round; same round = same place', () => {
    const out = { a: 0, b: 2, c: 2, d: 1, e: 0 };
    expect(copyCatRanking(['a', 'e'], out)).toEqual([['a', 'e'], ['b', 'c'], 'd']);
    // everyone knocked out together in the last round: they all win
    expect(copyCatRanking(['b', 'c'], { a: 1, b: 3, c: 3 })).toEqual([['b', 'c'], 'a']);
    expect(copyCatRanking(['a'], { a: 0 })).toEqual(['a']);
  });

  it("gives each device its own full answer window", () => {
    expect(answerDeadline([1000, 4000], 3)).toBe(4000 + inputTime(3) + NET_GRACE_MS);
  });
});
