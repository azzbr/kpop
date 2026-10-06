// Category Blitz rules (pure). One letter, five categories. Every answer must start with the
// letter ("the/a/an" don't count). A unique answer scores 2, an answer someone else also gave
// scores 1. In the review, friends can 👎 an answer that doesn't fit the category: if at least
// half of the other players (and at least one) agree, it scores 0 for everyone who gave it.
import { normaliseAnswer } from '../../online/quiz/quizLogic';
import { isRude } from '../../online/rudeWords';
import { BLITZ_CATEGORIES, BLITZ_LETTERS } from '../../online/blitzCategories';
import type { BlitzCategory } from '../../online/blitzCategories';

export const ROUNDS = 3;
export const CATS_PER_ROUND = 5;
export const WRITE_MS = 60_000;
export const REVIEW_MS = 30_000;
export const SCORES_MS = 6000;
/** Answers may arrive this long after the write deadline. */
export const GRACE_MS = 1500;
export const MAX_ANSWER = 20;
export const UNIQUE_POINTS = 2;
export const SHARED_POINTS = 1;

/** Two answers are the same if they match ignoring case, spaces and a leading the/a/an. */
export const answerKey = (s: string) => normaliseAnswer(s).replace(/ /g, '');

export const tidyAnswer = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER);

/** Does it count? At least 2 letters, starts with the letter, and kind. */
export function isValidBlitz(text: string, letter: string): boolean {
  const k = answerKey(text);
  return k.length >= 2 && k[0] === letter.toLowerCase() && !isRude(text);
}

export interface ReviewAnswer { key: string; text: string; authors: string[]; valid: boolean; pts: number }

/**
 * Per category, the distinct answers (merged by key) with their base points.
 * `answers` maps player → their answers in category order.
 */
export function buildReview(answers: Record<string, string[]>, letter: string, nCats = CATS_PER_ROUND): ReviewAnswer[][] {
  const out: ReviewAnswer[][] = [];
  for (let c = 0; c < nCats; c++) {
    const byKey = new Map<string, ReviewAnswer>();
    for (const [id, list] of Object.entries(answers)) {
      const raw = tidyAnswer(list?.[c] ?? '');
      const key = answerKey(raw);
      if (!key || isRude(raw)) continue; // empty, or not kind — never shown
      const have = byKey.get(key);
      if (have) have.authors.push(id);
      else byKey.set(key, { key, text: raw, authors: [id], valid: isValidBlitz(raw, letter), pts: 0 });
    }
    const list = [...byKey.values()];
    for (const a of list) a.pts = !a.valid ? 0 : a.authors.length > 1 ? SHARED_POINTS : UNIQUE_POINTS;
    out.push(list);
  }
  return out;
}

/** Votes needed to strike an answer, or Infinity when nobody else can vote. */
export function strikeNeeded(authors: string[], playerIds: string[]): number {
  const others = playerIds.filter(id => !authors.includes(id)).length;
  return others === 0 ? Infinity : Math.max(1, Math.ceil(others / 2));
}

/** Is this answer struck out? Authors' own votes never count. */
export function struck(voters: string[], authors: string[], playerIds: string[]): boolean {
  const n = voters.filter(v => !authors.includes(v) && playerIds.includes(v)).length;
  return n >= strikeNeeded(authors, playerIds);
}

export const voteId = (cat: number, key: string) => `${cat}:${key}`;

/** Round points per player, plus which answers were struck (as voteIds). */
export function finalRoundScores(review: ReviewAnswer[][], votes: Record<string, string[]>, playerIds: string[]) {
  const points: Record<string, number> = Object.fromEntries(playerIds.map(id => [id, 0]));
  const cells: Record<string, number[]> = {};
  const out: string[] = [];
  review.forEach((list, c) => {
    for (const a of list) {
      const s = a.valid && struck(votes[voteId(c, a.key)] ?? [], a.authors, playerIds);
      if (s) out.push(voteId(c, a.key));
      for (const id of a.authors) {
        const p = s ? 0 : a.pts;
        points[id] = (points[id] ?? 0) + p;
        (cells[id] ??= Array(review.length).fill(0))[c] = p;
      }
    }
  });
  return { points, struck: out, cells };
}

/** A letter and categories not used in earlier rounds. */
export function pickRound(rng: () => number, usedLetters: string[], usedCats: string[]): { letter: string; cats: BlitzCategory[] } {
  const letters = BLITZ_LETTERS.filter(l => !usedLetters.includes(l));
  const pool = (letters.length ? letters : [...BLITZ_LETTERS]);
  const letter = pool[Math.floor(rng() * pool.length)];
  let cats = BLITZ_CATEGORIES.filter(c => !usedCats.includes(c.id));
  if (cats.length < CATS_PER_ROUND) cats = [...BLITZ_CATEGORIES];
  const a = [...cats];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // At most one food category per round.
  const picked: BlitzCategory[] = [];
  for (const c of a) {
    if (picked.length === CATS_PER_ROUND) break;
    if (c.food && picked.some(p => p.food)) continue;
    picked.push(c);
  }
  return { letter, cats: picked };
}
