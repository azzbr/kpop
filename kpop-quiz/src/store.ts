import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { localDateKey, getStreak } from './utils/dates';
import { challengeFor, DAILY_REWARD } from './utils/dailyChallenge';
import type { QuizQuestion } from './data/quiz/types';
import { GAME_BADGES } from './data/gameBadges';

export type GameState =
  | 'welcome' | 'game_mode'
  | 'team_maker' | 'secret_menu' | 'doodle_pad' | 'sticker_board' | 'pixel_studio' | 'theme_lab' | 'my_stats' | 'agent_hq' | 'kpop_rush'
  | 'word_scramble' | 'idol_personality_quiz' | 'dance_battle' | 'beat_maker'
  | 'huntrx_splash' | 'truth_or_dare' | 'trivia_battle' | 'talent_show' | 'zip_game' | 'mini_sudoku'
  | 'crossword_mini' | 'word_ladder' | 'memory_speed' | 'reaction_duel' | 'streak_calendar'
  | 'achievement_showcase' | 'pattern_memory' | 'ninja_slice' | 'battle_arena' | 'rocket_launch'
  | 'style_studio' | 'sparkle_match' | 'idol_diary' | 'jarvis_hq' | 'guess_intro' | 'idol_profile'
  | 'fm_radio' | 'freeze_dance' | 'chaotic_backstage' | 'paper_clash' | 'tug_of_war' | 'online_hub'
  | 'snake_arena' | 'game_2048' | 'block_blast' | 'word_guess' | 'quiz_arena' | 'would_you_rather'
  | 'real_or_fake' | 'emoji_guess' | 'quiz_maker' | 'locker'
  | 'tower_defense' | 'pet_pal' | 'quest_map' | 'parent_corner' | 'heads_up';

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

export interface RoundResult { isBest: boolean; best: number; xp: number; coins: number; dailyDone?: boolean; newBadges?: string[] }

/** Seconds played and rounds per game, per local date (last 30 days kept). */
export type PlayLog = Record<string, { seconds: number; games: Record<string, number> }>;

export interface ParentSettings {
  /** Remind to take a break after this many minutes of play in one sitting (0 = off). */
  breakMinutes: number;
  /** Sound-effect volume 0–1 (music has its own slider). */
  sfxVolume: number;
}
export const DEFAULT_PARENT: ParentSettings = { breakMinutes: 0, sfxVolume: 1 };

export interface PetState {
  name: string;
  species: string;
  /** Grows by playing on different days. */
  growth: number;
  /** 0–100, goes down a little each day without a visit. */
  happiness: number;
  lastVisitDate: string;
  lastFedDate: string;
  decor: string[];
  born: string;
  /** Local date the pet last grew, so it grows at most once a day. */
  grewDate?: string;
}

/** Seasonal events (e.g. Halloween): collected item ids per event key like "halloween-2026". */
export type EventProgress = Record<string, string[]>;

export interface SavedQuiz { id: string; title: string; emoji: string; questions: QuizQuestion[]; updatedAt: number }

/** What the player has equipped from the Locker. */
export interface Equipped {
  avatar: string; color: string; trail: string; title: string;
  /** Pixel Studio art id used as the Paper Clash token ('' = the avatar emoji). */
  skin: string;
}
export const DEFAULT_EQUIPPED: Equipped = { avatar: '😎', color: '#3b82f6', trail: '', title: '', skin: '' };

/** A Truth or Dare card the kids wrote themselves ("Our cards" pack). */
export interface TodCustomCard { id: string; kind: 'truth' | 'dare'; text: string; emoji: string }
export const MAX_TOD_CUSTOM = 50;

/** Pixel Studio art: `size`×`size` colours, '' = empty. */
export interface PixelArt { id: string; name: string; size: number; pixels: string[]; updatedAt: number }
export const MAX_PIXEL_ART = 20;

/** Agent HQ code-breaking progress. */
export interface AgentProgress { solvedIds: string[]; solved: number }

export interface PaperClashPrefs { style: 'new' | 'classic' }

