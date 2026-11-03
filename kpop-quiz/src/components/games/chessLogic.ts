// Chess Academy rules — pure, no React. Every chess rule (legal moves, check, castling, en passant,
// promotion, draws) comes from chess.js; this file only wraps it in small, never-throwing helpers,
// plus the puzzle machine (Lichess puzzle format) and her adaptive puzzle level.
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import type { PuzzleTheme } from '../../data/chessThemes';
import type { Rng } from '../../games/engine/rng';

export type { Color, PieceSymbol, Square } from 'chess.js';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const SQUARE_RE = /^[a-h][1-8]$/;
const isSquare = (s: string): s is Square => SQUARE_RE.test(s);
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

// ---------- basic play ----------

/**
 * A new game: the normal start position, or `fen`. Throws on a broken FEN (a data bug — the puzzle
 * and lesson files are checked by tests). `loose` skips chess.js's checks so a lesson can use a
 * position without kings (moves still follow the pieces' rules; check means nothing there).
 */
export function newGame(fen?: string, opts: { loose?: boolean } = {}): Chess {
  if (fen === undefined) return new Chess();
  return new Chess(fen, { skipValidation: !!opts.loose });
}

/** Is this FEN a position chess.js accepts (both kings, sensible pawns, …)? */
export function isValidFen(fen: string): boolean {
  try { new Chess(fen); return true; } catch { return false; }
}

/** The squares the piece on `from` can move to (side to move only; each square once, even for promotions). */
export function legalTargets(game: Chess, from: string): string[] {
  if (!isSquare(from)) return [];
  const out: string[] = [];
  for (const m of game.moves({ square: from, verbose: true })) if (!out.includes(m.to)) out.push(m.to);
  return out;
}

/** Does moving from → to promote a pawn (so she must pick a piece)? */
export function needsPromotion(game: Chess, from: string, to: string): boolean {
  if (!isSquare(from)) return false;
  return game.moves({ square: from, verbose: true }).some(m => m.to === to && !!m.promotion);
}

export interface MoveResult {
  ok: boolean;
  /** e.g. "Nf3", "exd5", "O-O", "e8=Q#" ('' when not ok). */
  san: string;
  /** e.g. "g1f3", "e7e8q" (what she tried, even when not ok). */
  uci: string;
  from: string;
  to: string;
  /** The piece that moved (before promotion). */
  piece?: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PromotionPiece;
  castle?: 'king' | 'queen';
  enPassant: boolean;
  /** The side to move is now in check (includes mate). */
  check: boolean;
  mate: boolean;
  stalemate: boolean;
  /** Any draw: stalemate, too little material, threefold repetition or the 50-move rule. */
  draw: boolean;
  /** The position after the move (unchanged when not ok). */
  fen: string;
}

const failed = (game: Chess, uci: string, from: string, to: string): MoveResult => ({
  ok: false, san: '', uci, from, to, enPassant: false, check: false, mate: false, stalemate: false, draw: false, fen: game.fen(),
});

/**
 * Play from → to if it's legal. Never throws: an illegal move returns `ok: false` and leaves the game
 * as it was.
 */
export function tryMove(game: Chess, from: string, to: string, promotion?: PromotionPiece): MoveResult {
  // A promotion with no piece becomes a queen; a stray piece on a move that isn't a promotion is ignored.
  const promo = needsPromotion(game, from, to) ? promotion ?? 'q' : undefined;
  const fail = failed(game, `${from}${to}${promo ?? ''}`, from, to);
  if (!isSquare(from) || !isSquare(to)) return fail;
  let m;
  try { m = game.move({ from, to, promotion: promo }); } catch { return fail; }
  return {
    ok: true,
    san: m.san,
    uci: m.lan,
    from: m.from,
    to: m.to,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion as PromotionPiece | undefined,
    castle: m.isKingsideCastle() ? 'king' : m.isQueensideCastle() ? 'queen' : undefined,
    enPassant: m.isEnPassant(),
    check: game.inCheck(),
    mate: game.isCheckmate(),
    stalemate: game.isStalemate(),
    draw: game.isDraw(),
    fen: game.fen(),
  };
}

