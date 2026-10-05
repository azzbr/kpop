// Crossword Mini rules: selection, typing with auto-advance, checking and scoring.
// Pure functions (no React) so they can be tested — see crosswordLogic.test.ts.
import { isBlackCell } from '../../data/crossword';
import type { CrosswordClue, CrosswordPuzzle, Dir } from '../../data/crossword';

export interface Pos { r: number; c: number }
/** What the player has typed: one letter or '' per cell (black cells stay ''). */
export type Entries = string[][];

export const emptyEntries = (p: CrosswordPuzzle): Entries => p.rows.map(row => row.split('').map(() => ''));

export function cellsOf(cl: CrosswordClue): Pos[] {
  return Array.from({ length: cl.answer.length }, (_, i) =>
    cl.dir === 'across' ? { r: cl.row, c: cl.col + i } : { r: cl.row + i, c: cl.col });
}

/** Clues in reading order: all Across, then all Down. */
export const orderedClues = (p: CrosswordPuzzle): CrosswordClue[] => [
  ...p.clues.filter(c => c.dir === 'across').sort((a, b) => a.id - b.id),
  ...p.clues.filter(c => c.dir === 'down').sort((a, b) => a.id - b.id),
];

/** The clue in direction `dir` whose word covers (r, c), if any. */
export function clueAt(p: CrosswordPuzzle, pos: Pos, dir: Dir): CrosswordClue | undefined {
  return p.clues.find(cl => cl.dir === dir && cellsOf(cl).some(x => x.r === pos.r && x.c === pos.c));
}

const other = (d: Dir): Dir => (d === 'across' ? 'down' : 'across');

/**
 * Tapping a cell: a new cell is selected keeping the direction when a word goes that way;
 * tapping the selected cell again switches Across/Down (when both exist).
 */
export function tapCell(p: CrosswordPuzzle, sel: Pos | null, dir: Dir, pos: Pos): { sel: Pos | null; dir: Dir } {
  if (isBlackCell(p, pos.r, pos.c)) return { sel, dir };
  if (sel && sel.r === pos.r && sel.c === pos.c) {
    return { sel, dir: clueAt(p, pos, other(dir)) ? other(dir) : dir };
  }
  return { sel: pos, dir: clueAt(p, pos, dir) ? dir : other(dir) };
}

/** Selecting a clue jumps to its first empty cell (or its first cell when it's full). */
export function selectClue(cl: CrosswordClue, entries: Entries): { sel: Pos; dir: Dir } {
  const cells = cellsOf(cl);
  return { sel: cells.find(x => !entries[x.r][x.c]) ?? cells[0], dir: cl.dir };
}

/** Type a letter in the selected cell and move to the next cell of the word. */
export function typeLetter(p: CrosswordPuzzle, entries: Entries, sel: Pos, dir: Dir, letter: string): { entries: Entries; sel: Pos } {
  const next = entries.map(row => [...row]);
  next[sel.r][sel.c] = letter.toUpperCase();
  const cl = clueAt(p, sel, dir);
  if (!cl) return { entries: next, sel };
  const cells = cellsOf(cl);
  const i = cells.findIndex(x => x.r === sel.r && x.c === sel.c);
  return { entries: next, sel: cells[Math.min(i + 1, cells.length - 1)] };
}

/** Backspace: clear this cell, or (when it's already empty) step back one cell and clear that. */
export function backspace(p: CrosswordPuzzle, entries: Entries, sel: Pos, dir: Dir): { entries: Entries; sel: Pos } {
  const next = entries.map(row => [...row]);
  if (next[sel.r][sel.c]) {
    next[sel.r][sel.c] = '';
    return { entries: next, sel };
  }
  const cl = clueAt(p, sel, dir);
  if (!cl) return { entries: next, sel };
  const cells = cellsOf(cl);
  const i = cells.findIndex(x => x.r === sel.r && x.c === sel.c);
  if (i <= 0) return { entries: next, sel };
  const prev = cells[i - 1];
  next[prev.r][prev.c] = '';
  return { entries: next, sel: prev };
}

/** The clue after `cl` in reading order (wraps around). */
export function nextClue(p: CrosswordPuzzle, cl: CrosswordClue | undefined): CrosswordClue {
  const list = orderedClues(p);
  if (!cl) return list[0];
  const i = list.findIndex(x => x.id === cl.id && x.dir === cl.dir);
  return list[(i + 1) % list.length];
}

const whiteCells = (p: CrosswordPuzzle): Pos[] =>
  p.rows.flatMap((row, r) => row.split('').map((_, c) => ({ r, c }))).filter(x => !isBlackCell(p, x.r, x.c));

export const isFilled = (p: CrosswordPuzzle, e: Entries) => whiteCells(p).every(x => e[x.r][x.c] !== '');
export const isSolved = (p: CrosswordPuzzle, e: Entries) => whiteCells(p).every(x => e[x.r][x.c] === p.rows[x.r][x.c]);

/** "r-c" → true (right) / false (wrong) for every filled cell. Empty cells aren't marked. */
export function checkCells(p: CrosswordPuzzle, e: Entries): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const x of whiteCells(p)) if (e[x.r][x.c]) m.set(`${x.r}-${x.c}`, e[x.r][x.c] === p.rows[x.r][x.c]);
  return m;
}

/** Hint: the correct letter for the selected cell (or the first wrong/empty cell when it's already right). */
export function hintCell(p: CrosswordPuzzle, e: Entries, sel: Pos | null): Pos | null {
  if (sel && !isBlackCell(p, sel.r, sel.c) && e[sel.r][sel.c] !== p.rows[sel.r][sel.c]) return sel;
  return whiteCells(p).find(x => e[x.r][x.c] !== p.rows[x.r][x.c]) ?? null;
}

export const CROSSWORD_MAX_SCORE = 1000;
export const HINT_COST = 100;
/** 1000 points, minus 2 a second and 100 a hint — never below 100 for a solved puzzle. */
export function crosswordScore(seconds: number, hints: number): number {
  return Math.max(100, Math.round(CROSSWORD_MAX_SCORE - 2 * seconds - HINT_COST * hints));
}