export interface WordGuessState {
  /** The daily puzzle in progress / finished (keyed by local date). */
  daily: { date: string; guesses: string[]; done: boolean; won: boolean } | null;
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
}

interface GameStore {
  // Game flow
  gameState: GameState;
  userName: string;

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

  // Progress
  xp: number;
  userCurrency: number;
  highScores: Record<string, number>;
  myQuizzes: SavedQuiz[];
  equipped: Equipped;
  /** Local date of the last completed daily challenge. */
  dailyDoneDate: string;
  wordGuess: WordGuessState;
  playLog: PlayLog;
  /** Rounds finished per game id (all time). */
  rounds: Record<string, number>;
  gameBadges: string[];
  parent: ParentSettings;
  pet: PetState | null;
  events: EventProgress;
  datesPlayed: string[];
  // v4
  todCustom: TodCustomCard[];
  pixelArt: PixelArt[];
  agent: AgentProgress;
  /** Hidden easter eggs found (ids from data/secrets.ts). */
  secretsFound: string[];
  paperClash: PaperClashPrefs;

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

  /** Where a Secret Club screen's Back goes (not saved). */
  secretReturn: GameState | null;

  // Actions
  setGameState: (state: GameState) => void;
  /** Opens a hidden screen and remembers where its Back button should return. */
  openSecret: (screen: GameState, returnTo: GameState) => void;
  /** Back from a hidden screen (to wherever it was opened from, else the Secret Club). */
  leaveSecret: () => void;
  setUserName: (name: string) => void;

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
  /** Spend coins on a Locker item. Returns false if it can't be afforded or is already owned. */
  buyItem: (itemId: string, price: number) => boolean;
  equip: (patch: Partial<Equipped>) => void;
  saveQuiz: (quiz: SavedQuiz) => void;
  deleteQuiz: (id: string) => void;
  setWordGuess: (patch: Partial<WordGuessState>) => void;
  /** Adds play time to today's log (App calls it while a screen is open). */
  logPlaySeconds: (seconds: number) => void;
  setParent: (patch: Partial<ParentSettings>) => void;
  setPet: (pet: PetState | null) => void;
  /** Collect an event item (e.g. a pumpkin). Returns false if already collected. */
  collectEventItem: (eventKey: string, itemId: string) => boolean;
  /** Clears all progress (Parent corner). */
  resetProgress: () => void;
  saveTodCard: (card: TodCustomCard) => void;
  deleteTodCard: (id: string) => void;
  savePixelArt: (art: PixelArt) => void;
  deletePixelArt: (id: string) => void;
  setAgent: (patch: Partial<AgentProgress>) => void;
  /** Marks an easter egg as found. Returns true the first time. */
  findSecret: (id: string) => boolean;
  setPaperClash: (patch: Partial<PaperClashPrefs>) => void;
  incrementDrawingsCreated: () => void;
  incrementBubblesPopped: () => void;
  incrementPatternsCreated: () => void;
  incrementTreasureFound: () => void;
}

const SAVE_KEY = 'funquest-save';

export const SAVE_VERSION = 4;

/** What gets saved: progress only — never the current screen, an in-progress game or secretReturn. */
export function partializeSave(s: GameStore) {
  return {
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
    myQuizzes: s.myQuizzes,
    equipped: s.equipped,
    dailyDoneDate: s.dailyDoneDate,
    wordGuess: s.wordGuess,
    playLog: s.playLog,
    rounds: s.rounds,
    gameBadges: s.gameBadges,
    parent: s.parent,
    pet: s.pet,
    events: s.events,
    secretStats: s.secretStats,
    huntrxUnlocked: s.huntrxUnlocked,
    currentTheme: s.currentTheme,
    volume: s.volume,
    teamMembers: s.teamMembers,
    todCustom: s.todCustom,
    pixelArt: s.pixelArt,
    agent: s.agent,
    secretsFound: s.secretsFound,
    paperClash: s.paperClash,
  };
}

/**
 * Upgrades an older save. Missing top-level keys fall back to the store defaults when the save is
 * merged in, so only nested shapes need fixing here.
 */
