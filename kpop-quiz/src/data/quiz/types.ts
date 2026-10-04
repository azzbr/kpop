// Shared question format for Quiz Party (online), Quiz Arena (solo) and Quiz Maker.

export type QuestionType = 'choice' | 'truefalse' | 'type' | 'poll' | 'order';

export interface QuizQuestion {
  type: QuestionType;
  text: string;
  /** Optional big emoji "picture" shown above the question. */
  emoji?: string;
  /**
   * choice: 2–4 options, `correct` is the index of the right one.
   * truefalse: options are ['True', 'False'], `correct` 0 or 1.
   * poll: 2–4 options, no correct answer.
   * order: the items in the RIGHT order (they are shuffled when shown).
   * type: unused.
   */
  options?: string[];
  correct?: number;
  /** type: accepted answers (the first is shown on reveal). Matching is forgiving. */
  answers?: string[];
  /** Optional one-line fun fact shown on reveal. */
  fact?: string;
}

export interface QuizBank {
  id: string;
  title: string;
  emoji: string;
  questions: QuizQuestion[];
}

// Small helpers so the bank files stay readable.
/** Multiple choice; the FIRST option is the correct one (options are shuffled when played). */
export const mc = (text: string, right: string, wrong: [string, string, string], extra: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({ type: 'choice', text, options: [right, ...wrong], correct: 0, ...extra });
export const tf = (text: string, isTrue: boolean, extra: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({ type: 'truefalse', text, options: ['True', 'False'], correct: isTrue ? 0 : 1, ...extra });
export const typed = (text: string, answers: string[], extra: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({ type: 'type', text, answers, ...extra });
export const ordered = (text: string, itemsInOrder: string[], extra: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({ type: 'order', text, options: itemsInOrder, ...extra });
