// Hangman rules for the PuzzleRace engine: everyone races to reveal the same word, each with
// their own lives. Words come from the Doodle Dash word bank (kid-friendly, single words).
import type { Rng } from '../games/engine/rng';
import { createRng } from '../games/engine/rng';
import { DOODLE_WORDS } from './doodleWords';
import { isClean } from '../utils/cleanText';

export const HM_MAX_WRONG = 6;
export const HM_LEN: Record<string, [number, number]> = {
  easy: [4, 5],
  medium: [5, 6],
  hard: [6, 8],
  expert: [8, 10],
  master: [9, 12],
  legend: [10, 14],
};

export interface HmPuzzle { word: string }
export interface HmState { guessed: string[] }

/** The words a difficulty can use (lower case), widest-first fallback if the band is thin. */
export function hmPool(difficulty: string | undefined): string[] {
  const [lo, hi] = HM_LEN[difficulty || 'medium'] || HM_LEN.medium;
  const ok = DOODLE_WORDS.filter(w => /^[a-z]+$/.test(w) && isClean(w));
  const uniq = [...new Set(ok)];
  let pool = uniq.filter(w => w.length >= lo && w.length <= hi);
  if (pool.length < 8) pool = uniq.filter(w => w.length >= lo - 2);
  return pool;
}

/**
 * The word for one round. Every round of a game draws from the same shuffled pool (shuffled
 * with the game seed), so the rounds of a game never repeat a word.
 */
export function hmGenerate(difficulty: string | undefined, _rng: Rng, ctx: { gameSeed: number; round: number }): HmPuzzle {
  const pool = hmPool(difficulty);
  const rng = createRng(ctx.gameSeed);
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { word: (order[(ctx.round - 1) % order.length] || 'star').toUpperCase() };
}

export const hmInit = (): HmState => ({ guessed: [] });
const letters = (p: HmPuzzle) => [...new Set(p.word.split(''))];
export const hmWrong = (p: HmPuzzle, guessed: string[]) => guessed.filter(l => !p.word.includes(l)).length;
export const hmLives = (p: HmPuzzle, s: HmState) => Math.max(0, HM_MAX_WRONG - hmWrong(p, s.guessed));
export const hmSolved = (p: HmPuzzle, s: HmState) => hmLives(p, s) > 0 && letters(p).every(l => s.guessed.includes(l));
export const hmFailed = (p: HmPuzzle, s: HmState) => hmLives(p, s) <= 0;
export function hmProgress(p: HmPuzzle, s: HmState): number {
  const ls = letters(p);
  return ls.filter(l => s.guessed.includes(l)).length / ls.length;
}

export function hmGuess(p: HmPuzzle, s: HmState, letter: string): HmState {
  const L = letter.toUpperCase();
  if (!/^[A-Z]$/.test(L) || s.guessed.includes(L) || hmFailed(p, s) || hmSolved(p, s)) return s;
  return { guessed: [...s.guessed, L] };
}

/** Host check: the guesses reveal every letter before running out of lives. */
export function hmCheck(p: HmPuzzle, guessed: unknown): boolean {
  if (!Array.isArray(guessed) || guessed.length > 26 || !guessed.every(l => typeof l === 'string' && /^[A-Z]$/.test(l))) return false;
  return hmSolved(p, { guessed: guessed as string[] });
}
