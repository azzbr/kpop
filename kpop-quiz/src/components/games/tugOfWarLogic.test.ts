import { describe, expect, it } from 'vitest';
import { matchScore, minPullsToWin, pullRope, roundWinner } from './tugOfWarLogic';

describe('tugOfWarLogic', () => {
  it('pulls move the ribbon toward the puller and stay on the track', () => {
    expect(pullRope(50, 0)).toBeLessThan(50);
    expect(pullRope(50, 1)).toBeGreaterThan(50);
    expect(pullRope(1, 0)).toBe(0);
    expect(pullRope(99, 1)).toBe(100);
  });

  it('a round is won by reaching your goal', () => {
    expect(roundWinner(50)).toBeNull();
    let pos = 50;
    for (let i = 0; i < minPullsToWin(); i++) pos = pullRope(pos, 0);
    expect(roundWinner(pos)).toBe(0);
    pos = 50;
    for (let i = 0; i < minPullsToWin() - 1; i++) pos = pullRope(pos, 1);
    expect(roundWinner(pos)).toBeNull();
    expect(roundWinner(pullRope(pos, 1))).toBe(1);
  });

  it('match score counts everyone\'s pulls', () => {
    expect(matchScore([60, 45])).toBe(105);
  });
});
