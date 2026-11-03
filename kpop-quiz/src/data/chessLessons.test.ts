import { describe, it, expect } from 'vitest';
import { Chess, validateFen } from 'chess.js';
import { CHESS_LESSONS, CHESS_LESSON_LEVELS } from './chessLessons';
import {
  bfsMinMoves, checkLessonAnswer, checkLessonSolutions, checkLessonTargets, fileOf, isComplete, isSquare, pieceTargets,
  rankOf, starHuntMove, starHuntSolution, starHuntStart, starHuntTargets, starsEarned, starsLeft, toFen, toPieceMap,
} from '../components/games/chessLessonLogic';
import type { CheckLevel, StarHuntLevel, StarHuntState, StarPiece, Square } from '../components/games/chessLessonLogic';

const STAR_LEVELS = CHESS_LESSON_LEVELS.filter((l): l is StarHuntLevel => l.kind === 'stars');
const CHECK_LEVELS = CHESS_LESSON_LEVELS.filter((l): l is CheckLevel => l.kind === 'check');
const squareColour = (sq: Square) => (fileOf(sq) + rankOf(sq)) % 2;

/** A tiny star-hunt level for the rule tests. */
const hunt = (piece: StarPiece, start: Square, stars: Square[], blockers?: Square[]): StarHuntLevel =>
  ({ kind: 'stars', id: 'test', title: 'Test', piece, start, stars, blockers, target: 1 });

/** Play a route with the game's own move rules; fails the test on an illegal step. */
function play(level: StarHuntLevel, route: Square[]): StarHuntState {
  let s = starHuntStart(level);
  for (const sq of route) {
    const next = starHuntMove(level, s, sq);
    expect(next, `${level.id}: ${s.square} → ${sq}`).not.toBeNull();
    s = next!;
  }
  return s;
}

/** The same position with black to move — if black's king is attacked there, the real position is impossible. */
const blackToMove = (fen: string) => fen.replace(' w ', ' b ').replace(/ [a-h][36] /, ' - ');

