import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { slideLine, fromGrid, toGrid, move, canMove, isGameOver, newGame, spawnTile, emptyBoard } from './game2048Logic';

const U = 0, R = 1, D = 2, L = 3;

/** Moves without counting the spawned tile: compare only the slid cells. */
function slid(grid: number[][], dir: 0 | 1 | 2 | 3) {
  const res = move(fromGrid(grid), dir, createRng(1));
  // Remove the one tile that was spawned this move.
  const spawned = res.board.tiles.find(t => t.isNew);
  const g = toGrid(res.board);
  if (spawned) g[spawned.row][spawned.col] = 0;
  return { grid: g, res };
}

describe('slideLine', () => {
  it('[2,2,2,2] → [4,4]', () => {
    expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 });
  });
  it('[4,4,8] → [8,8] (no double merge into 16)', () => {
    expect(slideLine([4, 4, 8, 0])).toEqual({ line: [8, 8, 0, 0], gained: 8 });
  });
  it('[2,2,4,4] → [4,8]', () => {
    expect(slideLine([2, 2, 4, 4])).toEqual({ line: [4, 8, 0, 0], gained: 12 });
  });
  it('merges from the side tiles move towards', () => {
    expect(slideLine([2, 2, 2, 0]).line).toEqual([4, 2, 0, 0]);
    expect(slideLine([0, 2, 0, 2]).line).toEqual([4, 0, 0, 0]);
  });
  it('does not merge different values', () => {
    expect(slideLine([2, 4, 2, 4])).toEqual({ line: [2, 4, 2, 4], gained: 0 });
  });
  it('a merged tile does not merge again in the same move', () => {
    expect(slideLine([8, 4, 4, 0]).line).toEqual([8, 8, 0, 0]);
  });
});

describe('moves in all four directions', () => {
  const g = [
    [2, 0, 0, 2],
    [0, 4, 0, 4],
    [0, 0, 0, 0],
    [2, 0, 8, 8],
  ];
  it('left', () => {
    expect(slid(g, L).grid).toEqual([[4, 0, 0, 0], [8, 0, 0, 0], [0, 0, 0, 0], [2, 16, 0, 0]]);
  });
  it('right', () => {
    expect(slid(g, R).grid).toEqual([[0, 0, 0, 4], [0, 0, 0, 8], [0, 0, 0, 0], [0, 0, 2, 16]]);
  });
  it('up', () => {
    expect(slid(g, U).grid).toEqual([[4, 4, 8, 2], [0, 0, 0, 4], [0, 0, 0, 8], [0, 0, 0, 0]]);
  });
  it('down', () => {
    expect(slid(g, D).grid).toEqual([[0, 0, 0, 0], [0, 0, 0, 2], [0, 0, 0, 4], [4, 4, 8, 8]]);
  });
  it('column [2,2,2,2] moving down → [_,_,4,4]', () => {
    const col = [[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]];
    expect(slid(col, D).grid.map(r => r[0])).toEqual([0, 0, 4, 4]);
  });
});

describe('spawning', () => {
  it('a no-op move changes nothing and spawns nothing', () => {
    const b = fromGrid([[2, 4, 0, 0], [4, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const res = move(b, L, createRng(3));
    expect(res.moved).toBe(false);
    expect(res.board).toBe(b);
    expect(res.board.tiles).toHaveLength(4);
  });
  it('a real move spawns exactly one tile, 2 or 4, on an empty cell', () => {
    const b = fromGrid([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const res = move(b, L, createRng(3));
    expect(res.moved).toBe(true);
    const live = res.board.tiles.filter(t => !t.gone);
    expect(live).toHaveLength(2);
    const fresh = live.find(t => t.isNew)!;
    expect([2, 4]).toContain(fresh.value);
    expect(fresh.row === 0 && fresh.col === 0).toBe(false);
  });
  it('spawns roughly 90% twos and 10% fours', () => {
    const rng = createRng(42);
    let fours = 0;
    for (let i = 0; i < 2000; i++) {
      const b = spawnTile(emptyBoard(), rng);
      if (b.tiles[0].value === 4) fours++;
    }
    expect(fours / 2000).toBeGreaterThan(0.07);
    expect(fours / 2000).toBeLessThan(0.13);
  });
  it('a new game has two tiles and is deterministic for a seed', () => {
    const a = newGame(createRng(7));
    const b = newGame(createRng(7));
    expect(a.tiles).toHaveLength(2);
    expect(toGrid(a)).toEqual(toGrid(b));
  });
  it('does not mutate the old board (so Undo can keep it)', () => {
    const b = fromGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const before = JSON.stringify(b);
    move(b, R, createRng(1));
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe('scoring', () => {
  it('adds the value of every merged tile', () => {
    const b = fromGrid([[2, 2, 4, 4], [8, 8, 0, 0], [0, 0, 0, 0], [16, 0, 0, 16]], 100);
    const res = move(b, L, createRng(1));
    expect(res.gained).toBe(4 + 8 + 16 + 32);
    expect(res.board.score).toBe(100 + 60);
    expect(res.mergedValues.sort((a, b) => a - b)).toEqual([4, 8, 16, 32]);
  });
  it('sliding without merging gives no points', () => {
    const res = move(fromGrid([[0, 2, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), L, createRng(1));
    expect(res.moved).toBe(true);
    expect(res.gained).toBe(0);
  });
  it('tracks the biggest tile', () => {
    const res = move(fromGrid([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), L, createRng(1));
    expect(res.board.best).toBe(2048);
  });
  it('merged-away tiles are marked gone and drop out after the next move', () => {
    const r1 = move(fromGrid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), L, createRng(1));
    expect(r1.board.tiles.filter(t => t.gone)).toHaveLength(2);
    const r2 = move(r1.board, R, createRng(2));
    expect(r2.board.tiles.some(t => t.gone && r1.board.tiles.some(o => o.id === t.id && o.gone))).toBe(false);
  });
});

describe('game over', () => {
  it('a full board with no equal neighbours is over', () => {
    const b = fromGrid([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
    expect(canMove(b)).toBe(false);
    expect(isGameOver(b)).toBe(true);
    for (const d of [U, R, D, L] as const) expect(move(b, d, createRng(1)).moved).toBe(false);
  });
  it('a full board with an equal pair (horizontal or vertical) is not over', () => {
    expect(isGameOver(fromGrid([[2, 2, 4, 8], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]]))).toBe(false);
    expect(isGameOver(fromGrid([[2, 4, 2, 4], [4, 8, 4, 2], [2, 8, 2, 4], [4, 2, 4, 2]]))).toBe(false);
  });
  it('a board with an empty cell is not over', () => {
    expect(isGameOver(fromGrid([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 0, 4], [4, 2, 4, 2]]))).toBe(false);
  });
  it('random play always ends with a consistent score', () => {
    const rng = createRng(99);
    let b = newGame(rng);
    let total = 0;
    for (let i = 0; i < 5000 && !isGameOver(b); i++) {
      const res = move(b, Math.floor(rng() * 4) as 0 | 1 | 2 | 3, rng);
      total += res.gained;
      b = res.board;
    }
    expect(isGameOver(b)).toBe(true);
    expect(b.score).toBe(total);
    // Score equals the sum over merges, which is at least the value of the tiles above 4.
    expect(b.score).toBeGreaterThan(0);
  });
});
