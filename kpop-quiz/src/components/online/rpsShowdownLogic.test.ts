import { describe, it, expect } from 'vitest';
import { beats, roundPoints, counts } from './rpsShowdownLogic';

describe('RPS Showdown', () => {
  it('knows who beats whom', () => {
    expect(beats(0, 2)).toBe(true);
    expect(beats(1, 0)).toBe(true);
    expect(beats(2, 1)).toBe(true);
    expect(beats(0, 1)).toBe(false);
    expect(beats(1, 1)).toBe(false);
  });
  it('scores a point for every player beaten', () => {
    expect(roundPoints({ a: 0, b: 2, c: 2, d: 1 })).toEqual({ a: 2, b: 1, c: 1, d: 1 });
    expect(roundPoints({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
  it('counts the signs', () => {
    expect(counts({ a: 0, b: 2, c: 2 })).toEqual([1, 0, 2]);
  });
});
