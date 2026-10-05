import type { GameState } from '../store';
import { localDateKey } from './dates';

export interface DailyChallenge {
  /** Score key passed to finishRound. */
  gameId: string;
  /** Screen to open from the challenge card. */
  screen: GameState;
  icon: string;
  label: string;
  /** finishRound score needed (same units the game submits). */
  target: number;
}

// Targets are in each game's finishRound units (e.g. Paper Clash submits % × 10).
const CHALLENGES: DailyChallenge[] = [
  { gameId: 'paper_clash', screen: 'paper_clash', icon: '🗺️', label: 'Own 10% of the map in Paper Clash', target: 100 },
  { gameId: 'snake_arena', screen: 'snake_arena', icon: '🐍', label: 'Grow to length 60 in Snake Arena', target: 60 },
  { gameId: 'game_2048', screen: 'game_2048', icon: '🔢', label: 'Score 2,000 in 2048', target: 2000 },
  { gameId: 'block_blast', screen: 'block_blast', icon: '🧱', label: 'Score 500 in Block Blast', target: 500 },
  { gameId: 'word_guess', screen: 'word_guess', icon: '🟩', label: 'Solve a Word Guess', target: 1 },
  { gameId: 'quiz_arena', screen: 'quiz_arena', icon: '❓', label: 'Score 6,000 in Quiz Arena', target: 6000 },
  { gameId: 'real_or_fake', screen: 'real_or_fake', icon: '🤔', label: 'Get a streak of 7 in Real or Fake', target: 7 },
  { gameId: 'emoji_guess', screen: 'emoji_guess', icon: '🕵️', label: 'Get 8 right in Emoji Guess', target: 8 },
  { gameId: 'kpop_rush', screen: 'kpop_rush', icon: '🏃', label: 'Score 1,500 in Rush Runner', target: 1500 },
  { gameId: 'ninja_slice', screen: 'ninja_slice', icon: '🥷', label: 'Score 150 in Ninja Slice', target: 150 },
  { gameId: 'pattern_memory', screen: 'pattern_memory', icon: '🧠', label: 'Reach round 8 in Pattern Memory', target: 8 },
  { gameId: 'sparkle_match', screen: 'sparkle_match', icon: '💎', label: 'Score 800 in Gem Match', target: 800 },
  { gameId: 'mini_sudoku', screen: 'mini_sudoku', icon: '🔢', label: 'Score 300 in Mini Sudoku', target: 300 },
  { gameId: 'word_ladder', screen: 'word_ladder', icon: '🪜', label: 'Climb a Word Ladder in the fewest steps', target: 100 },
  { gameId: 'crossword_mini', screen: 'crossword_mini', icon: '📰', label: 'Score 600 in Crossword Mini', target: 600 },
  { gameId: 'word_scramble', screen: 'word_scramble', icon: '🔤', label: 'Score 1,200 in Word Scramble', target: 1200 },
];

export const DAILY_REWARD = { xp: 100, coins: 50 };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function challengeFor(date = localDateKey()): DailyChallenge {
  return CHALLENGES[hash(date) % CHALLENGES.length];
}

export const ALL_CHALLENGES = CHALLENGES;
