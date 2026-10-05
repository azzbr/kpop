// Copy Cat rules (pure): Simon-says with knock-outs.

export const PAD_COUNT = 4;
export const MAX_ROUNDS = 12;
/** Each pad lights for STEP_MS, then a gap of STEP_MS. */
export const STEP_MS = 320;
/** How long the sequence takes to play on a device. */
export const showTime = (len: number) => len * 2 * STEP_MS;
/** Answer window, counted from when THIS device finished showing the sequence. */
export const inputTime = (len: number) => 4000 + len * 1000;
/** Extra time the host waits for messages in flight. */
export const NET_GRACE_MS = 1500;
/** A device that never says it's ready is treated as ready this long after the sequence was sent. */
export const READY_WAIT_MS = 5000;

export const extendSeq = (seq: number[], rand: () => number = Math.random) => [...seq, Math.floor(rand() * PAD_COUNT)];

export const isCorrect = (input: number[] | undefined, seq: number[]) =>
  !!input && input.length === seq.length && input.every((v, i) => v === seq[i]);

/** Who survives this round. */
export function judgeRound(alive: string[], inputs: Record<string, number[]>, seq: number[]) {
  const out = alive.filter(id => !isCorrect(inputs[id], seq));
  return { out, alive: alive.filter(id => !out.includes(id)) };
}

/** The game ends with one (or no) survivor left, or after MAX_ROUNDS. */
export const isOver = (alive: number, round: number) => alive <= 1 || round >= MAX_ROUNDS;

/** Winners: the survivors — or, if the last ones were all knocked out together, all of them. */
export const finalists = (alive: string[], lastOut: string[]) => (alive.length > 0 ? alive : lastOut);

/**
 * Final ranking: winners first, then everyone else by the round they were knocked out in
 * (later = better). Players knocked out in the same round share a place.
 */
export function copyCatRanking(winners: string[], outRound: Record<string, number>): (string | string[])[] {
  const rest = Object.keys(outRound).filter(id => !winners.includes(id));
  const rounds = [...new Set(rest.map(id => outRound[id]))].sort((a, b) => b - a);
  const rung = (ids: string[]) => (ids.length === 1 ? ids[0] : ids);
  return [rung(winners), ...rounds.map(r => rung(rest.filter(id => outRound[id] === r)))].filter(r => r.length > 0);
}

/** The host's backstop for a round: the latest device's own answer window, plus grace. */
export const answerDeadline = (readyAt: number[], len: number) => Math.max(...readyAt) + inputTime(len) + NET_GRACE_MS;
