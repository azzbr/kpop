import { describe, it, expect } from 'vitest';
import { RIDDLES } from './riddles';
import { normaliseAnswer } from './quiz/quizLogic';
import { isClean } from '../utils/cleanText';
import { isKidSafe } from './rudeWords';
import { createRng } from '../games/engine/rng';
import {
  judgeGuess, maskAnswer, lengthLabel, hintLevel, points, chooseRiddles, readConfig,
  TIER_POINTS, SPEED_BONUS, ROUND_MS, HINT_AT,
} from './riddleRushLogic';

const key = (s: string) => normaliseAnswer(s).replace(/ /g, '');

describe('riddle bank', () => {
  it('has about 400 riddles, ~40 of them emoji riddles', () => {
    expect(RIDDLES.length).toBeGreaterThanOrEqual(400);
    expect(RIDDLES.filter(r => r.kind === 'emoji').length).toBeGreaterThanOrEqual(40);
  });

  it('every riddle has a question, answer, hint, explanation and difficulty', () => {
    for (const r of RIDDLES) {
      expect(r.q.trim().length, r.answer).toBeGreaterThan(8);
      expect(r.answer.trim()).toBe(r.answer);
      expect(r.answer.length).toBeGreaterThan(0);
      expect(r.hint.trim().length, r.q).toBeGreaterThan(2);
      expect(r.explanation.trim().length, r.q).toBeGreaterThan(8);
      expect(['easy', 'tricky', 'genius']).toContain(r.difficulty);
      expect(['word', 'emoji']).toContain(r.kind);
    }
  });

  it('answers are short (≤ 3 words) and typeable on the letters keyboard', () => {
    for (const r of RIDDLES) {
      expect(r.answer.split(/\s+/).length, r.answer).toBeLessThanOrEqual(3);
      expect(r.answer, r.answer).toMatch(/^[a-z ]+$/);
      for (const a of r.alt ?? []) expect(a, a).toMatch(/^[a-z0-9 ]+$/);
    }
  });

  it('no duplicate questions or answers', () => {
    const qs = RIDDLES.map(r => r.q.toLowerCase());
    expect(new Set(qs).size).toBe(qs.length);
    const answers = RIDDLES.map(r => key(r.answer));
    const dup = answers.filter((a, i) => answers.indexOf(a) !== i);
    expect(dup).toEqual([]);
  });

  it('the hint and the question never give the answer away in plain words', () => {
    for (const r of RIDDLES) {
      if (r.answer.length < 4) continue; // short answers like "sun" turn up inside other words
      expect(normaliseAnswer(r.hint).split(' '), r.answer).not.toContain(normaliseAnswer(r.answer));
    }
  });

  it('every riddle accepts its own answer and alternatives', () => {
    for (const r of RIDDLES) for (const a of [r.answer, ...(r.alt ?? [])]) expect(judgeGuess(a.toUpperCase(), r), a).toBe('right');
  });

  it('is G-rated', () => {
    const scary = /\b(kill|killed|dead|death|die|gun|weapon|murder|ghost|monster|zombie|skull|grave|coffin)\b/i;
    for (const r of RIDDLES) {
      for (const t of [r.q, r.answer, r.hint, r.explanation, ...(r.alt ?? [])]) {
        expect(isClean(t), t).toBe(true);
        expect(t, t).not.toMatch(scary);
      }
      // Answers are typed by kids and shown to the room after the round.
      for (const a of [r.answer, ...(r.alt ?? [])]) expect(isKidSafe(a), a).toBe(true);
    }
  });

  it('emoji riddles show pictures and explain the joined-up word', () => {
    for (const r of RIDDLES.filter(x => x.kind === 'emoji')) {
      expect(r.q).toMatch(/^What am I\? .+ \+ .+$/u);
      expect(r.explanation).toContain('+');
    }
  });
});

