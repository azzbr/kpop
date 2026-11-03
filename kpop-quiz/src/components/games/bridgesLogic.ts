// Bridges rules: numbered islands on a square grid. Join them with straight horizontal or vertical
// bridges (1 or 2 between the same pair) that never cross each other or pass over an island, so that
// every island has exactly its number of bridges and all the islands end up joined into one group.
// Puzzles are grown from a connected set of bridges (so they're always solvable), seeded for tests.
import type { Rng } from '../../games/engine/rng';

export interface BridgesLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  size: number;
  /** How many islands the generator aims for (it lands on this, or within one). */
  islands: number;
  /** Points for an instant solve; the score drops towards 30 % of this by `par` seconds. */
  base: number;
  par: number;
}

export const BRIDGES_LEVELS: BridgesLevel[] = [
  { id: 'easy', name: 'Easy', size: 5, islands: 5, base: 300, par: 90 },
  { id: 'medium', name: 'Medium', size: 7, islands: 9, base: 500, par: 240 },
  { id: 'hard', name: 'Hard', size: 9, islands: 14, base: 700, par: 420 },
];

/** An island: its id is its index in `islands`; `n` is how many bridges must touch it. */
export interface Island { id: number; r: number; c: number; n: number }
/** A bridge between islands `a` and `b` (stored with a < b), single or double. */
export interface Bridge { a: number; b: number; count: 1 | 2 }

export interface BridgesPuzzle {
  size: number;
  islands: Island[];
  /** One full answer (the bridges the puzzle was grown from). Any other valid answer counts too. */
  solution: Bridge[];
}

/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: ReadonlyArray<readonly [number, number]> = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// ─── Grid helpers ─────────────────────────────────────────────────────────────

const gridCache = new WeakMap<BridgesPuzzle, Int16Array>();
/** cell index → island id (or -1); puzzles are never changed, so this is cached per puzzle. */
function islandGrid(p: BridgesPuzzle): Int16Array {
  let g = gridCache.get(p);
  if (!g) {
    g = new Int16Array(p.size * p.size).fill(-1);
    for (const isl of p.islands) g[isl.r * p.size + isl.c] = isl.id;
    gridCache.set(p, g);
  }
  return g;
}

