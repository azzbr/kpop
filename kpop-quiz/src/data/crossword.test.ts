import { describe, it, expect } from 'vitest';
import { PUZZLES, CROSSWORD_SIZE, clueNumbers, isBlackCell } from './crossword';
import type { CrosswordPuzzle } from './crossword';

/** Every run of 2+ white cells in the grid, as {dir,row,col,word}. */
function gridWords(p: CrosswordPuzzle) {
  const words: { dir: 'across' | 'down'; row: number; col: number; word: string }[] = [];
  const size = p.rows.length;
  for (const dir of ['across', 'down'] as const) {
    for (let a = 0; a < size; a++) {
      let start = -1;
      let word = '';
      for (let b = 0; b <= size; b++) {
        const [r, c] = dir === 'across' ? [a, b] : [b, a];
        const white = b < size && !isBlackCell(p, r, c);
        if (white) {
          if (start < 0) start = b;
          word += p.rows[r][c];
        } else {
          if (word.length >= 2) {
            words.push(dir === 'across' ? { dir, row: a, col: start, word } : { dir, row: start, col: a, word });
          }
          start = -1;
          word = '';
        }
      }
    }
  }
  return words;
}

describe('crossword puzzles', () => {
  it('has 5 puzzles', () => {
    expect(PUZZLES.length).toBe(5);
  });

  describe.each(PUZZLES.map(p => [p.name, p] as const))('%s', (_, p) => {
    it('is a 5×5 grid of capital letters and #', () => {
      expect(p.rows.length).toBe(CROSSWORD_SIZE);
      for (const row of p.rows) expect(row).toMatch(/^[A-Z#]{5}$/);
    });

    it('grid letters agree with every across and down answer', () => {
      for (const cl of p.clues) {
        expect(cl.answer).toMatch(/^[A-Z]+$/);
        for (let i = 0; i < cl.answer.length; i++) {
          const r = cl.dir === 'across' ? cl.row : cl.row + i;
          const c = cl.dir === 'across' ? cl.col + i : cl.col;
          expect(p.rows[r]?.[c], `${cl.id}-${cl.dir} letter ${i + 1}`).toBe(cl.answer[i]);
        }
        // the clue's "(n)" length matches the answer
        expect(cl.clue).toContain(`(${cl.answer.length})`);
      }
    });

    it('every word in the grid has exactly one clue, and no answer is used twice', () => {
      const words = gridWords(p);
      expect(words.length).toBe(p.clues.length);
      for (const w of words) {
        const matching = p.clues.filter(cl => cl.dir === w.dir && cl.row === w.row && cl.col === w.col);
        expect(matching.length, `${w.dir} word at ${w.row},${w.col}`).toBe(1);
        expect(matching[0].answer).toBe(w.word);
      }
      const answers = p.clues.map(cl => cl.answer);
      expect(new Set(answers).size).toBe(answers.length);
    });

    it('every clue number is shown on its starting cell, and every shown number has a clue', () => {
      const nums = clueNumbers(p);
      for (const cl of p.clues) {
        expect(nums.get(`${cl.row}-${cl.col}`), `clue ${cl.id}-${cl.dir}`).toBe(cl.id);
      }
      const used = new Set(p.clues.map(cl => cl.id));
      for (const n of nums.values()) expect(used.has(n), `number ${n} has a clue`).toBe(true);
    });
  });
});
