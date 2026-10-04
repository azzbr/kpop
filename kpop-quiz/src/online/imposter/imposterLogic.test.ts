import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { isClean } from '../../utils/cleanText';
import {
  pickImposter, assignRoles, pickWord, turnOrder, guessOptions, validateClue, tooClose,
  tallyVotes, canVote, scoreRound, roundWinner, rankPlayers, POINTS, MAX_CLUE,
} from './imposterLogic';
import { IMPOSTER_CATEGORIES, IMPOSTER_WORDS } from './words';

const ids = ['a', 'b', 'c', 'd', 'e'];

describe('roles', () => {
  it('always gives exactly one imposter, who sees no word', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const group = ids.slice(0, 3 + (i % 3));
      const imp = pickImposter(group, [], rng);
      const roles = assignRoles(group, imp, 'Panda');
      const nulls = Object.values(roles).filter(v => v === null);
      expect(nulls).toHaveLength(1);
      expect(roles[imp]).toBeNull();
      expect(Object.keys(roles)).toHaveLength(group.length);
      expect(Object.values(roles).filter(v => v === 'Panda')).toHaveLength(group.length - 1);
    }
  });

  it('never picks the same imposter 3 rounds running when someone else can be', () => {
    for (let seed = 1; seed < 300; seed++) {
      const rng = createRng(seed);
      const history: string[] = [];
      for (let r = 0; r < 10; r++) history.push(pickImposter(['a', 'b', 'c'], history, rng));
      for (let r = 2; r < history.length; r++) {
        expect(history[r] === history[r - 1] && history[r] === history[r - 2]).toBe(false);
      }
    }
  });

  it('still works with a single possible player', () => {
    expect(pickImposter(['solo'], ['solo', 'solo'], createRng(3))).toBe('solo');
  });

  it('picks unused words and puts the imposter later than first', () => {
    const rng = createRng(7);
    const used: string[] = [];
    for (let i = 0; i < 10; i++) used.push(pickWord('animals', used, rng));
    expect(new Set(used).size).toBe(10);
    for (let s = 0; s < 100; s++) {
      const order = turnOrder(ids, 'c', 2, createRng(s));
      expect(order).toHaveLength(10);
      expect(order[0]).not.toBe('c');
      expect(new Set(order.slice(0, 5)).size).toBe(5);
      expect(order.slice(5)).toEqual(order.slice(0, 5));
    }
  });

  it('guess options: 6 unique words from the category, including the answer', () => {
    const opts = guessOptions('Panda', 'animals', createRng(5));
    expect(opts).toHaveLength(6);
    expect(new Set(opts).size).toBe(6);
    expect(opts).toContain('Panda');
    opts.forEach(o => expect(IMPOSTER_WORDS.animals).toContain(o));
  });
});

describe('clues', () => {
  it('accepts a normal clue and upper-cases it', () => {
    expect(validateClue('  bamboo ', 'Panda')).toEqual({ ok: true, clue: 'BAMBOO' });
  });

  it('rejects empty, too long, two words, symbols and rude words', () => {
    expect(validateClue('', 'Panda').ok).toBe(false);
    expect(validateClue('A'.repeat(MAX_CLUE + 1), 'Panda').ok).toBe(false);
    expect(validateClue('A'.repeat(MAX_CLUE), 'Panda').ok).toBe(true);
    expect(validateClue('black white', 'Panda').ok).toBe(false);
    expect(validateClue('b4mboo', 'Panda').ok).toBe(false);
    expect(validateClue('stupid', 'Panda').ok).toBe(false);
  });

  it('rejects the secret word, typos, plurals and obvious chunks', () => {
    expect(validateClue('panda', 'Panda').ok).toBe(false);
    expect(validateClue('PANDAS', 'Panda').ok).toBe(false);
    expect(validateClue('PENGUN', 'Penguin').ok).toBe(false);
    expect(validateClue('CAKE', 'Cupcake').ok).toBe(false);
    expect(validateClue('BEAR', 'Polar Bear').ok).toBe(false);
    expect(validateClue('POLARBEAR', 'Polar Bear').ok).toBe(false);
    expect(validateClue('SNOWDRAGON', 'Dragon').ok).toBe(false);
    expect(validateClue('TEACHING', 'Teacher').ok).toBe(false);
    expect(tooClose('ICE', 'Polar Bear')).toBe(false);
    expect(tooClose('WHISKERS', 'Kitten')).toBe(false);
  });

  it('rejects repeats of earlier clues', () => {
    expect(validateClue('bamboo', 'Panda', ['BAMBOO']).ok).toBe(false);
  });

  it("doesn't check the imposter's clue against the word (that would leak it)", () => {
    expect(validateClue('panda', null).ok).toBe(true);
  });
});

