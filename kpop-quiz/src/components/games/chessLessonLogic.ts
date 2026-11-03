// Chess Academy "Learn" rules — pure, no React.
//
// Star hunt: she has ONE white piece and some ⭐ squares. Nothing else moves. She collects a star by
// LANDING on it (sliding past one doesn't count) and the level ends when every star is collected.
// Blockers are her own pawns: they never move, can't be passed or landed on — only a knight can
// jump over them. A pawn steps forward one square (two from its start row) and becomes a queen
// when it reaches the 8th rank.
//
// Check & checkmate: real chess positions (white to move), checked with chess.js.
import { Chess } from 'chess.js';
import type { PieceSymbol, Square } from 'chess.js';

export type { Square } from 'chess.js';

/** The pieces a star hunt can use (white). */
export type StarPiece = 'r' | 'b' | 'q' | 'k' | 'n' | 'p';

export interface StarHuntLevel {
  kind: 'stars';
  id: string;
  title: string;
  /** Her piece at the start (a pawn may become a queen on the way). */
  piece: StarPiece;
  start: Square;
  stars: Square[];
  /** Her own pawns that never move. */
  blockers?: Square[];
  /** The fewest moves that collect every star (checked against bfsMinMoves in the tests). */
  target: number;
}

/** check = any move that gives check wins · mate = any checkmating move wins · escape = she's in check, any legal move wins. */
export type CheckGoal = 'check' | 'mate' | 'escape';

export interface CheckLevel {
  kind: 'check';
  id: string;
  title: string;
  goal: CheckGoal;
  /** A legal position, white to move. */
  fen: string;
  /** One friendly line shown above the board. */
  tip: string;
}

export type ChessLessonLevel = StarHuntLevel | CheckLevel;

export interface ChessLesson {
  id: string;
  /** The piece the lesson is about ('k' for Check & Checkmate — the king is what gets checked). */
  piece: StarPiece;
  emoji: string;
  title: string;
  /** 1–2 friendly sentences on how the piece moves. */
  intro: string;
  levels: ChessLessonLevel[];
}

// ---------- squares ----------

const FILES = 'abcdefgh';

export const fileOf = (sq: Square) => sq.charCodeAt(0) - 97; // 0–7 (a–h)
export const rankOf = (sq: Square) => sq.charCodeAt(1) - 48; // 1–8

export function isSquare(s: string): s is Square {
  return /^[a-h][1-8]$/.test(s);
}

export function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}

// ---------- star hunt ----------

export interface StarHuntState {
  /** Where her piece is now. */
  square: Square;
  /** Her piece now (a pawn becomes 'q' on the 8th rank). */
  piece: StarPiece;
  /** Stars collected so far, in the order she got them. */
  collected: Square[];
  moves: number;
}

export function starHuntStart(level: StarHuntLevel): StarHuntState {
  return { square: level.start, piece: level.piece, collected: [], moves: 0 };
}

const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KING_STEPS: [number, number][] = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** Squares a lone white piece can move to, with `blocked` squares it can't pass or land on (a knight jumps over them). */
export function pieceTargets(piece: StarPiece, from: Square, blocked: ReadonlySet<string>): Square[] {
  const f = fileOf(from), r = rankOf(from);
  const out: Square[] = [];
  const free = (sq: Square | null): sq is Square => sq !== null && !blocked.has(sq);
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      for (let k = 1; ; k++) {
        const sq = squareAt(f + df * k, r + dr * k);
        if (!free(sq)) break;
        out.push(sq);
      }
    }
  };
  const step = (offsets: [number, number][]) => {
    for (const [df, dr] of offsets) {
      const sq = squareAt(f + df, r + dr);
      if (free(sq)) out.push(sq);
    }
  };
  switch (piece) {
    case 'r': slide(ROOK_DIRS); break;
    case 'b': slide(BISHOP_DIRS); break;
    case 'q': slide([...ROOK_DIRS, ...BISHOP_DIRS]); break;
    case 'k': step(KING_STEPS); break;
    case 'n': step(KNIGHT_JUMPS); break;
    case 'p': {
      const one = squareAt(f, r + 1);
      if (free(one)) {
        out.push(one);
        const two = squareAt(f, r + 2);
        if (r === 2 && free(two)) out.push(two);
      }
      break;
    }
  }
  return out;
}

const blockerSet = (level: StarHuntLevel) => new Set<string>(level.blockers ?? []);

/** Legal squares for her piece standing on `from` (empty if `from` isn't where her piece is). */
export function starHuntTargets(level: StarHuntLevel, state: StarHuntState, from: Square): Square[] {
  if (from !== state.square || isComplete(level, state)) return [];
  return pieceTargets(state.piece, from, blockerSet(level));
}

/** Move her piece to `to`. Returns the new state, or null if that isn't a legal move. */
export function starHuntMove(level: StarHuntLevel, state: StarHuntState, to: Square): StarHuntState | null {
  if (!starHuntTargets(level, state, state.square).includes(to)) return null;
  const piece: StarPiece = state.piece === 'p' && rankOf(to) === 8 ? 'q' : state.piece;
  const gotStar = level.stars.includes(to) && !state.collected.includes(to);
  return {
    square: to,
    piece,
    collected: gotStar ? [...state.collected, to] : state.collected,
    moves: state.moves + 1,
  };
}

export function isComplete(level: StarHuntLevel, state: StarHuntState): boolean {
  return level.stars.every(s => state.collected.includes(s));
}

/** Stars still on the board. */
export function starsLeft(level: StarHuntLevel, state: StarHuntState): Square[] {
  return level.stars.filter(s => !state.collected.includes(s));
}

