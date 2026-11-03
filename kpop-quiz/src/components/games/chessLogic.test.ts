import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  newGame, isValidFen, legalTargets, needsPromotion, tryMove, tryUci, parseUci, gameStatus, undoLast, kingSquare,
  checkSquare, lastMove, lastMoveSquares, pieceAt,
  startPuzzle, puzzleMove, puzzleHint, noteHint, playerColor, puzzleProgress, puzzleProblem,
  updateLevel, pickPuzzle, streakScore, START_LEVEL, MIN_LEVEL, MAX_LEVEL,
} from './chessLogic';
import type { ChessPuzzleData } from './chessLogic';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sorted = (a: string[]) => [...a].sort();

// Hand-made puzzles in the Lichess format: moves[0] is the opponent's set-up move.
/** Back-row mate in 1 with TWO mating moves: Ra8# (listed) and Rb8#. */
const TWO_MATES: ChessPuzzleData = { fen: '7k/2p3pp/8/8/8/8/5PPP/RR4K1 b - - 0 1', moves: ['c7c6', 'a1a8'], theme: 'mateIn1' };
/** Knight fork: Nc7+ forks king and queen, the king steps away, Nxa8. */
const FORK: ChessPuzzleData = { fen: 'q3k3/7p/8/1N6/8/8/8/6K1 b - - 0 1', moves: ['h7h6', 'b5c7', 'e8e7', 'c7a8'], theme: 'fork' };
/** Promote with mate: e8=Q# (listed); e8=R# mates too; e8=N doesn't. */
const PROMOTE: ChessPuzzleData = { fen: '7k/p3P1pp/8/8/8/8/8/6K1 b - - 0 1', moves: ['a7a6', 'e7e8q'], theme: 'promotion' };
/** Black to play: after White's set-up move, she has the black pieces. Re1# (listed) or Rd1#. */
const BLACK_SIDE: ChessPuzzleData = { fen: '3rr2k/6pp/8/8/8/8/2P2PPP/6K1 w - - 0 1', moves: ['c2c3', 'e8e1'], theme: 'backRankMate' };

