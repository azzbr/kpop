import { describe, it, expect } from 'vitest';
import { GAME_BADGES } from '../data/gameBadges';
import { badgeGroups, bestScoreRows, formatBest, gameName, monthCells, monthsBack, shiftMonth } from './trophyRoomLogic';

describe('trophyRoomLogic', () => {
  it('shows every game with a best, skipping helper and loss keys', () => {
    const rows = bestScoreRows({
      paper_clash: 253, snake_arena: 80, battle_arena_losses: 4, truth_or_dare_dares: 12,
      truth_or_dare_super: 1, truth_or_dare: 9, brand_new_game: 7, game_2048: 0,
    });
    expect(rows.map(r => r.id).sort()).toEqual(['brand_new_game', 'paper_clash', 'snake_arena', 'truth_or_dare']);
    expect(rows.find(r => r.id === 'paper_clash')?.text).toBe('25.3% of the map');
    expect(rows.find(r => r.id === 'brand_new_game')?.name).toBe('Brand New Game');
  });

  it('formats plain scores with separators', () => {
    expect(formatBest('game_2048', 12345)).toBe((12345).toLocaleString());
    expect(gameName('kpop_rush').name).toBe('Rush Runner');
  });

  it('groups every badge exactly once, with "All games" last', () => {
    const groups = badgeGroups(GAME_BADGES, ['pc_first', 'any_3days', 'not_a_badge']);
    expect(groups.reduce((n, g) => n + g.badges.length, 0)).toBe(GAME_BADGES.length);
    expect(groups[groups.length - 1].game).toBe('any');
    expect(groups.find(g => g.game === 'paper_clash')?.earned).toBe(1);
    expect(groups.reduce((n, g) => n + g.earned, 0)).toBe(2);
    // Every badge game has a friendly name, not the fallback.
    for (const g of groups) expect(g.icon).not.toBe('🎮');
  });

  it('builds month grids and navigation', () => {
    const cells = monthCells(2026, 9); // October 2026 starts on a Thursday
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe('2026-10-01');
    expect(cells[cells.length - 1]).toBe('2026-10-31');
    expect(shiftMonth(new Date(2026, 0, 15), -1)).toEqual({ year: 2025, month: 11 });
    expect(monthsBack(['2026-08-03', '2026-10-01'], new Date(2026, 9, 5))).toBe(2);
    expect(monthsBack([], new Date(2026, 9, 5))).toBe(0);
  });
});
