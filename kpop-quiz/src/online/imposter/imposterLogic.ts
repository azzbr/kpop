// Imposter rules — pure functions, no React or networking, so they can be unit-tested.
// The host device runs these and broadcasts the public results.

import type { Rng } from '../../games/engine/rng';
import { isClean } from '../../utils/cleanText';
import { matchTyped, normaliseAnswer } from '../quiz/quizLogic';
import { IMPOSTER_WORDS, UNDERCOVER_PAIRS, EMOJI_CLUES } from './words';
import type { ImposterCategory } from './words';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_CLUE = 16;
/** One clue turn (was 45 s). The last 5 s tick. */
export const TURN_MS = 25_000;
export const VOTE_MS = 30_000;
export const GUESS_MS = 15_000;
export const GUESS_OPTIONS = 6;
/** Drumroll reveal: one vote flips every REVEAL_STEP_MS, then a pause, then the big reveal. */
export const REVEAL_STEP_MS = 700;
export const REVEAL_LEAD_MS = 1200;
export const REVEAL_DRUM_MS = 1600;
export const REVEAL_HOLD_MS = 3800;
/** Doodle clues: one stroke, at most this many points. */
export const MAX_STROKE_PTS = 160;
export const MAX_EMOJI = 2;

export type ImpMode = 'classic' | 'undercover' | 'doodle' | 'emoji';
export type ImpCountSetting = 'auto' | '1' | '2';

export const IMP_MODES: { id: ImpMode; emoji: string; name: string; blurb: string }[] = [
  { id: 'classic', emoji: '🤫', name: 'Classic', blurb: 'The imposter gets no word and has to blend in.' },
  { id: 'undercover', emoji: '🎭', name: 'Undercover', blurb: 'The imposter gets a similar word… and might not even know!' },
  { id: 'doodle', emoji: '✏️', name: 'Doodle clues', blurb: 'Each clue is ONE line on a shared drawing.' },
  { id: 'emoji', emoji: '😀', name: 'Emoji clues', blurb: 'Pick 1–2 emoji as your clue.' },
];
export const modeInfo = (m: ImpMode) => IMP_MODES.find(x => x.id === m) ?? IMP_MODES[0];
export const isMode = (v: unknown): v is ImpMode => IMP_MODES.some(m => m.id === v);

export const POINTS = {
  /** Each crew member whose vote was on an imposter. */
  crewCorrectVote: 2,
  /** An imposter who wasn't voted out. */
  imposterEscaped: 3,
  /** Imposter voted out, but picked the secret word. */
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

/** How many imposters this round: Auto = 2 at 7+ players; "2" needs at least 5 players. */
export function imposterCount(setting: ImpCountSetting | string | undefined, players: number): number {
  if (setting === '1') return 1;
  if (setting === '2') return players >= 5 ? 2 : 1;
  return players >= 7 ? 2 : 1;
}

/**
 * Picks `k` different imposters. `history` is each earlier round's imposters (oldest first).
 * Nobody is an imposter three rounds running if enough other players can be.
 */
export function pickImposters(ids: readonly string[], k: number, history: readonly (readonly string[])[], rng: Rng): string[] {
  if (ids.length === 0) throw new Error('no players');
  const n = history.length;
  const streak = n >= 2 ? history[n - 1].filter(id => history[n - 2].includes(id)) : [];
  const want = Math.max(1, Math.min(k, ids.length));
  const fresh = ids.filter(id => !streak.includes(id));
  const out = shuffle(fresh, rng).slice(0, want);
  if (out.length < want) out.push(...shuffle(ids.filter(id => !out.includes(id)), rng).slice(0, want - out.length));
  return out;
}

/** One imposter (kept for older callers and tests). */
export function pickImposter(ids: readonly string[], history: readonly string[], rng: Rng): string {
  return pickImposters(ids, 1, history.map(h => [h]), rng)[0];
}

/** A player's private card. `imposter` is only true when they're told (not in Undercover). */
export interface Card { word: string | null; imposter: boolean }

/**
 * Everyone's private card. Classic / doodle / emoji: imposters get no word and are told.
 * Undercover: imposters get `impWord` and are NOT told.
 */
export function dealCards(mode: ImpMode, ids: readonly string[], imposterIds: readonly string[], word: string, impWord: string | null): Record<string, Card> {
  const out: Record<string, Card> = {};
  for (const id of ids) {
    const imp = imposterIds.includes(id);
    if (!imp) out[id] = { word, imposter: false };
    else if (mode === 'undercover') out[id] = { word: impWord, imposter: false };
    else out[id] = { word: null, imposter: true };
  }
  return out;
}

/** Old shape: the word for the crew, null for the imposter. */
export function assignRoles(ids: readonly string[], imposterId: string, word: string): Record<string, string | null> {
  const cards = dealCards('classic', ids, [imposterId], word, null);
  return Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.word]));
}

/** A word from the category not used yet this game (starts over if they've all been used). */
export function pickWord(category: ImposterCategory, used: readonly string[], rng: Rng): string {
  const all = IMPOSTER_WORDS[category];
  const fresh = all.filter(w => !used.includes(w));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rng() * pool.length)];
}

/** Undercover: [crew word, imposter word] from a pair not used yet, either way round. */
export function pickPair(used: readonly string[], rng: Rng): [string, string] {
  const fresh = UNDERCOVER_PAIRS.filter(([a, b]) => !used.includes(a) && !used.includes(b));
  const pool = fresh.length ? fresh : UNDERCOVER_PAIRS;
  const [a, b] = pool[Math.floor(rng() * pool.length)];
  return rng() < 0.5 ? [a, b] : [b, a];
}

