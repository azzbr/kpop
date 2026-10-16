import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { deckCards, makeTeams, turnCount, guesserOrder, rankHeadsUp, teamTotals, teamOf } from './headsUpPartyLogic';
import { HEADS_UP_CATEGORIES } from '../../data/headsUpCards';

describe('Heads Up Party', () => {
  it('builds decks without duplicates', () => {
    expect(deckCards('animals')).toEqual(HEADS_UP_CATEGORIES.find(c => c.id === 'animals')!.cards);
    const mix = deckCards('mix');
    expect(new Set(mix.map(c => c.toLowerCase())).size).toBe(mix.length);
    expect(mix.length).toBeGreaterThan(250);
  });
  it('splits teams evenly', () => {
    const [a, b] = makeTeams(['1', '2', '3', '4', '5'], createRng(1));
    expect(a.length).toBe(3);
    expect(b.length).toBe(2);
    expect(teamOf([a, b], a[0])).toBe(0);
    expect(teamOf([a, b], b[0])).toBe(1);
  });
  it('counts turns (teams get the same number)', () => {
    expect(turnCount('5', 10, false)).toBe(5);
    expect(turnCount('5', 4, false)).toBe(4);
    expect(turnCount('5', 10, true)).toBe(6);
    expect(turnCount('all', 7, false)).toBe(7);
    expect(turnCount('all', 7, true)).toBe(8);
  });
  it('orders guessers: solo everyone once, teams alternate', () => {
    const solo = guesserOrder(['a', 'b', 'c'], 3, null, createRng(2));
    expect(new Set(solo).size).toBe(3);
    const teams: [string[], string[]] = [['a', 'c', 'e'], ['b', 'd']];
    expect(guesserOrder(['a', 'b', 'c', 'd', 'e'], 6, teams)).toEqual(['a', 'b', 'c', 'd', 'e', 'b']);
  });
  it('ranks solo by points and teams by team points', () => {
    expect(rankHeadsUp({ a: 3, b: 5, c: 3 }, ['a', 'b', 'c'], null).ranked).toEqual([['b'], ['a', 'c']]);
    const teams: [string[], string[]] = [['a', 'c'], ['b', 'd']];
    const pts = { a: 2, b: 4, c: 3, d: 0 };
    expect(teamTotals(pts, teams)).toEqual([5, 4]);
    const r = rankHeadsUp(pts, ['a', 'b', 'c', 'd'], teams);
    expect(r.ranked).toEqual([['a', 'c'], ['b', 'd']]);
    expect(r.shown).toEqual({ a: 5, c: 5, b: 4, d: 4 });
    expect(rankHeadsUp({ a: 1, b: 1 }, ['a', 'b'], [['a'], ['b']]).ranked).toEqual([['a', 'b']]);
  });
});
