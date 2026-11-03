/**
 * Chess Academy computer opponents: 🐶 Biscuit, 🦊 Fox and 🦉 Professor Hoot.
 *
 * Pure logic (no React, no DOM, no timers): chess.js makes the moves, this file picks one.
 * The UI asks through `askBot` (chessBotClient.ts), which runs `chooseMove` in a Web Worker.
 *
 * - Evaluation: material (P100 N320 B330 R500 Q900) + our own piece-square tables (made from the
 *   little formulas below), bishop pair, king safety → king in the middle in the endgame, and a
 *   "push the lone king to the edge" term so a bot that is well ahead actually finishes the game.
 * - Search: negamax alpha-beta; moves ordered promotions → captures (MVV-LVA) → checks → killers → rest.
 *   Iterative deepening with a time cap for every bot (only Hoot ever gets near it).
 * - 🐶 Biscuit: depth 1, and ~30% of the time a random move — never one that simply loses its queen.
 * - 🦊 Fox: depth 2. 🦉 Hoot: up to depth 4 + a short capture-only quiescence, stops at `timeMs`.
 *   Both pick at random among moves within 20 centipawns of the best (weighted towards the best), so games differ.
 *
 * Speed: chess.js's public `move()` / `moves({ verbose: true })` build SAN and two FENs for every
 * move (≈100× slower than its own move generator), so the search drives chess.js's internal
 * generator (`_moves`, `_makeMove`, `_undoMove`, the same calls chess.js's own `Move` class and
 * `perft` use). They are private in chess.js 1.4.0: `hasFastPath` checks they are there (a test
 * fails if an upgrade renames them) and, if not, the bots fall back to the public API at a lower depth.
 */
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';

// ── The bots ────────────────────────────────────────────────────────────────────────────────

export type BotId = 'biscuit' | 'fox' | 'hoot';

export interface BotLines {
  /** Said at the start of a game. */
  greet: string[];
  /** After one of her good moves (the UI decides what counts, e.g. it matches `hintMove`). */
  goodMove: string[];
  /** The bot won — kind, never gloating. */
  win: string[];
  /** The bot lost — she won. */
  lose: string[];
  draw: string[];
}

export interface BotInfo {
  name: string;
  emoji: string;
  blurb: string;
  lines: BotLines;
}

export const BOT_IDS: BotId[] = ['biscuit', 'fox', 'hoot'];

export const BOTS: Record<BotId, BotInfo> = {
  biscuit: {
    name: 'Biscuit',
    emoji: '🐶',
    blurb: 'A puppy who is just learning. Biscuit sometimes forgets to look — perfect for your first games!',
    lines: {
      greet: [
        "Woof! Hello! I'm still learning, so let's have fun!",
        "Hi! I've been practising my pawn moves!",
        'Ready to play? I promise to try my best!',
      ],
      goodMove: ['Ooh, nice move!', "Wow, I didn't see that one!", "Clever! You're good at this!", 'Paws up for that move!'],
      win: [
        'I got lucky that time! Good game — rematch?',
        'That was so much fun! Want to play again?',
        "Good game! You'll get me next time, I'm sure!",
      ],
      lose: ['You won! Brilliant playing!', "Woof! You're a star! Well done!", 'Checkmate! You were too clever for me!'],
      draw: ["A draw! We're both winners today!", "It's a tie! Good game, friend!"],
    },
  },
  fox: {
    name: 'Fox',
    emoji: '🦊',
    blurb: 'A keen chess-club player who spots any piece left on its own. Guard your pieces!',
    lines: {
      greet: ['Hi! I go to chess club every week. Good luck!', "Let's have a great game!", "Ready? I'll be looking for loose pieces!"],
      goodMove: ['Sharp move!', "Ooh, that's a good one!", "Nice! You're thinking ahead.", 'Great spot!'],
      win: ['Good game! Want a rematch?', 'That was close! Fancy another game?', 'Well played — you made me think hard!'],
      lose: ['You got me! Brilliant game!', 'Wow, you outfoxed the fox!', 'Great win! You played really well.'],
      draw: ['A draw — nicely fought!', "We're all square! Good game!"],
    },
  },
  hoot: {
    name: 'Professor Hoot',
    emoji: '🦉',
    blurb: 'A wise old owl who loves sneaky tricks. Check every capture — a real challenge!',
    lines: {
      greet: [
        "Hoo-hoo! Welcome, young player. Let's see what you can do!",
        'Ah, a new challenger! Have fun and think carefully.',
        'Good to see you! Remember: look before you leap.',
      ],
      goodMove: ['Hoo! A splendid move!', 'Very wise indeed!', "Excellent! I'm impressed.", 'Ah, a fine idea!'],
      win: ['Good game! Want a rematch?', 'Well played! Every game makes you stronger.', 'A fine battle! Shall we play again?'],
      lose: ['Hoo-hoo! You beat me! Marvellous!', 'Bravo! That was a brilliant game.', 'You outsmarted the professor! Well done!'],
      draw: ['A draw against the professor — splendid!', 'Evenly matched! What a good game.'],
    },
  },
};