/**
 * Clue order: a shuffled order, repeated for each lap. An imposter never goes first when
 * there's anyone else (going first with no clues to copy is unfair).
 */
export function turnOrder(ids: readonly string[], imposters: string | readonly string[], laps: number, rng: Rng): string[] {
  const imps = typeof imposters === 'string' ? [imposters] : imposters;
  const order = shuffle(ids, rng);
  const firstCrew = order.findIndex(id => !imps.includes(id));
  if (firstCrew > 0) [order[0], order[firstCrew]] = [order[firstCrew], order[0]];
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
 * Checks one typed clue. `secret` is the player's own word (null for a Classic imposter, who
 * can't be told it — telling them "too close to the word" would give it away).
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

/** 😀 Emoji clue: 1–2 emoji from the grid, not the same as an earlier clue. */
export function validateEmojiClue(picks: unknown, earlier: readonly string[] = []): ClueCheck {
  if (!Array.isArray(picks) || picks.length === 0) return { ok: false, reason: 'Pick an emoji first!' };
  if (picks.length > MAX_EMOJI) return { ok: false, reason: `Up to ${MAX_EMOJI} emoji.` };
  if (!picks.every(p => typeof p === 'string' && EMOJI_CLUES.includes(p))) return { ok: false, reason: 'Pick from the emoji grid.' };
  const clue = (picks as string[]).join('');
  if (earlier.includes(clue)) return { ok: false, reason: 'Someone already sent that — try another!' };
  return { ok: true, clue };
}

/** One point of a stroke: x, y (0..1) and 1 when it starts the stroke (DrawCanvas's DrawPt). */
export type StrokePt = [number, number, number];

/** ✏️ Doodle clue: one stroke of 2+ points in the 0..1 box, trimmed to MAX_STROKE_PTS. */
export function cleanStroke(raw: unknown): StrokePt[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StrokePt[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const r = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    out.push([r(x), r(y), out.length === 0 ? 1 : 0]);
    if (out.length >= MAX_STROKE_PTS) break;
  }
  return out.length >= 2 ? out : null;
}

/** Drop points that barely moved, so a stroke stays small on the wire. */
export function thinStroke(pts: readonly StrokePt[], minStep = 0.006): StrokePt[] {
  const out: StrokePt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minStep) out.push(p);
  }
  if (pts.length > 1 && out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

// ------------------------------------------------------------------ votes

export interface Tally {
  counts: Record<string, number>;
  /** Everyone with the most votes. */
  top: string[];
  /** Voted out: the single player with the most votes (a tie means nobody). */
  out: string | null;
  /** The voted-out player is an imposter. */
  caught: boolean;
}

export function tallyVotes(votes: Record<string, string>, imposters: string | readonly string[]): Tally {
  const imps = typeof imposters === 'string' ? [imposters] : imposters;
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!target || voter === target) continue; // can't vote for yourself
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const top = max > 0 ? Object.keys(counts).filter(id => counts[id] === max) : [];
  const out = top.length === 1 ? top[0] : null;
  return { counts, top, out, caught: !!out && imps.includes(out) };
}

/** Is this a valid vote? Only players in the round, not yourself. */
export function canVote(voter: string, target: string, roundIds: readonly string[]): boolean {
  return voter !== target && roundIds.includes(voter) && roundIds.includes(target);
}

/** The order votes flip over in the drumroll: everyone who voted, imposters' votes mixed in. */
export function revealOrder(votes: Record<string, string>, roundIds: readonly string[]): string[] {
  return roundIds.filter(id => votes[id]);
}

/** How long the host waits on the drumroll reveal for `n` votes. */
export const revealMs = (n: number) => REVEAL_LEAD_MS + n * REVEAL_STEP_MS + REVEAL_DRUM_MS + REVEAL_HOLD_MS;

// ------------------------------------------------------------------ scoring

export interface RoundOutcome {
  roundIds: readonly string[];
  imposterIds: readonly string[];
  votes: Record<string, string>;
  /** Who was voted out (null on a tie / no votes). */
  out: string | null;
  /** Only matters when an imposter was voted out: did they pick the right word? */
  guessedRight: boolean;
}

/** Points each player earns this round. */
export function scoreRound(o: RoundOutcome): Record<string, number> {
  const res: Record<string, number> = {};
  for (const id of o.roundIds) res[id] = 0;
  for (const id of o.roundIds) {
    if (!o.imposterIds.includes(id) && o.imposterIds.includes(o.votes[id])) res[id] += POINTS.crewCorrectVote;
  }
  for (const imp of o.imposterIds) {
    if (o.out !== imp) res[imp] = (res[imp] ?? 0) + POINTS.imposterEscaped;
    else if (o.guessedRight) res[imp] = (res[imp] ?? 0) + POINTS.imposterGuessed;
  }
  return res;
}

/**
 * Who "won" the round, for the reveal banner. With two imposters the crew can only catch
 * one of them, so catching one is a 'split'.
 */
export function roundWinner(caught: boolean, guessedRight: boolean, imposters = 1): 'crew' | 'imposter' | 'split' {
  if (!caught || guessedRight) return 'imposter';
  return imposters > 1 ? 'split' : 'crew';
}

export interface ScoredPlayer { id: string; name: string; score: number; joinedAt?: number }

/** Best first; ties keep the earlier joiner ahead. */
export function rankPlayers<T extends ScoredPlayer>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
}

/** Pen colour for each player's doodle lines (by seat in the round). */
export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#92400e', '#0ea5e9', '#84cc16', '#f97316', '#475569'];
