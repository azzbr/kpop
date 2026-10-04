// Word Guess rules (Wordle-style). Pure functions — no React, no store.
import { ALLOWED_5 } from '../../data/words5Allowed';
import { ANSWERS_5 } from '../../data/words5Answers';
import type { WordGuessState } from '../../store';
import type { Rng } from '../../games/engine/rng';

export type TileState = 'correct' | 'present' | 'absent';
export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

let allowed: Set<string> | null = null;

/** Every word that may be guessed (upper-case). Built once, on first use. */
export function allowedWords(): Set<string> {
  if (!allowed) {
    allowed = new Set<string>();
    for (const w of ALLOWED_5.split('\n')) if (w.length === WORD_LEN) allowed.add(w.toUpperCase());
    for (const w of ANSWERS_5) allowed.add(w.toUpperCase());
  }
  return allowed;
}

export const isAllowed = (word: string) => allowedWords().has(word.toUpperCase());

/**
 * Standard two-pass Wordle scoring: greens first, then yellows from the letters that are left,
 * so a letter is never marked more times than it appears in the answer.
 */
export function scoreGuess(guess: string, answer: string): TileState[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const res: TileState[] = Array(g.length).fill('absent');
  const left: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) res[i] = 'correct';
    else left[a[i]] = (left[a[i]] ?? 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (res[i] === 'correct') continue;
    if ((left[g[i]] ?? 0) > 0) {
      res[i] = 'present';
      left[g[i]]--;
    }
  }
  return res;
}

const RANK: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };

/** Keyboard colours: a letter keeps its best state (correct > present > absent). */
export function keyStates(guesses: string[], answer: string): Record<string, TileState> {
  const out: Record<string, TileState> = {};
  for (const g of guesses) {
    const sc = scoreGuess(g, answer);
    for (let i = 0; i < g.length; i++) {
      const l = g[i].toUpperCase();
      if (!out[l] || RANK[sc[i]] > RANK[out[l]]) out[l] = sc[i];
    }
  }
  return out;
}

/** FNV-1a string hash → unsigned 32-bit. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Final avalanche so neighbouring dates spread out.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Today's answer: the same for everyone on the same local date. */
export function dailyAnswer(dateKey: string): string {
  return ANSWERS_5[hashString(`word-guess:${dateKey}`) % ANSWERS_5.length].toUpperCase();
}

export function randomAnswer(rng: Rng, avoid?: string): string {
  for (let i = 0; i < 10; i++) {
    const w = ANSWERS_5[Math.floor(rng() * ANSWERS_5.length)].toUpperCase();
    if (w !== avoid) return w;
  }
  return ANSWERS_5[0].toUpperCase();
}

export const isWin = (guesses: string[], answer: string) => guesses.length > 0 && guesses[guesses.length - 1].toUpperCase() === answer.toUpperCase();
export const isDone = (guesses: string[], answer: string) => isWin(guesses, answer) || guesses.length >= MAX_GUESSES;

function prevDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** The daily streak as it stands today (it breaks if yesterday's puzzle wasn't won). */
export function liveStreak(s: WordGuessState, today: string): number {
  const d = s.daily;
  if (!d) return 0;
  if (d.date === today) return s.streak;
  if (d.date === prevDay(today) && d.done && d.won) return s.streak;
  return 0;
}

/** Store patch for starting (or resuming) today's daily puzzle. */
export function startDailyPatch(s: WordGuessState, today: string): Partial<WordGuessState> {
  if (s.daily?.date === today) return {};
  return { daily: { date: today, guesses: [], done: false, won: false }, streak: liveStreak(s, today) };
}

/** Store patch after a game ends. Played/won count both modes; the streak is daily-only. */
export function finishPatch(s: WordGuessState, won: boolean, daily: boolean, guesses: string[], today: string): Partial<WordGuessState> {
  const patch: Partial<WordGuessState> = { played: s.played + 1, won: s.won + (won ? 1 : 0) };
  if (daily) {
    const streak = won ? liveStreak(s, today) + 1 : 0;
    patch.streak = streak;
    patch.bestStreak = Math.max(s.bestStreak, streak);
    patch.daily = { date: today, guesses, done: true, won };
  }
  return patch;
}
