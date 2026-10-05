// Penalty Duel rules (pure): 5 kicks each, taking turns, then sudden death.

export const KICKS = 10; // regulation: 5 each
export const PER_SIDE = KICKS / 2;
/** Sudden death can't go on for ever: after this many kicks a level score is a draw. */
export const MAX_KICKS = 24;
export const PICK_MS = 9000;
export const DIRS = 3; // left, middle, right

/** Kick n (1-based): the first player shoots odd kicks, the second even ones. */
export const shooterFor = (n: number, ids: string[]) => ids[(n - 1) % 2];
export const keeperFor = (n: number, ids: string[]) => ids[n % 2];

export const isGoal = (shot: number, dive: number) => shot !== dive;

export const validDir = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) < DIRS;

/**
 * After kick n, the result: a winner's id, 'draw' (only at MAX_KICKS), or null (keep going).
 * Ends early when one side can't catch up with the kicks it has left.
 */
export function shootoutResult(n: number, scores: Record<string, number>, ids: string[]): string | 'draw' | null {
  const [a, b] = ids;
  const sa = scores[a] ?? 0;
  const sb = scores[b] ?? 0;
  if (n <= KICKS) {
    const leftA = PER_SIDE - Math.ceil(n / 2);
    const leftB = PER_SIDE - Math.floor(n / 2);
    if (sa > sb + leftB) return a;
    if (sb > sa + leftA) return b;
    return null; // at n = KICKS with level scores: sudden death
  }
  if (n % 2 !== 0) return null; // sudden death: both shoot before it's decided
  if (sa !== sb) return sa > sb ? a : b;
  return n >= MAX_KICKS ? 'draw' : null;
}

export const penaltyRanking = (result: string, ids: string[]): (string | string[])[] =>
  result === 'draw' ? [[...ids]] : [result, ...ids.filter(id => id !== result)];
