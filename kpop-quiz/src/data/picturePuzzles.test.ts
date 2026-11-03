import { describe, it, expect } from 'vitest';
import { PICTURE_PUZZLES, PALETTE } from './picturePuzzles';
import { PICTURE_LEVELS, solutionFromRows, rowCluesOf, colCluesOf, solveByLines, solutionCount } from '../components/games/pictureLogic';

const SIZES = PICTURE_LEVELS.map(l => l.size);

describe('picture palette', () => {
  it('has single lowercase letters with hex colours (and no "." — that means empty)', () => {
    for (const [key, hex] of Object.entries(PALETTE)) {
      expect(key, key).toMatch(/^[a-z]$/);
      expect(hex, key).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(PALETTE['.']).toBeUndefined();
  });
});

describe('picture puzzles', () => {
  it('ids and names are unique', () => {
    const ids = PICTURE_PUZZLES.map(p => p.id);
    const names = PICTURE_PUZZLES.map(p => p.name.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    for (const p of PICTURE_PUZZLES) {
      expect(p.id, p.id).toMatch(/^[a-z0-9_]+$/);
      expect(p.name.trim().length, p.id).toBeGreaterThan(0);
      expect(p.emoji.trim().length, p.id).toBeGreaterThan(0);
    }
  });

  it.each(PICTURE_LEVELS.map(l => [l.name, l.size] as const))('%s has at least 8 pictures', (_, size) => {
    expect(PICTURE_PUZZLES.filter(p => p.rows.length === size).length).toBeGreaterThanOrEqual(8);
  });

  it.each(PICTURE_PUZZLES.map(p => [`${p.name} (${p.id})`, p] as const))('%s is a square of palette letters', (_, p) => {
    const n = p.rows.length;
    expect(SIZES).toContain(n);
    for (const row of p.rows) {
      expect(row.length, `"${row}"`).toBe(n);
      for (const ch of row) expect(ch === '.' || ch in PALETTE, `"${ch}" in "${row}"`).toBe(true);
    }
  });

  it.each(PICTURE_PUZZLES.map(p => [`${p.name} (${p.id})`, p] as const))('%s is not blank, not full, and reaches the edge of its board', (_, p) => {
    const sol = solutionFromRows(p.rows);
    const n = sol.length;
    const filled = solutionCount(sol);
    expect(filled).toBeGreaterThan(n);
    expect(filled).toBeLessThan(n * n);
    // not a small picture floating in the middle of a big board
    const rowUsed = sol.map(row => row.some(Boolean));
    const colUsed = sol[0].map((_, c) => sol.some(row => row[c]));
    expect(rowUsed[0] || rowUsed[n - 1] || colUsed[0] || colUsed[n - 1]).toBe(true);
  });

  it.each(PICTURE_PUZZLES.map(p => [`${p.name} (${p.id})`, p] as const))('%s can be solved with line logic alone (no guessing)', (_, p) => {
    const sol = solutionFromRows(p.rows);
    const solved = solveByLines(rowCluesOf(sol), colCluesOf(sol));
    expect(solved, 'line solver got stuck').not.toBeNull();
    expect(solved).toEqual(sol);
  });
});
