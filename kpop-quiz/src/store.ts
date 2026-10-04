import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Question, HunterProfile } from './quizData';
import { getQuestionsByDifficulty, getProfileByScore } from './quizData';
import { localDateKey, getStreak } from './utils/dates';

export type GameState =
  | 'welcome' | 'game_mode' | 'difficulty' | 'quiz' | 'result'
  | 'team_maker' | 'secret_menu' | 'living_mural' | 'agent_hq' | 'shop' | 'kpop_rush'
  | 'word_scramble' | 'lightning_quiz' | 'idol_personality_quiz' | 'dance_battle' | 'beat_maker'
  | 'huntrx_splash' | 'truth_or_dare' | 'trivia_battle' | 'talent_show' | 'zip_game' | 'mini_sudoku'
  | 'crossword_mini' | 'word_ladder' | 'memory_speed' | 'reaction_duel' | 'streak_calendar'
  | 'achievement_showcase' | 'pattern_memory' | 'ninja_slice' | 'battle_arena' | 'rocket_launch'
  | 'style_studio' | 'sparkle_match' | 'idol_diary' | 'jarvis_hq' | 'guess_intro' | 'idol_profile'
  | 'fm_radio' | 'freeze_dance' | 'chaotic_backstage' | 'paper_clash' | 'tug_of_war' | 'online_hub';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'lyrics' | 'demon';

export type Theme = 'default' | 'neon' | 'ocean' | 'forest' | 'sunset' | 'galaxy';

export const LEVEL_NAMES = ['Rookie', 'Player', 'Pro', 'Rising Star', 'Champion', 'Legend', 'Grand Master'];
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000];

export function getLevel(xp: number): number {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i; break; }
  }
  return level;
}

export function xpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevel(xp);
  const current = xp - LEVEL_THRESHOLDS[level];
  const needed = level + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level + 1] - LEVEL_THRESHOLDS[level] : 999;
  return { current, needed, level };
}

export interface Track { file: string; title: string; artist: string }
export const TRACKS: Track[] = [
  { file: '01-takedown-twice.m4a', title: 'TAKEDOWN', artist: 'Jeongyeon, Jihyo, Chaeyoung' },
  { file: '02-hows-it-done.m4a', title: "How It's Done", artist: 'HUNTR/X' },
  { file: '03-soda-pop.m4a', title: 'Soda Pop', artist: 'Saja Boys' },
  { file: '04-golden.m4a', title: 'Golden', artist: 'HUNTR/X' },
  { file: '05-strategy.m4a', title: 'Strategy', artist: 'TWICE' },
  { file: '06-takedown.m4a', title: 'Takedown', artist: 'HUNTR/X' },
  { file: '07-your-idol.m4a', title: 'Your Idol', artist: 'Saja Boys' },
  { file: '08-free.m4a', title: 'Free', artist: 'Rumi & Jinu' },
];
export const trackInfo = (file: string): Track =>
  TRACKS.find(t => t.file === file) ?? { file, title: file.replace(/\.\w+$/, ''), artist: '' };

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

export interface RoundResult { isBest: boolean; best: number; xp: number; coins: number }

interface GameStore {
  // Game flow
  gameState: GameState;
  userName: string;
  difficulty: Difficulty | null;
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswer: number | null;
  isAnswerCorrect: boolean | null;
  score: number;
  hunterProfile: HunterProfile | null;

  // Music
  currentTrack: number;
  isPlaying: boolean;
  volume: number;
  playlist: string[];

  // Achievements
  badges: Badge[];
  earnedBadges: string[];
  totalQuizzesCompleted: number;
  totalCorrectAnswers: number;
  songsListened: number;
  currentStreak: number;
  quizStartTime: number | null;

  // Progress
  xp: number;
  userCurrency: number;
  highScores: Record<string, number>;
  datesPlayed: string[];

  // Team maker
  teamMembers: string[];
  numberOfTeams: number;
  generatedTeams: string[][];
  numberOfTaggers: number;
  selectedTaggers: string[];

  huntrxUnlocked: boolean;
  currentTheme: Theme;
  inventory: string[];
  secretStats: {
    bubblesPopped: number;
    patternsCreated: number;
    drawingsCreated: number;
    treasureFound: number;
  };

