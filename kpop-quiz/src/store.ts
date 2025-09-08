import { create } from 'zustand';
import type { Question, HunterProfile } from './quizData';
import { getQuestionsByDifficulty, getProfileByScore } from './quizData';

export type GameState = 'welcome' | 'difficulty' | 'quiz' | 'result';
export type Difficulty = 'easy' | 'normal' | 'hard';

interface GameStore {
  // Game state
  gameState: GameState;
  userName: string;
  difficulty: Difficulty | null;
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswer: number | null;
  isAnswerCorrect: boolean | null;
  score: number;
  hunterProfile: HunterProfile | null;

  // Actions
  setGameState: (state: GameState) => void;
  setUserName: (name: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  initializeQuiz: () => void;
  selectAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  calculateResult: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: 'welcome',
  userName: '',
  difficulty: null,
  questions: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  isAnswerCorrect: null,
  score: 0,
  hunterProfile: null,

  // Actions
  setGameState: (state) => set({ gameState: state }),

  setUserName: (name) => set({ userName: name }),

  setDifficulty: (difficulty) => set({ difficulty }),

  initializeQuiz: () => {
    const { difficulty } = get();
    if (!difficulty) return;

    const questions = getQuestionsByDifficulty(difficulty);
    set({
      questions,
      currentQuestionIndex: 0,
      selectedAnswer: null,
      isAnswerCorrect: null,
      score: 0,
      gameState: 'quiz',
    });
  },

  selectAnswer: (answerIndex) => {
    const { questions, currentQuestionIndex } = get();
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = currentQuestion.answers[answerIndex].isCorrect;

    set({
      selectedAnswer: answerIndex,
      isAnswerCorrect: isCorrect,
      score: isCorrect ? get().score + 1 : get().score,
    });
  },

  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // Quiz completed
      get().calculateResult();
    } else {
      set({
        currentQuestionIndex: nextIndex,
        selectedAnswer: null,
        isAnswerCorrect: null,
      });
    }
  },

  calculateResult: () => {
    const { score, questions } = get();
    const hunterProfile = getProfileByScore(score, questions.length);

    set({
      gameState: 'result',
      hunterProfile,
    });
  },

  resetGame: () => {
    set({
      gameState: 'welcome',
      userName: '',
      difficulty: null,
      questions: [],
      currentQuestionIndex: 0,
      selectedAnswer: null,
      isAnswerCorrect: null,
      score: 0,
      hunterProfile: null,
    });
  },
}));
