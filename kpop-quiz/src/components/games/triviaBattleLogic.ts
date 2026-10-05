// Trivia Battle (2-player buzzer on one iPad) — pure rules, no React.
import type { QuizQuestion } from '../../data/quiz/types';
import type { QuizSource } from '../../online/quiz/sources';
import type { Rng } from '../../games/engine/rng';
import { shuffle } from './drawLogic';

export const ROUNDS = 10;
export const SECS_PER_Q = 12;
/** A category needs at least this many usable questions to be offered. */
export const MIN_QUESTIONS = 5;

export interface BattleQ {
  text: string;
  emoji?: string;
  options: string[];
  correct: number;
}

/** Only questions you can answer with one tap: multiple choice and true/false with a right answer. */
export function usable(q: QuizQuestion): boolean {
  if (q.type !== 'choice' && q.type !== 'truefalse') return false;
  const n = q.options?.length ?? 0;
  return n >= 2 && n <= 4 && typeof q.correct === 'number' && q.correct >= 0 && q.correct < n;
}

/** Turns a quiz question into a battle question; multiple-choice options are shuffled, True/False stays in order. */
export function toBattleQ(q: QuizQuestion, rng: Rng): BattleQ {
  const options = q.options!;
  if (q.type === 'truefalse') return { text: q.text, emoji: q.emoji, options: [...options], correct: q.correct! };
  const order = shuffle(options.map((_, i) => i), rng);
  return { text: q.text, emoji: q.emoji, options: order.map(i => options[i]), correct: order.indexOf(q.correct!) };
}

/** A fresh, shuffled deck for one game: no question twice, no repeated question text. */
export function buildDeck(all: QuizQuestion[], count: number, rng: Rng): BattleQ[] {
  const seen = new Set<string>();
  const pool = all.filter(q => {
    if (!usable(q)) return false;
    const key = q.text.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return shuffle(pool, rng).slice(0, count).map(q => toBattleQ(q, rng));
}

/** Categories that have enough tap-to-answer questions for a whole game. */
export function battleSources(sources: QuizSource[]): QuizSource[] {
  return sources.filter(s => s.questions().filter(usable).length >= MIN_QUESTIONS);
}

export type Answers = [number | null, number | null];

export type Outcome =
  | { kind: 'ignored' }
  | { kind: 'point'; player: 0 | 1 }
  | { kind: 'miss'; player: 0 | 1 }          // wrong — the other player can still answer
  | { kind: 'both_missed' };

/**
 * One buzz. The first correct answer wins the point. A wrong answer locks only that player out
 * for this question; if both miss, nobody scores.
 */
export function buzz(q: BattleQ, answers: Answers, player: 0 | 1, choice: number): { answers: Answers; outcome: Outcome } {
  if (answers[player] !== null || choice < 0 || choice >= q.options.length) return { answers, outcome: { kind: 'ignored' } };
  const next: Answers = [answers[0], answers[1]];
  next[player] = choice;
  if (choice === q.correct) return { answers: next, outcome: { kind: 'point', player } };
  const other = player === 0 ? 1 : 0;
  if (next[other] !== null) return { answers: next, outcome: { kind: 'both_missed' } };
  return { answers: next, outcome: { kind: 'miss', player } };
}

/** 0 or 1 for the winner, null for a tie. */
export const leader = (scores: [number, number]): 0 | 1 | null => (scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null);

/** The score saved for the game: the winner's points (the higher of the two). */
export const battleScore = (scores: [number, number]) => Math.max(scores[0], scores[1]);

export const KIND_MISS = ['So close! 💪', 'Nice try! 🌈', 'Almost! ✨', 'Good guess! 🍀', 'Keep going! 🚀'];
export const CHEERS = ['⚡ Super fast!', '🎯 Nailed it!', '🌟 Brilliant!', '🔥 On fire!', '🧠 Big brain!', '💥 Boom!'];
