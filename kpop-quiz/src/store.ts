import { create } from 'zustand';
import type { Question, HunterProfile } from './quizData';
import { getQuestionsByDifficulty, getProfileByScore } from './quizData';

export type GameState = 'welcome' | 'game_mode' | 'difficulty' | 'quiz' | 'result' | 'memory_game' | 'rhythm_game' | 'trivia_cards' | 'instruments_tutorial' | 'team_maker' | 'friends_trivia';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'lyrics';
export type GameMode = 'quiz' | 'memory' | 'rhythm' | 'trivia' | 'instruments' | 'teams' | 'friends';

// Mini-games types
export interface MemoryCard {
  id: number;
  type: 'idol' | 'song' | 'album';
  name: string;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface MemoryScore {
  playerName: string;
  score: number;
  time: number;
  difficulty: 'easy' | 'hard';
  date: string;
}

export interface RhythmNote {
  id: number;
  position: number;
  timestamp: number;
  hit: boolean;
  type: 'perfect' | 'good' | 'miss';
}

export interface TriviaCard {
  id: string;
  name: string;
  group: string;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  facts: string[];
  value: number;
  owned: boolean;
}

export interface CardPack {
  id: string;
  name: string;
  description: string;
  cost: number;
  cards: string[]; // Card IDs
  imageUrl: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: {
    type: 'quizzes_completed' | 'perfect_score' | 'speed_completion' | 'songs_listened' | 'streak_days' | 'total_correct' | 'streak_answers';
    value: number;
  };
  unlocked: boolean;
}

export type DailyChallengeType = 'regular' | 'speed' | 'music' | 'streak';

export interface FriendsQuestion {
  id: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  aboutFriend: string;
  category: string;
}

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

  // Music state
  currentTrack: number;
  isPlaying: boolean;
  volume: number;
  playlist: string[];

  // Achievement state
  badges: Badge[];
  earnedBadges: string[];
  totalQuizzesCompleted: number;
  totalCorrectAnswers: number;
  songsListened: number;
  currentStreak: number;
  maxStreak: number;
  quizStartTime: number | null;

  // Daily challenge state
  dailyChallengeType: DailyChallengeType;
  dailyChallengeCompleted: boolean;
  dailyStreak: number;
  lastPlayedDate: string;

  // Mini-games state
  selectedGameMode: GameMode | null;

  // Memory game state
  memoryCards: MemoryCard[];
  memoryFlippedCards: number[];
  memoryMatchedPairs: number[];
  memoryGameStartTime: number | null;
  memoryScore: number;
  memoryDifficulty: 'easy' | 'hard';
  memoryLeaderboard: MemoryScore[];

  // Rhythm game state
  rhythmNotes: RhythmNote[];
  rhythmScore: number;
  rhythmCombo: number;
  rhythmAccuracy: number;
  rhythmCurrentSong: string;
  rhythmUnlockedSongs: string[];
  rhythmGameActive: boolean;

  // Trivia cards state
  userCards: TriviaCard[];
  userCurrency: number;
  cardCollection: TriviaCard[];
  cardMarket: CardPack[];

  // Team maker state
  teamMembers: string[];
  numberOfTeams: number;
  generatedTeams: string[][];
  numberOfTaggers: number;
  selectedTaggers: string[];

  // Friends trivia state
  friendsList: string[];
  friendsQuestions: FriendsQuestion[];
  currentFriendsQuestionIndex: number;
  friendsScore: number;
  friendsGameActive: boolean;

  // Trivia cards actions
  setUserCards: (cards: TriviaCard[]) => void;
  setUserCurrency: (currency: number) => void;
  setCardCollection: (cards: TriviaCard[]) => void;
  setCardMarket: (packs: CardPack[]) => void;

  // Team maker actions
  addTeamMember: (name: string) => void;
  removeTeamMember: (index: number) => void;
  setNumberOfTeams: (num: number) => void;
  generateTeams: () => void;
  clearTeams: () => void;
  setNumberOfTaggers: (num: number) => void;
  generateTaggers: () => void;

