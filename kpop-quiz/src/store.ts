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

  // Global counter
  totalTests: number;
  isLoadingCounter: boolean;
  counterError: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setUserName: (name: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  initializeQuiz: () => void;
  selectAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  calculateResult: () => void;
  resetGame: () => void;

  // Counter actions
  fetchTotalTests: () => Promise<void>;
  incrementTotalTests: () => Promise<void>;
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

  // Counter initial state
  totalTests: 0,
  isLoadingCounter: false,
  counterError: null,

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

  calculateResult: async () => {
    const { score, questions, incrementTotalTests } = get();
    const hunterProfile = getProfileByScore(score, questions.length);

    set({
      gameState: 'result',
      hunterProfile,
    });

    // Increment global counter when quiz is completed
    await incrementTotalTests();
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

  // Counter actions
  fetchTotalTests: async () => {
    set({ isLoadingCounter: true, counterError: null });
    try {
      const response = await fetch('/.netlify/functions/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      const data = await response.json();
      set({ totalTests: data.totalTests, isLoadingCounter: false });
    } catch (error) {
      console.error('Error fetching counter:', error);
      set({
        counterError: 'Failed to load counter',
        isLoadingCounter: false
      });
    }
  },

  incrementTotalTests: async () => {
    try {
      const response = await fetch('/.netlify/functions/increment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to increment counter');
      }
      const data = await response.json();
      set({ totalTests: data.totalTests });
    } catch (error) {
      console.error('Error incrementing counter:', error);
      set({ counterError: 'Failed to update counter' });
    }
  },
}));
