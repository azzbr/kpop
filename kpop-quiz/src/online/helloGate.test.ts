import { describe, it, expect } from 'vitest';
import { everyoneSaidHello, rankByScore, placeOf, msLeft } from './helloGate';

describe('helloGate helpers', () => {
  it('waits for every player except the host', () => {
    expect(everyoneSaidHello(['h', 'a', 'b'], 'h', new Set(['a']))).toBe(false);
    expect(everyoneSaidHello(['h', 'a', 'b'], 'h', new Set(['a', 'b']))).toBe(true);
    expect(everyoneSaidHello(['h'], 'h', new Set())).toBe(true);
  });

  it('ranks by score with ties sharing a rung', () => {
    expect(rankByScore({ a: 10, b: 30, c: 20 })).toEqual(['b', 'c', 'a']);
    expect(rankByScore({ a: 10, b: 10, c: 20 })).toEqual(['c', ['a', 'b']]);
    expect(rankByScore({ a: 5 }, ['a', 'z'])).toEqual(['a', 'z']);
    expect(rankByScore({}, ['a', 'b'])).toEqual([['a', 'b']]);
  });

  it('finds places and time left', () => {
    expect(placeOf(['c', ['a', 'b']], 'b')).toBe(2);
    expect(placeOf(['c'], 'x')).toBe(0);
    expect(msLeft(1500, 1000)).toBe(500);
    expect(msLeft(500, 1000)).toBe(0);
  });
});
