// Untangle rules: dots joined by lines start all tangled up; drag the dots until no two lines cross.
// Every puzzle is made from a layout that already has no crossings (so it's always solvable), then the
// dots are shuffled round a circle to tangle it. Seeded, so "Level n" is the same puzzle on every device.
import type { Rng } from '../../games/engine/rng';

export interface Point { x: number; y: number }
/** Two dot indices, smaller first. */
export type Edge = [number, number];

export interface UntangleLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  dots: number;
  /** Points for an instant solve; the score drops towards 30 % of this by `par` seconds. */
  base: number;
  par: number;
}

export const UNTANGLE_LEVELS: UntangleLevel[] = [
  { id: 'easy', name: 'Easy', dots: 6, base: 300, par: 60 },
  { id: 'medium', name: 'Medium', dots: 9, base: 500, par: 150 },
  { id: 'hard', name: 'Hard', dots: 13, base: 700, par: 300 },
];

export interface UntanglePuzzle {
  edges: Edge[];
  /** One layout with no crossings (the one the puzzle was made from). Coordinates 0..1. */
  solved: Point[];
  /** The tangled layout she starts from: the dots on a circle in a shuffled order. */
  start: Point[];
}

/** How far dots stay from the board edge (a dot's radius plus a little). */
export const DOT_MARGIN = 0.05;

const EPS = 1e-9;

/** Which side of the line a→b the point c is on: 1, -1, or 0 when (almost exactly) on the line. */
function orient(a: Point, b: Point, c: Point): number {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(v) < EPS ? 0 : Math.sign(v);
}

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;

/** p lies on the segment a–b, strictly between its ends (p is already known to be on the line). */
function strictlyInside(a: Point, b: Point, p: Point): boolean {
  if (samePoint(p, a) || samePoint(p, b)) return false;
  return p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS
    && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
}

/**
 * Do the lines p1–p2 and p3–p4 cross?
 * - a clean X: yes
 * - two lines meeting at a dot they share (a V, an L, or the bars of a T meeting at a dot): no
 * - parallel lines, or lines on one straight line that only touch end to end: no
 * - lines on one straight line that overlap (one lies along the other): yes — it looks like one tangled line
 * - a dot resting on the middle of another line (not one of its own): yes — that still looks tangled
 */
export function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orient(p1, p2, p3), o2 = orient(p1, p2, p4), o3 = orient(p3, p4, p1), o4 = orient(p3, p4, p2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;

  if (o1 === 0 && o2 === 0) {
    // All four dots on one straight line: they only cross if they overlap along it by more than a point.
    const xs = [p1.x, p2.x, p3.x, p4.x], ys = [p1.y, p2.y, p3.y, p4.y];
    const useX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const [a1, a2, b1, b2] = useX ? xs : ys;
    const overlap = Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
    return overlap > EPS;
  }

  if (samePoint(p1, p3) || samePoint(p1, p4) || samePoint(p2, p3) || samePoint(p2, p4)) return false;
  return (o1 === 0 && strictlyInside(p1, p2, p3)) || (o2 === 0 && strictlyInside(p1, p2, p4))
    || (o3 === 0 && strictlyInside(p3, p4, p1)) || (o4 === 0 && strictlyInside(p3, p4, p2));
}

/** Every pair of lines (by edge index, i < j) that cross. */
export function crossingPairs(edges: Edge[], pts: Point[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const [c, d] = edges[j];
      if (segmentsCross(pts[a], pts[b], pts[c], pts[d])) out.push([i, j]);
    }
  }
  return out;
}

/** Indices of the lines that cross at least one other line (drawn red). */
export function crossingEdges(edges: Edge[], pts: Point[]): Set<number> {
  const set = new Set<number>();
  for (const [i, j] of crossingPairs(edges, pts)) { set.add(i); set.add(j); }
  return set;
}

/** How many pairs of lines cross. */
export const crossingCount = (edges: Edge[], pts: Point[]) => crossingPairs(edges, pts).length;

export const isSolved = (edges: Edge[], pts: Point[]) => crossingCount(edges, pts) === 0;

/** Points for a solve: base, falling to 30 % of base at `par` seconds (never lower). */
export function untangleScore(level: UntangleLevel, seconds: number): number {
  return Math.round(level.base * Math.max(0.3, 1 - seconds / level.par));
}

