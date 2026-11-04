// 🤖 Robo Quest — the robot's world and the program interpreter. No React, no Blockly: the
// Blockly workspace is turned into a `Program` (roboBlocks.ts) and run here, step by step.
//
// The board is a small grid. The robot needs to reach its charging dock 🔋, but only after it has
// picked up every ⚡ battery on the way (it rolls over the dock otherwise). Bumping into a wall
// stops the run kindly; a loop that never reaches the dock is stopped after a step limit.

export type Dir = 0 | 1 | 2 | 3; // 0 up, 1 right, 2 down, 3 left
export type SensorDir = 'ahead' | 'left' | 'right';
export type BlockKind = 'forward' | 'left' | 'right' | 'repeat' | 'until' | 'if' | 'ifelse';

export type Stmt =
  | { t: 'forward' | 'left' | 'right'; id?: string }
  | { t: 'repeat'; n: number; body: Stmt[]; id?: string }
  | { t: 'until'; body: Stmt[]; id?: string }
  /** `else` present (even empty) = the if / else block. */
  | { t: 'if'; dir: SensorDir; body: Stmt[]; else?: Stmt[]; id?: string };
export type Program = Stmt[];

export interface Pos { x: number; y: number }
export interface Board {
  w: number;
  h: number;
  /** cells[y][x]: '#' wall, ' ' nothing (off the path), '.' floor. Start, dock and batteries are floor. */
  cells: string[][];
  start: Pos;
  dir: Dir;
  dock: Pos;
  batteries: Pos[];
}

export interface RoboLevelDef {
  /** Saved in progress — never rename. */
  id: string;
  world: 1 | 2 | 3;
  n: number;
  title: string;
  /** Rows top to bottom: '#' wall, ' ' nothing, '.' floor, 'S' start, 'G' dock 🔋, '*' battery ⚡. */
  grid: string[];
  dir: Dir;
  blocks: BlockKind[];
  /** Blocks for ⭐⭐⭐ — the reference solution's size (tests check nothing shorter works where they can). */
  target: number;
  solution: Program;
  hint: string;
}

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const REPEAT_MIN = 2;
export const REPEAT_MAX = 9;
export const MAX_MOVES = 300;
export const MAX_EVALS = 3000;
/** A run that loops for ever is only animated this far (she shouldn't wait through 300 steps). */
export const LOOP_PLAYBACK = 20;

export function parseLevel(def: Pick<RoboLevelDef, 'grid' | 'dir'>): Board {
  const h = def.grid.length;
  const w = Math.max(...def.grid.map(r => r.length));
  let start: Pos | null = null;
  let dock: Pos | null = null;
  const batteries: Pos[] = [];
  const cells = def.grid.map((row, y) => Array.from({ length: w }, (_, x) => {
    const c = row[x] ?? ' ';
    if (c === 'S') start = { x, y };
    if (c === 'G') dock = { x, y };
    if (c === '*') batteries.push({ x, y });
    return c === '#' || c === ' ' ? c : '.';
  }));
  if (!start || !dock) throw new Error('A level needs a start S and a dock G');
  return { w, h, cells, start, dir: def.dir, dock, batteries };
}

