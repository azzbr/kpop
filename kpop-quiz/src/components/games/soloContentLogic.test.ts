import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { EMOJI_PUZZLES } from '../../online/emojiPuzzles';
import { REAL_OR_FAKE } from '../../data/realOrFake';
import { WOULD_YOU_RATHER } from '../../data/wouldYouRather';
import { drawFresh, shuffle } from './drawLogic';
import { choicesFor, checkTyped, firstLetters, hintFor, starsFor } from './emojiGuessLogic';
import { newRof, answerRof, isOver, swipeAnswer, ROUND_SIZE as ROF_ROUND } from './realOrFakeLogic';
import { withMajority, pctFor, partySummary, cleanName } from './wouldYouRatherLogic';
import { normaliseAnswer } from '../../online/quiz/quizLogic';

describe('drawFresh', () => {
  it('draws distinct indices and avoids repeats across rounds', () => {
    const seen = new Set<number>();
    const rng = createRng(7);
    const a = drawFresh(30, 10, seen, rng);
    const b = drawFresh(30, 10, seen, rng);
    const c = drawFresh(30, 10, seen, rng);
    expect(new Set([...a, ...b, ...c]).size).toBe(30);
    // Pool used up → starts over, still distinct within the round.
    const d = drawFresh(30, 10, seen, rng);
    expect(new Set(d).size).toBe(10);
  });

  it('never asks for more than exist', () => {
    expect(drawFresh(4, 10, new Set(), createRng(1))).toHaveLength(4);
  });

  it('shuffle keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], createRng(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('every content bank is big enough for a round', () => {
    expect(REAL_OR_FAKE.length).toBeGreaterThanOrEqual(ROF_ROUND);
    expect(WOULD_YOU_RATHER.length).toBeGreaterThanOrEqual(10);
    expect(EMOJI_PUZZLES.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Emoji Guess', () => {
  it('gives 4 distinct choices including the answer, for every puzzle', () => {
    const rng = createRng(11);
    EMOJI_PUZZLES.forEach((p, i) => {
      const ch = choicesFor(i, rng);
      expect(ch).toHaveLength(4);
      expect(ch).toContain(p.answer);
      expect(new Set(ch.map(normaliseAnswer)).size).toBe(4);
      // No wrong choice is secretly also right.
      for (const c of ch) if (c !== p.answer) expect(checkTyped(c, p)).toBe(false);
    });
  });

  it('accepts typed answers and alternatives, forgivingly', () => {
    const turtle = EMOJI_PUZZLES.find(p => p.answer === 'turtle')!;
    expect(checkTyped('Turtle', turtle)).toBe(true);
    expect(checkTyped('tortoise', turtle)).toBe(true);
    expect(checkTyped('turtl', turtle)).toBe(true); // one typo is fine
    expect(checkTyped('snake', turtle)).toBe(false);
  });

  it('hints and stars', () => {
    expect(firstLetters('apple pie')).toBe('A____ P__');
    expect(hintFor({ emoji: '🍎', answer: 'apple', hint: '' })).toBe('A____');
    expect(starsFor(true, false)).toBe(3);
    expect(starsFor(true, true)).toBe(1);
    expect(starsFor(false, false)).toBe(0);
  });
});

describe('Real or Fake', () => {
  it('tracks lives, streak and best streak', () => {
    let s = newRof();
    s = answerRof(s, true, true).state;
    s = answerRof(s, false, false).state;
    expect(s.streak).toBe(2);
    const wrong = answerRof(s, true, false);
    expect(wrong.ok).toBe(false);
    s = wrong.state;
    expect(s.lives).toBe(2);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
    s = answerRof(s, true, true).state;
    expect(s.bestStreak).toBe(2);
    expect(s.correct).toBe(3);
  });

  it('ends at 0 lives or after the last fact', () => {
    let s = newRof();
    for (let i = 0; i < 3; i++) s = answerRof(s, true, false).state;
    expect(isOver(s, 15)).toBe(true);
    let t = newRof();
    for (let i = 0; i < 15; i++) t = answerRof(t, true, true).state;
    expect(isOver(t, 15)).toBe(true);
    expect(t.bestStreak).toBe(15);
  });

  it('swipe right = real, left = fake, short drag = nothing', () => {
    expect(swipeAnswer(200)).toBe(true);
    expect(swipeAnswer(-200)).toBe(false);
    expect(swipeAnswer(30)).toBeNull();
  });
});

describe('Would You Rather', () => {
  const q = { a: 'A', b: 'B', aPct: 70, emojiA: '', emojiB: '' };
  it('majority and percentages', () => {
    expect(withMajority(q, 'a')).toBe(true);
    expect(withMajority(q, 'b')).toBe(false);
    expect(pctFor(q, 'b')).toBe(30);
    expect(withMajority({ ...q, aPct: 50 }, 'b')).toBe(true);
  });

  it('every question has a valid percentage', () => {
    for (const w of WOULD_YOU_RATHER) {
      expect(w.aPct).toBeGreaterThan(0);
      expect(w.aPct).toBeLessThan(100);
    }
  });

  it('party summary finds the crowd-pleaser and the free spirit', () => {
    const qs = [q, q, { ...q, aPct: 20 }];
    const s = partySummary(['Mia', 'Leo', 'Ava'], qs, [['a', 'b', 'a'], ['a', 'b', 'b'], ['b', 'a', 'b']]);
    expect(s.agree).toEqual({ Mia: 3, Leo: 0, Ava: 2 });
    expect(s.crowd).toEqual(['Mia']);
    expect(s.unique).toEqual(['Leo']);
    const tie = partySummary(['Mia', 'Leo'], [q], [['a', 'a']]);
    expect(tie.crowd).toEqual(['Mia', 'Leo']);
    expect(tie.unique).toEqual([]);
  });

  it('cleans names', () => {
    expect(cleanName('  mia  ')).toBe('Mia');
    expect(cleanName('ANNA MARIE LONGNAME')).toBe('Anna Marie');
  });
});
