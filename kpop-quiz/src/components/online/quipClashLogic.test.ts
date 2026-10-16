import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  makeGroups, makeMatchups, tasksOf, answersEach, scoreMatchup, shownQuip, checkQuip, tidyQuip, pairKey,
  roundMult, pickQuipPrompts, TIMEOUT_TEXT, HIDDEN_TEXT, VOTE_POINTS, QUIPLASH_BONUS, MAX_QUIP,
} from './quipClashLogic';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('Quip Clash matchups', () => {
  it('gives everyone the same number of answers for 3–12 players', () => {
    for (let n = 3; n <= 12; n++) {
      const rng = createRng(n);
      const m = makeMatchups(ids(n), pickQuipPrompts(12, rng), rng);
      const each = answersEach(m);
      expect(each, `n=${n}`).toBe(n === 3 ? 2 : 1);
      expect(Object.keys(tasksOf(m)).sort()).toEqual(ids(n).sort());
      for (const x of m) expect(x.authors.length === 2 || x.authors.length === 3).toBe(true);
      expect(new Set(m.map(x => x.prompt)).size).toBe(m.length);
    }
  });
  it('uses one trio for odd rooms of 5+', () => {
    const g = makeGroups(ids(7), createRng(3));
    expect(g.filter(x => x.length === 3).length).toBe(1);
    expect(g.length).toBe(3);
  });
  it('with 3 players, each pair meets once (A+B, B+C, C+A)', () => {
    const g = makeGroups(ids(3), createRng(1));
    expect(new Set(g.map(([a, b]) => pairKey(a, b))).size).toBe(3);
  });
  it('avoids repeat partners when it can', () => {
    const rng = createRng(9);
    const first = makeGroups(ids(6), rng);
    const met = new Set(first.map(([a, b]) => pairKey(a, b)));
    const second = makeGroups(ids(6), rng, met);
    for (const [a, b] of second) expect(met.has(pairKey(a, b))).toBe(false);
  });
});

describe('Quip Clash scoring', () => {
  it('gives points per vote and ignores authors voting', () => {
    const r = scoreMatchup(['a', 'b'], { c: 'a', d: 'b', e: 'a', a: 'a' }, 1);
    expect(r.counts).toEqual({ a: 2, b: 1 });
    expect(r.points).toEqual({ a: 2 * VOTE_POINTS, b: VOTE_POINTS });
    expect(r.quiplash).toBeNull();
  });
  it('awards a QUIPLASH when one answer gets every vote', () => {
    const r = scoreMatchup(['a', 'b'], { c: 'a', d: 'a' }, 2);
    expect(r.quiplash).toBe('a');
    expect(r.points.a).toBe(2 * (2 * VOTE_POINTS + QUIPLASH_BONUS));
    expect(r.points.b).toBe(0);
  });
  it('no QUIPLASH with a single vote or against a time-out', () => {
    expect(scoreMatchup(['a', 'b'], { c: 'a' }, 1).quiplash).toBeNull();
    expect(scoreMatchup(['a', 'b'], { c: 'a', d: 'a' }, 1, ['b']).quiplash).toBeNull();
  });
  it('works for trios', () => {
    const r = scoreMatchup(['a', 'b', 'c'], { d: 'c', e: 'c' }, 1);
    expect(r.quiplash).toBe('c');
    expect(r.counts).toEqual({ a: 0, b: 0, c: 2 });
  });
  it('makes the last round double', () => {
    expect(roundMult(1)).toBe(1);
    expect(roundMult(3)).toBe(2);
  });
});

describe('Quip Clash answers', () => {
  it('tidies, checks and stands in for answers', () => {
    expect(tidyQuip('  a   big  dragon ')).toBe('a big dragon');
    expect(tidyQuip('x'.repeat(80)).length).toBe(MAX_QUIP);
    expect(checkQuip('   ')).toBe('empty');
    expect(checkQuip('you are stupid')).toBe('unkind');
    expect(checkQuip('Sir Sparkles')).toBe('ok');
    expect(shownQuip(undefined)).toBe(TIMEOUT_TEXT);
    expect(shownQuip('poop soup')).toBe(HIDDEN_TEXT);
    expect(shownQuip('Sir  Sparkles')).toBe('Sir Sparkles');
  });
});