  // Actions
  setGameState: (state: GameState) => void;
  setUserName: (name: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  initializeQuiz: () => void;
  selectAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  calculateResult: () => void;
  resetGame: () => void;

  setCurrentTrack: (track: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  checkAndAwardBadges: () => void;
  unlockBadge: (badgeId: string) => void;
  incrementSongsListened: () => void;

  addXP: (amount: number) => void;
  setUserCurrency: (currency: number) => void;
  /** Records a finished round: saves the best score, marks today as played. */
  submitScore: (gameId: string, score: number) => { isBest: boolean; best: number };
  /** One reward rule for every game: see CLAUDE.md "Scoring & rewards". */
  finishRound: (gameId: string, score: number, xpScale: number) => RoundResult;
  recordPlay: () => void;

  addTeamMember: (name: string) => void;
  removeTeamMember: (index: number) => void;
  setNumberOfTeams: (num: number) => void;
  generateTeams: () => void;
  clearTeams: () => void;
  setNumberOfTaggers: (num: number) => void;
  generateTaggers: () => void;

  unlockHuntrx: () => void;
  setTheme: (theme: Theme) => void;
  addToInventory: (itemId: string) => void;
  incrementDrawingsCreated: () => void;
  incrementBubblesPopped: () => void;
  incrementPatternsCreated: () => void;
  incrementTreasureFound: () => void;
}

const SAVE_KEY = 'funquest-save';

// One-time import of the scattered pre-persist localStorage keys, so existing scores survive.
const LEGACY_SCORES: Record<string, string> = {
  kpoprush_high: 'kpop_rush',
  ninja_best: 'ninja_slice',
  rocket_best: 'rocket_launch',
  arena_wins: 'battle_arena',
  simon_best: 'pattern_memory',
  sparkle_best: 'sparkle_match',
};
const LEGACY_KEYS = ['kpop_xp', 'kpop_theme', 'kpop_huntrx', 'kpop_dates_played', ...Object.keys(LEGACY_SCORES)];

function readLegacy() {
  const hasSave = (() => { try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return true; } })();
  const get = (k: string) => (hasSave ? null : localStorage.getItem(k));
  const highScores: Record<string, number> = {};
  for (const [oldKey, id] of Object.entries(LEGACY_SCORES)) {
    const v = Number(get(oldKey));
    if (v > 0) highScores[id] = v;
  }
  let datesPlayed: string[] = [];
  try { datesPlayed = JSON.parse(get('kpop_dates_played') || '[]'); } catch { /* ignore */ }
  return {
    xp: Number(get('kpop_xp') || 0),
    currentTheme: (get('kpop_theme') as Theme) || 'default',
    huntrxUnlocked: get('kpop_huntrx') === 'true',
    highScores,
    datesPlayed,
  };
}

const legacy = readLegacy();

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: 'welcome',
      userName: '',
      difficulty: null,
      questions: [],
      currentQuestionIndex: 0,
      selectedAnswer: null,
      isAnswerCorrect: null,
      score: 0,
      hunterProfile: null,

      currentTrack: 0,
      isPlaying: false,
      volume: 0.5,
      playlist: TRACKS.map(t => t.file),