describe('chess lessons — content', () => {
  it('has the 7 lessons in order, 3 levels each', () => {
    expect(CHESS_LESSONS.map(l => l.id)).toEqual(['rook', 'bishop', 'queen', 'king', 'knight', 'pawn', 'check']);
    expect(CHESS_LESSONS.map(l => l.piece)).toEqual(['r', 'b', 'q', 'k', 'n', 'p', 'k']);
    for (const l of CHESS_LESSONS) expect(l.levels.length, l.id).toBe(3);
    expect(CHESS_LESSON_LEVELS.length).toBe(21);
    expect(STAR_LEVELS.length).toBe(18);
    expect(CHECK_LEVELS.map(l => l.goal)).toEqual(['check', 'mate', 'escape']);
  });

  it('lesson and level ids are unique and save-safe', () => {
    const ids = [...CHESS_LESSONS.map(l => l.id), ...CHESS_LESSON_LEVELS.map(l => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
    for (const l of CHESS_LESSONS) for (const lv of l.levels) expect(lv.id.startsWith(`${l.id}_`), lv.id).toBe(true);
  });

  it('every lesson and level has kid-readable text (UK spelling, at most 2 sentences of intro)', () => {
    for (const l of CHESS_LESSONS) {
      expect(l.title.trim().length, l.id).toBeGreaterThan(0);
      expect(l.emoji.trim().length, l.id).toBeGreaterThan(0);
      const sentences = l.intro.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, l.intro).toBeGreaterThanOrEqual(1);
      expect(sentences.length, l.intro).toBeLessThanOrEqual(2);
      expect(l.intro, l.id).not.toMatch(/\bcolor|\bcenter|\bfavorite/i);
      for (const lv of l.levels) {
        expect(lv.title.trim().length, lv.id).toBeGreaterThan(0);
        if (lv.kind === 'check' || lv.tip) expect(lv.tip!.trim().length, lv.id).toBeGreaterThan(0);
      }
    }
  });

  it('intros describe the right movement', () => {
    const intro = (id: string) => CHESS_LESSONS.find(l => l.id === id)!.intro.toLowerCase();
    expect(intro('rook')).toMatch(/straight/);
    expect(intro('rook')).not.toMatch(/diagonal/);
    expect(intro('bishop')).toMatch(/diagonal/);
    expect(intro('bishop')).toMatch(/one colour/);
    expect(intro('bishop')).not.toMatch(/straight/);
    expect(intro('queen')).toMatch(/straight/);
    expect(intro('queen')).toMatch(/diagonal/);
    expect(intro('king')).toMatch(/one square/);
    expect(intro('king')).toMatch(/any direction/);
    expect(intro('knight')).toMatch(/\bl shape/);
    expect(intro('knight')).toMatch(/two squares/);
    expect(intro('knight')).toMatch(/one square to the side/);
    expect(intro('knight')).toMatch(/jump over/);
    expect(intro('pawn')).toMatch(/forward one square/);
    expect(intro('pawn')).toMatch(/two squares/);
    expect(intro('pawn')).toMatch(/starting row/);
    expect(intro('pawn')).toMatch(/queen/);
    expect(intro('check')).toMatch(/check/);
    expect(intro('check')).toMatch(/checkmate/);
  });
});

describe('chess lessons — star hunts', () => {
  it.each(STAR_LEVELS.map(l => [l.id, l] as const))('%s: squares are sensible', (id, l) => {
    const lesson = CHESS_LESSONS.find(x => x.levels.some(lv => lv.id === id))!;
    expect(l.piece).toBe(lesson.piece);
    const blockers = l.blockers ?? [];
    for (const sq of [l.start, ...l.stars, ...blockers]) expect(isSquare(sq), sq).toBe(true);
    expect(l.stars.length).toBeGreaterThanOrEqual(1);
    expect(new Set(l.stars).size, 'duplicate star').toBe(l.stars.length);
    expect(new Set(blockers).size, 'duplicate blocker').toBe(blockers.length);
    expect(l.stars, 'star on the start square').not.toContain(l.start);
    expect(blockers, 'blocker on the start square').not.toContain(l.start);
    for (const s of l.stars) expect(blockers, `star ${s} on a blocker`).not.toContain(s);
    // blockers are real pawns, and pawns never stand on the first or last rank
    for (const b of blockers) expect([1, 8], `blocker ${b}`).not.toContain(rankOf(b));
    if (l.piece === 'p') expect([1, 8]).not.toContain(rankOf(l.start));
    // the position draws as a FEN
    const board = new Chess(toFen(l, starHuntStart(l)), { skipValidation: true });
    expect(board.get(l.start)).toEqual({ type: l.piece, color: 'w' });
    for (const b of blockers) expect(board.get(b)).toEqual({ type: 'p', color: 'w' });
  });

  it.each(STAR_LEVELS.map(l => [l.id, l] as const))('%s: every star is reachable on its own', (_, l) => {
    for (const s of l.stars) expect(bfsMinMoves({ ...l, stars: [s] }), `star ${s}`).not.toBeNull();
    if (l.piece === 'b') for (const s of l.stars) expect(squareColour(s), `star ${s} is on the other colour`).toBe(squareColour(l.start));
  });

  it.each(STAR_LEVELS.map(l => [l.id, l] as const))('%s: solvable, and target is exactly the optimal move count', (_, l) => {
    const best = bfsMinMoves(l);
    expect(best).not.toBeNull();
    expect(l.target).toBe(best);
    // the optimal route really works tap by tap
    const route = starHuntSolution(l)!;
    expect(route.length).toBe(l.target);
    const end = play(l, route);
    expect(isComplete(l, end)).toBe(true);
    expect(end.moves).toBe(l.target);
    expect(starsLeft(l, end)).toEqual([]);
    expect(starsEarned(end.moves, l.target)).toBe(3);
  });

  it('level 3 of each piece is a little tricky (blockers to get round, or a promotion)', () => {
    for (const lesson of CHESS_LESSONS.filter(l => l.id !== 'check')) {
      const l3 = lesson.levels[2] as StarHuntLevel;
      if (l3.piece === 'p') {
        const route = starHuntSolution(l3)!;
        const end = play(l3, route);
        expect(end.piece, 'the pawn should promote on the way').toBe('q');
        // the last star is collected by the new queen, off the pawn's file
        expect(fileOf(route[route.length - 1])).not.toBe(fileOf(l3.start));
      } else if (l3.piece === 'n') {
        // a fence of pawns all round it (it jumps them), and a star that takes more than one jump
        const ring = pieceTargets('k', l3.start, new Set());
        for (const sq of ring) expect([...(l3.blockers ?? []), ...l3.stars], sq).toContain(sq);
        expect(l3.target, l3.id).toBeGreaterThan(l3.stars.length);
      } else {
        expect((l3.blockers ?? []).length, l3.id).toBeGreaterThan(0);
        // the blockers matter: without them it would be quicker
        expect(bfsMinMoves({ ...l3, blockers: [] })!, l3.id).toBeLessThan(l3.target);
      }
    }
  });

  it('levels get no easier within a lesson', () => {
    for (const lesson of CHESS_LESSONS.filter(l => l.id !== 'check')) {
      const t = lesson.levels.map(l => (l as StarHuntLevel).target);
      expect(t[1], lesson.id).toBeGreaterThanOrEqual(t[0]);
      expect(t[2], lesson.id).toBeGreaterThanOrEqual(t[1]);
    }
  });
});

describe('chess lessons — check & checkmate', () => {
  it.each(CHECK_LEVELS.map(l => [l.id, l] as const))('%s: the position is legal, white to move', (_, l) => {
    expect(validateFen(l.fen)).toEqual({ ok: true });
    const chess = new Chess(l.fen);
    expect(chess.turn()).toBe('w');
    expect(chess.isGameOver()).toBe(false);
    // black (not to move) must not be in check — that would be impossible
    expect(new Chess(blackToMove(l.fen)).inCheck()).toBe(false);
    // kings never stand next to each other
    const kings = chess.board().flat().filter(p => p?.type === 'k').map(p => p!.square);
    expect(kings.length).toBe(2);
    const [a, b] = kings;
    expect(Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)))).toBeGreaterThan(1);
  });

  it.each(CHECK_LEVELS.map(l => [l.id, l] as const))('%s: has a right answer of the right kind, and some wrong ones', (_, l) => {
    const chess = new Chess(l.fen);
    const legal = chess.moves({ verbose: true });
    const solutions = checkLessonSolutions(l);
    expect(solutions.length).toBeGreaterThanOrEqual(1);
    for (const uci of solutions) {
      const after = new Chess(l.fen);
      after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (l.goal === 'check') expect(after.inCheck(), uci).toBe(true);
      if (l.goal === 'mate') expect(after.isCheckmate(), uci).toBe(true);
      if (l.goal === 'escape') expect(after.turn()).toBe('b'); // a legal move was made
    }
    if (l.goal === 'check' || l.goal === 'mate') {
      expect(chess.inCheck(), 'she should not start in check').toBe(false);
      expect(solutions.length, 'some legal moves should be wrong').toBeLessThan(legal.length);
    }
    if (l.goal === 'check') expect(solutions.some(uci => { const c = new Chess(l.fen); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) }); return !c.isCheckmate(); })).toBe(true);
    if (l.goal === 'escape') {
      expect(chess.inCheck(), 'she should start in check').toBe(true);
      expect(solutions.length).toBe(legal.length); // every legal move escapes check
      // there's more than one way out (king steps and a block)
      expect(new Set(legal.map(m => m.piece)).size).toBeGreaterThan(1);
    }
  });
});