describe('votes', () => {
  it('catches the imposter with the most votes', () => {
    const t = tallyVotes({ a: 'c', b: 'c', c: 'a', d: 'c', e: 'b' }, 'c');
    expect(t.counts).toEqual({ c: 3, a: 1, b: 1 });
    expect(t.top).toEqual(['c']);
    expect(t.caught).toBe(true);
  });

  it('a tie means the imposter escapes', () => {
    const t = tallyVotes({ a: 'c', b: 'c', c: 'a', d: 'a' }, 'c');
    expect(t.top.sort()).toEqual(['a', 'c']);
    expect(t.caught).toBe(false);
  });

  it('no votes, or the wrong person voted out, means the imposter escapes', () => {
    expect(tallyVotes({}, 'c').caught).toBe(false);
    expect(tallyVotes({ a: 'b', c: 'b', d: 'b' }, 'c').caught).toBe(false);
  });

  it('ignores self-votes', () => {
    expect(tallyVotes({ c: 'c', a: 'b' }, 'c')).toEqual({ counts: { b: 1 }, top: ['b'], caught: false });
    expect(canVote('a', 'a', ids)).toBe(false);
    expect(canVote('a', 'b', ids)).toBe(true);
    expect(canVote('a', 'zz', ids)).toBe(false);
  });
});

describe('scoring', () => {
  const roundIds = ['a', 'b', 'c', 'd'];
  const votes = { a: 'c', b: 'c', c: 'a', d: 'a' };

  it('crew who voted right get +2; imposter +3 when not caught', () => {
    expect(scoreRound({ roundIds, imposterId: 'c', votes, caught: false, guessedRight: false }))
      .toEqual({ a: POINTS.crewCorrectVote, b: POINTS.crewCorrectVote, c: POINTS.imposterEscaped, d: 0 });
  });

  it('caught imposter gets 0 for a wrong guess, +3 for a right one', () => {
    expect(scoreRound({ roundIds, imposterId: 'c', votes, caught: true, guessedRight: false }).c).toBe(0);
    expect(scoreRound({ roundIds, imposterId: 'c', votes, caught: true, guessedRight: true }).c).toBe(3);
  });

  it('imposter voting for someone never earns crew points', () => {
    expect(scoreRound({ roundIds, imposterId: 'a', votes: { a: 'c' }, caught: true, guessedRight: false }).a).toBe(0);
  });

  it('winner banner + ranking', () => {
    expect(roundWinner(false, false)).toBe('imposter');
    expect(roundWinner(true, true)).toBe('imposter');
    expect(roundWinner(true, false)).toBe('crew');
    const ranked = rankPlayers([
      { id: 'a', name: 'A', score: 2, joinedAt: 1 },
      { id: 'b', name: 'B', score: 5, joinedAt: 2 },
      { id: 'c', name: 'C', score: 2, joinedAt: 0 },
    ]);
    expect(ranked.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('word lists', () => {
  it('every category has ~40 unique, clean words', () => {
    for (const c of IMPOSTER_CATEGORIES) {
      const words = IMPOSTER_WORDS[c.id];
      expect(words.length).toBeGreaterThanOrEqual(36);
      expect(new Set(words.map(w => w.toLowerCase())).size).toBe(words.length);
      words.forEach(w => expect(isClean(w)).toBe(true));
    }
  });
});
