import { describe, expect, it } from 'vitest';
import { addPoint, duelScore, judgeRound, waitMs } from './reactionDuelLogic';

describe('reactionDuelLogic', () => {
  it('no taps = no point', () => {
    expect(judgeRound([], 100)).toEqual({ kind: 'none' });
    expect(addPoint([1, 2], { kind: 'none' })).toEqual([1, 2]);
  });

  it('a tap before the signal gives the other player the point', () => {
    const o = judgeRound([{ player: 0, at: 50 }], null);
    expect(o).toEqual({ kind: 'early', player: 0, point: 1 });
    expect(addPoint([0, 0], o)).toEqual([0, 1]);
    expect(judgeRound([{ player: 1, at: 90 }], 100)).toEqual({ kind: 'early', player: 1, point: 0 });
  });

  it('first tap after the signal wins and both reaction times are kept', () => {
    const o = judgeRound([{ player: 1, at: 1250 }, { player: 0, at: 1251 }, { player: 1, at: 1300 }], 1000);
    expect(o).toEqual({ kind: 'win', player: 1, times: [251, 250] });
    expect(addPoint([3, 3], o)).toEqual([3, 4]);
  });

  it('score and wait', () => {
    expect(duelScore([7, 3])).toBe(7);
    expect(waitMs(0)).toBe(1500);
    expect(waitMs(1)).toBe(4500);
  });
});
