import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { CHESS_PUZZLES } from './chessPuzzles';
import { PUZZLE_THEMES, THEME_PRIORITY } from './chessThemes';

// Every puzzle is replayed with chess.js — the "facts must be correct" rule for puzzles.
const MATE_THEMES = new Set(['mateIn1', 'mateIn2', 'backRankMate']);

function replay(fen: string, moves: string[]) {
  const game = new Chess(fen);
  for (const uci of moves) game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return game;
}

describe('chess puzzles (Lichess, CC0)', () => {
  it('has about 1,200 puzzles with unique ids, kid-level ratings and known themes', () => {
    expect(CHESS_PUZZLES.length).toBeGreaterThanOrEqual(1000);
    expect(new Set(CHESS_PUZZLES.map(p => p.id)).size).toBe(CHESS_PUZZLES.length);
    for (const p of CHESS_PUZZLES) {
      expect(p.rating, p.id).toBeGreaterThanOrEqual(400);
      expect(p.rating, p.id).toBeLessThan(1600);
      expect(PUZZLE_THEMES[p.theme], p.id).toBeDefined();
    }
  });

  it('covers every theme and every 100-point rating band', () => {
    for (const t of THEME_PRIORITY) expect(CHESS_PUZZLES.some(p => p.theme === t), t).toBe(true);
    for (let band = 400; band < 1600; band += 100) {
      expect(CHESS_PUZZLES.filter(p => p.rating >= band && p.rating < band + 100).length, `${band}s`).toBeGreaterThanOrEqual(50);
    }
  });

  it('every puzzle is legal from its position, ends on her move, and at most 4 moves for her', () => {
    for (const p of CHESS_PUZZLES) {
      expect(p.moves.length % 2, p.id).toBe(0);
      expect(p.moves.length / 2, p.id).toBeLessThanOrEqual(4);
      expect(() => replay(p.fen, p.moves), p.id).not.toThrow();
    }
  });

  it('mate puzzles really end in checkmate', () => {
    for (const p of CHESS_PUZZLES.filter(x => MATE_THEMES.has(x.theme))) {
      expect(replay(p.fen, p.moves).isCheckmate(), p.id).toBe(true);
    }
  });

  it('keeps no links (house rule) — only ids, positions and moves', () => {
    for (const p of CHESS_PUZZLES) {
      expect(JSON.stringify(p), p.id).not.toMatch(/https?:|lichess\.org/);
    }
  });
});
