import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { SPY_PLACES, SPY_QUESTIONS } from '../../online/spyPlaces';
import {
  pickSpies, pickPlaces, assignRoles, questionCards, answerChips, guessOptions, tallyVotes, scoreRound, checkWord, showWord,
  questionCount, CHIPS, GUESS_OPTIONS, LOCAL_POINTS, SPY_POINTS,
} from './spyStationLogic';

const castle = SPY_PLACES.find(p => p.id === 'castle')!;

describe('Spy Station', () => {
  it('picks a different spy and place each round', () => {
    const spies = pickSpies(['a', 'b', 'c', 'd'], 2, createRng(4));
    expect(new Set(spies).size).toBe(2);
    const places = pickPlaces(2, createRng(4));
    expect(places[0].id).not.toBe(places[1].id);
  });
  it('gives every local a role and the spy none', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const roles = assignRoles(ids, 'p3', castle, createRng(1));
    expect(roles.p3).toBeUndefined();
    expect(Object.keys(roles).length).toBe(9);
    for (const r of Object.values(roles)) expect(castle.roles).toContain(r);
  });
  it('deals 3 different question cards', () => {
    const q = questionCards(createRng(2), ['hear', 'see']);
    expect(new Set(q).size).toBe(3);
    expect(q).not.toContain('hear');
  });
  it('gives locals 3 fitting chips and the spy 2', () => {
    for (let seed = 0; seed < 20; seed++) {
      const local = answerChips(castle, 'wear', false, createRng(seed));
      const spy = answerChips(castle, 'wear', true, createRng(seed));
      expect(local.length).toBe(CHIPS);
      expect(new Set(local.map(s => s.toLowerCase())).size).toBe(CHIPS);
      expect(local.filter(c => castle.answers.wear.includes(c)).length).toBe(3);
      expect(spy.filter(c => castle.answers.wear.includes(c)).length).toBe(2);
    }
  });
  it('lists 12 places to guess from, including the real one', () => {
    const opts = guessOptions(castle, createRng(3));
    expect(opts.length).toBe(GUESS_OPTIONS);
    expect(new Set(opts).size).toBe(GUESS_OPTIONS);
    expect(opts).toContain('castle');
  });
  it('tallies votes (ties catch nobody)', () => {
    expect(tallyVotes({ a: 'b', c: 'b', b: 'a' }).top).toBe('b');
    expect(tallyVotes({ a: 'b', b: 'a' }).top).toBeNull();
    expect(tallyVotes({}).top).toBeNull();
    expect(tallyVotes({ a: 'a' }).top).toBeNull();
  });
  it('scores like Fake Artist', () => {
    const ids = ['s', 'a', 'b'];
    expect(scoreRound('caught_missed', 's', ids)).toEqual({ s: 0, a: LOCAL_POINTS, b: LOCAL_POINTS });
    expect(scoreRound('called_wrong', 's', ids)).toEqual({ s: 0, a: LOCAL_POINTS, b: LOCAL_POINTS });
    for (const o of ['caught_stole', 'escaped', 'called_right'] as const) expect(scoreRound(o, 's', ids)).toEqual({ s: SPY_POINTS, a: 0, b: 0 });
  });
  it('checks typed one-word answers', () => {
    expect(checkWord('Trumpets')).toBe('ok');
    expect(checkWord('  ')).toBe('empty');
    expect(checkWord('stupid')).toBe('unkind');
    expect(showWord('tRUMPETS 2')).toBe('Trumpets');
  });
  it('asks about two laps, capped', () => {
    expect(questionCount(4)).toBe(8);
    expect(questionCount(10)).toBe(12);
  });
});

describe('Spy Station content', () => {
  it('has 24 different places', () => {
    expect(SPY_PLACES.length).toBe(24);
    expect(new Set(SPY_PLACES.map(p => p.id)).size).toBe(24);
    expect(new Set(SPY_PLACES.map(p => p.name)).size).toBe(24);
    expect(new Set(SPY_PLACES.map(p => p.emoji)).size).toBe(24);
  });
  it('has 8 questions with 4 one-word answers each, and 8 roles', () => {
    expect(SPY_QUESTIONS.length).toBe(8);
    for (const p of SPY_PLACES) {
      expect(p.roles.length, p.id).toBeGreaterThanOrEqual(8);
      expect(new Set(p.roles).size, p.id).toBe(p.roles.length);
      for (const q of SPY_QUESTIONS) {
        const a = p.answers[q.id];
        expect(a.length, `${p.id} ${q.id}`).toBe(4);
        expect(new Set(a.map(x => x.toLowerCase())).size, `${p.id} ${q.id}`).toBe(4);
        for (const x of a) expect(x, `${p.id} ${q.id}`).toMatch(/^[A-Z][a-z]*(-[a-z]+)*$/);
      }
    }
  });
  it('has enough decoys for every question', () => {
    for (const p of SPY_PLACES) for (const q of SPY_QUESTIONS) {
      expect(answerChips(p, q.id, true, createRng(1)).length, `${p.id} ${q.id}`).toBe(CHIPS);
    }
  });
});