/** "e2e4" / "e7e8q" → its parts, or null if it isn't a move written like that. */
export function parseUci(uci: string): { from: string; to: string; promotion?: PromotionPiece } | null {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci.trim().toLowerCase());
  if (!m) return null;
  return { from: m[1], to: m[2], promotion: m[3] as PromotionPiece | undefined };
}

/** tryMove for a UCI string. Also never throws. */
export function tryUci(game: Chess, uci: string): MoveResult {
  const p = parseUci(uci);
  if (!p) return failed(game, uci, '', '');
  return tryMove(game, p.from, p.to, p.promotion);
}

export type GameState = 'playing' | 'checkmate' | 'stalemate' | 'draw';

export interface GameStatus {
  state: GameState;
  /** Who won (checkmate only). */
  winner: Color | null;
  /** Whose turn it is (on mate: the side that got mated). */
  turn: Color;
  /** The side to move is in check (true on mate too). */
  check: boolean;
  /** Why a 'draw' is a draw (stalemate has its own state). */
  drawReason?: 'material' | 'repetition' | 'fifty';
}

export function gameStatus(game: Chess): GameStatus {
  const turn = game.turn();
  const check = game.inCheck();
  if (game.isCheckmate()) return { state: 'checkmate', winner: other(turn), turn, check };
  if (game.isStalemate()) return { state: 'stalemate', winner: null, turn, check };
  if (game.isDraw()) {
    const drawReason = game.isInsufficientMaterial() ? 'material' : game.isThreefoldRepetition() ? 'repetition' : 'fifty';
    return { state: 'draw', winner: null, turn, check, drawReason };
  }
  return { state: 'playing', winner: null, turn, check };
}

/** Take back the last `count` moves (2 = her move and the reply). Returns how many were taken back. */
export function undoLast(game: Chess, count = 1): number {
  let n = 0;
  while (n < count && game.undo()) n++;
  return n;
}

/** Where `color`'s king stands, or null (lesson positions may have none). */
export function kingSquare(game: Chess, color: Color): string | null {
  return game.findPiece({ type: 'k', color })[0] ?? null;
}

/** The king in check right now (for the board's red glow), or undefined. */
export function checkSquare(game: Chess): string | undefined {
  return game.inCheck() ? kingSquare(game, game.turn()) ?? undefined : undefined;
}

export interface LastMove { from: string; to: string; san: string; uci: string; color: Color }

/** The last move played in this game (moves made since the start FEN), or null. */
export function lastMove(game: Chess): LastMove | null {
  const h = game.history({ verbose: true });
  const m = h[h.length - 1];
  return m ? { from: m.from, to: m.to, san: m.san, uci: m.lan, color: m.color } : null;
}

/** The last move's two squares, ready for the board's `lastMove` prop. */
export function lastMoveSquares(game: Chess): [string, string] | undefined {
  const m = lastMove(game);
  return m ? [m.from, m.to] : undefined;
}

/** The piece on a square, or null. */
export function pieceAt(game: Chess, square: string): { type: PieceSymbol; color: Color } | null {
  if (!isSquare(square)) return null;
  return game.get(square) ?? null;
}

// ---------- puzzles (Lichess format) ----------

export interface ChessPuzzleData {
  /** The position BEFORE the opponent's set-up move. */
  fen: string;
  /** UCI moves: moves[0] is the opponent's set-up move, then hers and the replies alternate; the last is hers. */
  moves: string[];
  theme: PuzzleTheme;
  id?: string;
  rating?: number;
}

/** A puzzle in progress. Plain data (no chess.js object), so it can sit in React state or be saved. */
export interface PuzzleRun {
  puzzle: ChessPuzzleData;
  /** The position now: her turn while `status` is 'playing'. */
  fen: string;
  /** Index into puzzle.moves of the move she has to find next. */
  step: number;
  /** The colour she plays. */
  color: Color;
  /** The last move on the board (for the highlight). */
  lastMove: [string, string];
  status: 'playing' | 'solved';
  /** Wrong (legal) moves so far. */
  mistakes: number;
  /** The biggest hint she has used (0 = none) — see noteHint. */
  hints: 0 | 1 | 2;
}

