// Star Grab (pure): musical chairs with stars. While the music plays everyone dances; when it
// stops there is one star fewer than players. Each device measures its own reaction time from
// the moment it showed the stars, so the fastest finger wins whatever the network lag.
import { createRng, randInt } from '../../games/engine/rng';
import { rankByScore } from '../../online/helloGate';

export const MUSIC_MIN_MS = 4000;
export const MUSIC_MAX_MS = 12000;
export const GRAB_MS = 3000;
/** Extra time the host waits after the grab window for taps still on the way. */
export const GRACE_MS = 600;
export const OOPS_MS = 1000;
export const REVEAL_MS = 3200;
/** Each device may send this many taps per round (a second try if the first star was taken). */
export const MAX_TAPS = 2;

export interface Tap { id: string; star: number; reactMs: number }
export interface StarPos { x: number; y: number } // centre, % of the play field

/** Random music length for a round. */
export const musicMs = (rng: () => number) => randInt(rng, MUSIC_MIN_MS, MUSIC_MAX_MS);

/**
 * Star positions for a round — the same on every device for the same seed. Stars go in shuffled
 * cells of a grid (one star per cell, jittered inside it), so they never overlap.
 */
export function starLayout(seed: number, count: number): StarPos[] {
  if (count <= 0) return [];
  const rng = createRng(seed);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
  const rows = Math.ceil(count / cols);
  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const cw = 80 / cols;
  const ch = 80 / rows;
  return cells.slice(0, count).map(c => {
    const col = c % cols;
    const row = Math.floor(c / cols);
    // Jitter within the middle 40% of the cell so neighbours keep a gap.
    return {
      x: 10 + cw * (col + 0.3 + rng() * 0.4),
      y: 10 + ch * (row + 0.3 + rng() * 0.4),
    };
  });
}

/**
 * Who gets which star. Taps are taken fastest reactMs first (ties by id, so the order they
 * arrived in never matters). A player gets the first star they tapped that is still free and
 * keeps at most one star. Alive players left without a star are out.
 */
export function awardStars(taps: Tap[], stars: number, alive: string[]): { owner: Record<number, string>; out: string[] } {
  const owner: Record<number, string> = {};
  const has = new Set<string>();
  const sorted = taps
    .filter(t => alive.includes(t.id) && Number.isInteger(t.star) && t.star >= 0 && t.star < stars)
    .sort((a, b) => a.reactMs - b.reactMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const t of sorted) {
    if (has.has(t.id) || owner[t.star] !== undefined) continue;
    owner[t.star] = t.id;
    has.add(t.id);
  }
  return { owner, out: alive.filter(id => !has.has(id)) };
}

/**
 * Final ranking, best first: the winner(s) still in, then everyone else by the round they went
 * out (later is better). Players who went out in the same round share a place.
 * `outRound` holds the round each player went out; players without one are still in.
 */
export function starRanking(outRound: Record<string, number>, ids: string[]): (string | string[])[] {
  const last = Math.max(0, ...Object.values(outRound));
  const survived: Record<string, number> = {};
  for (const id of ids) survived[id] = outRound[id] ?? last + 1;
  return rankByScore(survived, ids);
}

/** Rounds each player lasted (shown as the score on the final card). */
export function roundsLasted(outRound: Record<string, number>, ids: string[], round: number): Record<string, number> {
  return Object.fromEntries(ids.map(id => [id, outRound[id] !== undefined ? outRound[id] - 1 : round]));
}

/** A cheerful major-key arpeggio loop: [frequency Hz, beats]. */
export const DANCE_TUNE: [number, number][] = [
  [523, 1], [659, 1], [784, 1], [659, 1], [587, 1], [698, 1], [880, 1], [698, 1],
  [523, 1], [659, 1], [784, 1], [1047, 1], [988, 1], [784, 1], [659, 2],
];