describe('judging guesses', () => {
  const towel = { answer: 'towel' };
  it('right: case, articles, a small typo, plurals and alts', () => {
    expect(judgeGuess('A TOWEL', towel)).toBe('right');
    expect(judgeGuess('towl', towel)).toBe('right');
    expect(judgeGuess('towels', towel)).toBe('right');
    expect(judgeGuess('eggs', { answer: 'egg' })).toBe('right');
    expect(judgeGuess('phone', { answer: 'telephone', alt: ['phone'] })).toBe('right');
    expect(judgeGuess('rubberband', { answer: 'rubber band' })).toBe('right');
  });
  it('close: a few letters off, or most of the word', () => {
    expect(judgeGuess('trowl', towel)).toBe('close');
    expect(judgeGuess('egs', { answer: 'egg' })).toBe('close');
    expect(judgeGuess('foot', { answer: 'footsteps' })).toBe('wrong');
    expect(judgeGuess('footstep', { answer: 'footsteps' })).toBe('right');
    expect(judgeGuess('telescop', { answer: 'telescope' })).toBe('right');
    expect(judgeGuess('mushrom', { answer: 'mushroom' })).toBe('right');
    expect(judgeGuess('mush', { answer: 'mushroom' })).toBe('wrong');
    expect(judgeGuess('mushro', { answer: 'mushroom' })).toBe('close');
  });
  it('wrong: different words and empty guesses', () => {
    expect(judgeGuess('banana', towel)).toBe('wrong');
    expect(judgeGuess('   ', towel)).toBe('wrong');
    expect(judgeGuess('cat', { answer: 'dog' })).toBe('wrong');
  });
});

describe('hints and points', () => {
  it('hints come at 12 s, 22 s and 29 s', () => {
    expect(hintLevel(0)).toBe(0);
    expect(hintLevel(HINT_AT[0] - 1)).toBe(0);
    expect(hintLevel(12_000)).toBe(1);
    expect(hintLevel(22_000)).toBe(2);
    expect(hintLevel(29_500)).toBe(3);
    expect(hintLevel(ROUND_MS)).toBe(3);
  });
  it('fewer points for each hint used, plus a speed bonus', () => {
    expect(points(0, ROUND_MS)).toBe(TIER_POINTS[0] + SPEED_BONUS);
    expect(points(0, 0)).toBe(100);
    expect(points(1, 0)).toBe(70);
    expect(points(2, 0)).toBe(50);
    expect(points(3, 0)).toBe(30);
    expect(points(1, ROUND_MS / 2)).toBe(70 + 25);
    for (let l = 0; l < 3; l++) expect(points(l, 1000)).toBeGreaterThan(points(l + 1, 1000));
  });
  it('masks the answer, showing the first then the last letter', () => {
    expect(maskAnswer('towel', 0)).toEqual([[null, null, null, null, null]]);
    expect(maskAnswer('towel', 2)).toEqual([['T', null, null, null, null]]);
    expect(maskAnswer('towel', 3)).toEqual([['T', null, null, null, 'L']]);
    expect(maskAnswer('rubber band', 3)).toEqual([['R', null, null, null, null, null], [null, null, null, 'D']]);
    expect(lengthLabel('towel')).toBe('5 letters');
    expect(lengthLabel('deck of cards')).toBe('3 words: 4 + 2 + 5');
  });
});

describe('choosing riddles', () => {
  it('sticks to the chosen difficulty and kind when it can', () => {
    for (const d of ['easy', 'tricky', 'genius'] as const) {
      const rs = chooseRiddles(RIDDLES, d, 'word', 8, createRng(3));
      expect(rs).toHaveLength(8);
      expect(new Set(rs.map(r => r.q)).size).toBe(8);
      rs.forEach(r => { expect(r.difficulty).toBe(d); expect(r.kind).toBe('word'); });
    }
  });
  it('emoji only, and fills from the nearest difficulty if it runs short', () => {
    const rs = chooseRiddles(RIDDLES, 'genius', 'emoji', 8, createRng(9));
    expect(rs).toHaveLength(8);
    rs.forEach(r => expect(r.kind).toBe('emoji'));
    expect(rs.filter(r => r.difficulty === 'easy').length).toBe(0);
  });
  it('mixed has some of each', () => {
    const rs = chooseRiddles(RIDDLES, 'easy', 'mixed', 8, createRng(5));
    expect(rs.filter(r => r.kind === 'emoji').length).toBe(2);
    expect(rs.filter(r => r.kind === 'word').length).toBe(6);
  });
  it('reads lobby options safely', () => {
    expect(readConfig(undefined)).toEqual({ difficulty: 'easy', kind: 'mixed', board: false });
    expect(readConfig({ difficulty: 'genius', kind: 'emoji', board: '1' })).toEqual({ difficulty: 'genius', kind: 'emoji', board: true });
    expect(readConfig({ difficulty: 'legend', kind: 'x' })).toEqual({ difficulty: 'easy', kind: 'mixed', board: false });
  });
});
