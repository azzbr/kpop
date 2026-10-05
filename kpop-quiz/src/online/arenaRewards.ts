// One reward rule for every Friends Arena game (Quiz Party and Imposter have their own).
// Call finishArenaGame once per device when a game ends, with the final ranking (best first).
// The host also reports the ranking to the lobby's "Tonight's leaderboard".
import { useGameStore } from '../store';
import type { RoundResult } from '../store';
import type { RoomApi } from './useRoom';

/** Score key in finishRound: every Arena game shares it (badges: arena_first / arena_win / arena_10). */
export const ARENA_ID = 'friends_arena';
/** Points per 1 XP: a win (100) gives 40 XP, the middle of the pack about 20. */
export const ARENA_XP_SCALE = 2.5;

/**
 * Placement score out of 100: 1st = 100, last = 20, evenly spaced between. Ties share a place
 * when `ranked` is an array of arrays (players on the same rung). Players missing from the
 * ranking (joined late, left) get the last-place score — they still played.
 */
export function placeScore(ranked: (string | string[])[], myId: string): number {
  const rungs = ranked.map(r => (Array.isArray(r) ? r : [r]));
  const n = rungs.length;
  const idx = rungs.findIndex(r => r.includes(myId));
  if (n <= 1) return idx === 0 ? 100 : 20;
  if (idx < 0) return 20;
  return Math.round(100 - (idx / (n - 1)) * 80);
}

/** Flat best-first ids from a ranking that may contain tied rungs. */
export const flatRanking = (ranked: (string | string[])[]) => ranked.flatMap(r => (Array.isArray(r) ? r : [r]));

/** Rewards this device's player and (on the host) feeds the session leaderboard. Returns the reward. */
export function finishArenaGame(room: Pick<RoomApi, 'isHost' | 'myId' | 'reportResult'>, ranked: (string | string[])[]): RoundResult {
  if (room.isHost) room.reportResult(flatRanking(ranked));
  return useGameStore.getState().finishRound(ARENA_ID, placeScore(ranked, room.myId), ARENA_XP_SCALE);
}