const inGrid = (size: number, r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size;

/** The island on cell (r, c), or -1. */
export function islandAt(p: BridgesPuzzle, r: number, c: number): number {
  return inGrid(p.size, r, c) ? islandGrid(p)[r * p.size + c] : -1;
}

function getIsland(p: BridgesPuzzle, id: number): Island | undefined {
  const byIndex = p.islands[id];
  return byIndex && byIndex.id === id ? byIndex : p.islands.find(i => i.id === id);
}

const samePair = (br: Bridge, a: number, b: number) => (br.a === a && br.b === b) || (br.a === b && br.b === a);

/** A straight line between two islands: `line` is the row (horizontal) or column (vertical). */
interface Segment { horiz: boolean; line: number; lo: number; hi: number }

function segment(p: BridgesPuzzle, a: number, b: number): Segment | null {
  const A = getIsland(p, a), B = getIsland(p, b);
  if (!A || !B || a === b) return null;
  if (A.r === B.r && A.c !== B.c) return { horiz: true, line: A.r, lo: Math.min(A.c, B.c), hi: Math.max(A.c, B.c) };
  if (A.c === B.c && A.r !== B.r) return { horiz: false, line: A.c, lo: Math.min(A.r, B.r), hi: Math.max(A.r, B.r) };
  return null;
}

/** No island on the cells strictly between the two ends. */
function clearBetween(p: BridgesPuzzle, s: Segment): boolean {
  for (let k = s.lo + 1; k < s.hi; k++) {
    if (s.horiz ? islandAt(p, s.line, k) >= 0 : islandAt(p, k, s.line) >= 0) return false;
  }
  return true;
}

/** A horizontal and a vertical bridge cross when they share a cell in the middle of both. */
function crosses(s: Segment, t: Segment): boolean {
  if (s.horiz === t.horiz) return false; // in line: overlapping would need an island in between
  const h = s.horiz ? s : t, v = s.horiz ? t : s;
  return h.lo < v.line && v.line < h.hi && v.lo < h.line && h.line < v.hi;
}

// ─── Moves ────────────────────────────────────────────────────────────────────

/**
 * Can a bridge join islands a and b? They must be in the same row or column with no island between,
 * and the bridge mustn't cross any of the current `bridges` (a bridge already between a and b is fine).
 */
export function canLink(p: BridgesPuzzle, a: number, b: number, bridges: Bridge[] = []): boolean {
  const s = segment(p, a, b);
  if (!s || !clearBetween(p, s)) return false;
  for (const br of bridges) {
    if (samePair(br, a, b)) continue;
    const t = segment(p, br.a, br.b);
    if (t && crosses(s, t)) return false;
  }
  return true;
}

/** How many bridges join a and b right now (0, 1 or 2). */
export function bridgeCount(bridges: Bridge[], a: number, b: number): number {
  return bridges.reduce((sum, br) => sum + (samePair(br, a, b) ? br.count : 0), 0);
}

/** One more tap or drag on a pair: none → single → double → none. Returns a new list. */
export function cycleBridge(bridges: Bridge[], a: number, b: number): Bridge[] {
  const x = Math.min(a, b), y = Math.max(a, b);
  const i = bridges.findIndex(br => samePair(br, x, y));
  if (i < 0) return [...bridges, { a: x, b: y, count: 1 }];
  if (bridges[i].count === 1) return bridges.map((br, j) => (j === i ? { a: x, b: y, count: 2 } : br));
  return bridges.filter((_, j) => j !== i);
}

/** Bridges touching an island (a double bridge counts as 2). */
export function islandCount(bridges: Bridge[], id: number): number {
  return bridges.reduce((sum, br) => sum + (br.a === id || br.b === id ? br.count : 0), 0);
}

/** The first island from `id` in direction `dir` (nothing can be between them), or -1. */
export function neighbourIn(p: BridgesPuzzle, id: number, dir: Dir): number {
  const isl = getIsland(p, id);
  if (!isl) return -1;
  const [dr, dc] = DIRS[dir];
  for (let r = isl.r + dr, c = isl.c + dc; inGrid(p.size, r, c); r += dr, c += dc) {
    const j = islandAt(p, r, c);
    if (j >= 0) return j;
  }
  return -1;
}

/** The bridge passing over cell (r, c) (not counting its end islands), if any. */
export function bridgeAtCell(p: BridgesPuzzle, bridges: Bridge[], r: number, c: number): Bridge | null {
  for (const br of bridges) {
    const s = segment(p, br.a, br.b);
    if (!s) continue;
    if (s.horiz ? s.line === r && s.lo < c && c < s.hi : s.line === c && s.lo < r && r < s.hi) return br;
  }
  return null;
}

/** All bridges a full answer needs (every bridge touches two islands). */
export const totalBridges = (p: BridgesPuzzle) => p.islands.reduce((s, i) => s + i.n, 0) / 2;

/** Bridges still to build (can go below 0 if too many are built). */
export const bridgesLeft = (p: BridgesPuzzle, bridges: Bridge[]) =>
  totalBridges(p) - bridges.reduce((s, br) => s + br.count, 0);

/** Every island can be reached from every other one over the bridges. */
export function isConnected(p: BridgesPuzzle, bridges: Bridge[]): boolean {
  if (p.islands.length === 0) return false;
  const links = new Map<number, number[]>();
  for (const br of bridges) {
    links.set(br.a, [...(links.get(br.a) ?? []), br.b]);
    links.set(br.b, [...(links.get(br.b) ?? []), br.a]);
  }
  const seen = new Set([p.islands[0].id]);
  const todo = [p.islands[0].id];
  while (todo.length) {
    for (const j of links.get(todo.pop()!) ?? []) {
      if (!seen.has(j)) { seen.add(j); todo.push(j); }
    }
  }
  return p.islands.every(i => seen.has(i.id));
}

/**
 * A full, valid answer (any answer, not only the stored one): straight bridges with no island in
 * between, at most 2 per pair, no crossings, every island's number met, and all islands joined up.
 */
export function isSolved(p: BridgesPuzzle, bridges: Bridge[]): boolean {
  if (p.islands.length === 0) return false;
  const perPair = new Map<string, number>();
  const segs: Segment[] = [];
  for (const br of bridges) {
    if (br.count !== 1 && br.count !== 2) return false;
    const s = segment(p, br.a, br.b);
    if (!s || !clearBetween(p, s)) return false;
    const key = `${Math.min(br.a, br.b)}-${Math.max(br.a, br.b)}`;
    const total = (perPair.get(key) ?? 0) + br.count;
    if (total > 2) return false;
    perPair.set(key, total);
    segs.push(s);
  }
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) if (crosses(segs[i], segs[j])) return false;
  }
  if (!p.islands.every(isl => islandCount(bridges, isl.id) === isl.n)) return false;
  return isConnected(p, bridges);
}

/** Points for a solve: base, falling to 30 % of base at `par` seconds (never lower). */
export function bridgesScore(level: Pick<BridgesLevel, 'base' | 'par'>, seconds: number): number {
  return Math.round(level.base * Math.max(0.3, 1 - seconds / level.par));
}