export const isOpen = (b: Board, x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.cells[y][x] === '.';

export function sensorCell(p: Pos, dir: Dir, look: SensorDir): Pos {
  const d = ((dir + (look === 'left' ? 3 : look === 'right' ? 1 : 0)) % 4) as Dir;
  return { x: p.x + DX[d], y: p.y + DY[d] };
}

export type StepKind = 'move' | 'turn' | 'sense' | 'bump';
export interface TraceStep {
  kind: StepKind;
  x: number;
  y: number;
  dir: Dir;
  blockId?: string;
  /** Index of the battery picked up on this step. */
  got?: number;
  /** For 'sense': the cell looked at and whether it was clear. For 'bump': the wall it bumped. */
  cell?: Pos;
  clear?: boolean;
}
export type RunResult = 'dock' | 'bump' | 'short' | 'missing' | 'loop' | 'empty';
export interface Run {
  result: RunResult;
  steps: TraceStep[];
  /** For 'empty': the loop block with nothing inside. */
  emptyId?: string;
}

class Stop extends Error {
  result: RunResult;
  emptyId?: string;
  constructor(result: RunResult, emptyId?: string) {
    super(result);
    this.result = result;
    this.emptyId = emptyId;
  }
}

/** Runs the program on the board and records every step (moves, turns, sensor checks). */
export function runProgram(board: Board, prog: Program): Run {
  const steps: TraceStep[] = [];
  let x = board.start.x, y = board.start.y, dir = board.dir;
  const got = new Set<number>();
  let moves = 0, evals = 0;
  const docked = () => x === board.dock.x && y === board.dock.y && got.size === board.batteries.length;

  const exec = (list: Stmt[]) => {
    for (const s of list) {
      if (++evals > MAX_EVALS) throw new Stop('loop');
      switch (s.t) {
        case 'forward': {
          const nx = x + DX[dir], ny = y + DY[dir];
          if (!isOpen(board, nx, ny)) {
            steps.push({ kind: 'bump', x, y, dir, blockId: s.id, cell: { x: nx, y: ny } });
            throw new Stop('bump');
          }
          x = nx; y = ny;
          const b = board.batteries.findIndex(p => p.x === x && p.y === y);
          const fresh = b >= 0 && !got.has(b);
          if (fresh) got.add(b);
          steps.push({ kind: 'move', x, y, dir, blockId: s.id, ...(fresh ? { got: b } : {}) });
          if (docked()) throw new Stop('dock');
          if (++moves > MAX_MOVES) throw new Stop('loop');
          break;
        }
        case 'left':
        case 'right':
          dir = ((dir + (s.t === 'left' ? 3 : 1)) % 4) as Dir;
          steps.push({ kind: 'turn', x, y, dir, blockId: s.id });
          if (++moves > MAX_MOVES) throw new Stop('loop');
          break;
        case 'repeat':
          if (s.body.length === 0) throw new Stop('empty', s.id);
          for (let i = 0; i < s.n; i++) exec(s.body);
          break;
        case 'until':
          if (s.body.length === 0) throw new Stop('empty', s.id);
          while (!docked()) exec(s.body);
          break;
        case 'if': {
          const c = sensorCell({ x, y }, dir, s.dir);
          const clear = isOpen(board, c.x, c.y);
          steps.push({ kind: 'sense', x, y, dir, blockId: s.id, cell: c, clear });
          if (clear) exec(s.body); else if (s.else) exec(s.else);
          break;
        }
      }
    }
  };

  try {
    exec(prog);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const run: Run = { result: e.result, steps };
    if (e.emptyId) run.emptyId = e.emptyId;
    if (e.result === 'loop') run.steps = steps.slice(0, LOOP_PLAYBACK);
    return run;
  }
  const onDock = x === board.dock.x && y === board.dock.y;
  return { result: onDock ? 'missing' : 'short', steps };
}

/** Blocks in the program (each statement is one block; if/else is one block). */
export function blockCount(prog: Program): number {
  let n = 0;
  for (const s of prog) {
    n++;
    if (s.t === 'repeat' || s.t === 'until') n += blockCount(s.body);
    if (s.t === 'if') n += blockCount(s.body) + (s.else ? blockCount(s.else) : 0);
  }
  return n;
}

/** The kinds of block a program uses. */
export function kindsUsed(prog: Program, into = new Set<BlockKind>()): Set<BlockKind> {
  for (const s of prog) {
    into.add(s.t === 'if' ? (s.else ? 'ifelse' : 'if') : s.t);
    if (s.t === 'repeat' || s.t === 'until') kindsUsed(s.body, into);
    if (s.t === 'if') { kindsUsed(s.body, into); if (s.else) kindsUsed(s.else, into); }
  }
  return into;
}

/** ⭐⭐⭐ at or under the target, ⭐⭐ up to 2 blocks over, ⭐ for any working program. */
export function starsFor(blocks: number, target: number): 1 | 2 | 3 {
  return blocks <= target ? 3 : blocks <= target + 2 ? 2 : 1;
}

/** Points for finishRound: world 1 = 100, 2 = 200, 3 = 300 per star (100–900). */
export const levelScore = (world: 1 | 2 | 3, stars: number) => world * 100 * stars;

/** Removes Blockly ids (for saving a compact program). */
export function stripIds(prog: Program): Program {
  return prog.map(s => {
    if (s.t === 'repeat') return { t: 'repeat', n: s.n, body: stripIds(s.body) };
    if (s.t === 'until') return { t: 'until', body: stripIds(s.body) };
    if (s.t === 'if') return s.else ? { t: 'if', dir: s.dir, body: stripIds(s.body), else: stripIds(s.else) } : { t: 'if', dir: s.dir, body: stripIds(s.body) };
    return { t: s.t };
  });
}

/** A saved program read back from storage: anything malformed is dropped, so a bad save can't break the screen. */
export function sanitizeProgram(raw: unknown, depth = 0): Program {
  if (!Array.isArray(raw) || depth > 8) return [];
  const out: Program = [];
  for (const s of raw.slice(0, 60)) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    if (o.t === 'forward' || o.t === 'left' || o.t === 'right') out.push({ t: o.t });
    else if (o.t === 'repeat') {
      const n = Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, Math.round(Number(o.n) || REPEAT_MIN)));
      out.push({ t: 'repeat', n, body: sanitizeProgram(o.body, depth + 1) });
    } else if (o.t === 'until') out.push({ t: 'until', body: sanitizeProgram(o.body, depth + 1) });
    else if (o.t === 'if' && (o.dir === 'ahead' || o.dir === 'left' || o.dir === 'right')) {
      const stmt: Stmt = { t: 'if', dir: o.dir, body: sanitizeProgram(o.body, depth + 1) };
      if (Array.isArray(o.else)) stmt.else = sanitizeProgram(o.else, depth + 1);
      out.push(stmt);
    }
  }
  return out;
}

