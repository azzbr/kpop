// Where Quiz Party / Quiz Arena questions come from: the 10+ banks in src/data/quiz,
// the school questions used by Friends Arena, the music quiz, and the player's own quizzes.

import type { QuizQuestion } from '../../data/quiz/types';
import { QUIZ_BANKS } from '../../data/quiz';
import { SCHOOL_QUESTIONS, CATEGORIES as SCHOOL_CATEGORIES } from '../schoolQuestions';
import { easyQuestions, normalQuestions, hardQuestions } from '../../quizData';
import type { Question } from '../../quizData';
import type { SavedQuiz } from '../../store';
import type { Rng } from '../../games/engine/rng';
import { shuffleIdx } from './quizLogic';

export interface QuizSource {
  id: string;
  title: string;
  emoji: string;
  group: 'Topics' | 'School' | 'Music' | 'My quizzes';
  count: number;
  questions: () => QuizQuestion[];
}

const fromAnswers = (text: string, answers: { answerText: string; isCorrect: boolean }[]): QuizQuestion => {
  const right = answers.findIndex(a => a.isCorrect);
  return { type: 'choice', text, options: answers.map(a => a.answerText), correct: right };
};

const music = (qs: Question[]) => qs.map(q => fromAnswers(q.questionText, q.answers));

export function quizSources(myQuizzes: SavedQuiz[] = []): QuizSource[] {
  const topics: QuizSource[] = QUIZ_BANKS.map(b => ({
    id: `bank:${b.id}`, title: b.title, emoji: b.emoji, group: 'Topics', count: b.questions.length, questions: () => b.questions,
  }));
  const allTopics: QuizSource = {
    id: 'bank:mix', title: 'Mega Mix', emoji: '🎲', group: 'Topics',
    count: QUIZ_BANKS.reduce((s, b) => s + b.questions.length, 0),
    questions: () => QUIZ_BANKS.flatMap(b => b.questions),
  };
  const school: QuizSource[] = SCHOOL_CATEGORIES.filter(c => c.id !== 'mix').map(c => {
    const qs = SCHOOL_QUESTIONS.filter(q => q.category === c.id);
    return {
      id: `school:${c.id}`, title: `School: ${c.label}`, emoji: c.emoji, group: 'School', count: qs.length,
      questions: () => qs.map(q => fromAnswers(q.questionText, q.answers)),
    };
  });
  const musicSources: QuizSource[] = [
    { id: 'music:easy', title: 'Music (easy)', emoji: '🎵', group: 'Music', count: easyQuestions.length, questions: () => music(easyQuestions) },
    { id: 'music:normal', title: 'Music (normal)', emoji: '🎶', group: 'Music', count: normalQuestions.length, questions: () => music(normalQuestions) },
    { id: 'music:hard', title: 'Music (hard)', emoji: '🎼', group: 'Music', count: hardQuestions.length, questions: () => music(hardQuestions) },
  ];
  const mine: QuizSource[] = myQuizzes.map(q => ({
    id: `mine:${q.id}`, title: q.title, emoji: q.emoji, group: 'My quizzes', count: q.questions.length, questions: () => q.questions,
  }));
  return [allTopics, ...topics, ...mine, ...school, ...musicSources];
}

/** Picks `count` questions from a source in a random order. Own quizzes keep their order. */
export function pickFrom(source: QuizSource, count: number, rng: Rng): QuizQuestion[] {
  const all = source.questions();
  if (source.group === 'My quizzes') return all.slice(0, count);
  return shuffleIdx(all.length, rng).slice(0, count).map(i => all[i]);
}
