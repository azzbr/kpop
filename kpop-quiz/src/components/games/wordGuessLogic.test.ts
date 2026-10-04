import { describe, it, expect } from 'vitest';
import { ANSWERS_5 } from '../../data/words5Answers';
import { localDateKey } from '../../utils/dates';
import type { WordGuessState } from '../../store';
import {
  scoreGuess, keyStates, dailyAnswer, isAllowed, allowedWords, liveStreak, startDailyPatch, finishPatch, isWin, isDone,
} from './wordGuessLogic';

const C = 'correct', P = 'present', A = 'absent';

describe('scoreGuess', () => {
  it('all correct', () => {
    expect(scoreGuess('HELLO', 'HELLO')).toEqual([C, C, C, C, C]);
  });

  it('LLAMA vs HELLO: both Ls are present (answer has two Ls), A and M absent', () => {
    expect(scoreGuess('LLAMA', 'HELLO')).toEqual([P, P, A, A, A]);
  });

  it('EERIE vs THERE: green E used first, only one E left for yellow', () => {
    expect(scoreGuess('EERIE', 'THERE')).toEqual([P, A, P, A, C]);
  });

  it('a repeated guess letter beyond the answer count is absent', () => {
    // SPEED vs ABIDE: only one E in the answer.
    expect(scoreGuess('SPEED', 'ABIDE')).toEqual([A, A, P, A, P]);
    // ALLEY vs LLAMA: green L at index 1, the other L (index 0 in the answer) makes index 2 yellow.
    expect(scoreGuess('ALLEY', 'LLAMA')).toEqual([P, C, P, A, A]);
  });

  it('is case-insensitive', () => {
    expect(scoreGuess('hello', 'HELLO')).toEqual([C, C, C, C, C]);
  });
});

describe('keyStates', () => {
  it('correct beats present beats absent', () => {
    // Answer HELLO. First guess LEMON: L present, E correct, M absent, O present, N absent.
    // Second guess HOTEL: H correct, O present, T absent, E present, L present.
    // Third guess BELLY: L correct (index 2 and 3).
    const ks = keyStates(['LEMON', 'HOTEL', 'BELLY'], 'HELLO');
    expect(ks.E).toBe('correct'); // correct in LEMON, present in HOTEL → stays correct
    expect(ks.L).toBe('correct'); // present first, then correct
    expect(ks.O).toBe('present');
    expect(ks.H).toBe('correct');
    expect(ks.M).toBe('absent');
    expect(ks.T).toBe('absent');
    expect(ks.Q).toBeUndefined();
  });

  it('an absent duplicate never downgrades a present letter', () => {
    // SPEED vs ABIDE: first E present, second E absent → E stays present.
    expect(keyStates(['SPEED'], 'ABIDE').E).toBe('present');
  });
});

describe('word list', () => {
  it('accepts real words and answers, rejects junk', () => {
    expect(isAllowed('HELLO')).toBe(true);
    expect(isAllowed('apple')).toBe(true);
    expect(isAllowed('XQZZY')).toBe(false);
    expect(isAllowed('ABCDE')).toBe(false);
  });

  it('contains every answer', () => {
    const set = allowedWords();
    for (const w of ANSWERS_5) expect(set.has(w.toUpperCase())).toBe(true);
  });
});

describe('daily answer', () => {
  it('is deterministic per date', () => {
    expect(dailyAnswer('2026-10-04')).toBe(dailyAnswer('2026-10-04'));
  });

  it('differs across dates', () => {
    expect(dailyAnswer('2026-10-04')).not.toBe(dailyAnswer('2026-10-05'));
    const seen = new Set<string>();
    let prev = '';
    for (let i = 0; i < 60; i++) {
      const w = dailyAnswer(localDateKey(new Date(2026, 0, 1 + i)));
      expect(w).not.toBe(prev); // never the same word two days running
      prev = w;
      seen.add(w);
    }
    expect(seen.size).toBeGreaterThan(50);
  });

  it('every daily answer for two years is an allowed answer word', () => {
    const answers = new Set(ANSWERS_5.map(w => w.toUpperCase()));
    for (let i = 0; i < 730; i++) {
      const w = dailyAnswer(localDateKey(new Date(2026, 0, 1 + i)));
      expect(w).toHaveLength(5);
      expect(answers.has(w)).toBe(true);
      expect(isAllowed(w)).toBe(true);
    }
  });
});

describe('win / done', () => {
  it('detects a win and running out of guesses', () => {
    expect(isWin(['CRANE', 'HELLO'], 'HELLO')).toBe(true);
    expect(isDone(['CRANE'], 'HELLO')).toBe(false);
    expect(isDone(Array(6).fill('CRANE'), 'HELLO')).toBe(true);
  });
});

describe('stats and streak', () => {
  const base: WordGuessState = { daily: null, played: 0, won: 0, streak: 0, bestStreak: 0 };

  it('counts consecutive daily wins', () => {
    let s = { ...base, ...startDailyPatch(base, '2026-10-01') };
    s = { ...s, ...finishPatch(s, true, true, ['HELLO'], '2026-10-01') };
    expect(s.streak).toBe(1);
    s = { ...s, ...startDailyPatch(s, '2026-10-02') };
    s = { ...s, ...finishPatch(s, true, true, ['HELLO'], '2026-10-02') };
    expect(s.streak).toBe(2);
    expect(s.bestStreak).toBe(2);
    expect(s.played).toBe(2);
    expect(s.won).toBe(2);
  });

  it('a missed day or a loss resets the streak', () => {
    let s: WordGuessState = { ...base, streak: 3, bestStreak: 3, daily: { date: '2026-10-01', guesses: ['HELLO'], done: true, won: true } };
    expect(liveStreak(s, '2026-10-02')).toBe(3);
    expect(liveStreak(s, '2026-10-03')).toBe(0);
    s = { ...s, ...startDailyPatch(s, '2026-10-03') };
    expect(s.streak).toBe(0);
    s = { ...s, ...finishPatch(s, false, true, Array(6).fill('CRANE'), '2026-10-03') };
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(3);
  });

  it('unlimited games count as played but never touch the streak', () => {
    const s: WordGuessState = { ...base, streak: 2, bestStreak: 2 };
    const p = finishPatch(s, true, false, ['HELLO'], '2026-10-03');
    expect(p.played).toBe(1);
    expect(p.won).toBe(1);
    expect(p.streak).toBeUndefined();
    expect(p.daily).toBeUndefined();
  });

  it('starting today twice keeps the saved board', () => {
    const s: WordGuessState = { ...base, daily: { date: '2026-10-03', guesses: ['CRANE'], done: false, won: false } };
    expect(startDailyPatch(s, '2026-10-03')).toEqual({});
  });
});