/** A random line of the given kind for a bot. */
export function botLine(bot: BotId, kind: keyof BotLines, rng: () => number = Math.random): string {
  const list = BOTS[bot].lines[kind];
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// ── Board access ────────────────────────────────────────────────────────────────────────────

/** A move as chess.js generates it internally: 0x88 squares (a8 = 0, h8 = 7, a1 = 112, h1 = 119). */
interface Mv {
  color: Color;
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
}
type Cell = { type: PieceSymbol; color: Color } | undefined;

interface Board {
  turn(): Color;
  /** 128 cells, 0x88 layout. */
  cells(): ArrayLike<Cell>;
  /** Pseudo-legal moves (may leave the own king in check — `play` refuses those). */
  moves(): Mv[];
  /** Makes the move; false (and nothing changed) if it leaves the mover's king in check. */
  play(m: Mv): boolean;
  undo(): void;
  /** Is the side to move in check? */
  inCheck(): boolean;
  /** Does any piece of `by` attack the 0x88 square? */
  attacked(by: Color, sq: number): boolean;
  fen(): string;
}

/** chess.js 1.4.0 private members the fast path uses. */
interface ChessInternals {
  _board: Cell[];
  _turn: Color;
  _moves(opts: { legal: boolean }): Mv[];
  _makeMove(m: Mv): void;
  _undoMove(): unknown;
  _isKingAttacked(color: Color): boolean;
  _attacked(color: Color, sq: number): boolean;
}

/** True when this chess.js build still has the internals the fast search needs. */
export function hasFastPath(chess: Chess = new Chess()): boolean {
  const c = chess as unknown as Record<string, unknown>;
  return (
    Array.isArray(c._board) &&
    (c._turn === 'w' || c._turn === 'b') &&
    ['_moves', '_makeMove', '_undoMove', '_isKingAttacked', '_attacked'].every(k => typeof c[k] === 'function')
  );
}

function fastBoard(chess: Chess): Board {
  const raw = chess as unknown as ChessInternals;
  return {
    turn: () => raw._turn,
    cells: () => raw._board,
    moves: () => raw._moves({ legal: false }),
    play(m) {
      const us = raw._turn;
      raw._makeMove(m);
      if (raw._isKingAttacked(us)) {
        raw._undoMove();
        return false;
      }
      return true;
    },
    undo: () => void raw._undoMove(),
    inCheck: () => raw._isKingAttacked(raw._turn),
    attacked: (by, sq) => raw._attacked(by, sq),
    fen: () => chess.fen(),
  };
}

const sq88 = (s: string) => (8 - Number(s[1])) * 16 + (s.charCodeAt(0) - 97);
const alg = (sq: number) => (String.fromCharCode(97 + (sq & 7)) + (8 - (sq >> 4))) as Square;

/** Slow but safe: only chess.js's public API. Used if the internals ever change. */
function publicBoard(chess: Chess): Board {
  let cache: Cell[] | null = null;
  return {
    turn: () => chess.turn(),
    cells() {
      if (!cache) {
        const cells: Cell[] = new Array(128);
        chess.board().forEach((row, r) => row.forEach((p, f) => (cells[r * 16 + f] = p ? { type: p.type, color: p.color } : undefined)));
        cache = cells;
      }
      return cache;
    },
    moves: () =>
      chess.moves({ verbose: true }).map(m => ({
        color: m.color,
        from: sq88(m.from),
        to: sq88(m.to),
        piece: m.piece,
        captured: m.captured,
        promotion: m.promotion,
        flags: 0,
      })),
    play(m) {
      chess.move({ from: alg(m.from), to: alg(m.to), promotion: m.promotion });
      cache = null;
      return true;
    },
    undo() {
      chess.undo();
      cache = null;
    },
    inCheck: () => chess.inCheck(),
    attacked: (by, sq) => chess.isAttacked(alg(sq), by),
    fen: () => chess.fen(),
  };
}

const uci = (m: Mv) => alg(m.from) + alg(m.to) + (m.promotion ?? '');
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

// ── Evaluation ──────────────────────────────────────────────────────────────────────────────

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;
/** Scores beyond this are "mate in N". */
const MATE_BOUND = MATE - 1000;
const INF = 1_000_000;

/** The 64 real squares of a 0x88 board. */
const SQUARES_88: number[] = Array.from({ length: 64 }, (_, i) => (i >> 3) * 16 + (i & 7));

/** Distance from the centre: 1 on d4/e4/d5/e5 … 7 in a corner. */
const centreDist = (f: number, r: number) => Math.abs(f - 3.5) + Math.abs(r - 3.5);

/** A table indexed by rank * 8 + file, rank 0 = the owner's back rank. */
const table = (fn: (f: number, r: number) => number) => Int16Array.from({ length: 64 }, (_, i) => Math.round(fn(i & 7, i >> 3)));

/** Pawn bonus by rank for each file group: d/e want to go to the middle; f/g/h stay home to guard a castled king. */
const PAWN_FILES: Record<'centre' | 'c' | 'king' | 'queen', number[]> = {
  centre: [0, -12, 2, 18, 14, 6, 0, 0],
  c: [0, 0, 2, 6, 4, 2, 0, 0],
  king: [0, 8, 0, -6, -4, 0, 0, 0],
  queen: [0, 2, 0, -2, 0, 2, 0, 0],
};
const pawnFile = (f: number) => (f === 3 || f === 4 ? PAWN_FILES.centre : f === 2 ? PAWN_FILES.c : f >= 5 ? PAWN_FILES.king : PAWN_FILES.queen);

/** Middlegame tables. Pawns and kings have endgame ones too (blended by how many pieces are left). */
const PST_MG: Record<PieceSymbol, Int16Array> = {
  p: table((f, r) => [0, 0, 3, 8, 16, 28, 50, 0][r] + pawnFile(f)[r]),
  n: table((f, r) => 24 - 8 * centreDist(f, r)),
  b: table((f, r) => 10 - 4 * centreDist(f, r) - (r === 0 ? 8 : 0)),
  r: table((f, r) => (r === 6 ? 16 : 0) + (r === 0 && f >= 2 && f <= 5 ? 4 : 0)),
  q: table((f, r) => 4 - 2 * centreDist(f, r) + (r === 0 ? 2 : 0)),
  k: table((f, r) =>
    r === 0 ? [10, 20, 8, -4, 0, -4, 24, 12][f] : r === 1 ? [-4, -6, -12, -20, -20, -12, -6, -4][f] : -30 - 8 * (r - 2),
  ),
};
const PAWN_EG = table((_f, r) => [0, 0, 6, 14, 26, 44, 72, 0][r]);
const KING_EG = table((f, r) => 24 - 8 * centreDist(f, r));
const PHASE: Record<PieceSymbol, number> = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };

