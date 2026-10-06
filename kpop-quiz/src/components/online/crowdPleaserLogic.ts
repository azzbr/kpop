// Crowd Pleaser (pure): a "Would you rather…" question, everyone picks a side AND guesses what
// most of the room picked. +1 for answering, +2 more when the guess matches the majority
// (a tie counts as right for everyone).
import type { Rng } from '../../games/engine/rng';

export const ROUNDS = 8;
export const ANSWER_MS = 20_000;
export const REVEAL_MS = 6000;

export type Side = 'a' | 'b';
export interface Answer { choice: Side; guess: Side }
export interface RoundTally { qi: number; a: number; b: number }

export const isSide = (v: unknown): v is Side => v === 'a' || v === 'b';

/** `n` different question indexes out of `total`. */
export function pickQuestions(n: number, total: number, rng: Rng): number[] {
  const idx = Array.from({ length: total }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(n, total));
}

export function tally(answers: Record<string, Answer>): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const x of Object.values(answers)) if (x.choice === 'a') a++; else b++;
  return { a, b };
}

export function majority(t: { a: number; b: number }): Side | 'tie' {
  return t.a > t.b ? 'a' : t.b > t.a ? 'b' : 'tie';
}

/** Points for one player this round (no answer = 0). */
export function roundPoints(ans: Answer | undefined, maj: Side | 'tie'): number {
  if (!ans) return 0;
  return 1 + (maj === 'tie' || ans.guess === maj ? 2 : 0);
}

/** Points this round for everyone in `ids`. */
export function scoreRound(answers: Record<string, Answer>, ids: string[]): { points: Record<string, number>; maj: Side | 'tie'; a: number; b: number } {
  const t = tally(answers);
  const maj = majority(t);
  return { points: Object.fromEntries(ids.map(id => [id, roundPoints(answers[id], maj)])), maj, ...t };
}

/**
 * Fun facts for the end: the question the room agreed on most and the one that split it most.
 * Rounds nobody answered are skipped; null when there is nothing to show.
 */
export function funStats(rounds: RoundTally[]): { agreed: RoundTally; split: RoundTally } | null {
  const played = rounds.filter(r => r.a + r.b > 0);
  if (played.length === 0) return null;
  const gap = (r: RoundTally) => Math.abs(r.a - r.b) / (r.a + r.b);
  let agreed = played[0];
  let split = played[0];
  for (const r of played) {
    if (gap(r) > gap(agreed)) agreed = r;
    if (gap(r) < gap(split)) split = r;
  }
  // All rounds equally split: still show two different questions.
  if (split === agreed && played.length > 1) split = played[played.length - 1];
  return { agreed, split };
}
