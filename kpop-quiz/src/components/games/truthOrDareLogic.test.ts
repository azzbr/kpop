import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { lapOrder, buildPools, drawCard, starsFor, applyTurn, places, awards, wheelRotation, wedgeAt, newPlayer, SKIPS_PER_PLAYER } from './truthOrDareLogic';
import { TOD_CARDS, TOD_PACKS, type TodCard } from '../../data/truthOrDare';

const card = (kind: TodCard['kind'], id: string = kind): TodCard => ({ id, pack: 'silly', kind, level: 1, text: 't', emoji: '⭐' });

describe('fair turns', () => {
  it('every player goes exactly once per lap and never twice in a row across laps', () => {
    const rng = createRng(7);
    for (const n of [2, 3, 5, 8]) {
      let last: number | null = null;
      for (let lap = 0; lap < 200; lap++) {
        const order = lapOrder(n, last, rng);
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        if (last !== null) expect(order[0]).not.toBe(last);
        last = order[n - 1];
      }
    }
  });
});

describe('decks', () => {
  it('level is a ceiling and packs are pooled', () => {
    const easy = buildPools(TOD_CARDS, ['silly'], 1);
    const brave = buildPools(TOD_CARDS, ['silly'], 2);
    const both = buildPools(TOD_CARDS, ['silly', 'animals'], 1);
    expect([...easy.truths, ...easy.dares].every(c => c.level === 1 && c.pack === 'silly')).toBe(true);
    expect(brave.truths.length + brave.dares.length).toBeGreaterThan(easy.truths.length + easy.dares.length);
    expect(both.truths.length).toBeGreaterThan(easy.truths.length);
    expect(easy.dares.every(c => c.kind !== 'truth')).toBe(true);
  });

  it('the smallest pool (one pack at Easy) covers a 4-player, 3-lap game without repeats', () => {
    for (const p of TOD_PACKS) {
      const { truths, dares } = buildPools(TOD_CARDS, [p.id], 1);
      expect(truths.length, `${p.id} truths`).toBeGreaterThanOrEqual(15);
      expect(dares.length, `${p.id} dares`).toBeGreaterThanOrEqual(15);
    }
  });

  it('never repeats until the pool is used up, then reshuffles', () => {
    const pool = [card('dare', 'a'), card('dare', 'b'), card('dare', 'c')];
    const seen = new Set<string>();
    const rng = createRng(3);
    const firstThree = [0, 1, 2].map(() => drawCard(pool, seen, rng));
    expect(new Set(firstThree.map(d => d.card!.id)).size).toBe(3);
    expect(firstThree.every(d => !d.reshuffled)).toBe(true);
    const fourth = drawCard(pool, seen, rng);
    expect(fourth.reshuffled).toBe(true);
    expect(seen.size).toBe(1);
    expect(drawCard([], seen, rng).card).toBeNull();
  });
});

describe('stars', () => {
  it('truth 1, dare 2, everyone/double 1, surprise +1, chicken 0', () => {
    expect(starsFor(card('truth'), 'done', false)).toBe(1);
    expect(starsFor(card('dare'), 'done', false)).toBe(2);
    expect(starsFor(card('everyone'), 'done', false)).toBe(1);
    expect(starsFor(card('double'), 'done', true)).toBe(2);
    expect(starsFor(card('dare'), 'chicken', true)).toBe(0);
  });

  it('everyone cards reward every player; double cards reward the partner; chicken uses a skip', () => {
    const ps = [newPlayer('A', '🐱', '#f00'), newPlayer('B', '🐶', '#0f0'), newPlayer('C', '🦊', '#00f')];
    const all = applyTurn(ps, 0, card('everyone'), 'done', false, null, 0);
    expect(all.map(p => p.stars)).toEqual([1, 1, 1]);
    const dbl = applyTurn(ps, 0, card('double'), 'done', false, 2, 0);
    expect(dbl.map(p => p.stars)).toEqual([1, 0, 1]);
    const ch = applyTurn(ps, 1, card('dare'), 'chicken', false, null, 0);
    expect(ch[1].skipsLeft).toBe(SKIPS_PER_PLAYER - 1);
    expect(ch[1].stars).toBe(0);
    const funny = applyTurn(ps, 2, card('truth'), 'done', false, null, 2);
    expect(funny[2]).toMatchObject({ stars: 1, truths: 1, funny: 2 });
  });

  it('ties share a place and an award', () => {
    const ps = [10, 7, 7, 3].map((s, i) => ({ ...newPlayer(`P${i}`, '⭐', '#fff'), stars: s, dares: i === 1 || i === 2 ? 3 : 0 }));
    expect(places(ps)).toEqual([1, 2, 2, 4]);
    const brave = awards(ps).find(a => a.title === 'Bravest')!;
    expect(brave.winners).toEqual([1, 2]);
    expect(awards(ps.map(p => ({ ...p, dares: 0 }))).some(a => a.title === 'Bravest')).toBe(false);
  });
});

describe('the wheel', () => {
  it('always lands on the chosen player and keeps spinning forwards', () => {
    const rng = createRng(11);
    let rot = 0;
    for (const n of [2, 3, 4, 6, 8]) {
      for (let k = 0; k < 100; k++) {
        const target = Math.floor(rng() * n);
        const next = wheelRotation(rot, n, target, rng);
        expect(next).toBeGreaterThan(rot + 720);
        expect(wedgeAt(next, n)).toBe(target);
        rot = next;
      }
    }
  });
});