/** Table index for a 0x88 square from `color`'s side of the board. */
const idx = (sq: number, color: Color) => (color === 'w' ? (7 - (sq >> 4)) * 8 + (sq & 7) : (sq >> 4) * 8 + (sq & 7));

/** Static score in centipawns, + = good for White. */
function evaluate(cells: ArrayLike<Cell>): number {
  let score = 0;
  let pawnMg = 0;
  let pawnEg = 0;
  let phase = 0;
  const material = { w: 0, b: 0 };
  const bishops = { w: 0, b: 0 };
  const minors = { w: 0, b: 0 };
  let heavyOrPawn = false;
  const kings = { w: -1, b: -1 };
  for (const sq of SQUARES_88) {
    const p = cells[sq];
    if (!p) continue;
    const sign = p.color === 'w' ? 1 : -1;
    const i = idx(sq, p.color);
    material[p.color] += VALUE[p.type];
    phase += PHASE[p.type];
    if (p.type === 'p') {
      pawnMg += sign * PST_MG.p[i];
      pawnEg += sign * PAWN_EG[i];
      heavyOrPawn = true;
    } else if (p.type === 'k') {
      kings[p.color] = sq;
    } else {
      score += sign * PST_MG[p.type][i];
      if (p.type === 'b') bishops[p.color]++;
      if (p.type === 'b' || p.type === 'n') minors[p.color]++;
      else heavyOrPawn = true;
    }
  }
  // Bare kings, or one knight/bishop each at most: nobody can win.
  if (!heavyOrPawn && minors.w <= 1 && minors.b <= 1) return 0;

  score += material.w - material.b;
  if (bishops.w >= 2) score += 25;
  if (bishops.b >= 2) score -= 25;

  const mg = Math.min(phase, 24);
  const blend = (mgScore: number, egScore: number) => (mgScore * mg + egScore * (24 - mg)) / 24;
  score += blend(pawnMg, pawnEg);
  for (const c of ['w', 'b'] as const) {
    const sq = kings[c];
    if (sq < 0) continue;
    const i = idx(sq, c);
    score += (c === 'w' ? 1 : -1) * blend(PST_MG.k[i], KING_EG[i]);
  }

  // Winning a simple ending: drive the other king to the edge and walk your own king up.
  const lead = material.w - material.b;
  if (mg <= 6 && Math.abs(lead) >= 300 && kings.w >= 0 && kings.b >= 0) {
    const loser = lead > 0 ? kings.b : kings.w;
    const kingGap = Math.abs((kings.w & 7) - (kings.b & 7)) + Math.abs((kings.w >> 4) - (kings.b >> 4));
    const push = 8 * centreDist(loser & 7, loser >> 4) + 5 * (14 - kingGap);
    score += lead > 0 ? push : -push;
  }
  return Math.round(score);
}

