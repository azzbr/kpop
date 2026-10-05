// Gem Match rules (match-3): finding matches, power gems, gravity, cascades and reshuffles.
// Pure functions — the component only handles input, animation and the timer.
import type { Rng } from '../../games/engine/rng';

export const SIZE = 7;
export const CHARMS = ['💖', '⭐', '🌸', '👑', '🎀', '💎'];
/** Badge drawn on a power gem (it keeps its colour, so it matches like a normal gem). */
export const POWER_BADGE = '⚡';
export const GAME_SECONDS = 60;

export type Cell = { id: number; charm: string; isPower: boolean };
export type Grid = Cell[][];
export type Pos = [number, number];

let idCounter = 0;
const nextId = () => ++idCounter;

export const randomCell = (rng: Rng): Cell => ({ id: nextId(), charm: CHARMS[Math.floor(rng() * CHARMS.length)], isPower: false });

export const isAdjacent = (a: Pos, b: Pos) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export function swap(grid: Grid, a: Pos, b: Pos): Grid {
  const g = grid.map(row => [...row]);
  [g[a[0]][a[1]], g[b[0]][b[1]]] = [g[b[0]][b[1]], g[a[0]][a[1]]];
  return g;
}

interface Run { r: number; c: number; len: number; dir: 'h' | 'v' }

function findRuns(grid: Grid): Run[] {
  const runs: Run[] = [];
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    let start = 0;
    for (let c = 1; c <= n; c++) {
      if (c < n && grid[r][c].charm === grid[r][start].charm) continue;
      if (c - start >= 3) runs.push({ r, c: start, len: c - start, dir: 'h' });
      start = c;
    }
  }
  for (let c = 0; c < n; c++) {
    let start = 0;
    for (let r = 1; r <= n; r++) {
      if (r < n && grid[r][c].charm === grid[start][c].charm) continue;
      if (r - start >= 3) runs.push({ r: start, c, len: r - start, dir: 'v' });
      start = r;
    }
  }
  return runs;
}

/** "r-c" keys of every gem in a line of 3 or more. */
export function findMatches(grid: Grid): Set<string> {
  const m = new Set<string>();
  for (const run of findRuns(grid)) {
    for (let k = 0; k < run.len; k++) m.add(run.dir === 'h' ? `${run.r}-${run.c + k}` : `${run.r + k}-${run.c}`);
  }
  return m;
}

/** True if at least one swap of neighbours would make a match. */
export function hasValidMove(grid: Grid): boolean {
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n && findMatches(swap(grid, [r, c], [r, c + 1])).size) return true;
      if (r + 1 < n && findMatches(swap(grid, [r, c], [r + 1, c])).size) return true;
    }
  }
  return false;
}

/** A new board with no ready-made matches and at least one move. */
export function freshGrid(rng: Rng, size = SIZE): Grid {
  for (;;) {
    const g = Array.from({ length: size }, () => Array.from({ length: size }, () => randomCell(rng)));
    if (findMatches(g).size === 0 && hasValidMove(g)) return g;
  }
}

/** The same gems shuffled into a board with no ready-made matches but at least one move. */
export function shuffleGrid(grid: Grid, rng: Rng): Grid {
  const n = grid.length;
  const cells = grid.flat();
  for (let attempt = 0; attempt < 200; attempt++) {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const next = Array.from({ length: n }, (_, r) => cells.slice(r * n, (r + 1) * n));
    if (findMatches(next).size === 0 && hasValidMove(next)) return next;
  }
  return freshGrid(rng, n); // very unlikely: these gems can't make a playable board
}

export interface MatchStep {
  grid: Grid;
  /** Gems that were cleared (to flash them). */
  cleared: Set<string>;
  scored: number;
}

/**
 * Clear one wave of matches. Every cleared gem is worth 10 × chain depth; a line of 4 adds 25,
 * 5+ adds 60, and a line of 4+ leaves a ⚡ power gem. A matched power gem clears its row and column.
 * Gems above fall down and new ones drop in. Returns null when there's nothing to clear.
 */
export function clearMatches(grid: Grid, chainDepth: number, rng: Rng): MatchStep | null {
  const runs = findRuns(grid);
  if (!runs.length) return null;
  const n = grid.length;
  const matches = findMatches(grid);

  // a line of 4+ leaves a power gem of its colour in the middle
  const powerSpawn = new Map<string, string>();
  for (const rn of runs) {
    if (rn.len >= 4) {
      const mid = Math.floor(rn.len / 2);
      powerSpawn.set(rn.dir === 'h' ? `${rn.r}-${rn.c + mid}` : `${rn.r + mid}-${rn.c}`, grid[rn.r][rn.c].charm);
    }
  }

  const cleared = new Set(matches);
  for (const key of matches) {
    const [r, c] = key.split('-').map(Number);
    if (grid[r][c].isPower) for (let i = 0; i < n; i++) { cleared.add(`${r}-${i}`); cleared.add(`${i}-${c}`); }
  }

  const scored = cleared.size * 10 * chainDepth
    + runs.filter(rn => rn.len === 4).length * 25
    + runs.filter(rn => rn.len >= 5).length * 60;

  const next: (Cell | null)[][] = grid.map(row => [...row]);
  for (const key of cleared) {
    const [r, c] = key.split('-').map(Number);
    next[r][c] = null;
  }
  for (const [key, charm] of powerSpawn) {
    const [r, c] = key.split('-').map(Number);
    next[r][c] = { id: nextId(), charm, isPower: true };
  }

  // gravity: compact each column downwards, fill the top with new gems
  for (let c = 0; c < n; c++) {
    const col: Cell[] = [];
    for (let r = n - 1; r >= 0; r--) if (next[r][c]) col.push(next[r][c]!);
    for (let r = n - 1; r >= 0; r--) next[r][c] = col.length ? col.shift()! : randomCell(rng);
  }
  return { grid: next as Grid, cleared, scored };
}

/** Direction of a swipe from its movement, or null when it's too short to count. */
export function swipeTarget(from: Pos, dx: number, dy: number, minDist: number, size = SIZE): Pos | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < minDist) return null;
  const to: Pos = Math.abs(dx) > Math.abs(dy) ? [from[0], from[1] + Math.sign(dx)] : [from[0] + Math.sign(dy), from[1]];
  if (to[0] < 0 || to[1] < 0 || to[0] >= size || to[1] >= size) return null;
  return to;
}
