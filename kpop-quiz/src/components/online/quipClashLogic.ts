// Quip Clash rules (pure). Each round, players are put into matchups (pairs, plus one trio when
// the count is odd; with 3 players everyone answers two prompts). Both/all authors answer the
// same prompt; everyone else votes for the funniest answer.
//   +100 per vote (round 3 counts double)
//   QUIPLASH! +200 bonus when one answer gets every vote (at least 2 votes, nobody timed out)
import { isRude } from '../../online/rudeWords';
import { QUIP_PROMPTS } from '../../online/quipPrompts';

export const ROUNDS = 3;
export const WRITE_MS = 45_000;
/** With 3 players everyone answers two prompts, so they get a little longer. */
export const WRITE_TWO_MS = 60_000;
export const VOTE_MS = 15_000;
export const RESULT_MS = 6500;
export const SCORES_MS = 6000;
export const MAX_QUIP = 40;
export const VOTE_POINTS = 100;
export const QUIPLASH_BONUS = 200;
export const TIMEOUT_TEXT = '(ran out of time!)';
export const HIDDEN_TEXT = '(a secret silly answer 🤐)';

/** The last round counts double. */
export const roundMult = (round: number) => (round >= ROUNDS ? 2 : 1);

export interface Matchup { prompt: string; authors: string[] }

type Rng = () => number;

function shuffle<T>(a: T[], rng: Rng): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Author groups for one round (no prompts yet): pairs + a trio for odd counts, 3 players → A+B, B+C, C+A. */
export function makeGroups(ids: string[], rng: Rng = Math.random, met: ReadonlySet<string> = new Set()): string[][] {
  if (ids.length <= 2) return [shuffle(ids, rng)];
  if (ids.length === 3) {
    const [a, b, c] = shuffle(ids, rng);
    return [[a, b], [b, c], [c, a]];
  }
  let best: string[][] = [];
  let bestRepeats = Infinity;
  for (let tries = 0; tries < 40 && bestRepeats > 0; tries++) {
    const order = shuffle(ids, rng);
    const groups: string[][] = [];
    for (let i = 0; i + 1 < order.length; i += 2) groups.push([order[i], order[i + 1]]);
    if (order.length % 2) groups[groups.length - 1].push(order[order.length - 1]);
    let repeats = 0;
    for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (met.has(pairKey(g[i], g[j]))) repeats++;
    if (repeats < bestRepeats) { best = groups; bestRepeats = repeats; }
  }
  return best;
}

/** Matchups for one round, each with a different prompt. */
export function makeMatchups(ids: string[], prompts: string[], rng: Rng = Math.random, met: ReadonlySet<string> = new Set()): Matchup[] {
  return makeGroups(ids, rng, met).map((authors, i) => ({ prompt: prompts[i % prompts.length], authors }));
}

/** Matchup indexes each player answers this round. */
export function tasksOf(matchups: Matchup[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  matchups.forEach((m, i) => { for (const a of m.authors) (out[a] ??= []).push(i); });
  return out;
}

/** Everyone answers the same number of prompts each round. */
export const answersEach = (matchups: Matchup[]) => {
  const counts = Object.values(tasksOf(matchups)).map(t => t.length);
  return counts.length && counts.every(c => c === counts[0]) ? counts[0] : -1;
};

export const answerKey = (matchup: number, author: string) => `${matchup}:${author}`;

/** Single spaces, trimmed, at most MAX_QUIP characters. */
export const tidyQuip = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_QUIP);

export type QuipCheck = 'empty' | 'unkind' | 'ok';
export function checkQuip(text: string): QuipCheck {
  const t = tidyQuip(text);
  if (!/[a-z0-9]/i.test(t)) return 'empty';
  if (isRude(t)) return 'unkind';
  return 'ok';
}

/** What everyone sees for an answer: the time-out text, a friendly stand-in, or the answer. */
export function shownQuip(raw: string | undefined): string {
  if (raw === undefined) return TIMEOUT_TEXT;
  return checkQuip(raw) === 'ok' ? tidyQuip(raw) : HIDDEN_TEXT;
}

export interface MatchupResult {
  /** Votes per author. */
  counts: Record<string, number>;
  points: Record<string, number>;
  /** The author who got every vote, if it's a QUIPLASH. */
  quiplash: string | null;
}

/**
 * Scores one matchup. `votes` maps voter → author voted for (authors' own votes are ignored).
 * `timedOut` lists authors who didn't answer (no QUIPLASH against a time-out).
 */
export function scoreMatchup(authors: string[], votes: Record<string, string>, mult: number, timedOut: string[] = []): MatchupResult {
  const counts: Record<string, number> = Object.fromEntries(authors.map(a => [a, 0]));
  let total = 0;
  for (const [voter, pick] of Object.entries(votes)) {
    if (authors.includes(voter) || !authors.includes(pick)) continue;
    counts[pick]++;
    total++;
  }
  const points: Record<string, number> = {};
  for (const a of authors) points[a] = counts[a] * VOTE_POINTS * mult;
  let quiplash: string | null = null;
  if (total >= 2 && timedOut.length === 0) {
    const winner = authors.find(a => counts[a] === total);
    if (winner) { quiplash = winner; points[winner] += QUIPLASH_BONUS * mult; }
  }
  return { counts, points, quiplash };
}

/** Prompts for the whole game, all different. */
export function pickQuipPrompts(n: number, rng: Rng = Math.random, pool: string[] = QUIP_PROMPTS): string[] {
  return shuffle(pool, rng).slice(0, n);
}
