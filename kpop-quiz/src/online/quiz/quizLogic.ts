// Quiz Party rules — pure functions, no React or networking, so they can be unit-tested.
// The host device runs these and broadcasts the results.

import type { QuizQuestion } from '../../data/quiz/types';
import type { Rng } from '../../games/engine/rng';

export type QuizMode = 'classic' | 'gold' | 'racing' | 'cash';

export interface QPlayer {
  id: string;
  name: string;
  emoji: string;
  team: number; // -1 = no teams
  score: number; // classic points
  streak: number;
  bestStreak: number;
  correct: number;
  answered: number;
  fastestMs: number; // Infinity until a correct answer
  gold: number;
  pos: number; // racing position
  finishedAt: number; // question number when they crossed the line (0 = not yet)
  cash: number;
  upgrades: Upgrades;
  lastGain: number;
  lastCorrect: boolean | null;
}

export interface Upgrades { mult: number; streak: number; insurance: number }

export function newPlayer(id: string, name: string, emoji: string, team = -1): QPlayer {
  return {
    id, name, emoji, team,
    score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, fastestMs: Infinity,
    gold: 0, pos: 0, finishedAt: 0, cash: 0, upgrades: { mult: 0, streak: 0, insurance: 0 },
    lastGain: 0, lastCorrect: null,
  };
}

// ------------------------------------------------------------------ answers

export interface PlayerAnswer {
  choice?: number; // index into the ORIGINAL options (host maps display order back)
  order?: number[]; // original indices in the order the player put them
  text?: string;
}

const STRIP = /^(the|a|an)\s+/;