describe('basic play', () => {
  it('starts from the normal position or a FEN', () => {
    expect(newGame().fen()).toBe(START);
    expect(newGame(TWO_MATES.fen).turn()).toBe('b');
    expect(() => newGame('not a fen')).toThrow();
    expect(isValidFen(START)).toBe(true);
    expect(isValidFen('8/8/8/8/8/8/8/R7 w - - 0 1')).toBe(false); // no kings
  });

  it('lists legal target squares for the side to move only', () => {
    const g = newGame();
    expect(sorted(legalTargets(g, 'e2'))).toEqual(['e3', 'e4']);
    expect(sorted(legalTargets(g, 'g1'))).toEqual(['f3', 'h3']);
    expect(legalTargets(g, 'e1')).toEqual([]); // boxed in
    expect(legalTargets(g, 'e7')).toEqual([]); // black, but it's White's turn
    expect(legalTargets(g, 'e4')).toEqual([]); // empty
    expect(legalTargets(g, 'z9')).toEqual([]); // not a square
  });

  it('lists each promotion square once and detects promotions', () => {
    const g = newGame(PROMOTE.fen);
    tryUci(g, 'a7a6');
    expect(legalTargets(g, 'e7')).toEqual(['e8']);
    expect(needsPromotion(g, 'e7', 'e8')).toBe(true);
    expect(needsPromotion(g, 'g1', 'g2')).toBe(false);
    expect(needsPromotion(newGame(), 'e2', 'e4')).toBe(false);
  });

  it('plays a move and reports it', () => {
    const g = newGame();
    const r = tryMove(g, 'g1', 'f3');
    expect(r).toMatchObject({ ok: true, san: 'Nf3', uci: 'g1f3', piece: 'n', check: false, mate: false, draw: false });
    expect(r.fen).toBe(g.fen());
    expect(pieceAt(g, 'f3')).toEqual({ type: 'n', color: 'w' });
    expect(lastMove(g)).toMatchObject({ from: 'g1', to: 'f3', san: 'Nf3', uci: 'g1f3', color: 'w' });
    expect(lastMoveSquares(g)).toEqual(['g1', 'f3']);
  });

  it('never throws on an illegal move and leaves the game alone', () => {
    const g = newGame();
    for (const [from, to] of [['e2', 'e5'], ['e7', 'e5'], ['a1', 'a3'], ['x1', 'e4'], ['', '']]) {
      const r = tryMove(g, from, to);
      expect(r.ok).toBe(false);
      expect(r.fen).toBe(START);
    }
    expect(tryUci(g, 'hello').ok).toBe(false);
    expect(g.fen()).toBe(START);
    expect(lastMove(g)).toBeNull();
  });

  it('promotes to a queen by default, or to the piece she picks', () => {
    const fen = '7k/4P3/8/8/8/8/8/K7 w - - 0 1';
    const q = tryMove(newGame(fen), 'e7', 'e8');
    expect(q).toMatchObject({ ok: true, promotion: 'q', uci: 'e7e8q', san: 'e8=Q+' });
    const n = tryMove(newGame(fen), 'e7', 'e8', 'n');
    expect(n).toMatchObject({ ok: true, promotion: 'n', uci: 'e7e8n', san: 'e8=N' });
    // a promotion piece on an ordinary move is ignored
    expect(tryMove(newGame(), 'e2', 'e4', 'q')).toMatchObject({ ok: true, uci: 'e2e4', promotion: undefined });
  });

  it('castles both ways (via chess.js) and moves the rook', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const g = newGame(fen);
    expect(legalTargets(g, 'e1')).toEqual(expect.arrayContaining(['g1', 'c1']));
    const k = tryMove(g, 'e1', 'g1');
    expect(k).toMatchObject({ ok: true, san: 'O-O', castle: 'king' });
    expect(pieceAt(g, 'f1')).toEqual({ type: 'r', color: 'w' });
    const q = tryMove(g, 'e8', 'c8');
    expect(q).toMatchObject({ ok: true, san: 'O-O-O', castle: 'queen' });
    expect(pieceAt(g, 'd8')).toEqual({ type: 'r', color: 'b' });
    // no castling through check
    const blocked = newGame('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
    expect(legalTargets(blocked, 'e1')).not.toContain('g1');
  });

  it('takes en passant (via chess.js)', () => {
    const g = newGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    expect(legalTargets(g, 'e5')).toContain('d6');
    const r = tryMove(g, 'e5', 'd6');
    expect(r).toMatchObject({ ok: true, enPassant: true, captured: 'p', san: 'exd6' });
    expect(pieceAt(g, 'd5')).toBeNull();
  });

  it('detects checkmate and who won', () => {
    const g = newGame();
    for (const m of ['f2f3', 'e7e5', 'g2g4']) expect(tryUci(g, m).ok).toBe(true);
    const mate = tryUci(g, 'd8h4');
    expect(mate).toMatchObject({ ok: true, check: true, mate: true, stalemate: false, san: 'Qh4#' });
    expect(gameStatus(g)).toMatchObject({ state: 'checkmate', winner: 'b', turn: 'w', check: true });
    expect(checkSquare(g)).toBe('e1');
  });

  it('detects stalemate and draws', () => {
    const stale = newGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(gameStatus(stale)).toMatchObject({ state: 'stalemate', winner: null, check: false });
    expect(checkSquare(stale)).toBeUndefined();

    const toStale = newGame('7k/4Q3/6K1/8/8/8/8/8 w - - 0 1');
    expect(tryMove(toStale, 'e7', 'f7')).toMatchObject({ ok: true, stalemate: true, draw: true, mate: false });

    expect(gameStatus(newGame('8/8/8/4k3/8/8/8/4K3 w - - 0 1'))).toMatchObject({ state: 'draw', drawReason: 'material' });
    expect(gameStatus(newGame())).toMatchObject({ state: 'playing', winner: null, turn: 'w', check: false });
  });

  it('shows the king in check', () => {
    const g = newGame('4k3/8/8/8/8/8/8/4K2R w - - 0 1');
    tryMove(g, 'h1', 'h8');
    expect(gameStatus(g)).toMatchObject({ state: 'playing', check: true, turn: 'b' });
    expect(checkSquare(g)).toBe('e8');
  });

  it('takes moves back', () => {
    const g = newGame();
    tryUci(g, 'e2e4');
    tryUci(g, 'e7e5');
    expect(undoLast(g, 2)).toBe(2);
    expect(g.fen()).toBe(START);
    expect(undoLast(g)).toBe(0);
  });

  it('finds the kings (and copes with a lesson board without them)', () => {
    const g = newGame();
    expect(kingSquare(g, 'w')).toBe('e1');
    expect(kingSquare(g, 'b')).toBe('e8');
    const lesson = newGame('8/8/8/8/8/8/8/R7 w - - 0 1', { loose: true });
    expect(kingSquare(lesson, 'w')).toBeNull();
    expect(legalTargets(lesson, 'a1')).toHaveLength(14);
  });

  it('parses UCI', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUci('e7e8k')).toBeNull();
    expect(parseUci('e9e4')).toBeNull();
  });
});

