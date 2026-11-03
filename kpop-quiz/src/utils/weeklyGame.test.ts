import { describe, it, expect } from 'vitest';
import { gameOfTheWeek, weekIndex, weekStart, WEEKLY_ROTATION } from './weeklyGame';
import { MASTERY_IDS } from '../data/mastery';

describe('game of the week', () => {
  it('uses every mastery game exactly once in the rotation', () => {
    expect([...WEEKLY_ROTATION].sort()).toEqual([...MASTERY_IDS].sort());
  });

  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-03')).toBe('2026-11-02'); // Tuesday → Monday
    expect(weekStart('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday stays in the same week
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // next Monday
  });

  it('crosses the year end, a leap day and summer time without slipping a day', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // Friday
    expect(weekStart('2028-02-29')).toBe('2028-02-28'); // Tuesday in a leap year
    expect(weekStart('2026-03-30')).toBe('2026-03-30'); // the Monday after clocks go forward (UK)
    expect(weekStart('2023-12-31')).toBe('2023-12-25'); // before the epoch Monday
    expect(weekIndex('2024-01-01')).toBe(0);
    expect(weekIndex('2023-12-31')).toBe(-1);
  });

  it('kept the week the puzzles were added on the same game', () => {
    expect(gameOfTheWeek('2026-10-28')).toBe('snake_arena');
    expect(gameOfTheWeek('2026-11-03')).toBe('game_2048');
  });

  it('is the same all week and changes every Monday, never twice in a row', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-08'];
    expect(new Set(days.map(gameOfTheWeek)).size).toBe(1);
    let prev = gameOfTheWeek('2025-12-29');
    for (let w = 1; w < 120; w++) {
      const d = new Date(Date.UTC(2025, 11, 29 + w * 7));
      const key = d.toISOString().slice(0, 10);
      const g = gameOfTheWeek(key);
      expect(g, key).not.toBe(prev);
      prev = g;
    }
  });
});
