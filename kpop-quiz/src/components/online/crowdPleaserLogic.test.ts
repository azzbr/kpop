import { describe, it, expect } from 'vitest';
import { pickQuestions, majority, roundPoints, scoreRound, funStats, tally } from './crowdPleaserLogic';
import { createRng } from '../../games/engine/rng';
import { WOULD_YOU_RATHER } from '../../data/wouldYouRather';

describe('Crowd Pleaser', () => {
  it('picks 8 different questions', () => {
    for (let seed = 1; seed < 50; seed++) {
      const qs = pickQuestions(8, WOULD_YOU_RATHER.length, createRng(seed));
      expect(qs).toHaveLength(8);
      expect(new Set(qs).size).toBe(8);
      for (const q of qs) expect(WOULD_YOU_RATHER[q]).toBeDefined();
    }
    expect(pickQuestions(8, 3, createRng(1))).toHaveLength(3);
  });

  it('finds the majority, with ties', () => {
    expect(majority({ a: 3, b: 1 })).toBe('a');
    expect(majority({ a: 1, b: 2 })).toBe('b');
    expect(majority({ a: 2, b: 2 })).toBe('tie');
    expect(majority({ a: 0, b: 0 })).toBe('tie');
  });

  it('gives +1 for answering and +2 for guessing the majority', () => {
    expect(roundPoints(undefined, 'a')).toBe(0);
    expect(roundPoints({ choice: 'b', guess: 'a' }, 'a')).toBe(3);
    expect(roundPoints({ choice: 'a', guess: 'b' }, 'a')).toBe(1);
    expect(roundPoints({ choice: 'a', guess: 'b' }, 'tie')).toBe(3);
  });

  it('scores a whole round', () => {
    const r = scoreRound({ x: { choice: 'a', guess: 'a' }, y: { choice: 'a', guess: 'b' }, z: { choice: 'b', guess: 'a' } }, ['x', 'y', 'z', 'w']);
    expect(r).toEqual({ points: { x: 3, y: 1, z: 3, w: 0 }, maj: 'a', a: 2, b: 1 });
    expect(tally({})).toEqual({ a: 0, b: 0 });
  });

  it('finds the most agreed and most split questions', () => {
    const s = funStats([{ qi: 1, a: 2, b: 2 }, { qi: 2, a: 4, b: 0 }, { qi: 3, a: 3, b: 1 }, { qi: 4, a: 0, b: 0 }]);
    expect(s?.agreed.qi).toBe(2);
    expect(s?.split.qi).toBe(1);
    expect(funStats([{ qi: 1, a: 0, b: 0 }])).toBeNull();
    const same = funStats([{ qi: 5, a: 2, b: 1 }, { qi: 6, a: 1, b: 2 }]);
    expect(same?.agreed.qi).toBe(5);
    expect(same?.split.qi).toBe(6);
  });
});