  // Friends trivia actions
  addFriend: (name: string) => void;
  removeFriend: (index: number) => void;
  generateFriendsQuestions: () => void;
  startFriendsTrivia: () => void;
  answerFriendsQuestion: (answerIndex: number) => void;
  nextFriendsQuestion: () => void;
  resetFriendsTrivia: () => void;

  // Actions
  setGameState: (state: GameState) => void;
  setUserName: (name: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setSelectedGameMode: (mode: GameMode | null) => void;

  // Memory game actions
  setMemoryCards: (cards: MemoryCard[]) => void;
  setMemoryFlippedCards: (cards: number[]) => void;
  setMemoryMatchedPairs: (pairs: number[]) => void;
  setMemoryGameStartTime: (time: number | null) => void;
  setMemoryScore: (score: number) => void;
  setMemoryDifficulty: (difficulty: 'easy' | 'hard') => void;
  setMemoryLeaderboard: (leaderboard: MemoryScore[]) => void;

  // Rhythm game actions
  setRhythmScore: (score: number) => void;
  setRhythmCombo: (combo: number) => void;
  setRhythmAccuracy: (accuracy: number) => void;
  setRhythmCurrentSong: (song: string) => void;
  setRhythmGameActive: (active: boolean) => void;
  initializeQuiz: () => void;
  selectAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  calculateResult: () => void;
  resetGame: () => void;

  // Music actions
  setCurrentTrack: (track: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // Achievement actions
  checkAndAwardBadges: () => void;
  unlockBadge: (badgeId: string) => void;
  incrementSongsListened: () => void;

  // Daily challenge actions
  initializeDailyChallenge: () => void;
  completeDailyChallenge: () => void;
  updateDailyStreak: () => void;
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

  // Music initial state
  currentTrack: 0,
  isPlaying: false,
  volume: 0.5,
  playlist: [
    '01. TAKEDOWN (JEONGYEON, JIHYO, CHAEYOUNG).flac',
    '02. How It\'s Done.flac',
    '03. Soda Pop.flac',
    '04. Golden.flac',
    '05. Strategy.flac',
    '06. Takedown.flac',
    '07. Your Idol.flac',
    '08. Free.flac'
  ],

  // Achievement initial state
  badges: [
    {
      id: 'quiz_master',
      name: 'Quiz Master',
      description: 'Complete 5 quizzes',
      icon: '🏆',
      criteria: { type: 'quizzes_completed', value: 5 },
      unlocked: false
    },
    {
      id: 'perfect_score',
      name: 'Perfect Score',
      description: 'Get 100% on any quiz',
      icon: '⭐',
      criteria: { type: 'perfect_score', value: 1 },
      unlocked: false
    },
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Complete quiz in under 2 minutes',
      icon: '⚡',
      criteria: { type: 'speed_completion', value: 120 },
      unlocked: false
    },
    {
      id: 'music_lover',
      name: 'Music Lover',
      description: 'Listen to 3 different songs',
      icon: '🎵',
      criteria: { type: 'songs_listened', value: 3 },
      unlocked: false
    },
    {
      id: 'streak_master',
      name: 'Streak Master',
      description: 'Play for 3 days in a row',
      icon: '🔥',
      criteria: { type: 'streak_days', value: 3 },
      unlocked: false
    },
    {
      id: 'kpop_expert',
      name: 'K-pop Expert',
      description: 'Answer 25 questions correctly total',
      icon: '🧠',
      criteria: { type: 'total_correct', value: 25 },
      unlocked: false
    },
    {
      id: 'sharpshooter',
      name: 'Sharpshooter',
      description: 'Get 5 questions right in a row',
      icon: '🎯',
      criteria: { type: 'streak_answers', value: 5 },
      unlocked: false
    },
    {
      id: 'super_fan',
      name: 'Super Fan',
      description: 'Complete all difficulty levels',
      icon: '🌟',
      criteria: { type: 'quizzes_completed', value: 1 },
      unlocked: false
    }
  ],
  earnedBadges: [],
  totalQuizzesCompleted: 0,
  totalCorrectAnswers: 0,
  songsListened: 0,
  currentStreak: 0,
  maxStreak: 0,
  quizStartTime: null,

  // Daily challenge initial state
  dailyChallengeType: 'regular',
  dailyChallengeCompleted: false,
  dailyStreak: 0,
  lastPlayedDate: '',

  // Mini-games initial state
  selectedGameMode: null,

  // Memory game initial state
  memoryCards: [],
  memoryFlippedCards: [],
  memoryMatchedPairs: [],
  memoryGameStartTime: null,
  memoryScore: 0,
  memoryDifficulty: 'easy',
  memoryLeaderboard: [],

  // Rhythm game initial state
  rhythmNotes: [],
  rhythmScore: 0,
  rhythmCombo: 0,
  rhythmAccuracy: 0,
  rhythmCurrentSong: '',
  rhythmUnlockedSongs: ['01. TAKEDOWN (JEONGYEON, JIHYO, CHAEYOUNG).flac'],
  rhythmGameActive: false,

  // Trivia cards initial state
  userCards: [],
  userCurrency: 100, // Starting currency
  cardCollection: [],
  cardMarket: [],

  // Team maker initial state
  teamMembers: [],
  numberOfTeams: 2,
  generatedTeams: [],
  numberOfTaggers: 0,
  selectedTaggers: [],

  // Friends trivia initial state
  friendsList: [],
  friendsQuestions: [],
  currentFriendsQuestionIndex: 0,
  friendsScore: 0,
  friendsGameActive: false,



  // Actions
  setGameState: (state) => set({ gameState: state }),

  setUserName: (name) => set({ userName: name }),

  setDifficulty: (difficulty) => set({ difficulty }),

  setSelectedGameMode: (mode) => set({ selectedGameMode: mode }),

  // Memory game actions
  setMemoryCards: (cards) => set({ memoryCards: cards }),
  setMemoryFlippedCards: (cards) => set({ memoryFlippedCards: cards }),
  setMemoryMatchedPairs: (pairs) => set({ memoryMatchedPairs: pairs }),
  setMemoryGameStartTime: (time) => set({ memoryGameStartTime: time }),
  setMemoryScore: (score) => set({ memoryScore: score }),
  setMemoryDifficulty: (difficulty) => set({ memoryDifficulty: difficulty }),
  setMemoryLeaderboard: (leaderboard) => set({ memoryLeaderboard: leaderboard }),

  // Rhythm game actions
  setRhythmScore: (score) => set({ rhythmScore: score }),
  setRhythmCombo: (combo) => set({ rhythmCombo: combo }),
  setRhythmAccuracy: (accuracy) => set({ rhythmAccuracy: accuracy }),
  setRhythmCurrentSong: (song) => set({ rhythmCurrentSong: song }),
  setRhythmGameActive: (active) => set({ rhythmGameActive: active }),

  // Trivia cards actions
  setUserCards: (cards) => set({ userCards: cards }),
  setUserCurrency: (currency) => set({ userCurrency: currency }),
  setCardCollection: (cards) => set({ cardCollection: cards }),
  setCardMarket: (packs) => set({ cardMarket: packs }),

  // Team maker actions
  addTeamMember: (name) => {
    const state = get();
    if (name.trim() && !state.teamMembers.includes(name.trim())) {
      set({ teamMembers: [...state.teamMembers, name.trim()] });
    }
  },
  removeTeamMember: (index) => {
    const state = get();
    const newMembers = [...state.teamMembers];
    newMembers.splice(index, 1);
    set({ teamMembers: newMembers });
  },
  setNumberOfTeams: (num) => set({ numberOfTeams: num }),
  generateTeams: () => {
    const state = get();
    const { teamMembers, numberOfTeams } = state;

    if (teamMembers.length === 0 || numberOfTeams < 2) return;

    // Shuffle the array using Fisher-Yates algorithm
    const shuffled = [...teamMembers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Distribute members into teams as evenly as possible
    const teams: string[][] = Array.from({ length: numberOfTeams }, () => []);
    shuffled.forEach((member, index) => {
      const teamIndex = index % numberOfTeams;
      teams[teamIndex].push(member);
    });

    set({ generatedTeams: teams });
  },
  clearTeams: () => set({ generatedTeams: [], teamMembers: [], selectedTaggers: [] }),
  setNumberOfTaggers: (num) => set({ numberOfTaggers: num }),
  generateTaggers: () => {
    const state = get();
    const { teamMembers, numberOfTaggers } = state;

    if (teamMembers.length === 0 || numberOfTaggers === 0) {
      set({ selectedTaggers: [] });
      return;
    }

    // Shuffle the array and select taggers
    const shuffled = [...teamMembers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const taggers = shuffled.slice(0, Math.min(numberOfTaggers, teamMembers.length));
    set({ selectedTaggers: taggers });
  },

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
      quizStartTime: Date.now(),
      gameState: 'quiz',
    });
  },

