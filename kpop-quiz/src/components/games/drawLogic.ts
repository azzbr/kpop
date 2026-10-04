// Shared "deal a round" helper for the content games (Would You Rather, Real or Fake, Emoji Guess).
import type { Rng } from '../../games/engine/rng';

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks `n` distinct indices out of `size`, preferring ones not in `seen` (items shown in earlier
 * rounds this session). `seen` is updated; when nearly everything has been seen it starts over.
 */
export function drawFresh(size: number, n: number, seen: Set<number>, rng: Rng): number[] {
  const count = Math.min(n, size);
  let fresh = [...Array(size).keys()].filter(i => !seen.has(i));
  if (fresh.length < count) {
    seen.clear();
    fresh = [...Array(size).keys()];
  }
  const picked = shuffle(fresh, rng).slice(0, count);
  for (const i of picked) seen.add(i);
  return picked;
}
