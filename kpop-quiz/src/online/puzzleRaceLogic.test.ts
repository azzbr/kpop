import { describe, expect, it } from 'vitest';
import {
  PROGRESS_POINTS, PLACE_MIN, addTotals, placeOf, placePoints, roundOver, scoreRound, standings, speedPoints,
} from './puzzleRaceLogic';

const ROUND = 60_000;

describe('scoreRound', () => {
  it('gives the first solver the most points, then by time', () => {
    const s = scoreRound({
      a: { p: 1, solvedMs: 20_000 },
      b: { p: 1, solvedMs: 10_000 },
      c: { p: 1, solvedMs: 30_000 },
    }, ['a', 'b', 'c'], ROUND);
    expect(s.map(x => x.id)).toEqual(['b', 'a', 'c']);
    expect(s.map(x => x.place)).toEqual([1, 2, 3]);
    expect(s[0].points).toBeGreaterThan(s[1].points);
    expect(s[1].points).toBeGreaterThan(s[2].points);
  });

  it('treats solves within the same tenth of a second as a tie (same place, same points)', () => {
    const s = scoreRound({
      a: { p: 1, solvedMs: 12_340 },
      b: { p: 1, solvedMs: 12_310 },
      c: { p: 1, solvedMs: 15_000 },
    }, ['a', 'b', 'c'], ROUND);
    const a = s.find(x => x.id === 'a')!;
    const b = s.find(x => x.id === 'b')!;
    const c = s.find(x => x.id === 'c')!;
    expect(a.place).toBe(1);
    expect(b.place).toBe(1);
    expect(a.points).toBe(b.points);
    // after a two-way tie for 1st, the next solver is 3rd
    expect(c.place).toBe(3);
  });

  it('always gives any solver more than any non-solver', () => {
    const live = {
      slow: { p: 1, solvedMs: ROUND },
      almost: { p: 0.99 },
      out: { p: 0.5, failed: true },
    };
    const s = scoreRound(live, ['slow', 'almost', 'out', 'ghost'], ROUND);
    const pts = Object.fromEntries(s.map(x => [x.id, x.points]));
    expect(pts.slow).toBeGreaterThanOrEqual(PLACE_MIN);
    expect(pts.almost).toBeLessThanOrEqual(PROGRESS_POINTS);
    expect(pts.slow).toBeGreaterThan(pts.almost);
    expect(pts.almost).toBeGreaterThan(pts.out);
    expect(pts.ghost).toBe(0);
    expect(s.find(x => x.id === 'out')!.failed).toBe(true);
    expect(s.map(x => x.id)).toEqual(['slow', 'almost', 'out', 'ghost']);
  });

  it('never gives negative or NaN points', () => {
    const s = scoreRound({ a: { p: NaN }, b: { p: 5, solvedMs: 999_999 } }, ['a', 'b'], ROUND);
    for (const x of s) expect(x.points).toBeGreaterThanOrEqual(0);
    expect(speedPoints(999_999, ROUND)).toBe(0);
    expect(placePoints(30)).toBe(PLACE_MIN);
  });
});

describe('standings', () => {
  it('ranks by total, best first, with equal totals sharing a rung', () => {
    const totals = addTotals({ a: 100, b: 50 }, [
      { id: 'a', place: null, ms: null, points: 0, p: 0, failed: false },
      { id: 'b', place: 1, ms: 1, points: 50, p: 1, failed: false },
      { id: 'c', place: 2, ms: 2, points: 20, p: 1, failed: false },
    ]);
    expect(totals).toEqual({ a: 100, b: 100, c: 20 });
    const r = standings(totals, ['d']);
    expect(r).toEqual([['a', 'b'], ['c'], ['d']]);
    expect(placeOf(r, 'b')).toBe(1);
    expect(placeOf(r, 'c')).toBe(3);
    expect(placeOf(r, 'd')).toBe(4);
    expect(placeOf(r, 'zz')).toBeNull();
  });
});

describe('roundOver', () => {
  it('waits for every player still playing', () => {
    expect(roundOver({}, [])).toBe(false);
    expect(roundOver({ a: { p: 1, solvedMs: 5 } }, ['a', 'b'])).toBe(false);
    expect(roundOver({ a: { p: 1, solvedMs: 5 }, b: { p: 0.2, failed: true } }, ['a', 'b'])).toBe(true);
  });
});
