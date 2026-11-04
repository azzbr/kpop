// Game of the week: one solo game per Monday–Sunday week gives 2× XP and coins (store.finishRound).
// Dates are local "YYYY-MM-DD" keys, turned into whole days with Date.UTC so clock changes
// (summer time) can never shift a day.
import { MASTERY } from '../data/mastery';

const DAY_MS = 86_400_000;
/** 1 January 2024 was a Monday. */
const EPOCH_MONDAY = Date.UTC(2024, 0, 1) / DAY_MS;

/** gameIds, interleaved arcade / puzzle / quiz so neighbouring weeks feel different. New games go at the end. */
export const WEEKLY_ROTATION: string[] = [
  'snake_arena', 'game_2048', 'quiz_arena', 'ninja_slice', 'block_blast', 'emoji_guess', 'picture_puzzle',
  'paper_clash', 'word_scramble', 'real_or_fake', 'kpop_rush', 'sparkle_match', 'guess_intro', 'bridges',
  'rocket_launch', 'mini_sudoku', 'tower_defense', 'pattern_memory', 'battle_arena', 'light_up', 'crossword_mini',
  'memory_speed', 'zip_game', 'word_ladder', 'untangle', 'chess_puzzles', 'stack_lab',
].filter(id => id in MASTERY);

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function keyOf(day: number): string {
  const dt = new Date(day * DAY_MS);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Weeks since the epoch Monday (negative before it). */
export function weekIndex(dateKey: string): number {
  return Math.floor((dayNumber(dateKey) - EPOCH_MONDAY) / 7);
}

/** The Monday of that week, as a date key. */
export function weekStart(dateKey: string): string {
  return keyOf(EPOCH_MONDAY + weekIndex(dateKey) * 7);
}

/**
 * The rotation counts from the week of 26 Oct 2026 (Snake Arena), so adding games to the list on
 * 3 Nov 2026 didn't change that week's game (2048). When adding more games mid-week, move this
 * start so the current week keeps its game (weeklyGame.test.ts pins it).
 */
const ROTATION_START = '2026-10-26';

/** The gameId of the week (open it through the tile whose score key it is). */
export function gameOfTheWeek(dateKey: string): string {
  const n = WEEKLY_ROTATION.length;
  const k = weekIndex(dateKey) - weekIndex(ROTATION_START);
  return WEEKLY_ROTATION[((k % n) + n) % n];
}