/** A stable seed for "Level n" of a difficulty, so the same level is the same puzzle every time. */
export function levelSeed(levelId: string, n: number): number {
  const s = `untangle:${levelId}:${n}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Keep a dot inside the board, `margin` away from every edge. */
export function clampPoint(p: Point, margin = DOT_MARGIN): Point {
  const c = (v: number) => Math.min(1 - margin, Math.max(margin, Number.isFinite(v) ? v : 0.5));
  return { x: c(p.x), y: c(p.y) };
}

// ---------- generator ----------

/** Solved layouts use this part of the board, so every dot can be dragged there. */
const SPREAD_MARGIN = 0.08;
/** A line in the solved layout never passes this close to a dot that isn't one of its ends. */
const CLEARANCE = 0.035;
/** The start circle. */
const RING_R = 0.4;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function pointSegDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** n random dots, no two closer than a spacing that suits n (relaxed a little if they don't fit). */
function spreadPoints(n: number, rng: Rng): Point[] {
  const span = 1 - 2 * SPREAD_MARGIN;
  let minD = 0.62 / Math.sqrt(n);
  const pts: Point[] = [];
  let fails = 0;
  while (pts.length < n) {
    const p = { x: SPREAD_MARGIN + rng() * span, y: SPREAD_MARGIN + rng() * span };
    if (pts.every(q => dist(p, q) >= minD)) { pts.push(p); fails = 0; continue; }
    if (++fails > 200) { minD *= 0.9; fails = 0; }
  }
  return pts;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Union-find "which group is this dot in". */
function findRoot(parent: number[], i: number): number {
  while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
  return i;
}

/**
 * Greedy planar graph on `pts`: try every pair, shortest first, keeping a line if it crosses no line
 * already kept (and passes no other dot too closely), until `target` lines. Then patch it up so every
 * dot has at least 2 lines and it's all one piece. Returns null if that can't be done.
 */
function buildGraph(pts: Point[], target: number, clearance: number): Edge[] | null {
  const n = pts.length;
  const pairs: Edge[] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  pairs.sort((e, f) => dist(pts[e[0]], pts[e[1]]) - dist(pts[f[0]], pts[f[1]]));

  const edges: Edge[] = [];
  const used = new Set<string>();
  const deg = new Array<number>(n).fill(0);
  const fits = ([a, b]: Edge) => {
    if (used.has(`${a}-${b}`)) return false;
    if (clearance > 0) {
      for (let k = 0; k < n; k++) {
        if (k !== a && k !== b && pointSegDist(pts[k], pts[a], pts[b]) < clearance) return false;
      }
    }
    return edges.every(([c, d]) => !segmentsCross(pts[a], pts[b], pts[c], pts[d]));
  };
  const add = (e: Edge) => { edges.push(e); used.add(`${e[0]}-${e[1]}`); deg[e[0]]++; deg[e[1]]++; };

  for (const e of pairs) {
    if (edges.length >= target) break;
    if (fits(e)) add(e);
  }

  // Every dot needs at least 2 lines (a dot on one line is too easy to tuck away).
  for (let v = 0; v < n; v++) {
    for (const e of pairs) {
      if (deg[v] >= 2) break;
      if ((e[0] === v || e[1] === v) && fits(e)) add(e);
    }
    if (deg[v] < 2) return null;
  }

  // One piece: join separate groups with the shortest line that fits.
  for (;;) {
    const parent = Array.from({ length: n }, (_, i) => i);
    for (const [a, b] of edges) parent[findRoot(parent, a)] = findRoot(parent, b);
    const root0 = findRoot(parent, 0);
    if (pts.every((_, i) => findRoot(parent, i) === root0)) return edges;
    const bridge = pairs.find(e => findRoot(parent, e[0]) !== findRoot(parent, e[1]) && fits(e));
    if (!bridge) return null;
    add(bridge);
  }
}

/** Dots joined in order of their angle round the middle: a simple loop, never crossing itself. */
function ringAroundMiddle(pts: Point[]): Edge[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const order = pts.map((_, i) => i).sort((a, b) => Math.atan2(pts[a].y - cy, pts[a].x - cx) - Math.atan2(pts[b].y - cy, pts[b].x - cx));
  return order.map((a, k) => {
    const b = order[(k + 1) % order.length];
    return (a < b ? [a, b] : [b, a]) as Edge;
  });
}

/** The dots on a circle, dot `order[k]` in the k-th seat. */
function ringLayout(order: number[], turn: number): Point[] {
  const n = order.length;
  const out: Point[] = new Array(n);
  order.forEach((dot, k) => {
    const a = turn + (2 * Math.PI * k) / n;
    out[dot] = { x: 0.5 + RING_R * Math.cos(a), y: 0.5 + RING_R * Math.sin(a) };
  });
  return out;
}

/** A new puzzle for a level. Same rng seed → same puzzle. */
export function generateUntangle(level: Pick<UntangleLevel, 'dots'>, rng: Rng): UntanglePuzzle {
  const n = Math.max(4, Math.round(level.dots));
  const target = Math.min(3 * n - 6, Math.round(n * (1.6 + rng() * 0.4)));

  let solved: Point[] = [];
  let edges: Edge[] | null = null;
  for (let attempt = 0; !edges; attempt++) {
    solved = spreadPoints(n, rng);
    // After many tries (never seen in tests), drop the extras: a full greedy triangulation always works,
    // and a ring round the middle is the last resort.
    if (attempt < 40) edges = buildGraph(solved, target, CLEARANCE);
    else if (attempt < 60) edges = buildGraph(solved, 3 * n, 0);
    else edges = ringAroundMiddle(solved);
  }

  // Tangle it: dots round a circle in a shuffled order, until there are plenty of crossings.
  const want = Math.ceil(n / 2);
  const dots = Array.from({ length: n }, (_, i) => i);
  let start: Point[] = [];
  let bestCount = -1;
  for (let tries = 0; tries < 200 && bestCount < want; tries++) {
    const layout = ringLayout(shuffle(dots, rng), rng() * 2 * Math.PI);
    const c = crossingCount(edges, layout);
    if (c > bestCount) { bestCount = c; start = layout; }
  }
  return { edges, solved, start };
}