      badges: [
        { id: 'quiz_master', name: 'Quiz Master', description: 'Complete 5 quizzes', icon: '🏆', criteria: { type: 'quizzes_completed', value: 5 }, unlocked: false },
        { id: 'perfect_score', name: 'Perfect Score', description: 'Get 100% on any quiz', icon: '⭐', criteria: { type: 'perfect_score', value: 1 }, unlocked: false },
        { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a quiz in under 2 minutes', icon: '⚡', criteria: { type: 'speed_completion', value: 120 }, unlocked: false },
        { id: 'music_lover', name: 'Music Lover', description: 'Listen to 3 different songs', icon: '🎵', criteria: { type: 'songs_listened', value: 3 }, unlocked: false },
        { id: 'streak_master', name: 'Streak Master', description: 'Play 3 days in a row', icon: '🔥', criteria: { type: 'streak_days', value: 3 }, unlocked: false },
        { id: 'brainiac', name: 'Brainiac', description: 'Answer 25 questions correctly in total', icon: '🧠', criteria: { type: 'total_correct', value: 25 }, unlocked: false },
        { id: 'sharpshooter', name: 'Sharpshooter', description: 'Get 5 questions right in a row', icon: '🎯', criteria: { type: 'streak_answers', value: 5 }, unlocked: false },
        { id: 'first_quiz', name: 'First Quiz', description: 'Finish your first quiz', icon: '🌟', criteria: { type: 'quizzes_completed', value: 1 }, unlocked: false },
      ],
      earnedBadges: [],
      totalQuizzesCompleted: 0,
      totalCorrectAnswers: 0,
      songsListened: 0,
      currentStreak: 0,
      quizStartTime: null,

      xp: legacy.xp,
      userCurrency: 100,
      highScores: legacy.highScores,
      datesPlayed: legacy.datesPlayed,

      teamMembers: [],
      numberOfTeams: 2,
      generatedTeams: [],
      numberOfTaggers: 0,
      selectedTaggers: [],

      huntrxUnlocked: legacy.huntrxUnlocked,
      currentTheme: legacy.currentTheme,
      inventory: [],
      secretStats: { bubblesPopped: 0, patternsCreated: 0, drawingsCreated: 0, treasureFound: 0 },

      setGameState: (state) => set({ gameState: state }),
      setUserName: (name) => set({ userName: name }),
      setDifficulty: (difficulty) => set({ difficulty }),

      initializeQuiz: () => {
        const { difficulty } = get();
        if (!difficulty) return;
        const questions = getQuestionsByDifficulty(difficulty).map(q => ({
          ...q,
          answers: [...q.answers].sort(() => Math.random() - 0.5),
        }));
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
        const isCorrect = questions[currentQuestionIndex].answers[answerIndex].isCorrect;
        set({
          selectedAnswer: answerIndex,
          isAnswerCorrect: isCorrect,
          score: isCorrect ? get().score + 1 : get().score,
          currentStreak: isCorrect ? currentStreak + 1 : 0,
          totalCorrectAnswers: isCorrect ? get().totalCorrectAnswers + 1 : get().totalCorrectAnswers,
        });
        get().checkAndAwardBadges();
      },

      nextQuestion: () => {
        const { currentQuestionIndex, questions } = get();
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= questions.length) {
          get().calculateResult();
        } else {
          set({ currentQuestionIndex: nextIndex, selectedAnswer: null, isAnswerCorrect: null });
        }
      },

      calculateResult: () => {
        const { score, questions } = get();
        set({
          gameState: 'result',
          hunterProfile: getProfileByScore(score, questions.length),
          totalQuizzesCompleted: get().totalQuizzesCompleted + 1,
        });
        get().finishRound(`quiz_${get().difficulty ?? 'easy'}`, score, 0.2);
        get().checkAndAwardBadges();
      },

      // Back to the difficulty picker so "Play again" restarts the quiz rather than the whole app.
      resetGame: () => {
        set({
          gameState: 'difficulty',
          questions: [],
          currentQuestionIndex: 0,
          selectedAnswer: null,
          isAnswerCorrect: null,
          score: 0,
          hunterProfile: null,
        });
      },

