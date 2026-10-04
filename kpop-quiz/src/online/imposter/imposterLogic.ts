// Imposter rules — pure functions, no React or networking, so they can be unit-tested.
// The host device runs these and broadcasts the public results.

import type { Rng } from '../../games/engine/rng';
import { isClean } from '../../utils/cleanText';
import { matchTyped, normaliseAnswer } from '../quiz/quizLogic';
import { IMPOSTER_WORDS } from './words';
import type { ImposterCategory } from './words';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_CLUE = 16;
export const VOTE_MS = 30_000;
export const GUESS_MS = 15_000;
export const GUESS_OPTIONS = 6;

export const POINTS = {
  /** Each crew member whose vote was on the imposter. */
  crewCorrectVote: 2,
  /** Imposter not caught by the vote. */
  imposterEscaped: 3,
  /** Imposter caught, but picked the secret word. */
  imposterGuessed: 3,
} as const;

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ roles

/**
 * Picks exactly one imposter. `history` is the imposter of each earlier round (oldest first).
 * Nobody is the imposter three rounds running if anyone else can be.
 */
export function pickImposter(ids: readonly string[], history: readonly string[], rng: Rng): string {
  if (ids.length === 0) throw new Error('no players');
  const n = history.length;
  const streak = n >= 2 && history[n - 1] === history[n - 2] ? history[n - 1] : null;
  const pool = streak && ids.length > 1 ? ids.filter(id => id !== streak) : [...ids];
  const usable = pool.length ? pool : [...ids];
  return usable[Math.floor(rng() * usable.length)];
}

/** Private role per player: the word for the crew, null for the imposter. */
export function assignRoles(ids: readonly string[], imposterId: string, word: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const id of ids) out[id] = id === imposterId ? null : word;
  return out;
}

/** A word from the category not used yet this game (starts over if they've all been used). */
export function pickWord(category: ImposterCategory, used: readonly string[], rng: Rng): string {
  const all = IMPOSTER_WORDS[category];
  const fresh = all.filter(w => !used.includes(w));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Clue order: a shuffled order, repeated for each lap. The imposter never goes first when
 * there's anyone else (going first with no clues to copy is unfair).
 */
export function turnOrder(ids: readonly string[], imposterId: string, laps: number, rng: Rng): string[] {
  const order = shuffle(ids, rng);
  if (order.length > 1 && order[0] === imposterId) {
    const swap = 1 + Math.floor(rng() * (order.length - 1));
    [order[0], order[swap]] = [order[swap], order[0]];
  }
  const out: string[] = [];
  for (let l = 0; l < Math.max(1, laps); l++) out.push(...order);
  return out;
}

/** 6 options for the imposter's last-chance guess: the word plus 5 others from the category. */
export function guessOptions(word: string, category: ImposterCategory, rng: Rng, n = GUESS_OPTIONS): string[] {
  const others = shuffle(IMPOSTER_WORDS[category].filter(w => w !== word), rng).slice(0, n - 1);
  return shuffle([word, ...others], rng);
}

// ------------------------------------------------------------------ clues

export type ClueCheck = { ok: true; clue: string } | { ok: false; reason: string };

/**
 * Checks one typed clue. `secret` is the word (null for the imposter, who can't be told it
 * — telling them "too close to the word" would give it away).
 */
export function validateClue(raw: string, secret: string | null, earlier: readonly string[] = []): ClueCheck {
  const clue = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!clue) return { ok: false, reason: 'Type a clue word first!' };
  if (clue.length > MAX_CLUE) return { ok: false, reason: `Keep it short — ${MAX_CLUE} letters max.` };
  if (!/^[A-Z]+$/.test(clue)) return { ok: false, reason: 'Just one word — letters only.' };
  if (!isClean(clue)) return { ok: false, reason: "Let's pick a friendlier word 🙂" };
  if (earlier.some(e => normaliseAnswer(e) === normaliseAnswer(clue))) return { ok: false, reason: 'Someone already said that — try another!' };
  if (secret && tooClose(clue, secret)) return { ok: false, reason: "That's too close to the secret word! 🤫" };
  return { ok: true, clue };
}

/** The clue is the word, a near-typo of it, contains it, or is an obvious chunk of it. */
export function tooClose(clue: string, secret: string): boolean {
  const c = normaliseAnswer(clue).replace(/ /g, '');
  const parts = normaliseAnswer(secret).split(' ').filter(Boolean);
  const whole = parts.join('');
  if (!c) return false;
  if (matchTyped(clue, [secret, ...parts])) return true;
  if (c.includes(whole)) return true;
  for (const p of parts) {
    if (p.length >= 3 && c.includes(p)) return true; // "SNOWDRAGON" for Dragon
    if (c.length >= 4 && p.includes(c)) return true; // "CAKE" for Cupcake
    // Plurals / simple endings: "PENGUINS", "BAKING"
    if (p.length >= 4 && c.length >= 4 && c.slice(0, 4) === p.slice(0, 4) && Math.abs(c.length - p.length) <= 3) return true;
  }
  return false;
}

// ------------------------------------------------------------------ votes

export interface Tally {
  counts: Record<string, number>;
  /** Everyone with the most votes. */
  top: string[];
  /** The imposter has strictly more votes than anyone else. A tie means the imposter escapes. */
  caught: boolean;
}

export function tallyVotes(votes: Record<string, string>, imposterId: string): Tally {
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!target || voter === target) continue; // can't vote for yourself
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const top = max > 0 ? Object.keys(counts).filter(id => counts[id] === max) : [];
  return { counts, top, caught: top.length === 1 && top[0] === imposterId };
}

/** Is this a valid vote? Only players in the round, not yourself. */
export function canVote(voter: string, target: string, roundIds: readonly string[]): boolean {
  return voter !== target && roundIds.includes(voter) && roundIds.includes(target);
}

// ------------------------------------------------------------------ scoring

export interface RoundOutcome {
  roundIds: readonly string[];
  imposterId: string;
  votes: Record<string, string>;
  caught: boolean;
  /** Only matters when caught: did the imposter pick the right word? */
  guessedRight: boolean;
}

/** Points each player earns this round. */
export function scoreRound(o: RoundOutcome): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of o.roundIds) out[id] = 0;
  for (const id of o.roundIds) {
    if (id !== o.imposterId && o.votes[id] === o.imposterId) out[id] += POINTS.crewCorrectVote;
  }
  if (!o.caught) out[o.imposterId] = (out[o.imposterId] ?? 0) + POINTS.imposterEscaped;
  else if (o.guessedRight) out[o.imposterId] = (out[o.imposterId] ?? 0) + POINTS.imposterGuessed;
  return out;
}

/** Who "won" the round, for the reveal banner. */
export function roundWinner(caught: boolean, guessedRight: boolean): 'crew' | 'imposter' {
  return !caught || guessedRight ? 'imposter' : 'crew';
}

export interface ScoredPlayer { id: string; name: string; score: number; joinedAt?: number }

/** Best first; ties keep the earlier joiner ahead. */
export function rankPlayers<T extends ScoredPlayer>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
}