export function migrateSave(persisted: unknown, version: number): Partial<GameStore> {
  const s = (persisted ?? {}) as Partial<GameStore>;
  // v1 → v2 added myQuizzes, equipped, dailyDoneDate and wordGuess.
  if (version < 2) {
    s.myQuizzes = s.myQuizzes ?? [];
    s.dailyDoneDate = s.dailyDoneDate ?? '';
  }
  // v2 → v3 added playLog, rounds, gameBadges, parent, pet, events.
  if (version < 3) s.parent = { ...DEFAULT_PARENT, ...(s.parent ?? {}) };
  // v3 → v4 added todCustom, pixelArt, agent, secretsFound, paperClash and equipped.skin.
  if (version < 4) {
    s.todCustom = s.todCustom ?? [];
    s.pixelArt = s.pixelArt ?? [];
    s.agent = { solvedIds: [], solved: 0, ...(s.agent ?? {}) };
    s.secretsFound = s.secretsFound ?? [];
    s.paperClash = { style: 'new', ...(s.paperClash ?? {}) };
  }
  s.equipped = { ...DEFAULT_EQUIPPED, ...(s.equipped ?? {}) };
  return s;
}

/** Content keys outside the main save that "Reset all progress" also clears. */
const RESET_KEYS = ['cipher_*', 'ciphers_solved', 'jarvis_students', 'jarvis_seen_intro', 'style_saves', 'style_*', 'funquest-quests-claimed', 'diary_list', 'zip_best', 'wordladder_solved'];
const RESET_DBS = ['funquest-doodles', 'TLDRAW_DOCUMENT_v2kpop-fun-quest-mural-v2'];


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
      myQuizzes: [],
      equipped: DEFAULT_EQUIPPED,
      dailyDoneDate: '',
      wordGuess: { daily: null, played: 0, won: 0, streak: 0, bestStreak: 0 },
      playLog: {},
      rounds: {},
      gameBadges: [],
      parent: DEFAULT_PARENT,
      pet: null,
      events: {},
      todCustom: [],
      pixelArt: [],
      agent: { solvedIds: [], solved: 0 },
      secretsFound: [],
      paperClash: { style: 'new' },
      secretStats: { bubblesPopped: 0, patternsCreated: 0, drawingsCreated: 0, treasureFound: 0 },

      setGameState: (state) => set({ gameState: state }),
      secretReturn: null,
      openSecret: (screen, returnTo) => set({ gameState: screen, secretReturn: returnTo }),
      leaveSecret: () => set({ gameState: get().secretReturn ?? 'secret_menu', secretReturn: null }),
      setUserName: (name) => set({ userName: name }),

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
            // perfect_score and speed_completion are unlocked directly by Quiz Arena (unlockBadge).
            case 'perfect_score':
            case 'speed_completion': break;
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
        let coins = Math.floor(xp / 5);
        let bonusXp = 0;
        // Daily challenge: first time today this game hits its target.
        const today = localDateKey();
        const ch = challengeFor(today);
        const dailyDone = get().dailyDoneDate !== today && ch.gameId === gameId && score >= ch.target;
        if (dailyDone) {
          coins += DAILY_REWARD.coins;
          bonusXp = DAILY_REWARD.xp;
          set({ dailyDoneDate: today });
        }
        // Rounds per game (all time + today's log), then per-game badges.
        const rounds = { ...get().rounds, [gameId]: (get().rounds[gameId] ?? 0) + 1 };
        const log = { ...get().playLog };
        const day = log[today] ?? { seconds: 0, games: {} };
        log[today] = { ...day, games: { ...day.games, [gameId]: (day.games[gameId] ?? 0) + 1 } };
        const have = new Set(get().gameBadges);
        const check = { gameId, score, best, highScores: get().highScores, rounds, daysPlayed: get().datesPlayed.length };
        const newBadges = GAME_BADGES.filter(b => !have.has(b.id) && b.test(check)).map(b => b.id);
        set({
          xp: get().xp + xp + bonusXp,
          userCurrency: get().userCurrency + coins + newBadges.length * 10,
          rounds,
          playLog: log,
          gameBadges: newBadges.length ? [...get().gameBadges, ...newBadges] : get().gameBadges,
        });
        return { isBest, best, xp: xp + bonusXp, coins: coins + newBadges.length * 10, dailyDone, newBadges };
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
      buyItem: (itemId, price) => {
        const { inventory, userCurrency } = get();
        if (inventory.includes(itemId) || userCurrency < price) return false;
        set({ inventory: [...inventory, itemId], userCurrency: userCurrency - price });
        return true;
      },
      equip: (patch) => set({ equipped: { ...get().equipped, ...patch } }),
      saveQuiz: (quiz) => {
        const rest = get().myQuizzes.filter(q => q.id !== quiz.id);
        set({ myQuizzes: [{ ...quiz, updatedAt: Date.now() }, ...rest] });
      },
      deleteQuiz: (id) => set({ myQuizzes: get().myQuizzes.filter(q => q.id !== id) }),
      setWordGuess: (patch) => set({ wordGuess: { ...get().wordGuess, ...patch } }),
      logPlaySeconds: (seconds) => {
        const today = localDateKey();
        const log: PlayLog = {};
        // Keep the last 30 days only.
        for (const [d, v] of Object.entries(get().playLog)) if (d >= localDateKey(new Date(Date.now() - 30 * 86400000))) log[d] = v;
        const day = log[today] ?? { seconds: 0, games: {} };
        log[today] = { ...day, seconds: day.seconds + seconds };
        set({ playLog: log });
      },
      setParent: (patch) => set({ parent: { ...get().parent, ...patch } }),
      setPet: (pet) => set({ pet }),
      collectEventItem: (eventKey, itemId) => {
        const got = get().events[eventKey] ?? [];
        if (got.includes(itemId)) return false;
        set({ events: { ...get().events, [eventKey]: [...got, itemId] } });
        return true;
      },
      resetProgress: () => {
        try {
          localStorage.removeItem(SAVE_KEY);
          // Per-screen content keys outside the main save.
          for (const k of Object.keys(localStorage)) if (RESET_KEYS.some(r => (r.endsWith('*') ? k.startsWith(r.slice(0, -1)) : k === r))) localStorage.removeItem(k);
          for (const db of RESET_DBS) indexedDB.deleteDatabase(db);
        } catch { /* ignore */ }
        window.location.reload();
      },
      saveTodCard: (card) => {
        const list = get().todCustom.filter(c => c.id !== card.id);
        set({ todCustom: [...list, card].slice(-MAX_TOD_CUSTOM) });
      },
      deleteTodCard: (id) => set({ todCustom: get().todCustom.filter(c => c.id !== id) }),
      savePixelArt: (art) => {
        const list = get().pixelArt.filter(a => a.id !== art.id);
        set({ pixelArt: [art, ...list].slice(0, MAX_PIXEL_ART) });
      },
      deletePixelArt: (id) => {
        const { pixelArt, equipped } = get();
        set({ pixelArt: pixelArt.filter(a => a.id !== id), equipped: equipped.skin === id ? { ...equipped, skin: '' } : equipped });
      },
      setAgent: (patch) => set({ agent: { ...get().agent, ...patch } }),
      findSecret: (id) => {
        if (get().secretsFound.includes(id)) return false;
        set({ secretsFound: [...get().secretsFound, id] });
        return true;
      },
      setPaperClash: (patch) => set({ paperClash: { ...get().paperClash, ...patch } }),
      incrementDrawingsCreated: () => bump(set, get, 'drawingsCreated'),
      incrementBubblesPopped: () => bump(set, get, 'bubblesPopped'),
      incrementPatternsCreated: () => bump(set, get, 'patternsCreated'),
      incrementTreasureFound: () => bump(set, get, 'treasureFound'),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only progress is saved — never the current screen or an in-progress quiz.
      partialize: partializeSave,
      migrate: (persisted, version) => migrateSave(persisted, version) as unknown as GameStore,
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
