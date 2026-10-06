// Pure rules for PuzzleRace: everyone gets the same puzzle each round and races to solve it.
// The host keeps a RaceState, scores each round with scoreRound and ranks the totals with
// standings. No React, no network — see components/online/PuzzleRace.tsx for the sync.

/** One player's live state in the current round (reported by their device, checked by the host). */
export interface LiveEntry {
  /** Progress 0..1 (as the device reports it). */
  p: number;
  /** Lives left, for games that have them. */
  lives?: number;
  /** Time from round start to a solve the host has checked, in ms. */
  solvedMs?: number;
  /** Out of lives / gave up — done for this round without solving it. */
  failed?: boolean;
}

export interface RoundScore {
  id: string;
  /** 1-based place among solvers (tied solvers share it); null when they didn't solve it. */
  place: number | null;
  /** Solve time in ms (null when not solved). */
  ms: number | null;
  points: number;
  p: number;
  failed: boolean;
}

/** Solve times are compared in tenths of a second, the precision we show — closer than that is a tie. */
export const TIE_MS = 100;
/** Points for 1st place, minus 10 per place, never below PLACE_MIN. */
export const PLACE_TOP = 100;
export const PLACE_MIN = 50;
/** Up to this many extra points for solving early in the round. */
export const SPEED_BONUS = 50;
/** A non-solver gets up to this many points for how far they got (always less than any solver). */
export const PROGRESS_POINTS = 40;

export const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

const tick = (ms: number) => Math.round(Math.max(0, ms) / TIE_MS);

export function placePoints(place: number): number {
  return Math.max(PLACE_MIN, PLACE_TOP - 10 * (place - 1));
}

export function speedPoints(ms: number, roundMs: number): number {
  if (roundMs <= 0) return 0;
  return Math.round(SPEED_BONUS * clamp01(1 - (tick(ms) * TIE_MS) / roundMs));
}

/**
 * Scores a finished round for `ids`. Solvers are placed by time (1st gets the most points;
 * players within the same tenth of a second share the place and the points). Everyone else
 * gets a few points for their progress, always fewer than the slowest solver.
 * Best first.
 */
export function scoreRound(live: Record<string, LiveEntry>, ids: string[], roundMs: number): RoundScore[] {
  const uniq = [...new Set(ids)];
  const solverTicks = uniq
    .map(id => live[id]?.solvedMs)
    .filter((ms): ms is number => typeof ms === 'number')
    .map(tick);
  const out = uniq.map((id): RoundScore => {
    const e = live[id];
    const p = clamp01(e?.p ?? 0);
    if (e && typeof e.solvedMs === 'number') {
      const t = tick(e.solvedMs);
      const place = 1 + solverTicks.filter(x => x < t).length;
      return { id, place, ms: e.solvedMs, points: placePoints(place) + speedPoints(e.solvedMs, roundMs), p: 1, failed: false };
    }
    return { id, place: null, ms: null, points: Math.round(PROGRESS_POINTS * p), p, failed: !!e?.failed };
  });
  return out.sort((a, b) => {
    if (a.place !== null && b.place !== null) return a.place - b.place || (a.id < b.id ? -1 : 1);
    if (a.place !== null) return -1;
    if (b.place !== null) return 1;
    return b.points - a.points || (a.id < b.id ? -1 : 1);
  });
}

export function addTotals(totals: Record<string, number>, scores: RoundScore[]): Record<string, number> {
  const next = { ...totals };
  for (const s of scores) next[s.id] = (next[s.id] ?? 0) + s.points;
  return next;
}

/**
 * Ranking best first, as rungs: players with the same total share a rung (a fair tie).
 * Everyone in `ids` is included (0 points if they have no total yet).
 */
export function standings(totals: Record<string, number>, ids: string[] = []): string[][] {
  const all = [...new Set([...Object.keys(totals), ...ids])];
  const score = (id: string) => totals[id] ?? 0;
  all.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
  const rungs: string[][] = [];
  let last: number | null = null;
  for (const id of all) {
    if (last !== null && score(id) === last) rungs[rungs.length - 1].push(id);
    else rungs.push([id]);
    last = score(id);
  }
  return rungs;
}

/** 1-based place of `id` in a rung ranking (shared by everyone on the rung), or null. */
export function placeOf(ranked: string[][], id: string): number | null {
  let place = 1;
  for (const rung of ranked) {
    if (rung.includes(id)) return place;
    place += rung.length;
  }
  return null;
}

/** The round is over once everyone still playing has solved it or is out. */
export function roundOver(live: Record<string, LiveEntry>, roster: string[]): boolean {
  if (!roster.length) return false;
  return roster.every(id => {
    const e = live[id];
    return !!e && (typeof e.solvedMs === 'number' || !!e.failed);
  });
}

/** A fresh random 31-bit seed (the host picks one per game; rounds use seed + round). */
export const newSeed = () => Math.floor(Math.random() * 0x7fffffff);

/** Seed for one round of a game. */
export const roundSeed = (seed: number, round: number) => (seed + Math.imul(round, 0x9e3779b1)) >>> 0;

/** "12.3s" */
export const fmtSecs = (ms: number) => `${(Math.round(ms / TIE_MS) / 10).toFixed(1)}s`;
