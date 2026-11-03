// Picture Puzzles (nonograms): fill squares so every row and column matches its number clues.
// When the filled squares match the picture, the full-colour picture appears.
// Pure rules — no React. The line solver proves every picture can be solved without guessing.

/** What she has put in a square. Marks (❌ "this stays empty") never count towards the answer. */
export const EMPTY = 0;
export const FILLED = 1;
export const MARKED = 2;
export type CellState = typeof EMPTY | typeof FILLED | typeof MARKED;

/** Her board, row by row. */
export type Board = CellState[][];
/** The answer, row by row: true = filled. */
export type Solution = boolean[][];
/** Run lengths of filled squares in one line, in order. An empty line has no runs ([]; shown as "0"). */
export type Clue = number[];
/** Line-solver knowledge of a square: -1 unknown, 0 empty, 1 filled. */
export type Known = -1 | 0 | 1;
export type PaintMode = 'fill' | 'mark';
export interface Pos { r: number; c: number }

export interface PictureLevel {
  id: 'small' | 'medium' | 'big';
  name: string;
  size: number;
  /** Points for an instant solve; the time part drops towards 30 % of this by `par` seconds. */
  base: number;
  par: number;
}

export const PICTURE_LEVELS: PictureLevel[] = [
  { id: 'small', name: 'Small', size: 5, base: 300, par: 90 },
  { id: 'medium', name: 'Medium', size: 8, base: 500, par: 240 },
  { id: 'big', name: 'Big', size: 10, base: 700, par: 420 },
];

/** Points for a solve: faster is better (never below 30 %), each hint takes 10 % off (never below 50 %). */
export function pictureScore(level: PictureLevel, seconds: number, hints: number): number {
  return Math.round(level.base * Math.max(0.3, 1 - seconds / level.par) * Math.max(0.5, 1 - 0.1 * hints));
}

// ---------- clues & grid helpers ----------

