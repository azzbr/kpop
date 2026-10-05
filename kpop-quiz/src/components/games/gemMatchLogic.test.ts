import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { SIZE, freshGrid, findMatches, hasValidMove, shuffleGrid, clearMatches, swap, isAdjacent, swipeTarget } from './gemMatchLogic';
import type { Cell, Grid } from './gemMatchLogic';

let id = 0;
/** Build a grid from letters: each letter is a gem colour, '*' + letter = power gem. */
function gridOf(rows: string[]): Grid {
  return rows.map(row => {
    const out: Cell[] = [];
    for (let i = 0; i < row.length; i++) {
      const power = row[i] === '*';
      if (power) i++;
      out.push({ id: ++id, charm: row[i], isPower: power });
    }
    return out;
  });
}

describe('gem match boards', () => {
  it('a fresh board has no matches and at least one move', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = freshGrid(createRng(seed));
      expect(g.length).toBe(SIZE);
      expect(findMatches(g).size).toBe(0);
      expect(hasValidMove(g)).toBe(true);
    }
  });

  it('a shuffled board keeps the same gems, with no matches and a move', () => {
    const g = freshGrid(createRng(4));
    const s = shuffleGrid(g, createRng(9));
    expect(s.flat().map(c => c.id).sort()).toEqual(g.flat().map(c => c.id).sort());
    expect(findMatches(s).size).toBe(0);
    expect(hasValidMove(s)).toBe(true);
  });

  it('spots a board with no moves', () => {
    const g = gridOf(['ABC', 'BCA', 'CAB'].map(r => r));
    expect(findMatches(g).size).toBe(0);
    expect(hasValidMove(g)).toBe(false);
  });
});

describe('matching', () => {
  it('finds lines of 3+ in rows and columns', () => {
    const g = gridOf(['AAAB', 'CDEB', 'FGHB', 'IJKL']);
    expect([...findMatches(g)].sort()).toEqual(['0-0', '0-1', '0-2', '0-3', '1-3', '2-3'].sort());
  });

  it('clears a line of 3, drops gems down and refills, scoring 10 a gem × chain', () => {
    const g = gridOf(['BCD', 'EFG', 'AAA']);
    const step = clearMatches(g, 1, createRng(1))!;
    expect(step.scored).toBe(30);
    expect(step.cleared.size).toBe(3);
    // row 1 fell into row 2, row 0 into row 1
    expect(step.grid[2].map(c => c.charm).join('')).toBe('EFG');
    expect(step.grid[1].map(c => c.charm).join('')).toBe('BCD');
    expect(clearMatches(g, 2, createRng(1))!.scored).toBe(60);
    expect(clearMatches(gridOf(['ABC', 'BCA', 'CAB']), 1, createRng(1))).toBeNull();
  });

  it('a line of 4 scores a bonus and leaves a power gem of the same colour', () => {
    const g = gridOf(['BCDE', 'FGHI', 'JKLM', 'AAAA']);
    const step = clearMatches(g, 1, createRng(1))!;
    expect(step.scored).toBe(4 * 10 + 25);
    const power = step.grid.flat().filter(c => c.isPower);
    expect(power.length).toBe(1);
    expect(power[0].charm).toBe('A');
  });

  it('a matched power gem clears its whole row and column', () => {
    const g = gridOf(['BCDEF', 'GHIJK', 'A*AALM', 'NOPQR', 'STUVW']);
    const step = clearMatches(g, 1, createRng(1))!;
    // row 2 (5) + column 1 (5) − shared cell = 9
    expect(step.cleared.size).toBe(9);
  });
});

describe('swaps and swipes', () => {
  it('swaps neighbours', () => {
    const g = gridOf(['AB', 'CD']);
    const s = swap(g, [0, 0], [0, 1]);
    expect(s[0].map(c => c.charm).join('')).toBe('BA');
    expect(g[0].map(c => c.charm).join('')).toBe('AB'); // original untouched
    expect(isAdjacent([0, 0], [0, 1])).toBe(true);
    expect(isAdjacent([0, 0], [1, 1])).toBe(false);
  });

  it('a swipe picks the main direction, ignores short moves and the board edge', () => {
    expect(swipeTarget([3, 3], 40, 5, 20)).toEqual([3, 4]);
    expect(swipeTarget([3, 3], -5, -40, 20)).toEqual([2, 3]);
    expect(swipeTarget([3, 3], 10, 5, 20)).toBeNull();
    expect(swipeTarget([0, 0], -40, 0, 20)).toBeNull();
    expect(swipeTarget([SIZE - 1, 0], 0, 40, 20)).toBeNull();
  });
});
