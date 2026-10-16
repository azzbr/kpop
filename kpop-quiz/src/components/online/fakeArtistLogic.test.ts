import { describe, it, expect } from 'vitest';
import {
  parseConfig, colorsFor, fakeOrder, turnOrder, pickWord, guessChoices, validVote, tally, mostVoted, roundPoints, allVoted,
  PLAYER_COLORS, CHOICES, LAPS,
} from './fakeArtistLogic';
import { createRng } from '../../games/engine/rng';
import { FAKE_ARTIST_CATEGORIES } from '../../online/fakeArtistWords';

const ids = ['a', 'b', 'c', 'd', 'e'];

describe('Fake Artist logic', () => {
  it('reads host options with safe defaults', () => {
    expect(parseConfig({})).toEqual({ rounds: 2, category: 'mixed', board: false });
    expect(parseConfig({ rounds: '3', category: 'Animals', board: '1' })).toEqual({ rounds: 3, category: 'Animals', board: true });
    expect(parseConfig({ category: 'Nope' }).category).toBe('mixed');
  });

  it('gives every player their own colour (10 players)', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `p${i}`);
    expect(new Set(Object.values(colorsFor(ten))).size).toBe(10);
    expect(new Set(PLAYER_COLORS).size).toBe(PLAYER_COLORS.length);
  });

  it('rotates the fake fairly — a new fake each round', () => {
    for (let s = 0; s < 30; s++) {
      const f = fakeOrder(ids, 3, createRng(s));
      expect(f).toHaveLength(3);
      expect(new Set(f).size).toBe(3);
      for (const id of f) expect(ids).toContain(id);
    }
    expect(fakeOrder(['a', 'b'], 3, createRng(1))).toHaveLength(3);
  });

  it('lets everyone draw once per lap, and the fake never goes first', () => {
    for (let s = 0; s < 40; s++) {
      const fake = ids[s % ids.length];
      const t = turnOrder(ids, fake, createRng(s));
      expect(t).toHaveLength(ids.length * LAPS);
      expect(t[0]).not.toBe(fake);
      expect(t.slice(0, ids.length).sort()).toEqual([...ids].sort());
      expect(t.slice(ids.length)).toEqual(t.slice(0, ids.length));
    }
  });

  it('picks unused words from the chosen category', () => {
    const rand = createRng(3);
    const w = pickWord('Animals', [], rand);
    expect(w.category).toBe('Animals');
    const animals = FAKE_ARTIST_CATEGORIES.find(c => c.category === 'Animals')!.words;
    const used = animals.slice(1);
    expect(pickWord('Animals', used, rand).word).toBe(animals[0]);
    expect(pickWord('mixed', [], rand).word).toBeTruthy();
  });

  it('offers the fake 6 choices from the same category, including the real word', () => {
    const rand = createRng(5);
    for (const c of FAKE_ARTIST_CATEGORIES) {
      for (const word of c.words) {
        const ch = guessChoices({ word, category: c.category }, rand);
        expect(ch).toHaveLength(CHOICES);
        expect(new Set(ch).size).toBe(CHOICES);
        expect(ch).toContain(word);
        for (const x of ch) expect(c.words).toContain(x);
      }
    }
  });

  it('counts votes: no voting for yourself, ties let the fake escape', () => {
    expect(validVote('a', 'a', ids)).toBe(false);
    expect(validVote('a', 'z', ids)).toBe(false);
    expect(validVote('a', 'b', ids)).toBe(true);
    expect(tally({ a: 'b', c: 'b', b: 'a' })).toEqual({ b: 2, a: 1 });
    expect(mostVoted({ a: 'b', c: 'b', b: 'a' })).toBe('b');
    expect(mostVoted({ a: 'b', b: 'a' })).toBe(null);
    expect(mostVoted({})).toBe(null);
    expect(allVoted(['a', 'b'], { a: 'b' })).toBe(false);
    expect(allVoted(['a', 'b'], { a: 'b', b: 'a' })).toBe(true);
  });

  it('scores: artists +2 for catching a fake who misses, the fake +3 otherwise', () => {
    expect(roundPoints(['a', 'b', 'c'], 'a', true, false)).toEqual({ a: 0, b: 2, c: 2 });
    expect(roundPoints(['a', 'b', 'c'], 'a', true, true)).toEqual({ a: 3, b: 0, c: 0 });
    expect(roundPoints(['a', 'b', 'c'], 'a', false, false)).toEqual({ a: 3, b: 0, c: 0 });
  });
});