export function cluesOf(line: readonly boolean[]): Clue {
  const out: number[] = [];
  let run = 0;
  for (const on of line) {
    if (on) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out;
}

/** A picture's rows ('.' = empty, any other letter = filled) as a solution grid. */
export const solutionFromRows = (rows: readonly string[]): Solution => rows.map(row => [...row].map(ch => ch !== '.'));

export const column = <T>(grid: readonly (readonly T[])[], c: number): T[] => grid.map(row => row[c]);
export const rowCluesOf = (solution: Solution): Clue[] => solution.map(row => cluesOf(row));
export const colCluesOf = (solution: Solution): Clue[] => solution[0].map((_, c) => cluesOf(column(solution, c)));

export const emptyBoard = (size: number): Board => Array.from({ length: size }, () => Array<CellState>(size).fill(EMPTY));
export const boardFromSolution = (solution: Solution): Board => solution.map(row => row.map(on => (on ? FILLED : EMPTY)));

export function setCell(board: Board, r: number, c: number, state: CellState): Board {
  if (board[r]?.[c] === undefined || board[r][c] === state) return board;
  return board.map((row, i) => (i === r ? row.map((s, j) => (j === c ? state : s)) : row));
}
export const fillCell = (board: Board, r: number, c: number) => setCell(board, r, c, FILLED);
export const markCell = (board: Board, r: number, c: number) => setCell(board, r, c, MARKED);
export const clearCell = (board: Board, r: number, c: number) => setCell(board, r, c, EMPTY);

/**
 * What a touch (or a drag starting) on a square in this state does: in ✏️ Fill mode it fills,
 * or clears a filled square; in ❌ Mark mode it marks, or clears a marked square.
 */
export function paintTarget(mode: PaintMode, first: CellState): CellState {
  if (mode === 'fill') return first === FILLED ? EMPTY : FILLED;
  return first === MARKED ? EMPTY : MARKED;
}

/**
 * Paint a drag: every square in `cells` that is in the same state as the first square was (`from`)
 * becomes `to`. So dragging from an empty square fills empty squares only and leaves marks alone.
 */
export function paintCells(board: Board, cells: readonly Pos[], from: CellState, to: CellState): Board {
  let out = board;
  for (const { r, c } of cells) if (board[r]?.[c] === from) out = setCell(out, r, c, to);
  return out;
}

export type DragAxis = 'row' | 'col';

/** The axis a drag locks to once the finger leaves the first square: along the row or down the column. */
export const dragAxis = (start: Pos, cur: Pos): DragAxis => (Math.abs(cur.c - start.c) >= Math.abs(cur.r - start.r) ? 'row' : 'col');

/** The straight run of squares from `start` towards `cur`, along `axis` (just `start` when no axis yet). */
export function dragRun(start: Pos, cur: Pos, axis: DragAxis | null): Pos[] {
  if (!axis) return [start];
  const out: Pos[] = [];
  if (axis === 'row') {
    const step = cur.c >= start.c ? 1 : -1;
    for (let c = start.c; c !== cur.c + step; c += step) out.push({ r: start.r, c });
  } else {
    const step = cur.r >= start.r ? 1 : -1;
    for (let r = start.r; r !== cur.r + step; r += step) out.push({ r, c: start.c });
  }
  return out;
}

/** A line matches its clue (the clue dims). Only filled squares count. */
export const lineDone = (line: readonly CellState[], clue: Clue): boolean => {
  const got = cluesOf(line.map(s => s === FILLED));
  return got.length === clue.length && got.every((n, i) => n === clue[i]);
};
export const rowsDone = (board: Board, clues: Clue[]): boolean[] => board.map((row, r) => lineDone(row, clues[r]));
export const colsDone = (board: Board, clues: Clue[]): boolean[] => clues.map((clue, c) => lineDone(column(board, c), clue));

/** Solved when the filled squares are exactly the picture's squares. Marks are ignored. */
export function isSolved(fills: Board, solution: Solution): boolean {
  if (fills.length !== solution.length) return false;
  return solution.every((row, r) => fills[r]?.length === row.length && row.every((on, c) => (fills[r][c] === FILLED) === on));
}

export const filledCount = (board: Board): number => board.reduce((n, row) => n + row.filter(s => s === FILLED).length, 0);
export const solutionCount = (solution: Solution): number => solution.reduce((n, row) => n + row.filter(Boolean).length, 0);

// ---------- line solver ----------

/**
 * One line: every placement of the clue's runs that fits the known squares. A square that is filled
 * in all of them (or empty in all of them) is forced. Returns the line with forced squares filled in,
 * or null if no placement fits (a contradiction).
 */
export function solveLine(clue: Clue, known: readonly Known[]): Known[] | null {
  const n = known.length;
  const blocks = clue.filter(b => b > 0);
  const k = blocks.length;
  // emptiesBefore[i] = how many squares known empty in 0..i-1; noFillFrom[i] = nothing known filled in i..n-1
  const emptiesBefore = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) emptiesBefore[i + 1] = emptiesBefore[i] + (known[i] === 0 ? 1 : 0);
  const noFillFrom = new Array<boolean>(n + 1).fill(true);
  for (let i = n - 1; i >= 0; i--) noFillFrom[i] = noFillFrom[i + 1] && known[i] !== 1;

  const W = n + 2;
  const memo = new Int8Array((k + 1) * W).fill(-1);
  // Can run j and the ones after it fit in squares i..n-1 (square i may start a run)?
  const fits = (i: number, j: number): boolean => {
    if (j === k) return noFillFrom[Math.min(i, n)];
    if (i >= n) return false;
    const key = j * W + i;
    if (memo[key] >= 0) return memo[key] === 1;
    const ok = (known[i] !== 1 && fits(i + 1, j)) || placeAt(i, j);
    memo[key] = ok ? 1 : 0;
    return ok;
  };
  // Can run j start at square i (with an empty square or the line's end after it), and the rest fit?
  const placeAt = (i: number, j: number): boolean => {
    const end = i + blocks[j];
    if (end > n || emptiesBefore[end] - emptiesBefore[i] > 0) return false;
    if (end === n) return j + 1 === k;
    return known[end] !== 1 && fits(end + 1, j + 1);
  };

  if (!fits(0, 0)) return null;

  const canFill = new Array<boolean>(n).fill(false);
  const canEmpty = new Array<boolean>(n).fill(false);
  const seen = new Uint8Array((k + 1) * W);
  const walk = (i: number, j: number) => {
    const key = j * W + Math.min(i, n);
    if (seen[key]) return;
    seen[key] = 1;
    if (j === k) { for (let t = i; t < n; t++) canEmpty[t] = true; return; }
    if (i >= n) return;
    if (known[i] !== 1 && fits(i + 1, j)) { canEmpty[i] = true; walk(i + 1, j); }
    if (placeAt(i, j)) {
      const end = i + blocks[j];
      for (let t = i; t < end; t++) canFill[t] = true;
      if (end < n) { canEmpty[end] = true; walk(end + 1, j + 1); }
    }
  };
  walk(0, 0);

  return known.map((_, t) => (canFill[t] && canEmpty[t] ? -1 : canFill[t] ? 1 : 0));
}