// ── Search ──────────────────────────────────────────────────────────────────────────────────

const ORDER_RANK: Record<PieceSymbol, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

interface Plan {
  maxDepth: number;
  /** Plies of capture-only search at the leaves (0 = none). */
  quiesce: number;
  /** Pick at random (weighted towards the best) among moves within this many centipawns of the best. */
  margin: number;
  timeMs: number;
}

class Search {
  private nodes = 0;
  stopped = false;
  private killers: Mv[][] = [];
  private readonly b: Board;
  private readonly quiesce: number;
  private readonly deadline: number;
  private readonly repeats: Set<Mv>;

  constructor(b: Board, quiesce: number, deadline: number, repeats: Set<Mv>) {
    this.b = b;
    this.quiesce = quiesce;
    this.deadline = deadline;
    this.repeats = repeats;
  }

  private tick() {
    if ((++this.nodes & 63) === 0 && Date.now() > this.deadline) this.stopped = true;
  }

  /** Side-to-move score. */
  private staticScore(): number {
    const e = evaluate(this.b.cells());
    return this.b.turn() === 'w' ? e : -e;
  }

  private hasLegalMove(): boolean {
    for (const m of this.b.moves()) {
      if (this.b.play(m)) {
        this.b.undo();
        return true;
      }
    }
    return false;
  }