describe('star hunt rules', () => {
  it('a rook slides in straight lines but can’t pass or land on a blocker', () => {
    expect(pieceTargets('r', 'a1', new Set()).length).toBe(14);
    const t = pieceTargets('r', 'a1', new Set(['a4', 'c1']));
    expect(t.sort()).toEqual(['a2', 'a3', 'b1']);
  });

  it('a bishop moves diagonally and stays on its colour', () => {
    const t = pieceTargets('b', 'c1', new Set());
    expect(t.sort()).toEqual(['a3', 'b2', 'd2', 'e3', 'f4', 'g5', 'h6']);
    for (const sq of pieceTargets('b', 'd4', new Set())) expect(squareColour(sq)).toBe(squareColour('d4'));
    expect(pieceTargets('b', 'c1', new Set(['d2']))).not.toContain('e3');
  });

  it('a queen moves like a rook and a bishop', () => {
    expect(pieceTargets('q', 'd4', new Set()).length).toBe(27);
    expect(pieceTargets('q', 'd4', new Set(['f6']))).not.toContain('g7');
  });

  it('a king steps one square in any direction', () => {
    expect(pieceTargets('k', 'e4', new Set()).length).toBe(8);
    expect(pieceTargets('k', 'a1', new Set()).sort()).toEqual(['a2', 'b1', 'b2']);
    expect(pieceTargets('k', 'a1', new Set(['b2']))).not.toContain('b2');
  });

  it('a knight jumps in an L over blockers, but can’t land on one', () => {
    const fence = new Set(['a2', 'b2', 'c2', 'c1', 'a1']);
    expect(pieceTargets('n', 'b1', fence).sort()).toEqual(['a3', 'c3', 'd2']);
    expect(pieceTargets('n', 'b1', new Set(['c3']))).not.toContain('c3');
    expect(pieceTargets('n', 'd4', new Set()).length).toBe(8);
  });

  it('a pawn moves forward one, or two only from its start row, and is stopped by a blocker', () => {
    expect(pieceTargets('p', 'e2', new Set()).sort()).toEqual(['e3', 'e4']);
    expect(pieceTargets('p', 'e3', new Set())).toEqual(['e4']);
    expect(pieceTargets('p', 'e5', new Set())).toEqual(['e6']);
    expect(pieceTargets('p', 'e2', new Set(['e4']))).toEqual(['e3']);
    expect(pieceTargets('p', 'e2', new Set(['e3']))).toEqual([]);
  });

  it('a pawn reaching the 8th rank becomes a queen', () => {
    const l = hunt('p', 'd7', ['d8', 'a5']);
    const s = starHuntMove(l, starHuntStart(l), 'd8')!;
    expect(s.piece).toBe('q');
    expect(s.collected).toEqual(['d8']);
    expect(starHuntTargets(l, s, 'd8')).toContain('a5');
    expect(toPieceMap(l, s)).toEqual({ d8: { type: 'q', color: 'w' } });
    expect(isComplete(l, starHuntMove(l, s, 'a5')!)).toBe(true);
  });

  it('stars count only when she lands on them', () => {
    const l = hunt('r', 'a1', ['a3', 'a6']);
    let s = starHuntMove(l, starHuntStart(l), 'a6')!; // slides past a3
    expect(s.collected).toEqual(['a6']);
    expect(starsLeft(l, s)).toEqual(['a3']);
    expect(isComplete(l, s)).toBe(false);
    s = starHuntMove(l, s, 'a3')!;
    expect(isComplete(l, s)).toBe(true);
    expect(s.moves).toBe(2);
    expect(starHuntTargets(l, s, 'a3')).toEqual([]); // nothing more to do
  });

  it('illegal moves are refused and change nothing', () => {
    const l = hunt('r', 'a1', ['h8'], ['a4']);
    const s0 = starHuntStart(l);
    expect(starHuntMove(l, s0, 'b2')).toBeNull(); // rooks don't go diagonally
    expect(starHuntMove(l, s0, 'a5')).toBeNull(); // past a blocker
    expect(starHuntMove(l, s0, 'a4')).toBeNull(); // onto a blocker
    expect(starHuntMove(l, s0, 'a1')).toBeNull(); // staying put
    expect(starHuntTargets(l, s0, 'b1')).toEqual([]); // no piece there
    expect(s0).toEqual({ square: 'a1', piece: 'r', collected: [], moves: 0 });
  });

  it('bfsMinMoves finds the optimal count, and null when a star is out of reach', () => {
    expect(bfsMinMoves(hunt('r', 'a1', ['h8']))).toBe(2);
    expect(bfsMinMoves(hunt('k', 'a1', ['h8']))).toBe(7);
    expect(bfsMinMoves(hunt('n', 'a1', ['b2']))).toBe(4);
    expect(bfsMinMoves(hunt('p', 'b6', ['b8', 'h2']))).toBe(3); // promotes, then the queen goes b8–h2
    expect(bfsMinMoves(hunt('b', 'c1', ['c2']))).toBeNull(); // other colour
    expect(bfsMinMoves(hunt('p', 'e4', ['e3']))).toBe(5); // pawns never go back… but a new queen can
    expect(bfsMinMoves(hunt('p', 'e4', ['e3'], ['e6']))).toBeNull(); // stuck behind a blocker
    expect(bfsMinMoves(hunt('k', 'a1', ['a3'], ['a2', 'b2', 'b1']))).toBeNull(); // boxed in
  });

  it('starsEarned: 3 for the target, 2 within two extra moves, else 1', () => {
    expect(starsEarned(3, 4)).toBe(3);
    expect(starsEarned(4, 4)).toBe(3);
    expect(starsEarned(5, 4)).toBe(2);
    expect(starsEarned(6, 4)).toBe(2);
    expect(starsEarned(7, 4)).toBe(1);
  });

  it('toFen draws her piece and blockers', () => {
    const l = hunt('n', 'e4', ['e5'], ['d3', 'f5']);
    expect(toFen(l, starHuntStart(l))).toBe('8/8/8/5P2/4N3/3P4/8/8 w - - 0 1');
  });
});

