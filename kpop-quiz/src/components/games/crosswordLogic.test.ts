import { describe, it, expect } from 'vitest';
import { PUZZLES } from '../../data/crossword';
import {
  emptyEntries, tapCell, typeLetter, backspace, clueAt, cellsOf, nextClue, orderedClues, isSolved, isFilled,
  checkCells, hintCell, crosswordScore, selectClue,
} from './crosswordLogic';

const p = PUZZLES[0]; // frame shape: across at rows 0 and 4, down at cols 0 and 4

describe('crossword selection', () => {
  it('a new cell keeps the direction when a word goes that way, else switches', () => {
    expect(tapCell(p, null, 'across', { r: 0, c: 2 })).toEqual({ sel: { r: 0, c: 2 }, dir: 'across' });
    // (2,0) is only in a Down word
    expect(tapCell(p, null, 'across', { r: 2, c: 0 })).toEqual({ sel: { r: 2, c: 0 }, dir: 'down' });
  });

  it('tapping the selected cell again toggles Across/Down when both exist', () => {
    expect(tapCell(p, { r: 0, c: 0 }, 'across', { r: 0, c: 0 }).dir).toBe('down');
    expect(tapCell(p, { r: 0, c: 0 }, 'down', { r: 0, c: 0 }).dir).toBe('across');
    // only a Down word here, so it stays Down
    expect(tapCell(p, { r: 2, c: 0 }, 'down', { r: 2, c: 0 }).dir).toBe('down');
  });

  it('black cells cannot be selected', () => {
    expect(tapCell(p, { r: 0, c: 0 }, 'across', { r: 2, c: 2 })).toEqual({ sel: { r: 0, c: 0 }, dir: 'across' });
  });

  it('selecting a clue jumps to its first empty cell', () => {
    const cl = clueAt(p, { r: 0, c: 0 }, 'across')!;
    let e = emptyEntries(p);
    expect(selectClue(cl, e).sel).toEqual({ r: 0, c: 0 });
    e = typeLetter(p, e, { r: 0, c: 0 }, 'across', 'S').entries;
    expect(selectClue(cl, e).sel).toEqual({ r: 0, c: 1 });
  });
});

describe('crossword typing', () => {
  it('auto-advances along the word and stops at its end', () => {
    let e = emptyEntries(p);
    let sel = { r: 0, c: 3 };
    ({ entries: e, sel } = typeLetter(p, e, sel, 'across', 'r'));
    expect(e[0][3]).toBe('R');
    expect(sel).toEqual({ r: 0, c: 4 });
    ({ entries: e, sel } = typeLetter(p, e, sel, 'across', 'S'));
    expect(sel).toEqual({ r: 0, c: 4 });
  });

  it('auto-advances downwards in Down mode', () => {
    const { sel } = typeLetter(p, emptyEntries(p), { r: 0, c: 0 }, 'down', 'S');
    expect(sel).toEqual({ r: 1, c: 0 });
  });

  it('backspace clears the cell, then moves back and clears the one before', () => {
    let e = emptyEntries(p);
    let sel = { r: 0, c: 0 };
    ({ entries: e, sel } = typeLetter(p, e, sel, 'across', 'S'));
    ({ entries: e, sel } = typeLetter(p, e, sel, 'across', 'T'));
    expect(sel).toEqual({ r: 0, c: 2 });
    ({ entries: e, sel } = backspace(p, e, sel, 'across')); // empty cell → back + clear T
    expect(sel).toEqual({ r: 0, c: 1 });
    expect(e[0][1]).toBe('');
    expect(e[0][0]).toBe('S');
    ({ entries: e, sel } = backspace(p, e, sel, 'across')); // empty → back + clear S
    expect(sel).toEqual({ r: 0, c: 0 });
    expect(e[0][0]).toBe('');
    ({ entries: e, sel } = backspace(p, e, sel, 'across')); // start of word: stays
    expect(sel).toEqual({ r: 0, c: 0 });
  });

  it('next clue cycles through every clue in order', () => {
    const list = orderedClues(p);
    let cl = nextClue(p, undefined);
    const seen = [cl];
    for (let i = 1; i < list.length; i++) { cl = nextClue(p, cl); seen.push(cl); }
    expect(seen).toEqual(list);
    expect(nextClue(p, cl)).toBe(list[0]);
  });
});

describe('crossword checking and scoring', () => {
  it.each(PUZZLES.map(x => [x.name, x] as const))('%s can be solved by typing every answer', (_, puz) => {
    let e = emptyEntries(puz);
    for (const cl of puz.clues) {
      let sel = cellsOf(cl)[0];
      for (const ch of cl.answer) ({ entries: e, sel } = typeLetter(puz, e, sel, cl.dir, ch));
    }
    expect(isFilled(puz, e)).toBe(true);
    expect(isSolved(puz, e)).toBe(true);
    expect([...checkCells(puz, e).values()].every(Boolean)).toBe(true);
    expect(hintCell(puz, e, null)).toBeNull();
  });

  it('marks right and wrong letters, ignores empty cells', () => {
    let e = emptyEntries(p);
    e = typeLetter(p, e, { r: 0, c: 0 }, 'across', p.rows[0][0]).entries;
    e = typeLetter(p, e, { r: 0, c: 1 }, 'across', 'Z').entries;
    const m = checkCells(p, e);
    expect(m.get('0-0')).toBe(true);
    expect(m.get('0-1')).toBe(false);
    expect(m.has('0-2')).toBe(false);
    expect(isSolved(p, e)).toBe(false);
    expect(hintCell(p, e, { r: 0, c: 0 })).toEqual({ r: 0, c: 1 });
    expect(hintCell(p, e, { r: 4, c: 4 })).toEqual({ r: 4, c: 4 });
  });

  it('score: 1000 minus time and hints, never below 100', () => {
    expect(crosswordScore(0, 0)).toBe(1000);
    expect(crosswordScore(100, 1)).toBe(700);
    expect(crosswordScore(10000, 9)).toBe(100);
  });
});
