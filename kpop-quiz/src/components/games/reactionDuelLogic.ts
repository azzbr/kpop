// Reaction Duel (2 players, one iPad) — pure round rules, no React.

export const ROUNDS = 10;
/** After the first good tap, the other player has this long to tap too (so both times show). */
export const SECOND_TAP_MS = 600;
/** Nobody tapped: the round ends without a point. */
export const GO_TIMEOUT_MS = 2500;

export interface Tap { player: 0 | 1; at: number }

export type RoundOutcome =
  | { kind: 'early'; player: 0 | 1; point: 0 | 1 }       // tapped before the signal; the other player scores
  | { kind: 'win'; player: 0 | 1; times: [number | null, number | null] }
  | { kind: 'none' };

/**
 * Decides a round from every tap (in order) and the time the signal appeared (null = it hasn't yet).
 * A tap before the signal is a false start. Otherwise the first tap after the signal wins; each
 * player's reaction time is from their first tap after the signal.
 */
export function judgeRound(taps: Tap[], goAt: number | null): RoundOutcome {
  if (!taps.length) return { kind: 'none' };
  const first = taps[0];
  if (goAt === null || first.at < goAt) return { kind: 'early', player: first.player, point: first.player === 0 ? 1 : 0 };
  const times: [number | null, number | null] = [null, null];
  for (const t of taps) if (t.at >= goAt && times[t.player] === null) times[t.player] = Math.round(t.at - goAt);
  return { kind: 'win', player: first.player, times };
}

/** Adds a round's point to the scores. */
export function addPoint(scores: [number, number], o: RoundOutcome): [number, number] {
  const p = o.kind === 'early' ? o.point : o.kind === 'win' ? o.player : null;
  if (p === null) return scores;
  return p === 0 ? [scores[0] + 1, scores[1]] : [scores[0], scores[1] + 1];
}

/** Score saved for the game: the winner's points out of ROUNDS. */
export const duelScore = (scores: [number, number]) => Math.max(scores[0], scores[1]);

/** A random wait before the signal, 1.5–4.5 s. */
export const waitMs = (r: number) => 1500 + r * 3000;