      setCurrentTrack: (track) => set({ currentTrack: track }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (volume) => set({ volume }),
      nextTrack: () => set({ currentTrack: (get().currentTrack + 1) % get().playlist.length }),
      prevTrack: () => {
        const { currentTrack, playlist } = get();
        set({ currentTrack: currentTrack === 0 ? playlist.length - 1 : currentTrack - 1 });
      },

      checkAndAwardBadges: () => {
        const state = get();
        const earned = new Set(state.earnedBadges);
        const streakDays = getStreak(state.datesPlayed).current;
        for (const badge of state.badges) {
          if (earned.has(badge.id)) continue;
          const v = badge.criteria.value;
          let ok = false;
          switch (badge.criteria.type) {
            case 'quizzes_completed': ok = state.totalQuizzesCompleted >= v; break;
            case 'perfect_score': ok = state.gameState === 'result' && state.questions.length > 0 && state.score === state.questions.length; break;
            case 'speed_completion': ok = state.gameState === 'result' && !!state.quizStartTime && (Date.now() - state.quizStartTime) / 1000 <= v; break;
            case 'songs_listened': ok = state.songsListened >= v; break;
            case 'streak_days': ok = streakDays >= v; break;
            case 'total_correct': ok = state.totalCorrectAnswers >= v; break;
            case 'streak_answers': ok = state.currentStreak >= v; break;
          }
          if (ok) earned.add(badge.id);
        }
        if (earned.size !== state.earnedBadges.length) set({ earnedBadges: [...earned] });
      },

      unlockBadge: (badgeId) => {
        if (!get().earnedBadges.includes(badgeId)) set({ earnedBadges: [...get().earnedBadges, badgeId] });
      },

      incrementSongsListened: () => {
        set({ songsListened: get().songsListened + 1 });
        get().checkAndAwardBadges();
      },

      addXP: (amount) => { set({ xp: get().xp + amount }); get().recordPlay(); },
      setUserCurrency: (currency) => set({ userCurrency: currency }),

      submitScore: (gameId, score) => {
        get().recordPlay();
        const prev = get().highScores[gameId] ?? 0;
        const isBest = score > prev;
        if (isBest) set({ highScores: { ...get().highScores, [gameId]: score } });
        return { isBest, best: Math.max(prev, score) };
      },

      finishRound: (gameId, score, xpScale) => {
        const { isBest, best } = get().submitScore(gameId, score);
        const base = Math.min(50, Math.max(5, Math.round(score / Math.max(xpScale, 0.0001))));
        const xp = base + (isBest && score > 0 ? 25 : 0);
        const coins = Math.floor(xp / 5);
        set({ xp: get().xp + xp, userCurrency: get().userCurrency + coins });
        return { isBest, best, xp, coins };
      },

      recordPlay: () => {
        const today = localDateKey();
        if (!get().datesPlayed.includes(today)) {
          set({ datesPlayed: [...get().datesPlayed, today] });
          get().checkAndAwardBadges();
        }
      },

      addTeamMember: (name) => {
        const n = name.trim();
        if (n && !get().teamMembers.includes(n)) set({ teamMembers: [...get().teamMembers, n] });
      },
      removeTeamMember: (index) => set({ teamMembers: get().teamMembers.filter((_, i) => i !== index) }),
      setNumberOfTeams: (num) => set({ numberOfTeams: num }),
      generateTeams: () => {
        const { teamMembers, numberOfTeams } = get();
        if (teamMembers.length === 0 || numberOfTeams < 2) return;
        const shuffled = shuffle(teamMembers);
        const teams: string[][] = Array.from({ length: numberOfTeams }, () => []);
        shuffled.forEach((m, i) => teams[i % numberOfTeams].push(m));
        set({ generatedTeams: teams });
      },
      clearTeams: () => set({ generatedTeams: [], teamMembers: [], selectedTaggers: [] }),
      setNumberOfTaggers: (num) => set({ numberOfTaggers: num }),
      generateTaggers: () => {
        const { teamMembers, numberOfTaggers } = get();
        if (teamMembers.length === 0 || numberOfTaggers === 0) { set({ selectedTaggers: [] }); return; }
        set({ selectedTaggers: shuffle(teamMembers).slice(0, Math.min(numberOfTaggers, teamMembers.length)) });
      },

      unlockHuntrx: () => {
        if (get().huntrxUnlocked) return;
        set({ huntrxUnlocked: true, xp: get().xp + 500 });
      },

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ currentTheme: theme });
      },

      addToInventory: (itemId) => {
        if (!get().inventory.includes(itemId)) set({ inventory: [...get().inventory, itemId] });
      },
      incrementDrawingsCreated: () => bump(set, get, 'drawingsCreated'),
      incrementBubblesPopped: () => bump(set, get, 'bubblesPopped'),
      incrementPatternsCreated: () => bump(set, get, 'patternsCreated'),
      incrementTreasureFound: () => bump(set, get, 'treasureFound'),
    }),
    {
      name: SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only progress is saved — never the current screen or an in-progress quiz.
      partialize: (s) => ({
        userName: s.userName,
        xp: s.xp,
        userCurrency: s.userCurrency,
        highScores: s.highScores,
        datesPlayed: s.datesPlayed,
        earnedBadges: s.earnedBadges,
        totalQuizzesCompleted: s.totalQuizzesCompleted,
        totalCorrectAnswers: s.totalCorrectAnswers,
        songsListened: s.songsListened,
        inventory: s.inventory,
        secretStats: s.secretStats,
        huntrxUnlocked: s.huntrxUnlocked,
        currentTheme: s.currentTheme,
        volume: s.volume,
        teamMembers: s.teamMembers,
      }),
      migrate: (persisted) => persisted as GameStore,
      onRehydrateStorage: () => (state) => {
        try { LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
        if (state) document.documentElement.setAttribute('data-theme', state.currentTheme);
      },
    },
  ),
);

type Setter = (partial: Partial<GameStore>) => void;
function bump(set: Setter, get: () => GameStore, key: keyof GameStore['secretStats']) {
  const s = get().secretStats;
  set({ secretStats: { ...s, [key]: s[key] + 1 } });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
