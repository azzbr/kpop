import { describe, it, expect } from 'vitest';
import { starLayout, awardStars, starRanking, roundsLasted, musicMs, MUSIC_MIN_MS, MUSIC_MAX_MS } from './starGrabLogic';
import { createRng } from '../../games/engine/rng';

describe('Star Grab', () => {
  it('lays stars out the same way for the same seed, inside the field, without overlaps', () => {
    for (const n of [1, 2, 5, 9, 19]) {
      const a = starLayout(42, n);
      expect(a).toEqual(starLayout(42, n));
      expect(a).toHaveLength(n);
      for (const p of a) {
        expect(p.x).toBeGreaterThanOrEqual(10);
        expect(p.x).toBeLessThanOrEqual(90);
        expect(p.y).toBeGreaterThanOrEqual(10);
        expect(p.y).toBeLessThanOrEqual(90);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y);
        expect(d).toBeGreaterThan(80 / Math.ceil(Math.sqrt(n * 1.6)) * 0.15);
      }
    }
    expect(starLayout(1, 4)).not.toEqual(starLayout(2, 4));
    expect(starLayout(1, 0)).toEqual([]);
  });

  it('gives each star to the fastest tap, whatever order the taps arrived in', () => {
    const taps = [
      { id: 'b', star: 0, reactMs: 500 },
      { id: 'a', star: 0, reactMs: 300 },
      { id: 'c', star: 1, reactMs: 900 },
    ];
    const r1 = awardStars(taps, 2, ['a', 'b', 'c']);
    const r2 = awardStars([...taps].reverse(), 2, ['a', 'b', 'c']);
    expect(r1).toEqual(r2);
    expect(r1.owner).toEqual({ 0: 'a', 1: 'c' });
    expect(r1.out).toEqual(['b']);
  });

  it('uses a second tap when the first star was taken, one star per player', () => {
    const r = awardStars([
      { id: 'a', star: 0, reactMs: 200 },
      { id: 'a', star: 1, reactMs: 250 }, // a already has a star
      { id: 'b', star: 0, reactMs: 400 }, // taken by a
      { id: 'b', star: 1, reactMs: 700 }, // free → b
      { id: 'c', star: 1, reactMs: 800 },
    ], 2, ['a', 'b', 'c']);
    expect(r.owner).toEqual({ 0: 'a', 1: 'b' });
    expect(r.out).toEqual(['c']);
  });

  it('ignores taps from players who are out and stars that do not exist', () => {
    const r = awardStars([
      { id: 'x', star: 0, reactMs: 1 },
      { id: 'a', star: 5, reactMs: 2 },
      { id: 'b', star: 0, reactMs: 3 },
    ], 1, ['a', 'b']);
    expect(r.owner).toEqual({ 0: 'b' });
    expect(r.out).toEqual(['a']);
  });

  it('breaks an exact tie by id', () => {
    const r = awardStars([{ id: 'b', star: 0, reactMs: 300 }, { id: 'a', star: 0, reactMs: 300 }], 1, ['a', 'b']);
    expect(r.owner[0]).toBe('a');
  });

  it('ranks the winner first, later outs higher, same-round outs sharing a place', () => {
    const ranked = starRanking({ a: 1, b: 1, c: 2 }, ['a', 'b', 'c', 'd']);
    expect(ranked).toEqual(['d', 'c', ['a', 'b']]);
    expect(roundsLasted({ a: 1, b: 1, c: 2 }, ['a', 'b', 'c', 'd'], 2)).toEqual({ a: 0, b: 0, c: 1, d: 2 });
  });

  it('picks a music length between 4 and 12 seconds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const m = musicMs(rng);
      expect(m).toBeGreaterThanOrEqual(MUSIC_MIN_MS);
      expect(m).toBeLessThanOrEqual(MUSIC_MAX_MS);
    }
  });
});