// ---------- tests / level design: the shortest program ----------

/**
 * Fewest moves (forward / left / right, no loops) that pick up every battery and reach the dock —
 * a breadth-first search over (position, facing, batteries). World 1 targets must equal this.
 */
export function shortestMoves(board: Board): number | null {
  const full = (1 << board.batteries.length) - 1;
  const key = (x: number, y: number, d: number, m: number) => ((y * board.w + x) * 4 + d) * (full + 1) + m;
  const seen = new Set<number>([key(board.start.x, board.start.y, board.dir, 0)]);
  let frontier = [{ x: board.start.x, y: board.start.y, d: board.dir as number, m: 0 }];
  for (let depth = 1; frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const s of frontier) {
      const opts = [
        { x: s.x + DX[s.d], y: s.y + DY[s.d], d: s.d, fwd: true },
        { x: s.x, y: s.y, d: (s.d + 3) % 4, fwd: false },
        { x: s.x, y: s.y, d: (s.d + 1) % 4, fwd: false },
      ];
      for (const o of opts) {
        if (o.fwd && !isOpen(board, o.x, o.y)) continue;
        let m = s.m;
        if (o.fwd) { const b = board.batteries.findIndex(p => p.x === o.x && p.y === o.y); if (b >= 0) m |= 1 << b; }
        if (o.fwd && o.x === board.dock.x && o.y === board.dock.y && m === full) return depth;
        const k = key(o.x, o.y, o.d, m);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ x: o.x, y: o.y, d: o.d, m });
      }
    }
    frontier = next;
  }
  return null;
}

/** Every program with exactly `size` blocks using these kinds (bodies never empty). Skips programs
 *  with an obviously shorter twin (a turn undone straight away, three turns the same way). */
export function* programsOfSize(size: number, kinds: readonly BlockKind[]): Generator<Program> {
  const simple = (['forward', 'left', 'right'] as const).filter(k => kinds.includes(k));
  const dirs: SensorDir[] = ['ahead', 'left', 'right'];
  function* stmts(n: number): Generator<Stmt> {
    if (n === 1) { for (const t of simple) yield { t }; return; }
    if (kinds.includes('repeat')) for (const body of seqs(n - 1)) for (let r = REPEAT_MIN; r <= REPEAT_MAX; r++) yield { t: 'repeat', n: r, body };
    if (kinds.includes('until')) for (const body of seqs(n - 1)) yield { t: 'until', body };
    if (kinds.includes('if')) for (const body of seqs(n - 1)) for (const dir of dirs) yield { t: 'if', dir, body };
    if (kinds.includes('ifelse')) {
      for (let a = 0; a <= n - 1; a++) {
        for (const body of seqs(a)) for (const other of seqs(n - 1 - a)) {
          if (body.length === 0 && other.length === 0) continue;
          for (const dir of dirs) yield { t: 'if', dir, body, else: other };
        }
      }
    }
  }
  function* seqs(n: number): Generator<Program> {
    if (n === 0) { yield []; return; }
    for (let k = 1; k <= n; k++) {
      for (const first of stmts(k)) {
        for (const rest of seqs(n - k)) {
          const a = first.t, b = rest[0]?.t, c = rest[1]?.t;
          if ((a === 'left' && b === 'right') || (a === 'right' && b === 'left')) continue;
          if ((a === 'left' || a === 'right') && a === b && b === c) continue;
          yield [first, ...rest];
        }
      }
    }
  }
  yield* seqs(size);
}

/** The smallest program (≤ maxBlocks) that docks, or null. Exhaustive — keep maxBlocks small. */
export function searchShortest(board: Board, kinds: readonly BlockKind[], maxBlocks: number): { size: number; program: Program } | null {
  for (let size = 1; size <= maxBlocks; size++) {
    for (const p of programsOfSize(size, kinds)) if (runProgram(board, p).result === 'dock') return { size, program: p };
  }
  return null;
}