/** A stable seed for "Level n" of a difficulty, so Level 4 is always the same puzzle. */
export function levelSeed(levelId: string, n: number): number {
  const s = `bridges:${levelId}:${n}`;
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Generator ────────────────────────────────────────────────────────────────

interface Grown {
  cells: { r: number; c: number }[];
  bridges: Bridge[];
  /** cell → island index (or -1) */
  isl: Int16Array;
  /** cell is under a bridge */
  used: Uint8Array;
}

const pick = (rng: Rng, n: number) => Math.floor(rng() * n);

/** Grow a tree of bridges: from a random island, go 2+ free cells in a random direction and put a new island there. */
function grow(size: number, target: number, rng: Rng): Grown {
  const isl = new Int16Array(size * size).fill(-1);
  const used = new Uint8Array(size * size);
  const cells: { r: number; c: number }[] = [];
  const bridges: Bridge[] = [];
  const place = (r: number, c: number) => { isl[r * size + c] = cells.length; cells.push({ r, c }); };
  const nextToIsland = (r: number, c: number) =>
    DIRS.some(([dr, dc]) => inGrid(size, r + dr, c + dc) && isl[(r + dr) * size + c + dc] >= 0);

  place(pick(rng, size), pick(rng, size));
  for (let tries = 0; cells.length < target && tries < target * 80; tries++) {
    const from = pick(rng, cells.length);
    const { r, c } = cells[from];
    const [dr, dc] = DIRS[pick(rng, 4)];
    // how far the path is free of islands and bridges
    let reach = 0;
    for (let k = 1; inGrid(size, r + dr * k, c + dc * k); k++) {
      const cell = (r + dr * k) * size + c + dc * k;
      if (isl[cell] >= 0 || used[cell]) break;
      reach = k;
    }
    if (reach < 2) continue;
    // 2…reach cells away, leaning towards shorter bridges so the board stays busy
    const dist = 2 + Math.floor(Math.pow(rng(), 1.4) * (reach - 1));
    const nr = r + dr * dist, nc = c + dc * dist;
    if (nextToIsland(nr, nc)) continue;
    for (let k = 1; k < dist; k++) used[(r + dr * k) * size + c + dc * k] = 1;
    const id = cells.length;
    place(nr, nc);
    bridges.push({ a: from, b: id, count: rng() < 0.35 ? 2 : 1 });
  }
  return { cells, bridges, isl, used };
}

/** Lower is better: right island count first, then islands spread over (almost) every row and column. */
function quality(g: Grown, size: number, target: number): number {
  const rows = g.cells.map(c => c.r), cols = g.cells.map(c => c.c);
  const spanR = Math.max(...rows) - Math.min(...rows) + 1;
  const spanC = Math.max(...cols) - Math.min(...cols) + 1;
  return Math.abs(g.cells.length - target) * 100 + Math.max(0, size - 1 - spanR) + Math.max(0, size - 1 - spanC);
}

/** A few extra bridges between neighbouring islands (loops make it less of a straight trail). */
function addExtras(g: Grown, size: number, extras: number, rng: Rng) {
  const cands: [number, number, Dir][] = [];
  g.cells.forEach(({ r, c }, i) => {
    for (const dir of [1, 2] as Dir[]) {
      const [dr, dc] = DIRS[dir];
      for (let k = 1; inGrid(size, r + dr * k, c + dc * k); k++) {
        const j = g.isl[(r + dr * k) * size + c + dc * k];
        if (j < 0) continue;
        if (!g.bridges.some(br => samePair(br, i, j))) cands.push([i, j, dir]);
        break;
      }
    }
  });
  for (let i = cands.length - 1; i > 0; i--) {
    const j = pick(rng, i + 1);
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  let added = 0;
  for (const [i, j, dir] of cands) {
    if (added >= extras) break;
    const [dr, dc] = DIRS[dir];
    const { r, c } = g.cells[i];
    const dist = Math.abs(g.cells[j].r - r) + Math.abs(g.cells[j].c - c);
    let free = true;
    for (let k = 1; k < dist; k++) if (g.used[(r + dr * k) * size + c + dc * k]) { free = false; break; }
    if (!free) continue; // it would cross a bridge
    for (let k = 1; k < dist; k++) g.used[(r + dr * k) * size + c + dc * k] = 1;
    g.bridges.push({ a: i, b: j, count: rng() < 0.25 ? 2 : 1 });
    added++;
  }
}

/**
 * A puzzle for a level: grown from a connected answer, so it can always be solved. The islands'
 * numbers come from that answer. Same rng seed → same puzzle.
 */
export function generateBridges(level: Pick<BridgesLevel, 'size' | 'islands'>, rng: Rng): BridgesPuzzle {
  const { size } = level;
  const target = Math.max(2, level.islands);
  let best: Grown | null = null;
  let bestQ = Infinity;
  for (let attempt = 0; attempt < 60 && bestQ > 0; attempt++) {
    const g = grow(size, target, rng);
    const q = quality(g, size, target);
    if (q < bestQ) { best = g; bestQ = q; }
  }
  const g = best!;
  addExtras(g, size, Math.round(target / 5), rng);

  // number the islands in reading order
  const order = g.cells.map((_, i) => i).sort((i, j) => g.cells[i].r - g.cells[j].r || g.cells[i].c - g.cells[j].c);
  const newId = new Map(order.map((old, k) => [old, k]));
  const solution: Bridge[] = g.bridges
    .map(br => {
      const a = newId.get(br.a)!, b = newId.get(br.b)!;
      return { a: Math.min(a, b), b: Math.max(a, b), count: br.count };
    })
    .sort((x, y) => x.a - y.a || x.b - y.b);
  const islands: Island[] = order.map((old, id) => ({ id, r: g.cells[old].r, c: g.cells[old].c, n: 0 }));
  for (const br of solution) {
    islands[br.a].n += br.count;
    islands[br.b].n += br.count;
  }
  return { size, islands, solution };
}