describe('check lesson rules', () => {
  const lvl = (goal: CheckLevel['goal'], fen: string): CheckLevel => ({ kind: 'check', id: 'test', title: 'Test', goal, fen, tip: 'Test' });

  it('give check: any checking move is right', () => {
    const l = lvl('check', '4k3/8/8/8/8/8/8/R5K1 w - - 0 1');
    expect(checkLessonAnswer(l, 'a1a8').result).toBe('correct');
    expect(checkLessonAnswer(l, { from: 'a1', to: 'e1' }).result).toBe('correct');
    expect(checkLessonAnswer(l, 'a1a5')).toEqual({ result: 'try_again', reason: 'no_check', san: 'Ra5' });
    expect(checkLessonAnswer(l, 'a1b2')).toEqual({ result: 'try_again', reason: 'illegal' });
    expect(checkLessonAnswer(l, 'nonsense')).toEqual({ result: 'try_again', reason: 'illegal' });
    expect(checkLessonSolutions(l).sort()).toEqual(['a1a8', 'a1e1']);
  });

  it('checkmate: a check that isn’t mate is not enough', () => {
    const l = lvl('mate', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const right = checkLessonAnswer(l, 'a1a8');
    expect(right.result).toBe('correct');
    if (right.result === 'correct') expect(right.san).toBe('Ra8#');
    const kingOpen = lvl('mate', '6k1/8/8/8/8/8/5PPP/R5K1 w - - 0 1'); // no pawns in front: Ra8+ isn't mate
    expect(checkLessonAnswer(kingOpen, 'a1a8')).toEqual({ result: 'try_again', reason: 'no_mate', san: 'Ra8+' });
  });

  it('escape check: any legal move is right; a move that leaves the king in check is not', () => {
    const l = lvl('escape', '4r1k1/5ppp/8/8/8/8/5PPP/2B1K3 w - - 0 1');
    expect(checkLessonAnswer(l, 'e1d1').result).toBe('correct');
    expect(checkLessonAnswer(l, 'c1e3').result).toBe('correct'); // block
    expect(checkLessonAnswer(l, 'h2h3')).toEqual({ result: 'try_again', reason: 'illegal' });
    expect(checkLessonAnswer(l, 'c1d2')).toEqual({ result: 'try_again', reason: 'illegal' });
    expect(checkLessonTargets(l, 'e1').sort()).toEqual(['d1', 'd2', 'f1']);
    expect(checkLessonTargets(l, 'h2')).toEqual([]);
  });

  it('a pawn reaching the last rank promotes to a queen unless told otherwise', () => {
    const l = lvl('mate', '6k1/4Pppp/8/8/8/8/8/6K1 w - - 0 1');
    const q = checkLessonAnswer(l, 'e7e8');
    expect(q.result).toBe('correct');
    if (q.result === 'correct') expect(q.san).toBe('e8=Q#');
    expect(checkLessonAnswer(l, 'e7e8r').result).toBe('correct'); // a rook mates too
    expect(checkLessonAnswer(l, 'e7e8n')).toEqual({ result: 'try_again', reason: 'no_mate', san: 'e8=N' });
  });
});
