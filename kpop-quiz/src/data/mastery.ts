// Mastery stars: 1–3 ⭐ per solo game, from the best score (no extra save data — existing best
// scores light up straight away). Thresholds are in each game's own finishRound units (see the
// score notes in each game's code). 2★ is about the daily-challenge target, 3★ is reachable in one
// great round and never above the game's maximum. These are first guesses: tune them after
// watching her play. A new solo game needs an entry here (data/mastery.test.ts checks).
import type { GameState } from '../store';

export interface Mastery {
  /** Scores for 1★, 2★ and 3★. */
  stars: [number, number, number];
  /** Highest score one round can give, when the game has one. */
  max?: number;
}

/** Keyed by the gameId passed to GameShell — for these games it is also the screen's GameState. */
export const MASTERY: Partial<Record<GameState, Mastery>> = {
  paper_clash: { stars: [50, 100, 150], max: 1000 },
  snake_arena: { stars: [30, 60, 120] },
  tower_defense: { stars: [500, 1000, 1500], max: 1809 },
  kpop_rush: { stars: [500, 1500, 3000] },
  ninja_slice: { stars: [100, 250, 600] },
  rocket_launch: { stars: [300, 500, 650], max: 800 },
  // A win scores HP left × 10, a loss 0 — so 1★ is any win.
  battle_arena: { stars: [10, 200, 450], max: 1100 },
  game_2048: { stars: [1000, 2000, 5000] },
  block_blast: { stars: [200, 500, 1000] },
  // Easy tops out at 300: 3★ needs Medium or Hard.
  mini_sudoku: { stars: [100, 250, 450], max: 700 },
  // Easy tops out at 300: 3★ needs a harder level.
  zip_game: { stars: [100, 250, 500], max: 900 },
  word_ladder: { stars: [40, 80, 100], max: 100 },
  crossword_mini: { stars: [400, 600, 800], max: 1000 },
  word_scramble: { stars: [600, 1200, 1800], max: 2650 },
  pattern_memory: { stars: [4, 8, 12], max: 20 },
  memory_speed: { stars: [150, 300, 500], max: 1290 },
  sparkle_match: { stars: [400, 800, 1300] },
  quiz_arena: { stars: [3000, 6000, 9000], max: 16500 },
  real_or_fake: { stars: [3, 7, 10], max: 15 },
  emoji_guess: { stars: [5, 8, 10], max: 10 },
  guess_intro: { stars: [2, 4, 5], max: 5 },
};

export const MASTERY_IDS = Object.keys(MASTERY) as GameState[];

/** 0–3 stars for a best score (0 for games without mastery stars). */
export function starsFor(gameId: string, best: number): number {
  const m = MASTERY[gameId as GameState];
  if (!m || !(best > 0)) return 0;
  return m.stars.filter(t => best >= t).length;
}

/** Score needed for the next star, or null at 3★ (or for games without stars). */
export function nextStarAt(gameId: string, best: number): number | null {
  const m = MASTERY[gameId as GameState];
  if (!m) return null;
  return m.stars[starsFor(gameId, best)] ?? null;
}

/** Score of the star already earned (0 before the first) — the start of the progress bar. */
export function prevStarAt(gameId: string, best: number): number {
  const m = MASTERY[gameId as GameState];
  const n = starsFor(gameId, best);
  return m && n > 0 ? m.stars[n - 1] : 0;
}

export function totalStars(highScores: Record<string, number>): { have: number; of: number } {
  return {
    have: MASTERY_IDS.reduce((n, id) => n + starsFor(id, highScores[id] ?? 0), 0),
    of: MASTERY_IDS.length * 3,
  };
}

/** "⭐⭐☆" */
export const starString = (n: number) => '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