export type PuzzleMoveResult =
  /** Right move: `move` is hers (move.fen = the position just after it, to show before the reply), the reply is already played. */
  | { result: 'correct'; run: PuzzleRun; move: MoveResult; reply: MoveResult }
  /** Puzzle done. `altMate`: she found a checkmate that isn't the listed move (still a win). */
  | { result: 'solved'; run: PuzzleRun; move: MoveResult; altMate: boolean }
  /**
   * Not it. The run's position is unchanged (the move is NOT kept); `move.fen` is the position after
   * her try, in case the screen wants to show it for a moment before sliding it back.
   * reason 'try' = a legal move that isn't the answer (counts as a mistake), 'illegal' = not a legal
   * move (not counted), 'over' = the puzzle is already solved.
   */
  | { result: 'wrong'; run: PuzzleRun; move: MoveResult | null; reason: 'try' | 'illegal' | 'over' };

// Some exports write castling as "king takes own rook" (e1h1); chess.js wants e1g1.
const ALT_CASTLE: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };

/** Play one listed puzzle move, allowing the king-takes-rook castling spelling. */
function playListed(game: Chess, uci: string): MoveResult {
  const r = tryUci(game, uci);
  if (r.ok || !ALT_CASTLE[uci]) return r;
  const king = pieceAt(game, uci.slice(0, 2));
  return king?.type === 'k' ? tryUci(game, ALT_CASTLE[uci]) : r;
}

/** Does her move match the listed one (same squares; same promotion piece, a missing one meaning queen)? */
function sameMove(played: MoveResult, listed: string): boolean {
  const want = parseUci(ALT_CASTLE[listed] && played.piece === 'k' ? ALT_CASTLE[listed] : listed);
  if (!want) return false;
  return played.from === want.from && played.to === want.to && (played.promotion ?? '') === (want.promotion ?? (played.promotion ? 'q' : ''));
}

/** Her colour: the side NOT to move in the puzzle's FEN (the opponent plays moves[0]). */
export function playerColor(p: PuzzleRun | ChessPuzzleData): Color {
  if ('color' in p) return p.color;
  const turn = p.fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
  return other(turn);
}

/** Why a puzzle can't be played (null = fine). For data tests. */
export function puzzleProblem(p: ChessPuzzleData): string | null {
  if (p.moves.length < 2) return 'needs the set-up move and at least one of hers';
  if (p.moves.length % 2 !== 0) return 'the last move must be hers (even number of moves)';
  let game: Chess;
  try { game = newGame(p.fen); } catch (e) { return `bad FEN: ${(e as Error).message}`; }
  for (let i = 0; i < p.moves.length; i++) {
    if (!playListed(game, p.moves[i]).ok) return `move ${i} (${p.moves[i]}) is not legal`;
    if (game.isGameOver() && i < p.moves.length - 1) return `the game ends after move ${i}`;
  }
  return null;
}

/**
 * Start a puzzle: plays the opponent's set-up move (moves[0]) so it's her turn.
 * Throws if the puzzle data is broken (see puzzleProblem).
 */
export function startPuzzle(p: ChessPuzzleData): PuzzleRun {
  const game = newGame(p.fen);
  const setup = playListed(game, p.moves[0] ?? '');
  if (!setup.ok || p.moves.length < 2) throw new Error(`Puzzle ${p.id ?? p.fen}: can't play the set-up move ${p.moves[0]}`);
  return {
    puzzle: p, fen: game.fen(), step: 1, color: game.turn(), lastMove: [setup.from, setup.to],
    status: 'playing', mistakes: 0, hints: 0,
  };
}

/**
 * She plays `uci` (e.g. "e2e4", "e7e8q"; no promotion letter on a promotion = queen).
 * Lichess rules: the listed move is right, and so is ANY move that gives checkmate (there can be
 * several). A right move that isn't the last one → 'correct', and the opponent's reply is played.
 */
