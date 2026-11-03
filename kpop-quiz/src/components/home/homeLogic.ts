// Home screen rules, no React: the "Jump back in" list, favourites, and the 🎲 Surprise Me pick.
import type { GameState } from '../../store';
import { MASTERY, starsFor } from '../../data/mastery';

export const MAX_RECENT = 6;
export const MAX_FAVOURITES = 20;

/** Newest first, no duplicates, at most `max`. */
export function pushRecent(list: GameState[], id: GameState, max = MAX_RECENT): GameState[] {
  return [id, ...list.filter(x => x !== id)].slice(0, max);
}

/** Removes `id` if it is there, otherwise adds it at the end (unless the list is full). */
export function toggleIn(list: GameState[], id: GameState, max = MAX_FAVOURITES): GameState[] {
  if (list.includes(id)) return list.filter(x => x !== id);
  return list.length >= max ? list : [...list, id];
}

/**
 * 🎲 Surprise Me: any visible game can come up, but games with 0–1★ that she hasn't opened lately
 * are three times as likely — a nudge towards games she hasn't tried or mastered yet.
 */
export function pickSurpriseGame(
  visible: GameState[],
  highScores: Record<string, number>,
  recent: GameState[],
  rng: () => number = Math.random,
): GameState | null {
  if (visible.length === 0) return null;
  const weights = visible.map(id => (id in MASTERY && starsFor(id, highScores[id] ?? 0) <= 1 && !recent.includes(id) ? 3 : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < visible.length; i++) {
    r -= weights[i];
    if (r < 0) return visible[i];
  }
  return visible[visible.length - 1];
}
