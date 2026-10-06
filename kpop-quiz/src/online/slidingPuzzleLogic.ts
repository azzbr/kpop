// Sliding Puzzle rules for the PuzzleRace engine. Boards are scrambled by random legal moves
// from the solved board, so they're always solvable (isSolvable proves it in the tests).
import type { Rng } from '../games/engine/rng';

export interface SlSpec { n: number; scr: number; ms: number }
export const SL_DIFF: Record<string, SlSpec> = {
  easy: { n: 3, scr: 40, ms: 120000 },
  medium: { n: 3, scr: 80, ms: 120000 },
  hard: { n: 4, scr: 130, ms: 180000 },
  expert: { n: 4, scr: 220, ms: 180000 },
  master: { n: 5, scr: 280, ms: 300000 },
  legend: { n: 5, scr: 450, ms: 300000 },
};
export const slSpec = (d: string | undefined) => SL_DIFF[d || 'easy'] || SL_DIFF.easy;

export interface SlPuzzle { n: number; board: number[] }
/** `moves` = the cell index of each tile slid into the gap, in order (the host replays them). */
export interface SlState { board: number[]; moves: number[] }

export const solvedBoard = (n: number) => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));

export function isSolvedBoard(b: number[]): boolean {
  for (let i = 0; i < b.length - 1; i++) if (b[i] !== i + 1) return false;
  return b[b.length - 1] === 0;
}

const adjacent = (a: number, b: number, n: number) =>
  (Math.floor(a / n) === Math.floor(b / n) && Math.abs(a - b) === 1) || Math.abs(a - b) === n;

/** Classic parity rule for the n×n sliding puzzle. */
export function isSolvable(b: number[], n: number): boolean {
  const tiles = b.filter(v => v !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = n - Math.floor(b.indexOf(0) / n);
  return (inv + blankRowFromBottom) % 2 === 1;
}

export function slGenerate(difficulty: string | undefined, rng: Rng): SlPuzzle {
  const { n, scr } = slSpec(difficulty);
  let board: number[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    board = solvedBoard(n);
    let blank = n * n - 1;
    let prev = -1;
    for (let i = 0; i < scr; i++) {
      const r = Math.floor(blank / n);
      const c = blank % n;
      const nbrs: number[] = [];
      if (r > 0) nbrs.push(blank - n);
      if (r < n - 1) nbrs.push(blank + n);
      if (c > 0) nbrs.push(blank - 1);
      if (c < n - 1) nbrs.push(blank + 1);
      const choices = nbrs.filter(x => x !== prev); // don't just undo the last move
      const p = choices[Math.floor(rng() * choices.length)];
      board[blank] = board[p];
      board[p] = 0;
      prev = blank;
      blank = p;
    }
    // make sure at least a third of the tiles are out of place
    const wrong = board.filter((v, i) => v !== 0 && v !== i + 1).length;
    if (!isSolvedBoard(board) && wrong >= Math.ceil((n * n - 1) / 3)) break;
  }
  return { n, board };
}

/** Slides the tile at `idx` (and any tiles between it and the gap, same row/column). Returns the new state. */
export function slSlide(n: number, s: SlState, idx: number): SlState {
  let board = s.board;
  const moves = [...s.moves];
  let blank = board.indexOf(0);
  const r = Math.floor(idx / n), c = idx % n;
  const br = Math.floor(blank / n), bc = blank % n;
  if (idx === blank || (r !== br && c !== bc)) return s;
  const step = r === br ? (c > bc ? 1 : -1) : (r > br ? n : -n);
  board = [...board];
  while (blank !== idx) {
    const next = blank + step;
    board[blank] = board[next];
    board[next] = 0;
    moves.push(next);
    blank = next;
  }
  return { board, moves };
}

/** Host check: replay the moves from the start board; every move must be legal and end solved. */
export function slCheck(p: SlPuzzle, moves: unknown): boolean {
  if (!Array.isArray(moves) || moves.length > 20000) return false;
  const b = [...p.board];
  let blank = b.indexOf(0);
  for (const m of moves) {
    if (!Number.isInteger(m) || m < 0 || m >= b.length || !adjacent(m, blank, p.n)) return false;
    b[blank] = b[m];
    b[m] = 0;
    blank = m;
  }
  return isSolvedBoard(b);
}

export const slInit = (p: SlPuzzle): SlState => ({ board: [...p.board], moves: [] });
export const slSolved = (_p: SlPuzzle, s: SlState) => isSolvedBoard(s.board);
export function slProgress(p: SlPuzzle, s: SlState): number {
  if (isSolvedBoard(s.board)) return 1;
  const ok = s.board.filter((v, i) => v !== 0 && v === i + 1).length;
  return Math.min(0.95, ok / (p.n * p.n - 1));
}
