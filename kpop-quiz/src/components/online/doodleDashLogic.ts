// Doodle Dash rules (pure — no React, no canvas).
import type { DrawPt } from './DrawCanvas';
import { rankByScore } from '../../online/helloGate';

export const ROUND_MS = 75000;
export const MAX_DRAWERS = 6;
export const DRAWER_BONUS = 25;
export const MAX_GUESS = 24;

/** Letters only, lower case: "Ice Cream!" and "icecream" match. */
export const normalizeGuess = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export const isRightGuess = (guess: string, word: string) => {
  const g = normalizeGuess(guess);
  return g.length > 0 && g === normalizeGuess(word);
};

/** 100 for a right guess plus up to 100 more for speed. */
export const guessPoints = (msLeftInRound: number, roundMs = ROUND_MS) =>
  100 + Math.round((100 * Math.max(0, Math.min(roundMs, msLeftInRound))) / roundMs);

/** Letter counts per word, so guessers see "_ _ _   _ _ _ _ _" without the word itself. */
export const wordShape = (word: string) => word.trim().split(/\s+/).map(w => w.length);

/** Who draws, in order: everyone once (up to MAX_DRAWERS), shuffled. */
export function drawOrder(ids: string[], rand: () => number = Math.random): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, MAX_DRAWERS);
}

export interface StrokeBatch { pts: DrawPt[]; c: string; w: number }

/** Keeps the picture so far (for devices that arrive late); trims the oldest batches if huge. */
export function addBatch(log: StrokeBatch[], b: StrokeBatch, maxPts = 6000): StrokeBatch[] {
  const next = [...log, b];
  let total = next.reduce((n, x) => n + x.pts.length, 0);
  while (total > maxPts && next.length > 1) total -= next.shift()!.pts.length;
  return next;
}

/** Everyone who played, best score first; equal scores share a place. */
export const doodleRanking = (scores: Record<string, number>, ids: string[]) => rankByScore(scores, ids);

/** The round ends early once every guesser (still in the room) has it. */
export const allGuessed = (guesserIds: string[], correct: Record<string, boolean>) =>
  guesserIds.length > 0 && guesserIds.every(id => correct[id]);