describe('puzzle machine', () => {
  it('plays the set-up move and gives her the other colour', () => {
    const run = startPuzzle(FORK);
    expect(run).toMatchObject({ step: 1, color: 'w', lastMove: ['h7', 'h6'], status: 'playing', mistakes: 0, hints: 0 });
    expect(pieceAt(newGame(run.fen), 'h6')).toEqual({ type: 'p', color: 'b' });
    expect(playerColor(run)).toBe('w');
    expect(playerColor(FORK)).toBe('w');
    expect(playerColor(BLACK_SIDE)).toBe('b');
    expect(startPuzzle(BLACK_SIDE).color).toBe('b');
    expect(puzzleProgress(run)).toEqual({ done: 0, total: 2 });
  });

  it('a right move plays the reply, and the last right move solves it', () => {
    const run = startPuzzle(FORK);
    const a = puzzleMove(run, 'b5c7');
    expect(a.result).toBe('correct');
    if (a.result !== 'correct') return;
    expect(a.move).toMatchObject({ ok: true, san: 'Nc7+', check: true });
    expect(a.reply).toMatchObject({ ok: true, san: 'Ke7', from: 'e8', to: 'e7' });
    expect(a.run).toMatchObject({ step: 3, lastMove: ['e8', 'e7'], status: 'playing' });
    expect(a.run.fen).toBe(a.reply.fen);
    expect(a.move.fen).not.toBe(a.run.fen); // her move alone, to show before the reply
    expect(puzzleProgress(a.run)).toEqual({ done: 1, total: 2 });

    const b = puzzleMove(a.run, 'c7a8');
    expect(b).toMatchObject({ result: 'solved', altMate: false });
    expect(b.run).toMatchObject({ status: 'solved', lastMove: ['c7', 'a8'] });
    expect(pieceAt(newGame(b.run.fen), 'a8')).toEqual({ type: 'n', color: 'w' });
    expect(puzzleProgress(b.run)).toEqual({ done: 2, total: 2 });
    // nothing more to play
    expect(puzzleMove(b.run, 'a8b6')).toMatchObject({ result: 'wrong', reason: 'over' });
    expect(puzzleHint(b.run, 1)).toBeNull();
  });

  it('accepts every checkmating move, not only the listed one', () => {
    const listed = puzzleMove(startPuzzle(TWO_MATES), 'a1a8');
    expect(listed).toMatchObject({ result: 'solved', altMate: false });
    const other = puzzleMove(startPuzzle(TWO_MATES), 'b1b8');
    expect(other).toMatchObject({ result: 'solved', altMate: true });
    expect(other.move).toMatchObject({ san: 'Rb8#', mate: true });
    const black = puzzleMove(startPuzzle(BLACK_SIDE), 'd8d1');
    expect(black).toMatchObject({ result: 'solved', altMate: true });
  });

  it('accepts a mate that comes sooner than the listed line', () => {
    // Listed: a quiet move first; the mate in 1 she finds instead still wins.
    const p: ChessPuzzleData = { fen: TWO_MATES.fen, moves: ['c7c6', 'g2g3', 'c6c5', 'a1a8'], theme: 'mateIn2' };
    expect(puzzleProblem(p)).toBeNull();
    expect(puzzleMove(startPuzzle(p), 'b1b8')).toMatchObject({ result: 'solved', altMate: true });
  });

  it('a wrong move keeps the position and counts a mistake', () => {
    const run = startPuzzle(TWO_MATES);
    const w = puzzleMove(run, 'a1a7');
    expect(w).toMatchObject({ result: 'wrong', reason: 'try' });
    if (w.result !== 'wrong') return;
    expect(w.run.fen).toBe(run.fen);
    expect(w.run.mistakes).toBe(1);
    expect(w.run.step).toBe(1);
    expect(w.move?.ok).toBe(true);
    expect(w.move?.fen).not.toBe(run.fen); // where the try would have gone, for a moment on screen
    // she can still solve it afterwards
    expect(puzzleMove(w.run, 'a1a8').result).toBe('solved');

    // a wrong move mid-puzzle
    const mid = puzzleMove(startPuzzle(FORK), 'b5c7');
    if (mid.result !== 'correct') throw new Error('expected correct');
    expect(puzzleMove(mid.run, 'c7e6')).toMatchObject({ result: 'wrong', reason: 'try' });
  });

  it('an illegal move is wrong but not a mistake', () => {
    const run = startPuzzle(TWO_MATES);
    for (const uci of ['a1h8', 'h7h6', 'zz', 'g1g3']) {
      const w = puzzleMove(run, uci);
      expect(w).toMatchObject({ result: 'wrong', reason: 'illegal', move: null });
      expect(w.run.mistakes).toBe(0);
    }
  });

  it('promotion: no letter means queen; another piece only counts if it mates', () => {
    expect(puzzleMove(startPuzzle(PROMOTE), 'e7e8')).toMatchObject({ result: 'solved', altMate: false });
    expect(puzzleMove(startPuzzle(PROMOTE), 'e7e8q')).toMatchObject({ result: 'solved', altMate: false });
    expect(puzzleMove(startPuzzle(PROMOTE), 'e7e8r')).toMatchObject({ result: 'solved', altMate: true });
    expect(puzzleMove(startPuzzle(PROMOTE), 'e7e8n')).toMatchObject({ result: 'wrong', reason: 'try' });
  });

  it('hints: first the piece, then the whole move', () => {
    const run = startPuzzle(FORK);
    expect(puzzleHint(run, 1)).toEqual({ level: 1, square: 'b5' });
    expect(puzzleHint(run, 2)).toEqual({ level: 2, square: 'b5', from: 'b5', to: 'c7', san: 'Nc7+', uci: 'b5c7' });
    const mid = puzzleMove(run, 'b5c7');
    if (mid.result !== 'correct') throw new Error('expected correct');
    expect(puzzleHint(mid.run, 1)).toEqual({ level: 1, square: 'c7' });
    expect(puzzleHint(mid.run, 2)).toMatchObject({ from: 'c7', to: 'a8', san: 'Nxa8' });

    const h1 = noteHint(run, 1);
    expect(h1.hints).toBe(1);
    expect(noteHint(noteHint(h1, 2), 1).hints).toBe(2);
    expect(run.hints).toBe(0); // runs are never changed in place
  });

  it('understands castling written king-takes-rook', () => {
    const p: ChessPuzzleData = { fen: 'r3k2r/pppq1ppp/8/8/8/8/PPP2PPP/R3K2R b KQkq - 0 1', moves: ['d7d6', 'e1h1'], theme: 'hangingPiece' };
    expect(puzzleProblem(p)).toBeNull();
    expect(puzzleMove(startPuzzle(p), 'e1g1')).toMatchObject({ result: 'solved', altMate: false });
  });

  it('spots broken puzzle data', () => {
    for (const p of [TWO_MATES, FORK, PROMOTE, BLACK_SIDE]) expect(puzzleProblem(p)).toBeNull();
    expect(puzzleProblem({ ...FORK, moves: ['h7h6'] })).toMatch(/at least one/);
    expect(puzzleProblem({ ...FORK, moves: ['h7h6', 'b5c7', 'e8e7'] })).toMatch(/last move/);
    expect(puzzleProblem({ ...FORK, moves: ['h7h6', 'b5c6'] })).toMatch(/not legal/);
    expect(puzzleProblem({ ...FORK, fen: 'nonsense' })).toMatch(/bad FEN/);
    expect(puzzleProblem({ ...TWO_MATES, moves: ['c7c6', 'a1a8', 'h8g8', 'a8a7'] })).toMatch(/ends/);
    expect(() => startPuzzle({ ...FORK, moves: ['a1a2', 'b5c7'] })).toThrow();
  });
});

