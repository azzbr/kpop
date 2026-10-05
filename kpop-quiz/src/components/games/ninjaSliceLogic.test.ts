import { describe, it, expect } from 'vitest';
import { FRUITS, pickFruit, comboMult, bladeHits } from './ninjaSliceLogic';

describe('ninja slice', () => {
  it('fruit odds add up to 1 and every roll gives a fruit', () => {
    expect(FRUITS.reduce((s, f) => s + f.prob, 0)).toBeCloseTo(1, 10);
    for (let r = 0; r < 1; r += 0.01) expect(FRUITS).toContain(pickFruit(r));
    expect(pickFruit(0.9999999)).toBe(FRUITS[FRUITS.length - 1]);
  });

  it('combo multiplier grows every 4 fruits', () => {
    expect([0, 3, 4, 7, 8].map(comboMult)).toEqual([1, 1, 2, 2, 3]);
  });

  it('a fast swipe that jumps over a fruit between frames still slices it', () => {
    expect(bladeHits(0, 100, 400, 100, 200, 100, 30)).toBe(true);
    expect(bladeHits(0, 100, 400, 100, 200, 200, 30)).toBe(false);
    // a tap (no movement) right on the fruit
    expect(bladeHits(200, 100, 200, 100, 205, 100, 30)).toBe(true);
  });
});
