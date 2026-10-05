import { describe, it, expect } from 'vitest';
import { shooterFor, keeperFor, isGoal, validDir, shootoutResult, penaltyRanking, MAX_KICKS } from './penaltyDuelLogic';

const ids = ['a', 'b'];
describe('Penalty Duel logic', () => {
  it('takes turns shooting', () => {
    expect([1, 2, 3].map(n => shooterFor(n, ids))).toEqual(['a', 'b', 'a']);
    expect(keeperFor(1, ids)).toBe('b');
    expect(isGoal(0, 1)).toBe(true);
    expect(isGoal(2, 2)).toBe(false);
    expect(validDir(2)).toBe(true);
    expect(validDir(3)).toBe(false);
    expect(validDir('1')).toBe(false);
  });

  it('ends early when one side cannot catch up', () => {
    // a scored 3 of 3, b missed 3 of 3 (after 6 kicks): b has 2 left, can reach 2 < 3
    expect(shootoutResult(6, { a: 3, b: 0 }, ids)).toBe('a');
    // a 3, b 1 after 6: b can still reach 3
    expect(shootoutResult(6, { a: 3, b: 1 }, ids)).toBe(null);
    // after 5 kicks (a 3 taken, b 2): a 0, b 2; a can reach 2 → still going; b 3 → done
    expect(shootoutResult(5, { a: 0, b: 2 }, ids)).toBe(null);
    expect(shootoutResult(5, { a: 0, b: 3 }, ids)).toBe('b');
    expect(shootoutResult(10, { a: 4, b: 3 }, ids)).toBe('a');
    expect(shootoutResult(9, { a: 4, b: 3 }, ids)).toBe(null); // b still has a kick
  });

  it('plays sudden death in pairs, then calls a draw at the limit', () => {
    expect(shootoutResult(10, { a: 3, b: 3 }, ids)).toBe(null);
    expect(shootoutResult(11, { a: 4, b: 3 }, ids)).toBe(null);
    expect(shootoutResult(12, { a: 4, b: 3 }, ids)).toBe('a');
    expect(shootoutResult(MAX_KICKS, { a: 5, b: 5 }, ids)).toBe('draw');
    expect(penaltyRanking('b', ids)).toEqual(['b', 'a']);
    expect(penaltyRanking('draw', ids)).toEqual([['a', 'b']]);
  });
});