/**
 * Solve lines over and over (every row, then every column) until nothing new is forced.
 * Returns the knowledge at that point, or null if the clues contradict the knowns.
 */
export function propagate(rowClues: Clue[], colClues: Clue[], start: readonly (readonly Known[])[]): Known[][] | null {
  const rows = rowClues.length, cols = colClues.length;
  const known = start.map(row => [...row]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      const res = solveLine(rowClues[r], known[r]);
      if (!res) return null;
      for (let c = 0; c < cols; c++) if (res[c] !== known[r][c]) { known[r][c] = res[c]; changed = true; }
    }
    for (let c = 0; c < cols; c++) {
      const res = solveLine(colClues[c], column(known, c));
      if (!res) return null;
      for (let r = 0; r < rows; r++) if (res[r] !== known[r][c]) { known[r][c] = res[r]; changed = true; }
    }
  }
  return known;
}

/** Solve with line logic only (no guessing). The solved grid, or null if it gets stuck or the clues clash. */
export function solveByLines(rowClues: Clue[], colClues: Clue[]): Solution | null {
  const start: Known[][] = rowClues.map(() => colClues.map(() => -1 as Known));
  const known = propagate(rowClues, colClues, start);
  if (!known || known.some(row => row.includes(-1))) return null;
  return known.map(row => row.map(v => v === 1));
}

// ---------- hints ----------

/** What she has got right so far: correct fills are known filled, correct marks known empty; anything wrong is ignored. */
export function knownFromBoard(board: Board, solution: Solution): Known[][] {
  return solution.map((row, r) => row.map((on, c) => {
    const s = board[r]?.[c];
    if (s === FILLED && on) return 1;
    if (s === MARKED && !on) return 0;
    return -1;
  }));
}

/**
 * One square she hasn't filled yet that is filled in the picture. Prefers a square that one row or
 * column can tell her right now from her correct squares (the line where most squares are forced),
 * then any square line logic can reach, then any missing square. Null when nothing is missing.
 */
export function hintCell(board: Board, solution: Solution, rowClues: Clue[] = rowCluesOf(solution), colClues: Clue[] = colCluesOf(solution)): Pos | null {
  const missing = (r: number, c: number) => solution[r][c] && board[r]?.[c] !== FILLED;
  const known = knownFromBoard(board, solution);
  const size = solution.length;

  let best: Pos[] = [];
  const consider = (cells: Pos[]) => { if (cells.length > best.length) best = cells; };
  for (let r = 0; r < size; r++) {
    const res = solveLine(rowClues[r], known[r]);
    if (res) consider(res.flatMap((v, c) => (v === 1 && missing(r, c) ? [{ r, c }] : [])));
  }
  for (let c = 0; c < solution[0].length; c++) {
    const res = solveLine(colClues[c], column(known, c));
    if (res) consider(res.flatMap((v, r) => (v === 1 && missing(r, c) ? [{ r, c }] : [])));
  }
  if (best.length) return best[0];

  const deep = propagate(rowClues, colClues, known);
  const all: Pos[] = [];
  solution.forEach((row, r) => row.forEach((_, c) => { if (missing(r, c)) all.push({ r, c }); }));
  return all.find(({ r, c }) => deep?.[r][c] === 1) ?? all[0] ?? null;
}

/** A square she filled that stays empty in the picture (for a hint once nothing is missing), or null. */
export function wrongCell(board: Board, solution: Solution): Pos | null {
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[r].length; c++) if (board[r]?.[c] === FILLED && !solution[r][c]) return { r, c };
  }
  return null;
}

/** "a" or "an" before a picture's name: "You made an 🦉 Owl!". */
export const article = (name: string): 'a' | 'an' => (/^[aeiou]/i.test(name.trim()) ? 'an' : 'a');

// ---------- picking the next picture ----------

/**
 * The next picture to play: the first one she hasn't solved yet (in list order); once all are
 * solved, the one after `lastId` (going round), or a random one if there is no last one.
 */
export function nextPicture(ids: readonly string[], solved: ReadonlySet<string>, lastId?: string, rnd: () => number = Math.random): string {
  const fresh = ids.find(id => !solved.has(id));
  if (fresh) return fresh;
  const at = lastId ? ids.indexOf(lastId) : -1;
  if (at >= 0) return ids[(at + 1) % ids.length];
  return ids[Math.floor(rnd() * ids.length) % ids.length];
}