  /** End of the line without quiescence: spot mate and stalemate, else the static score. */
  private leaf(ply: number): number {
    if (!this.hasLegalMove()) return this.b.inCheck() ? -MATE + ply : 0;
    return this.staticScore();
  }

  /** Best first. `probeChecks` plays each move to see whether it gives check (costs a little). */
  order(moves: Mv[], ply: number, probeChecks: boolean): Mv[] {
    const killers = this.killers[ply];
    const keyed = moves.map(m => {
      let s: number;
      if (m.promotion) s = 30_000 + VALUE[m.promotion];
      else if (m.captured) s = 20_000 + ORDER_RANK[m.captured] * 16 - ORDER_RANK[m.piece];
      else if (killers && killers.some(k => k.from === m.from && k.to === m.to)) s = 9_000;
      else s = PST_MG[m.piece][idx(m.to, m.color)] - PST_MG[m.piece][idx(m.from, m.color)];
      if (probeChecks) {
        if (!this.b.play(m)) s = -INF;
        else {
          if (this.b.inCheck()) s += m.captured || m.promotion ? 100 : 10_000;
          this.b.undo();
        }
      }
      return { m, s };
    });
    keyed.sort((a, b) => b.s - a.s);
    return keyed.map(k => k.m);
  }

  private addKiller(ply: number, m: Mv) {
    const list = (this.killers[ply] ??= []);
    if (list.some(k => k.from === m.from && k.to === m.to)) return;
    list.unshift(m);
    if (list.length > 2) list.pop();
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;
    if (depth <= 0) return this.quiesce > 0 ? this.qsearch(alpha, beta, ply, this.quiesce) : this.leaf(ply);
    const moves = this.order(this.b.moves(), ply, depth >= 2);
    let legal = 0;
    let best = -INF;
    for (const m of moves) {
      if (!this.b.play(m)) continue;
      legal++;
      const v = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.b.undo();
      if (this.stopped) return 0;
      if (v > best) {
        best = v;
        if (v > alpha) {
          alpha = v;
          if (v >= beta) {
            if (!m.captured && !m.promotion) this.addKiller(ply, m);
            break;
          }
        }
      }
    }
    if (legal === 0) return this.b.inCheck() ? -MATE + ply : 0;
    return best;
  }