describe('her puzzle level', () => {
  it('goes up when she solves and down when she misses', () => {
    expect(START_LEVEL).toBe(600);
    expect(updateLevel(600, 600, true)).toBe(620);
    expect(updateLevel(600, 600, false)).toBe(580);
    // a hard puzzle solved moves it more than an easy one; missing a hard one costs little
    expect(updateLevel(600, 900, true) - 600).toBeGreaterThan(updateLevel(600, 400, true) - 600);
    expect(600 - updateLevel(600, 900, false)).toBeLessThan(600 - updateLevel(600, 400, false));
    expect(updateLevel(600, 900, true)).toBeLessThanOrEqual(640);
  });

  it('stays between 400 and 2000', () => {
    expect(updateLevel(MIN_LEVEL, 400, false)).toBe(MIN_LEVEL);
    expect(updateLevel(410, 2000, false)).toBe(410); // missing a far-too-hard puzzle costs (almost) nothing
    expect(updateLevel(MAX_LEVEL, 2000, true)).toBe(MAX_LEVEL);
    expect(updateLevel(1990, 1200, true)).toBeLessThanOrEqual(MAX_LEVEL);
    expect(updateLevel(Number.NaN, 600, true)).toBe(620);
    let lv = START_LEVEL;
    for (let i = 0; i < 200; i++) lv = updateLevel(lv, 2500, true);
    expect(lv).toBe(MAX_LEVEL);
    for (let i = 0; i < 200; i++) lv = updateLevel(lv, 100, false);
    expect(lv).toBe(MIN_LEVEL);
  });

  const LIST = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, rating: 400 + i * 50 })); // 400 … 1600

  it('picks a puzzle within ±150 of her level', () => {
    const rng = createRng(7);
    const got = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const p = pickPuzzle(LIST, 800, [], rng)!;
      expect(Math.abs(p.rating - 800)).toBeLessThanOrEqual(150);
      got.add(p.rating);
    }
    expect(got.size).toBeGreaterThan(3); // not always the same one
  });

  it('never repeats a seen puzzle while there are fresh ones, widening the search if needed', () => {
    const rng = createRng(3);
    const near = LIST.filter(p => Math.abs(p.rating - 800) <= 150).map(p => p.id);
    for (let i = 0; i < 100; i++) {
      const p = pickPuzzle(LIST, 800, new Set(near), rng)!;
      expect(near).not.toContain(p.id);
      expect(Math.abs(p.rating - 800)).toBeLessThanOrEqual(300);
    }
    // only one puzzle left unseen, far away: that's the one
    const allButOne = LIST.filter(p => p.id !== 'p24').map(p => p.id);
    expect(pickPuzzle(LIST, 500, allButOne, rng)?.id).toBe('p24');
    // everything seen: still gives one near her level
    const all = LIST.map(p => p.id);
    const again = pickPuzzle(LIST, 1000, all, rng)!;
    expect(Math.abs(again.rating - 1000)).toBeLessThanOrEqual(150);
    expect(pickPuzzle([], 600, [], rng)).toBeNull();
  });

  it('copes with a level outside the list', () => {
    const rng = createRng(1);
    expect(pickPuzzle(LIST, 2000, [], rng)!.rating).toBeGreaterThanOrEqual(1450);
    expect(pickPuzzle(LIST, 100, [], rng)!.rating).toBeLessThanOrEqual(550);
  });

  it('scores a streak', () => {
    expect(streakScore([])).toBe(0);
    expect(streakScore([600, 745, 1234])).toBe(60 + 75 + 123);
  });
});