export function puzzleMove(run: PuzzleRun, uci: string): PuzzleMoveResult {
  if (run.status !== 'playing') return { result: 'wrong', run, move: null, reason: 'over' };
  const game = newGame(run.fen);
  const move = tryUci(game, uci);
  if (!move.ok) return { result: 'wrong', run, move: null, reason: 'illegal' };

  const listed = run.puzzle.moves[run.step];
  const isListed = sameMove(move, listed);
  if (!isListed && !move.mate) {
    return { result: 'wrong', run: { ...run, mistakes: run.mistakes + 1 }, move, reason: 'try' };
  }

  const lastOne = run.step >= run.puzzle.moves.length - 1;
  if (move.mate || lastOne) {
    return {
      result: 'solved',
      run: { ...run, fen: move.fen, step: run.puzzle.moves.length, lastMove: [move.from, move.to], status: 'solved' },
      move,
      altMate: !isListed,
    };
  }

  const reply = playListed(game, run.puzzle.moves[run.step + 1]);
  if (!reply.ok) {
    // Broken data (the tests stop this): count her right move as the win rather than getting stuck.
    return { result: 'solved', run: { ...run, fen: move.fen, step: run.puzzle.moves.length, lastMove: [move.from, move.to], status: 'solved' }, move, altMate: false };
  }
  return {
    result: 'correct',
    run: { ...run, fen: reply.fen, step: run.step + 2, lastMove: [reply.from, reply.to] },
    move,
    reply,
  };
}

export type PuzzleHint =
  /** Level 1: which piece to move. */
  | { level: 1; square: string }
  /** Level 2: the whole move. */
  | { level: 2; square: string; from: string; to: string; san: string; uci: string };

/** A hint for the move she has to find: level 1 = the piece's square, level 2 = the whole move. Null once solved. */
export function puzzleHint(run: PuzzleRun, level: 1 | 2): PuzzleHint | null {
  if (run.status !== 'playing') return null;
  const game = newGame(run.fen);
  const m = playListed(game, run.puzzle.moves[run.step] ?? '');
  if (!m.ok) return null;
  return level === 1 ? { level: 1, square: m.from } : { level: 2, square: m.from, from: m.from, to: m.to, san: m.san, uci: m.uci };
}

/** Remember that she used a hint (keeps the biggest level). */
export function noteHint(run: PuzzleRun, level: 1 | 2): PuzzleRun {
  return level > run.hints ? { ...run, hints: level } : run;
}

/** How far through the puzzle she is, in her own moves: e.g. { done: 1, total: 2 }. */
export function puzzleProgress(run: PuzzleRun): { done: number; total: number } {
  const total = Math.floor(run.puzzle.moves.length / 2);
  return { done: run.status === 'solved' ? total : Math.min(total, Math.floor((run.step - 1) / 2)), total };
}

// ---------- her puzzle level (adaptive difficulty) ----------

export const START_LEVEL = 600;
export const MIN_LEVEL = 400;
export const MAX_LEVEL = 2000;
export const LEVEL_K = 40;

/**
 * Elo-style update after a puzzle. `solved` should mean "solved cleanly" (the screen decides, e.g.
 * no wrong move and no full-move hint). A puzzle well above her level moves it up a lot when solved
 * and only a little when missed. Rounded, clamped to 400–2000.
 */
export function updateLevel(level: number, puzzleRating: number, solved: boolean): number {
  const lv = Number.isFinite(level) ? level : START_LEVEL;
  const expected = 1 / (1 + 10 ** ((puzzleRating - lv) / 400));
  const next = lv + LEVEL_K * ((solved ? 1 : 0) - expected);
  return Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, next)));
}

/**
 * A puzzle near her level: rating within ±150, widening by 150 at a time until there's one she
 * hasn't seen. Only when she has seen every puzzle does a seen one come back (nearest band first).
 * Null for an empty list.
 */
export function pickPuzzle<T extends { id: string; rating: number }>(
  list: readonly T[], level: number, seenIds: ReadonlySet<string> | readonly string[], rng: Rng,
): T | null {
  if (!list.length) return null;
  const lv = Number.isFinite(level) ? level : START_LEVEL;
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds as readonly string[]);
  const fresh = list.filter(p => !seen.has(p.id));
  const pool = fresh.length ? fresh : list;
  const pick = (from: readonly T[]) => from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
  for (let band = 150; band <= 3000; band += 150) {
    const near = pool.filter(p => Math.abs(p.rating - lv) <= band);
    if (near.length) return pick(near);
  }
  return pick(pool); // only for ratings that aren't numbers
}

/** Points for a run of solved puzzles: Σ round(rating / 10). */
export function streakScore(solvedRatings: readonly number[]): number {
  return solvedRatings.reduce((sum, r) => sum + Math.round(r / 10), 0);
}