export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(STRIP, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Forgiving match for typed answers: case, punctuation, "the/a/an", and one typo on longer words. */
export function matchTyped(input: string, accepted: string[]): boolean {
  const got = normaliseAnswer(input);
  if (!got) return false;
  return accepted.some(raw => {
    const want = normaliseAnswer(raw);
    if (got === want) return true;
    if (got.replace(/ /g, '') === want.replace(/ /g, '')) return true;
    const allowed = want.length >= 9 ? 2 : want.length >= 5 ? 1 : 0;
    return allowed > 0 && levenshtein(got, want) <= allowed;
  });
}

/** Is this answer right? Polls have no right answer and return null. */
export function isCorrect(q: QuizQuestion, a: PlayerAnswer | undefined): boolean | null {
  if (q.type === 'poll') return null;
  if (!a) return false;
  switch (q.type) {
    case 'choice':
    case 'truefalse':
      return a.choice === q.correct;
    case 'type':
      return typeof a.text === 'string' && matchTyped(a.text, q.answers ?? []);
    case 'order': {
      const n = q.options?.length ?? 0;
      return !!a.order && a.order.length === n && a.order.every((v, i) => v === i);
    }
  }
}

// ------------------------------------------------------------------ classic (Kahoot-style)

export const STREAK_STEP = 100;
export const STREAK_CAP = 500;

/** 500 for a right answer + up to 500 for speed, plus a streak bonus. Wrong = 0. */
export function classicPoints(correct: boolean, ms: number, limitMs: number, streakAfter: number): number {
  if (!correct) return 0;
  const speed = Math.max(0, Math.min(1, 1 - ms / limitMs));
  const streakBonus = Math.min(STREAK_CAP, STREAK_STEP * Math.max(0, streakAfter - 1));
  return 500 + Math.round(500 * speed) + streakBonus;
}

/** Updates the shared stats (streak, correct count, fastest) for any mode. */
export function recordAnswer(p: QPlayer, correct: boolean | null, ms: number): QPlayer {
  if (correct === null) return { ...p, answered: p.answered + 1, lastCorrect: null, lastGain: 0 };
  const streak = correct ? p.streak + 1 : 0;
  return {
    ...p,
    answered: p.answered + 1,
    correct: p.correct + (correct ? 1 : 0),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    fastestMs: correct ? Math.min(p.fastestMs, ms) : p.fastestMs,
    lastCorrect: correct,
  };
}

// ------------------------------------------------------------------ racing

/** Finish line for a race of `total` questions — reachable with ~75% right answers. */
export const raceGoal = (total: number) => Math.max(3, Math.ceil(total * 0.75));

/** A right answer moves 1 space; a fast one (top third of the time) moves 2. */
export function racingMove(correct: boolean, ms: number, limitMs: number): number {
  if (!correct) return 0;
  return ms < limitMs / 3 ? 2 : 1;
}

// ------------------------------------------------------------------ gold quest (Blooket-style)

export type ChestKind = 'gold' | 'double' | 'triple' | 'lose' | 'steal' | 'swap' | 'nothing';
export interface Chest { kind: ChestKind; amount: number; label: string; emoji: string }

const CHEST_TABLE: { kind: ChestKind; weight: number; amount: number }[] = [
  { kind: 'gold', weight: 14, amount: 15 },
  { kind: 'gold', weight: 14, amount: 25 },
  { kind: 'gold', weight: 10, amount: 50 },
  { kind: 'gold', weight: 4, amount: 100 },
  { kind: 'double', weight: 8, amount: 2 },
  { kind: 'triple', weight: 3, amount: 3 },
  { kind: 'lose', weight: 7, amount: 25 }, // lose 25%
  { kind: 'steal', weight: 9, amount: 20 }, // steal 20% from someone
  { kind: 'swap', weight: 3, amount: 0 },
  { kind: 'nothing', weight: 6, amount: 0 },
];

export function chestLabel(kind: ChestKind, amount: number): { label: string; emoji: string } {
  switch (kind) {
    case 'gold': return { label: `+${amount} gold`, emoji: amount >= 100 ? '💰' : '🪙' };
    case 'double': return { label: 'Double gold!', emoji: '✖️2' };
    case 'triple': return { label: 'TRIPLE gold!', emoji: '✖️3' };
    case 'lose': return { label: `Lose ${amount}%`, emoji: '💸' };
    case 'steal': return { label: `Steal ${amount}%!`, emoji: '🦊' };
    case 'swap': return { label: 'Swap gold!', emoji: '🔄' };
    case 'nothing': return { label: 'Empty chest', emoji: '🕸️' };
  }
}

/** Rolls 3 hidden chests for a player who answered right. */
export function rollChests(rng: Rng): Chest[] {
  const total = CHEST_TABLE.reduce((s, c) => s + c.weight, 0);
  return [0, 1, 2].map(() => {
    let r = rng() * total;
    const row = CHEST_TABLE.find(c => (r -= c.weight) < 0) ?? CHEST_TABLE[0];
    return { kind: row.kind, amount: row.amount, ...chestLabel(row.kind, row.amount) };
  });
}

export const chestNeedsTarget = (c: Chest) => c.kind === 'steal' || c.kind === 'swap';

/**
 * Applies an opened chest. Returns the updated players (by id). `targetId` is required for
 * steal/swap; if it's missing or invalid the chest does nothing.
 */
export function openChest(players: Record<string, QPlayer>, meId: string, chest: Chest, targetId?: string): Record<string, QPlayer> {
  const me = players[meId];
  if (!me) return players;
  const out = { ...players };
  const set = (id: string, gold: number, gain: number) => { out[id] = { ...out[id], gold: Math.max(0, Math.round(gold)), lastGain: gain }; };
  switch (chest.kind) {
    case 'gold': set(meId, me.gold + chest.amount, chest.amount); break;
    case 'double': set(meId, me.gold * 2, me.gold); break;
    case 'triple': set(meId, me.gold * 3, me.gold * 2); break;
    case 'lose': {
      const loss = Math.round(me.gold * chest.amount / 100);
      set(meId, me.gold - loss, -loss);
      break;
    }
    case 'steal': {
      const t = targetId && targetId !== meId ? players[targetId] : undefined;
      if (!t) break;
      const take = Math.round(t.gold * chest.amount / 100);
      set(targetId!, t.gold - take, -take);
      set(meId, me.gold + take, take);
      break;
    }
    case 'swap': {
      const t = targetId && targetId !== meId ? players[targetId] : undefined;
      if (!t) break;
      set(targetId!, me.gold, me.gold - t.gold);
      set(meId, t.gold, t.gold - me.gold);
      break;
    }
    case 'nothing': set(meId, me.gold, 0); break;
  }
  return out;
}

// ------------------------------------------------------------------ cash climb (Gimkit-style)

export type UpgradeKind = keyof Upgrades;

export const UPGRADES: Record<UpgradeKind, { name: string; emoji: string; levels: number[]; costs: number[]; describe: (v: number) => string }> = {
  mult: { name: 'Money multiplier', emoji: '✖️', levels: [1, 2, 3, 5, 8], costs: [0, 150, 600, 2000, 6000], describe: v => `×${v} money per right answer` },
  streak: { name: 'Streak bonus', emoji: '🔥', levels: [0, 20, 60, 150, 400], costs: [0, 100, 450, 1500, 4500], describe: v => `+$${v} per answer in a row` },
  insurance: { name: 'Insurance', emoji: '🛡️', levels: [1, 0.5, 0.25, 0], costs: [0, 200, 800, 2500], describe: v => v === 0 ? 'Wrong answers cost nothing' : `Wrong answers cost ${Math.round(v * 100)}%` },
};

export const CASH_BASE = 50;
/** A wrong answer costs this fraction of what a right one would have earned (before insurance). */
export const CASH_WRONG = 0.5;

export function cashEarn(p: QPlayer): number {
  const mult = UPGRADES.mult.levels[p.upgrades.mult];
  const perStreak = UPGRADES.streak.levels[p.upgrades.streak];
  return CASH_BASE * mult + perStreak * Math.max(0, p.streak);
}

/** Money change for an answer. Call with the player's stats BEFORE recordAnswer for wrong answers. */
export function cashDelta(pAfter: QPlayer, correct: boolean): number {
  if (correct) return cashEarn(pAfter);
  const mult = UPGRADES.mult.levels[pAfter.upgrades.mult];
  const cost = Math.round(CASH_BASE * mult * CASH_WRONG * UPGRADES.insurance.levels[pAfter.upgrades.insurance]);
  return -Math.min(cost, pAfter.cash);
}

export function upgradeCost(p: QPlayer, kind: UpgradeKind): number | null {
  const next = p.upgrades[kind] + 1;
  const u = UPGRADES[kind];
  return next < u.levels.length ? u.costs[next] : null;
}

/** Buys the next level of an upgrade. Returns null if maxed or unaffordable. */
export function buyUpgrade(p: QPlayer, kind: UpgradeKind): QPlayer | null {
  const cost = upgradeCost(p, kind);
  if (cost === null || p.cash < cost) return null;
  return { ...p, cash: p.cash - cost, upgrades: { ...p.upgrades, [kind]: p.upgrades[kind] + 1 } };
}

// ------------------------------------------------------------------ applying a whole question

/**
 * Scores one question for one player in any mode (except the Gold Quest chest step, which
 * happens after the reveal). `ms` is the host-measured answer time.
 */
export function scoreAnswer(mode: QuizMode, p: QPlayer, q: QuizQuestion, a: PlayerAnswer | undefined, ms: number, limitMs: number, questionNo: number, total: number): QPlayer {
  const correct = isCorrect(q, a);
  const timeMs = a ? ms : limitMs;
  let next = recordAnswer(p, correct, timeMs);
  if (correct === null) return next; // poll
  switch (mode) {
    case 'classic': {
      const gain = classicPoints(correct, timeMs, limitMs, next.streak);
      next = { ...next, score: next.score + gain, lastGain: gain };
      break;
    }
    case 'racing': {
      if (next.finishedAt) { next = { ...next, lastGain: 0 }; break; }
      const move = racingMove(correct, timeMs, limitMs);
      const pos = Math.min(raceGoal(total), next.pos + move);
      next = { ...next, pos, lastGain: move, finishedAt: pos >= raceGoal(total) ? questionNo : 0 };
      break;
    }
    case 'cash': {
      const delta = cashDelta(next, correct);
      next = { ...next, cash: next.cash + delta, lastGain: delta };
      break;
    }
    case 'gold':
      next = { ...next, lastGain: 0 };
      break;
  }
  return next;
}

// ------------------------------------------------------------------ results

/** The number each mode ranks by (and reports to finishRound). */
export function modeScore(mode: QuizMode, p: QPlayer): number {
  switch (mode) {
    case 'classic': return p.score;
    case 'gold': return p.gold;
    case 'cash': return p.cash;
    case 'racing': return p.pos;
  }
}

/** XP scale per mode so a strong game earns ~40 XP (see store.finishRound). */
export const MODE_XP_SCALE: Record<QuizMode, number> = { classic: 200, gold: 8, cash: 60, racing: 0.25 };

export function rankPlayers(mode: QuizMode, players: QPlayer[]): QPlayer[] {
  return [...players].sort((a, b) => {
    if (mode === 'racing') {
      // Finishers first, earliest finish first; then furthest along; then most correct.
      const fa = a.finishedAt || Infinity;
      const fb = b.finishedAt || Infinity;
      if (fa !== fb) return fa - fb;
      if (b.pos !== a.pos) return b.pos - a.pos;
      return b.correct - a.correct;
    }
    return modeScore(mode, b) - modeScore(mode, a) || b.correct - a.correct;
  });
}

export interface TeamResult { team: number; members: number; avg: number }

/** Team score = the average of its members (so a bigger team doesn't win just by size). */
export function teamResults(mode: QuizMode, players: QPlayer[]): TeamResult[] {
  const map = new Map<number, number[]>();
  for (const p of players) {
    if (p.team < 0) continue;
    map.set(p.team, [...(map.get(p.team) ?? []), modeScore(mode, p)]);
  }
  return [...map.entries()]
    .map(([team, scores]) => ({ team, members: scores.length, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => b.avg - a.avg);
}

/** Splits players into `n` teams as evenly as possible, keeping existing assignments stable. */
export function assignTeams(ids: string[], n: number): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => { out[id] = i % n; });
  return out;
}

export const TEAMS = [
  { name: 'Red Rockets', color: '#ef4444', emoji: '🚀' },
  { name: 'Blue Whales', color: '#3b82f6', emoji: '🐳' },
  { name: 'Green Geckos', color: '#22c55e', emoji: '🦎' },
  { name: 'Yellow Yetis', color: '#eab308', emoji: '❄️' },
];

// ------------------------------------------------------------------ question prep

/** A question as sent to players: no answer, options in display order. */
export interface PublicQuestion {
  type: QuizQuestion['type'];
  text: string;
  emoji?: string;
  options?: string[];
}

export interface PreparedQuestion {
  q: QuizQuestion; // canonical: choice options/correct as authored, order options in right order
  display: number[]; // display index → original option index
}

export function shuffleIdx(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function prepare(q: QuizQuestion, rng: Rng): PreparedQuestion {
  const n = q.options?.length ?? 0;
  // True/false keeps True first; polls keep their order; choice and order are shuffled.
  let display = Array.from({ length: n }, (_, i) => i);
  if (q.type === 'choice' || q.type === 'order') {
    display = shuffleIdx(n, rng);
    if (q.type === 'order' && n > 1 && display.every((v, i) => v === i)) display = [...display.slice(1), display[0]];
  }
  return { q, display };
}

export function publicQuestion(p: PreparedQuestion): PublicQuestion {
  return {
    type: p.q.type,
    text: p.q.text,
    emoji: p.q.emoji,
    options: p.q.options ? p.display.map(i => p.q.options![i]) : undefined,
  };
}

/** Converts what the player tapped (display indices) into original indices. */
export function toOriginal(p: PreparedQuestion, a: { choice?: number; order?: number[]; text?: string }): PlayerAnswer {
  return {
    choice: a.choice !== undefined ? p.display[a.choice] : undefined,
    order: a.order ? a.order.map(d => p.display[d]) : undefined,
    text: a.text,
  };
}

/** The correct answer as text, for the reveal. */
export function correctText(q: QuizQuestion): string {
  switch (q.type) {
    case 'choice':
    case 'truefalse': return q.options![q.correct!];
    case 'type': return q.answers?.[0] ?? '';
    case 'order': return q.options!.join(' → ');
    case 'poll': return '';
  }
}
