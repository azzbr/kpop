import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { cbCheck, cbGenerate, cbGuess, cbInit, cbProgress, cbSolved, evalGuess, validCode } from './codeBreakerLogic';

const LEVELS = ['easy', 'normal', 'hard', 'expert', 'master', 'legend'];

describe('Code Breaker', () => {
  it('generates valid codes for every difficulty', () => {
    for (const d of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const p = cbGenerate(d, createRng(seed));
        expect(validCode(p, p.code)).toBe(true);
      }
    }
  });

  it('scores pegs like Mastermind', () => {
    expect(evalGuess([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, color: 0 });
    expect(evalGuess([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, color: 4 });
    expect(evalGuess([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ exact: 1, color: 2 });
    expect(evalGuess([0, 1, 2], [4, 4, 4])).toEqual({ exact: 0, color: 0 });
  });

  it('host check accepts only a list ending in the code', () => {
    const p = cbGenerate('normal', createRng(7));
    let s = cbInit();
    const wrong = p.code.map(c => (c + 1) % p.palette);
    s = cbGuess(p, s, wrong);
    expect(cbSolved(p, s)).toBe(false);
    expect(cbProgress(p, s)).toBeLessThan(1);
    s = cbGuess(p, s, p.code);
    expect(cbSolved(p, s)).toBe(true);
    expect(cbProgress(p, s)).toBe(1);
    expect(cbCheck(p, s.history.map(r => r.guess))).toBe(true);
    expect(cbCheck(p, [wrong])).toBe(false);
    expect(cbCheck(p, [])).toBe(false);
    expect(cbCheck(p, 'nope')).toBe(false);
  });
});
