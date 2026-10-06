// Code Breaker (Mastermind) rules for the PuzzleRace engine.
import type { Rng } from '../games/engine/rng';

export const CB_COLORS = [
  { hex: '#ef4444', name: 'red' },
  { hex: '#3b82f6', name: 'blue' },
  { hex: '#22c55e', name: 'green' },
  { hex: '#eab308', name: 'yellow' },
  { hex: '#a855f7', name: 'purple' },
  { hex: '#f97316', name: 'orange' },
  { hex: '#06b6d4', name: 'cyan' },
  { hex: '#ec4899', name: 'pink' },
];

export interface CbSpec { length: number; palette: number; repeats: boolean }

export function cbSpec(difficulty: string | undefined): CbSpec {
  if (difficulty === 'easy') return { length: 3, palette: 5, repeats: false };
  if (difficulty === 'hard') return { length: 4, palette: 6, repeats: true };
  if (difficulty === 'expert') return { length: 5, palette: 6, repeats: true };
  if (difficulty === 'master') return { length: 5, palette: 8, repeats: true };
  if (difficulty === 'legend') return { length: 6, palette: 8, repeats: true };
  return { length: 4, palette: 6, repeats: false }; // normal
}

export interface CbPuzzle extends CbSpec { code: number[] }
export interface CbRow { guess: number[]; exact: number; color: number }
export interface CbState { cur: number[]; history: CbRow[] }

export function cbGenerate(difficulty: string | undefined, rng: Rng): CbPuzzle {
  const spec = cbSpec(difficulty);
  let code: number[];
  if (spec.repeats) code = Array.from({ length: spec.length }, () => Math.floor(rng() * spec.palette));
  else {
    const pool = Array.from({ length: spec.palette }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    code = pool.slice(0, spec.length);
  }
  return { ...spec, code };
}

/** ⚫ right colour right spot, ⚪ right colour wrong spot. */
export function evalGuess(code: number[], guess: number[]): { exact: number; color: number } {
  let exact = 0;
  const counts: Record<number, number> = {};
  const rest: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      counts[code[i]] = (counts[code[i]] || 0) + 1;
      rest.push(guess[i]);
    }
  }
  let color = 0;
  for (const g of rest) if (counts[g] > 0) { color++; counts[g]--; }
  return { exact, color };
}

/** A code the puzzle allows: right length, colours from the palette, no repeats unless allowed. */
export function validCode(p: CbSpec, code: number[]): boolean {
  if (!Array.isArray(code) || code.length !== p.length) return false;
  if (!code.every(c => Number.isInteger(c) && c >= 0 && c < p.palette)) return false;
  return p.repeats || new Set(code).size === code.length;
}

export const cbInit = (): CbState => ({ cur: [], history: [] });

/** Host check: the answer is the list of guesses; the last one must be the code. */
export function cbCheck(p: CbPuzzle, guesses: unknown): boolean {
  if (!Array.isArray(guesses) || !guesses.length || guesses.length > 200) return false;
  const last = guesses[guesses.length - 1];
  return Array.isArray(last) && last.length === p.code.length && last.every((v, i) => v === p.code[i]);
}

export const cbSolved = (p: CbPuzzle, s: CbState) => s.history.some(r => r.exact === p.length);

/** Best guess so far: exact pegs count fully, right-colour pegs half. */
export function cbProgress(p: CbPuzzle, s: CbState): number {
  if (cbSolved(p, s)) return 1;
  const best = Math.max(0, ...s.history.map(r => r.exact + r.color * 0.5));
  return Math.min(0.95, best / p.length);
}

/** Adds a guess to the history (oldest first). */
export function cbGuess(p: CbPuzzle, s: CbState, guess: number[]): CbState {
  const fb = evalGuess(p.code, guess);
  return { cur: [], history: [...s.history, { guess, ...fb }] };
}
