// Rock Paper Scissors Showdown (pure). Everyone picks at once; each player scores 1 point for
// every other player they beat that round (round-robin), so in a big room the rare pick wins.
export type Rps = 0 | 1 | 2; // ✊ rock, ✋ paper, ✌️ scissors
export const RPS_EMOJI = ['✊', '✋', '✌️'] as const;
export const RPS_NAME = ['Rock', 'Paper', 'Scissors'] as const;
export const ROUNDS = 5;
export const PICK_MS = 10_000;

/** Does a beat b? Rock beats scissors, paper beats rock, scissors beat paper. */
export const beats = (a: Rps, b: Rps) => (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1);

/** Points this round for every player who picked. */
export function roundPoints(picks: Record<string, Rps>): Record<string, number> {
  const ids = Object.keys(picks);
  const out: Record<string, number> = {};
  for (const a of ids) out[a] = ids.reduce((n, b) => n + (b !== a && beats(picks[a], picks[b]) ? 1 : 0), 0);
  return out;
}

/** How many players picked each sign: [rock, paper, scissors]. */
export function counts(picks: Record<string, Rps>): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const p of Object.values(picks)) c[p]++;
  return c;
}

export const isRps = (v: unknown): v is Rps => v === 0 || v === 1 || v === 2;
