import { describe, it, expect } from 'vitest';
import { assignTeams, addToTeams, cupPoints, addCup, cupLeaders, lessonId } from './classLogic';
import { createRng } from '../games/engine/rng';

describe('Class Cup', () => {
  it('splits a class evenly', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    for (const n of [2, 3, 4]) {
      const t = assignTeams(ids, n, createRng(n));
      const sizes = Array.from({ length: n }, (_, k) => Object.values(t).filter(x => x === k).length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(Object.keys(t).sort()).toEqual([...ids].sort());
    }
  });

  it('late arrivals join the smallest team', () => {
    const t = addToTeams({ a: 0, b: 0, c: 1 }, ['a', 'd', 'e'], 2);
    expect(t).toEqual({ a: 0, b: 0, c: 1, d: 1, e: 0 });
  });

  it('team points: 1 for playing + 3/2/1 for the podium, ties share', () => {
    const teams = { a: 0, b: 1, c: 0, d: 1 };
    expect(cupPoints(['a', 'b', 'c', 'd'], teams)).toEqual({ 0: 4 + 2, 1: 3 + 1 });
    expect(cupPoints([['a', 'b'], 'c', 'x'], teams)).toEqual({ 0: 4 + 3, 1: 4 });
    const cup = addCup(addCup({}, { 0: 5 }), { 0: 1, 1: 6 });
    expect(cup).toEqual({ 0: 6, 1: 6 });
    expect(cupLeaders(cup)).toEqual([0, 1]);
    expect(cupLeaders({})).toEqual([]);
  });

  it('a lesson is one room on one day', () => {
    expect(lessonId('ABCD', '2026-10-16')).toBe('ABCD-2026-10-16');
  });
});