  /** Captures (and queening) only, so a search never stops halfway through a swap. */
  private qsearch(alpha: number, beta: number, ply: number, left: number): number {
    this.tick();
    if (this.stopped) return 0;
    const inCheck = this.b.inCheck();
    let best: number;
    if (inCheck) {
      if (left <= 0) return this.leaf(ply);
      best = -INF; // in check: every escape is searched, no standing pat
    } else {
      best = this.staticScore();
      if (left <= 0 || best >= beta) return best;
      if (best > alpha) alpha = best;
    }
    const all = this.b.moves();
    const moves = this.order(inCheck ? all : all.filter(m => m.captured || m.promotion === 'q'), ply, false);
    let legal = 0;
    for (const m of moves) {
      if (!this.b.play(m)) continue;
      legal++;
      const v = -this.qsearch(-beta, -alpha, ply + 1, left - 1);
      this.b.undo();
      if (this.stopped) return 0;
      if (v > best) {
        best = v;
        if (v > alpha) {
          alpha = v;
          if (v >= beta) break;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  /**
   * Scores every root move at `depth`. Each move is searched with alpha a margin below the best so
   * far, so every move within `margin` of the best gets its true score (the rest score ≤ alpha).
   * Returns null if time ran out (`partial` then holds what was finished).
   */
  root(moves: Mv[], depth: number, margin: number, partial: number[]): number[] | null {
    let best = -INF;
    for (let i = 0; i < moves.length; i++) {
      const alpha = best <= -INF ? -INF : Math.abs(best) >= MATE_BOUND ? best - 1 : best - margin - 1;
      this.b.play(moves[i]);
      let v = -this.negamax(depth - 1, -INF, -alpha, 1);
      this.b.undo();
      if (this.stopped) return null;
      if (this.repeats.has(moves[i])) v = Math.min(v, 0); // back to an earlier position: no better than a draw
      partial[i] = v;
      if (v > best) best = v;
    }
    return partial;
  }
}

/**
 * A random pick among the moves within `margin` of the best score, weighted towards the best
 * ((margin + 1 − gap)²: equal moves are equally likely, one 20 cp worse is rare). Only the exact
 * best once a mate is involved.
 */
function pickNear(moves: Mv[], scores: number[], margin: number, rng: () => number): Mv {
  const best = Math.max(...scores);
  const room = Math.abs(best) >= MATE_BOUND ? 0 : margin;
  const weights = scores.map(v => (best - v <= room ? (room + 1 - (best - v)) ** 2 : 0));
  let r = rng() * weights.reduce((a, w) => a + w, 0);
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (weights[i] > 0 && r < 0) return moves[i];
  }
  return moves[scores.indexOf(best)];
}

/** Iterative deepening over the root moves (all legal). Never returns without a move. */
function think(b: Board, rootMoves: Mv[], plan: Plan, rng: () => number, repeats = new Set<Mv>()): Mv {
  const s = new Search(b, plan.quiesce, Date.now() + plan.timeMs, repeats);
  let order = s.order(rootMoves, 0, true);
  let scores: number[] | null = null;
  for (let depth = 1; depth <= plan.maxDepth; depth++) {
    const partial = order.map(() => -INF);
    const done = s.root(order, depth, plan.margin, partial);
    if (!done) {
      // Out of time. The unfinished pass searched last pass's best first; if it already found
      // something clearly better, trust it. Otherwise keep the last finished pass.
      let bi = 0;
      for (let i = 1; i < partial.length; i++) if (partial[i] > partial[bi]) bi = i;
      if (partial[0] > -INF && partial[bi] > partial[0]) return order[bi];
      if (!scores) return partial[bi] > -INF ? order[bi] : order[0];
      break;
    }
    const rank = order.map((_, i) => i).sort((x, y) => done[y] - done[x]);
    order = rank.map(i => order[i]);
    scores = rank.map(i => done[i]);
    if (scores[0] >= MATE_BOUND) break; // a mate was found: nothing deeper beats it
  }
  return pickNear(order, scores!, plan.margin, rng);
}

/** Does playing `m` leave the mover's queen where it can simply be taken (by a cheaper piece, or for free)? */
function hangsQueen(b: Board, m: Mv): boolean {
  const us = m.color;
  const them = other(us);
  if (!b.play(m)) return false;
  let hangs = false;
  const cells = b.cells();
  const queens = SQUARES_88.filter(sq => cells[sq]?.type === 'q' && cells[sq]?.color === us && b.attacked(them, sq));
  if (queens.length) {
    for (const r of b.moves()) {
      if (!queens.includes(r.to) || !b.play(r)) continue;
      const lost = r.piece !== 'q' || !b.attacked(us, r.to);
      b.undo();
      if (lost) {
        hangs = true;
        break;
      }
    }
  }
  b.undo();
  return hangs;
}

function legalMoves(b: Board): Mv[] {
  return b.moves().filter(m => {
    if (!b.play(m)) return false;
    b.undo();
    return true;
  });
}

const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Root moves that go back to a position from `seen` (FENs from earlier in the game). */
function repeatingMoves(b: Board, moves: Mv[], seen: string[] | undefined): Set<Mv> {
  const out = new Set<Mv>();
  if (!seen?.length) return out;
  const keys = new Set(seen.map(positionKey));
  for (const m of moves) {
    if (!b.play(m)) continue;
    if (keys.has(positionKey(b.fen()))) out.add(m);
    b.undo();
  }
  return out;
}

function makeBoard(fen: string, publicApiOnly = false): { b: Board; fast: boolean } | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const fast = !publicApiOnly && hasFastPath(chess);
  return { b: fast ? fastBoard(chess) : publicBoard(chess), fast };
}

/** Without chess.js internals each node costs ~1–3 ms, so keep the search shallow. */
const forBoard = (plan: Plan, fast: boolean): Plan => (fast ? plan : { ...plan, maxDepth: Math.min(plan.maxDepth, 2), quiesce: 0 });

export const DEFAULT_TIME_MS = 1500;
/** How often Biscuit plays a random (queen-safe) move instead of its best one. */
export const BISCUIT_RANDOM = 0.3;

const PLANS: Record<BotId, Omit<Plan, 'timeMs'>> = {
  biscuit: { maxDepth: 1, quiesce: 0, margin: 20 },
  fox: { maxDepth: 2, quiesce: 0, margin: 20 },
  hoot: { maxDepth: 4, quiesce: 4, margin: 20 },
};

export interface ChooseOptions {
  /** Time cap in ms (default 1500). Only Hoot ever gets near it; it then plays the best move found so far. */
  timeMs?: number;
  /**
   * FENs of the earlier positions in this game (e.g. `history({ verbose: true }).map(m => m.before)`).
   * A move back to one of them counts as no better than a draw, so a bot that is ahead doesn't
   * give endless checks or shuffle back and forth.
   */
  seen?: string[];
  /** Tests only: search with chess.js's public API (the fallback used if its internals change). */
  publicApiOnly?: boolean;
}

/**
 * The bot's move for the side to move in `fen`, in UCI ("e2e4", "e7e8q").
 * Returns '' when there is no move (checkmate, stalemate) or the FEN is not valid.
 * Same `rng` seed ⇒ same move, as long as the time cap isn't reached (only Hoot gets near it).
 */
export function chooseMove(fen: string, bot: BotId, rng: () => number, opts: ChooseOptions = {}): string {
  const made = makeBoard(fen, opts.publicApiOnly);
  if (!made) return '';
  const { b, fast } = made;
  const moves = legalMoves(b);
  if (moves.length === 0) return '';
  if (moves.length === 1) return uci(moves[0]);
  const plan = forBoard({ ...(PLANS[bot] ?? PLANS.fox), timeMs: opts.timeMs ?? DEFAULT_TIME_MS }, fast);

  if (bot === 'biscuit') {
    const safe = moves.filter(m => !hangsQueen(b, m));
    const pool = safe.length ? safe : moves;
    if (rng() < BISCUIT_RANDOM) return uci(pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]);
    return uci(think(b, pool, plan, rng, repeatingMoves(b, pool, opts.seen)));
  }
  return uci(think(b, moves, plan, rng, repeatingMoves(b, moves, opts.seen)));
}

/** A good move for the player to move in `fen` (depth 2 + captures), for the 💡 hint button. '' if none. */
export function hintMove(fen: string): string {
  const made = makeBoard(fen);
  if (!made) return '';
  const moves = legalMoves(made.b);
  if (moves.length === 0) return '';
  if (moves.length === 1) return uci(moves[0]);
  return uci(think(made.b, moves, forBoard({ maxDepth: 2, quiesce: 4, margin: 0, timeMs: 1000 }, made.fast), () => 0));
}
