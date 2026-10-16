import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { isClean } from '../../utils/cleanText';
import {
  pickImposter, pickImposters, imposterCount, assignRoles, dealCards, pickWord, pickPair, turnOrder, guessOptions,
  validateClue, validateEmojiClue, cleanStroke, thinStroke, tooClose, tallyVotes, canVote, scoreRound, roundWinner,
  rankPlayers, revealMs, POINTS, MAX_CLUE, MAX_STROKE_PTS, TURN_MS,
} from './imposterLogic';
import { IMPOSTER_CATEGORIES, IMPOSTER_WORDS, UNDERCOVER_PAIRS, EMOJI_CLUES } from './words';
import { isKidSafe } from '../rudeWords';

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
    expect(tallyVotes({ c: 'c', a: 'b' }, 'c')).toEqual({ counts: { b: 1 }, top: ['b'], out: 'b', caught: false });
    expect(canVote('a', 'a', ids)).toBe(false);
    expect(canVote('a', 'b', ids)).toBe(true);
    expect(canVote('a', 'zz', ids)).toBe(false);
  });
});

describe('scoring', () => {
  const roundIds = ['a', 'b', 'c', 'd'];
  const votes = { a: 'c', b: 'c', c: 'a', d: 'a' };

  it('crew who voted right get +2; imposter +3 when not voted out', () => {
    expect(scoreRound({ roundIds, imposterIds: ['c'], votes, out: null, guessedRight: false }))
      .toEqual({ a: POINTS.crewCorrectVote, b: POINTS.crewCorrectVote, c: POINTS.imposterEscaped, d: 0 });
  });

  it('caught imposter gets 0 for a wrong guess, +3 for a right one', () => {
    expect(scoreRound({ roundIds, imposterIds: ['c'], votes, out: 'c', guessedRight: false }).c).toBe(0);
    expect(scoreRound({ roundIds, imposterIds: ['c'], votes, out: 'c', guessedRight: true }).c).toBe(3);
  });

  it('imposter voting for someone never earns crew points', () => {
    expect(scoreRound({ roundIds, imposterIds: ['a'], votes: { a: 'c' }, out: 'a', guessedRight: false }).a).toBe(0);
  });

  it('two imposters: votes on either count, the one not voted out escapes', () => {
    const v = { a: 'c', b: 'd', c: 'a', d: 'c' };
    const t = tallyVotes(v, ['c', 'd']);
    expect(t.out).toBe('c');
    expect(t.caught).toBe(true);
    const pts = scoreRound({ roundIds, imposterIds: ['c', 'd'], votes: v, out: t.out, guessedRight: false });
    expect(pts).toEqual({ a: 2, b: 2, c: 0, d: POINTS.imposterEscaped });
    // An imposter's vote for the other imposter earns nothing.
    expect(pts.d).toBe(3);
  });

  it('winner banner + ranking', () => {
    expect(roundWinner(false, false)).toBe('imposter');
    expect(roundWinner(true, true)).toBe('imposter');
    expect(roundWinner(true, false)).toBe('crew');
    expect(roundWinner(true, false, 2)).toBe('split');
    expect(roundWinner(false, false, 2)).toBe('imposter');
    const ranked = rankPlayers([
      { id: 'a', name: 'A', score: 2, joinedAt: 1 },
      { id: 'b', name: 'B', score: 5, joinedAt: 2 },
      { id: 'c', name: 'C', score: 2, joinedAt: 0 },
    ]);
    expect(ranked.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('the drumroll gets longer with more votes', () => {
    expect(revealMs(8)).toBeGreaterThan(revealMs(3));
    expect(TURN_MS).toBe(25_000);
  });
});

describe('modes and imposter count', () => {
  it('Auto gives 2 imposters at 7+ players; "2" needs 5+', () => {
    expect(imposterCount('auto', 6)).toBe(1);
    expect(imposterCount('auto', 7)).toBe(2);
    expect(imposterCount('1', 12)).toBe(1);
    expect(imposterCount('2', 4)).toBe(1);
    expect(imposterCount('2', 5)).toBe(2);
    expect(imposterCount(undefined, 8)).toBe(2);
  });

  it('picks distinct imposters and never the same one 3 rounds running', () => {
    for (let seed = 1; seed < 200; seed++) {
      const rng = createRng(seed);
      const group = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const history: string[][] = [];
      for (let r = 0; r < 8; r++) {
        const imps = pickImposters(group, 2, history, rng);
        expect(new Set(imps).size).toBe(2);
        imps.forEach(i => expect(group).toContain(i));
        history.push(imps);
      }
      for (let r = 2; r < history.length; r++) {
        for (const id of history[r]) expect(history[r - 1].includes(id) && history[r - 2].includes(id)).toBe(false);
      }
    }
  });

  it('Classic: imposters get no word and are told; Undercover: a similar word and no warning', () => {
    const c = dealCards('classic', ['a', 'b', 'c', 'd'], ['b'], 'Panda', null);
    expect(c.b).toEqual({ word: null, imposter: true });
    expect(c.a).toEqual({ word: 'Panda', imposter: false });
    const u = dealCards('undercover', ['a', 'b', 'c', 'd', 'e'], ['b', 'e'], 'cat', 'dog');
    expect(u.b).toEqual({ word: 'dog', imposter: false });
    expect(u.e).toEqual({ word: 'dog', imposter: false });
    expect(u.c).toEqual({ word: 'cat', imposter: false });
    expect(Object.values(u).every(card => !card.imposter)).toBe(true);
    expect(dealCards('emoji', ['a', 'b', 'c'], ['a'], 'Moon', null).a.imposter).toBe(true);
  });

  it('Undercover pairs come from the list, both ways round, fresh until they run out', () => {
    const rng = createRng(4);
    const used: string[] = [];
    let swapped = 0;
    for (let i = 0; i < 40; i++) {
      const [crew, imp] = pickPair(used, rng);
      expect(UNDERCOVER_PAIRS.some(([a, b]) => (a === crew && b === imp) || (a === imp && b === crew))).toBe(true);
      expect(used).not.toContain(crew);
      if (UNDERCOVER_PAIRS.some(([a]) => a === imp)) swapped++;
      used.push(crew, imp);
    }
    expect(swapped).toBeGreaterThan(5);
  });

  it('two imposters: neither goes first', () => {
    for (let s = 0; s < 100; s++) expect(['b', 'c']).not.toContain(turnOrder(['a', 'b', 'c', 'd', 'e'], ['b', 'c'], 1, createRng(s))[0]);
  });

  it('emoji clues: 1–2 from the grid, no repeats', () => {
    expect(validateEmojiClue(['🐶'])).toEqual({ ok: true, clue: '🐶' });
    expect(validateEmojiClue(['🐶', '🔥'])).toEqual({ ok: true, clue: '🐶🔥' });
    expect(validateEmojiClue([]).ok).toBe(false);
    expect(validateEmojiClue(['🐶', '🔥', '⭐']).ok).toBe(false);
    expect(validateEmojiClue(['💩']).ok).toBe(false);
    expect(validateEmojiClue('🐶').ok).toBe(false);
    expect(validateEmojiClue(['🐶'], ['🐶']).ok).toBe(false);
  });

  it('doodle strokes: one stroke, clamped to the box, capped in length', () => {
    expect(cleanStroke([[0.1, 0.1, 1]])).toBeNull();
    expect(cleanStroke('nope')).toBeNull();
    const s = cleanStroke([[0.1, 0.2, 0], [2, -1, 1], [0.5, 0.5, 1]])!;
    expect(s).toEqual([[0.1, 0.2, 1], [1, 0, 0], [0.5, 0.5, 0]]);
    const long = Array.from({ length: 500 }, (_, i) => [i / 500, 0.5, 0]);
    expect(cleanStroke(long)!.length).toBe(MAX_STROKE_PTS);
    const thin = thinStroke(Array.from({ length: 100 }, (_, i) => [0.5 + i * 0.0001, 0.5, i === 0 ? 1 : 0] as [number, number, number]));
    expect(thin.length).toBeLessThan(5);
  });
});

describe('word lists', () => {
  it('every category has ~40 unique, clean words', () => {
    for (const c of IMPOSTER_CATEGORIES) {
      const words = IMPOSTER_WORDS[c.id];
      expect(words.length).toBeGreaterThanOrEqual(36);
      expect(new Set(words.map(w => w.toLowerCase())).size).toBe(words.length);
      words.forEach(w => {
        expect(w.trim()).toBe(w);
        expect(w.length).toBeGreaterThan(1);
        expect(isClean(w)).toBe(true);
        expect(isKidSafe(w)).toBe(true);
      });
    }
  });

  it('12 categories, about 480 words, no word in two categories', () => {
    expect(IMPOSTER_CATEGORIES.map(c => c.id)).toEqual(expect.arrayContaining(['space', 'ocean', 'toys', 'weather']));
    expect(IMPOSTER_CATEGORIES).toHaveLength(12);
    const all = IMPOSTER_CATEGORIES.flatMap(c => IMPOSTER_WORDS[c.id].map(w => w.toLowerCase()));
    expect(all.length).toBeGreaterThanOrEqual(470);
    expect(new Set(all).size).toBe(all.length);
  });

  it('150 undercover pairs: lowercase, different words, never repeated, kid-safe', () => {
    expect(UNDERCOVER_PAIRS.length).toBeGreaterThanOrEqual(150);
    const seen = new Set<string>();
    for (const [a, b] of UNDERCOVER_PAIRS) {
      expect(a).not.toBe(b);
      for (const w of [a, b]) {
        expect(w).toBe(w.toLowerCase());
        expect(w).toMatch(/^[a-z][a-z ]*[a-z]$/);
        expect(isClean(w)).toBe(true);
        expect(isKidSafe(w)).toBe(true);
        expect(seen.has(w)).toBe(false);
        seen.add(w);
      }
      // A pair must be guessable from clues, so neither word contains the other.
      expect(tooClose(a, b)).toBe(false);
    }
  });

  it('emoji grid has no repeats', () => {
    expect(EMOJI_CLUES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EMOJI_CLUES).size).toBe(EMOJI_CLUES.length);
  });
});
