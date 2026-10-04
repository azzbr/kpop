// Emoji Guess rules. Pure — no React.
import { EMOJI_PUZZLES } from '../../online/emojiPuzzles';
import type { EmojiPuzzle } from '../../online/emojiPuzzles';
import { matchTyped, normaliseAnswer } from '../../online/quiz/quizLogic';
import type { Rng } from '../../games/engine/rng';
import { shuffle } from './drawLogic';

export const ROUND_SIZE = 10;
export const PUZZLE_SECS = 20;

/** Every accepted spelling of a puzzle's answer. */
export const acceptedAnswers = (p: EmojiPuzzle) => [p.answer, ...(p.alt ?? [])];

export const checkTyped = (input: string, p: EmojiPuzzle) => matchTyped(input, acceptedAnswers(p));

/**
 * Four choices: the answer plus three other answers. The puzzle bank is written in themed
 * sections (animals, food, nature, vehicles, compound phrases), so neighbours in the list are
 * the same kind of thing — wrong choices are drawn from the nearest puzzles to keep it fair
 * but tricky.
 */
export function choicesFor(index: number, rng: Rng, bank: EmojiPuzzle[] = EMOJI_PUZZLES): string[] {
  const p = bank[index];
  const taken = new Set(acceptedAnswers(p).map(normaliseAnswer));
  const near = bank
    .map((q, i) => ({ q, d: Math.abs(i - index) + rng() * 0.5 }))
    .filter(({ q }) => q !== p)
    .sort((a, b) => a.d - b.d);
  const pool: string[] = [];
  for (const { q } of near) {
    const key = normaliseAnswer(q.answer);
    if (taken.has(key) || (q.alt ?? []).some(a => taken.has(normaliseAnswer(a)))) continue;
    // Too close to the real answer (e.g. a one-letter difference) would be marked right when typed.
    if (checkTyped(q.answer, p)) continue;
    taken.add(key);
    pool.push(q.answer);
    if (pool.length >= 8) break;
  }
  const wrong = shuffle(pool, rng).slice(0, 3);
  return shuffle([p.answer, ...wrong], rng);
}

/** A hint that never gives the whole answer away: the bank's hint, or else the first letters. */
export function hintFor(p: EmojiPuzzle): string {
  if (p.hint) return p.hint;
  return firstLetters(p.answer);
}

export function firstLetters(answer: string): string {
  return answer.split(' ').map(w => (w ? w[0].toUpperCase() + '_'.repeat(Math.max(0, w.length - 1)) : '')).join(' ');
}

/** Stars for one puzzle: 3 without the hint, 1 with it, 0 if missed. */
export const starsFor = (correct: boolean, usedHint: boolean) => (correct ? (usedHint ? 1 : 3) : 0);