/**
 * One shortest route (the squares she lands on, in order), found by breadth-first search over
 * (square, piece, stars collected). Null if the stars can't all be collected.
 */
export function starHuntSolution(level: StarHuntLevel): Square[] | null {
  const all = (1 << level.stars.length) - 1;
  const starBit = new Map<string, number>(level.stars.map((s, i) => [s, 1 << i]));
  const blocked = blockerSet(level);
  type Node = { sq: Square; piece: StarPiece; mask: number; prev: Node | null };
  const key = (n: { sq: Square; piece: StarPiece; mask: number }) => `${n.sq}${n.piece}${n.mask}`;
  const startMask = starBit.get(level.start) ?? 0;
  const first: Node = { sq: level.start, piece: level.piece, mask: startMask, prev: null };
  const seen = new Set<string>([key(first)]);
  let frontier: Node[] = [first];
  let done: Node | null = first.mask === all ? first : null;
  while (!done && frontier.length) {
    const next: Node[] = [];
    for (const n of frontier) {
      for (const to of pieceTargets(n.piece, n.sq, blocked)) {
        const piece: StarPiece = n.piece === 'p' && rankOf(to) === 8 ? 'q' : n.piece;
        const child: Node = { sq: to, piece, mask: n.mask | (starBit.get(to) ?? 0), prev: n };
        const k = key(child);
        if (seen.has(k)) continue;
        seen.add(k);
        if (child.mask === all) { done = child; break; }
        next.push(child);
      }
      if (done) break;
    }
    frontier = next;
  }
  if (!done) return null;
  const path: Square[] = [];
  for (let n: Node | null = done; n && n.prev; n = n.prev) path.unshift(n.sq);
  return path;
}

/** The optimal number of moves for a star hunt, or null if it can't be finished. */
export function bfsMinMoves(level: StarHuntLevel): number | null {
  return starHuntSolution(level)?.length ?? null;
}

/** 3 stars for a perfect route, 2 if within 2 extra moves, else 1. */
export function starsEarned(movesUsed: number, target: number): 1 | 2 | 3 {
  if (movesUsed <= target) return 3;
  if (movesUsed <= target + 2) return 2;
  return 1;
}

export type PieceMap = Partial<Record<Square, { type: PieceSymbol; color: 'w' | 'b' }>>;

/** What to draw for a star hunt: her piece plus her blocker pawns (stars are an overlay — use starsLeft). */
export function toPieceMap(level: StarHuntLevel, state: StarHuntState): PieceMap {
  const map: PieceMap = {};
  for (const b of level.blockers ?? []) map[b] = { type: 'p', color: 'w' };
  map[state.square] = { type: state.piece, color: 'w' };
  return map;
}

/**
 * The same position as a FEN (white to move). It has no kings unless her piece is the king, so
 * chess.js only loads it with `{ skipValidation: true }` — it's for drawing, not for playing.
 */
export function toFen(level: StarHuntLevel, state: StarHuntState): string {
  const map = toPieceMap(level, state);
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = map[squareAt(file, rank)!];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.color === 'w' ? p.type.toUpperCase() : p.type;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} w - - 0 1`;
}

// ---------- check & checkmate ----------

export type LessonMove = string | { from: Square; to: Square; promotion?: string };

export type CheckAnswer =
  | { result: 'correct'; san: string; fen: string }
  /** illegal = chess doesn't allow it (in an escape level: her king would still be in check). */
  | { result: 'try_again'; reason: 'illegal' | 'no_check' | 'no_mate'; san?: string };

function parseMove(move: LessonMove): { from: Square; to: Square; promotion?: string } | null {
  if (typeof move !== 'string') return move;
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(move.trim().toLowerCase());
  if (!m) return null;
  return { from: m[1] as Square, to: m[2] as Square, promotion: m[3] };
}

/** Is `move` a right answer for this check lesson? Uses chess.js; a pawn reaching the last rank becomes a queen unless told otherwise. */
export function checkLessonAnswer(level: CheckLevel, move: LessonMove): CheckAnswer {
  const parsed = parseMove(move);
  if (!parsed) return { result: 'try_again', reason: 'illegal' };
  const chess = new Chess(level.fen);
  let san: string;
  try {
    const piece = chess.get(parsed.from);
    const promoting = piece?.type === 'p' && (rankOf(parsed.to) === 8 || rankOf(parsed.to) === 1);
    san = chess.move({ from: parsed.from, to: parsed.to, promotion: promoting ? parsed.promotion ?? 'q' : undefined }).san;
  } catch {
    return { result: 'try_again', reason: 'illegal' };
  }
  if (level.goal === 'check' && !chess.isCheck()) return { result: 'try_again', reason: 'no_check', san };
  if (level.goal === 'mate' && !chess.isCheckmate()) return { result: 'try_again', reason: 'no_mate', san };
  return { result: 'correct', san, fen: chess.fen() };
}

/** Every right answer, as UCI ('a1a8', 'e7e8q'). */
export function checkLessonSolutions(level: CheckLevel): string[] {
  const chess = new Chess(level.fen);
  return chess.moves({ verbose: true })
    .map(m => `${m.from}${m.to}${m.promotion ?? ''}`)
    .filter(uci => checkLessonAnswer(level, uci).result === 'correct');
}

/** Legal squares for the piece on `from` in a check lesson (for drawing move dots). */
export function checkLessonTargets(level: CheckLevel, from: Square): Square[] {
  const chess = new Chess(level.fen);
  return [...new Set(chess.moves({ square: from, verbose: true }).map(m => m.to))];
}