  selectAnswer: (answerIndex) => {
    const { questions, currentQuestionIndex, currentStreak } = get();
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = currentQuestion.answers[answerIndex].isCorrect;

    const newStreak = isCorrect ? currentStreak + 1 : 0;

    set({
      selectedAnswer: answerIndex,
      isAnswerCorrect: isCorrect,
      score: isCorrect ? get().score + 1 : get().score,
      currentStreak: newStreak,
      totalCorrectAnswers: isCorrect ? get().totalCorrectAnswers + 1 : get().totalCorrectAnswers,
    });

    // Check for badge unlocks after answering
    setTimeout(() => get().checkAndAwardBadges(), 100);
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
      totalQuizzesCompleted: get().totalQuizzesCompleted + 1,
    });

    // Mark daily challenge as completed if not already done
    if (!get().dailyChallengeCompleted) {
      get().completeDailyChallenge();
    }

    // Check for badge unlocks after quiz completion
    setTimeout(() => {
      get().checkAndAwardBadges();
    }, 500);
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

  // Music actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  nextTrack: () => {
    const { currentTrack, playlist } = get();
    const next = (currentTrack + 1) % playlist.length;
    set({ currentTrack: next });
  },
  prevTrack: () => {
    const { currentTrack, playlist } = get();
    const prev = currentTrack === 0 ? playlist.length - 1 : currentTrack - 1;
    set({ currentTrack: prev });
  },

  // Achievement actions
  checkAndAwardBadges: () => {
    const state = get();
    const newEarnedBadges = [...state.earnedBadges];

    state.badges.forEach(badge => {
      if (!badge.unlocked) {
        let shouldUnlock = false;

        switch (badge.criteria.type) {
          case 'quizzes_completed':
            shouldUnlock = state.totalQuizzesCompleted >= badge.criteria.value;
            break;
          case 'perfect_score':
            shouldUnlock = state.score === state.questions.length && state.questions.length > 0;
            break;
          case 'speed_completion':
            if (state.quizStartTime) {
              const completionTime = (Date.now() - state.quizStartTime) / 1000;
              shouldUnlock = completionTime <= badge.criteria.value;
            }
            break;
          case 'songs_listened':
            shouldUnlock = state.songsListened >= badge.criteria.value;
            break;
          case 'streak_days':
            shouldUnlock = state.dailyStreak >= badge.criteria.value;
            break;
          case 'total_correct':
            shouldUnlock = state.totalCorrectAnswers >= badge.criteria.value;
            break;
          case 'streak_answers':
            shouldUnlock = state.currentStreak >= badge.criteria.value;
            break;
        }

        if (shouldUnlock && !newEarnedBadges.includes(badge.id)) {
          newEarnedBadges.push(badge.id);
        }
      }
    });

    if (newEarnedBadges.length !== state.earnedBadges.length) {
      set({ earnedBadges: newEarnedBadges });
    }
  },

  unlockBadge: (badgeId) => {
    const state = get();
    if (!state.earnedBadges.includes(badgeId)) {
      set({ earnedBadges: [...state.earnedBadges, badgeId] });
    }
  },

  incrementSongsListened: () => {
    const state = get();
    set({ songsListened: state.songsListened + 1 });
    get().checkAndAwardBadges();
  },

  // Daily challenge actions
  initializeDailyChallenge: () => {
    const today = new Date().toDateString();
    const state = get();

    if (state.lastPlayedDate !== today) {
      // New day - determine challenge type based on day of week
      const dayOfWeek = new Date().getDay();
      let challengeType: DailyChallengeType = 'regular';

      switch (dayOfWeek) {
        case 1: // Monday
          challengeType = 'speed';
          break;
        case 3: // Wednesday
          challengeType = 'music';
          break;
        case 5: // Friday
          challengeType = 'streak';
          break;
        default:
          challengeType = 'regular';
      }

      set({
        dailyChallengeType: challengeType,
        dailyChallengeCompleted: false,
        lastPlayedDate: today
      });
    }
  },

  completeDailyChallenge: () => {
    set({ dailyChallengeCompleted: true });
    get().updateDailyStreak();
  },

  updateDailyStreak: () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const state = get();

    // If this is the first time playing today, update streak
    if (state.lastPlayedDate !== today) {
      if (state.lastPlayedDate === yesterday) {
        // Continued streak
        const newStreak = state.dailyStreak + 1;
        set({
          dailyStreak: newStreak,
          maxStreak: Math.max(state.maxStreak, newStreak),
          lastPlayedDate: today
        });
      } else if (state.lastPlayedDate === '') {
        // First time playing
        set({
          dailyStreak: 1,
          maxStreak: 1,
          lastPlayedDate: today
        });
      } else {
        // Streak broken
        set({
          dailyStreak: 1,
          lastPlayedDate: today
        });
      }
    }

    get().checkAndAwardBadges();
  },

  // Friends trivia actions
  addFriend: (name) => {
    const state = get();
    if (name.trim() && !state.friendsList.includes(name.trim())) {
      set({ friendsList: [...state.friendsList, name.trim()] });
    }
  },
  removeFriend: (index) => {
    const state = get();
    const newFriends = [...state.friendsList];
    newFriends.splice(index, 1);
    set({ friendsList: newFriends });
  },
  generateFriendsQuestions: () => {
    const state = get();
    if (state.friendsList.length === 0) return;

    // Import the function dynamically to avoid circular dependency
    import('./friendsQuestionsData').then(({ generateQuestionsForFriends }) => {
      const questions = generateQuestionsForFriends(state.friendsList);
      set({ friendsQuestions: questions });
    });
  },
  startFriendsTrivia: () => {
    const state = get();
    if (state.friendsQuestions.length > 0) {
      set({
        friendsGameActive: true,
        currentFriendsQuestionIndex: 0,
        friendsScore: 0,
        gameState: 'friends_trivia'
      });
    }
  },
  answerFriendsQuestion: (answerIndex) => {
    const state = get();
    const currentQuestion = state.friendsQuestions[state.currentFriendsQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    set({
      friendsScore: isCorrect ? state.friendsScore + 10 : state.friendsScore
    });
  },
  nextFriendsQuestion: () => {
    const state = get();
    const nextIndex = state.currentFriendsQuestionIndex + 1;

    if (nextIndex >= state.friendsQuestions.length) {
      // Game completed
      set({ friendsGameActive: false });
    } else {
      set({ currentFriendsQuestionIndex: nextIndex });
    }
  },
  resetFriendsTrivia: () => {
    set({
      friendsList: [],
      friendsQuestions: [],
      currentFriendsQuestionIndex: 0,
      friendsScore: 0,
      friendsGameActive: false
    });
  },

}));
