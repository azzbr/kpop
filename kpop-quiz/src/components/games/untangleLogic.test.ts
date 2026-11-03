import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  UNTANGLE_LEVELS, DOT_MARGIN, generateUntangle, segmentsCross, crossingEdges, crossingPairs, crossingCount,
  isSolved, untangleScore, levelSeed, clampPoint, crossingPoint,
} from './untangleLogic';
import type { Edge, Point, UntanglePuzzle } from './untangleLogic';

const P = (x: number, y: number): Point => ({ x, y });

function isConnected(n: number, edges: Edge[]): boolean {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    for (const w of adj[stack.pop()!]) if (!seen.has(w)) { seen.add(w); stack.push(w); }
  }
  return seen.size === n;
}

/** Brute-force crossing check that doesn't use the module's helpers: proper X crossings only. */
function bruteCrossings(edges: Edge[], pts: Point[]): number {
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      const [p1, p2, p3, p4] = [pts[a], pts[b], pts[c], pts[d]];
      if (side(p1, p2, p3) * side(p1, p2, p4) < 0 && side(p3, p4, p1) * side(p3, p4, p2) < 0) count++;
    }
  }
  return count;
}

const SEEDS = 250;

describe('untangle generator', () => {
  it.each(UNTANGLE_LEVELS.map(l => [l.name, l] as const))('%s: every generated puzzle is a fair, solvable tangle', (_, level) => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateUntangle(level, createRng(seed * 7919 + level.dots));
      const n = level.dots;
      const msg = `${level.name} seed ${seed}`;
      expect(p.solved.length, msg).toBe(n);
      expect(p.start.length, msg).toBe(n);

      // the solved layout really has no crossings (by two different checks), so the puzzle is solvable
      expect(crossingCount(p.edges, p.solved), msg).toBe(0);
      expect(isSolved(p.edges, p.solved), msg).toBe(true);
      expect(bruteCrossings(p.edges, p.solved), msg).toBe(0);
      // the start layout is properly tangled
      expect(crossingCount(p.edges, p.start), msg).toBeGreaterThanOrEqual(Math.ceil(n / 2));
      expect(isSolved(p.edges, p.start), msg).toBe(false);

      // edges: in range, smaller index first, no loops, no duplicates, a sensible number of them
      const keys = new Set<string>();
      for (const [a, b] of p.edges) {
        expect(Number.isInteger(a) && Number.isInteger(b), msg).toBe(true);
        expect(a >= 0 && b < n && a < b, msg).toBe(true);
        keys.add(`${a}-${b}`);
      }
      expect(keys.size, msg).toBe(p.edges.length);
      expect(p.edges.length, msg).toBeGreaterThanOrEqual(n);
      expect(p.edges.length, msg).toBeLessThanOrEqual(3 * n - 6);

      // one piece, and every dot has at least 2 lines
      expect(isConnected(n, p.edges), msg).toBe(true);
      const deg = new Array<number>(n).fill(0);
      for (const [a, b] of p.edges) { deg[a]++; deg[b]++; }
      expect(Math.min(...deg), msg).toBeGreaterThanOrEqual(2);

      // every dot of both layouts sits where she can drag a dot to, and no two dots sit on top of each other
      for (const layout of [p.solved, p.start]) {
        for (const pt of layout) expect(clampPoint(pt), msg).toEqual(pt);
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            expect(Math.hypot(layout[i].x - layout[j].x, layout[i].y - layout[j].y), msg).toBeGreaterThan(0.1);
          }
        }
      }
    }
  });

  it('harder levels have more lines', () => {
    const avgEdges = (dots: number) => {
      let total = 0;
      for (let seed = 1; seed <= 50; seed++) total += generateUntangle({ dots }, createRng(seed)).edges.length;
      return total / 50;
    };
    const [e, m, h] = UNTANGLE_LEVELS.map(l => avgEdges(l.dots));
    expect(m).toBeGreaterThan(e);
    expect(h).toBeGreaterThan(m);
  });

  it('same seed gives the same puzzle; different seeds give different ones', () => {
    const level = UNTANGLE_LEVELS[1];
    const a: UntanglePuzzle = generateUntangle(level, createRng(42));
    const b: UntanglePuzzle = generateUntangle(level, createRng(42));
    expect(b).toEqual(a);
    const c = generateUntangle(level, createRng(43));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('levelSeed is stable and different for each level and difficulty', () => {
    expect(levelSeed('easy', 5)).toBe(levelSeed('easy', 5));
    const seeds = new Set<number>();
    for (const l of UNTANGLE_LEVELS) for (let n = 1; n <= 200; n++) seeds.add(levelSeed(l.id, n));
    expect(seeds.size).toBe(UNTANGLE_LEVELS.length * 200);
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
    // "Level 5" is the same puzzle every time
    const lvl = UNTANGLE_LEVELS[0];
    expect(generateUntangle(lvl, createRng(levelSeed(lvl.id, 5)))).toEqual(generateUntangle(lvl, createRng(levelSeed(lvl.id, 5))));
  });
});

describe('segmentsCross', () => {
  it('an X crosses', () => {
    expect(segmentsCross(P(0, 0), P(1, 1), P(0, 1), P(1, 0))).toBe(true);
    expect(segmentsCross(P(0.1, 0.5), P(0.9, 0.5), P(0.5, 0.1), P(0.5, 0.9))).toBe(true);
  });

  it('lines that would cross further on, but stop short, do not', () => {
    expect(segmentsCross(P(0, 0), P(0.4, 0.4), P(0, 1), P(1, 0))).toBe(false);
  });

  it('lines meeting at a shared dot do not cross (V, L, and a T made of lines meeting at a dot)', () => {
    expect(segmentsCross(P(0, 0), P(1, 0), P(0, 0), P(0, 1))).toBe(false); // L
    expect(segmentsCross(P(0, 1), P(0.5, 0), P(0.5, 0), P(1, 1))).toBe(false); // V
    // T: bar A–M–B with a stem M–C, all meeting at dot M
    const A = P(0, 0), M = P(0.5, 0), B = P(1, 0), C = P(0.5, 1);
    expect(segmentsCross(A, M, M, C)).toBe(false);
    expect(segmentsCross(M, B, M, C)).toBe(false);
    expect(segmentsCross(M, C, B, M)).toBe(false); // either order of ends
  });

  it('parallel lines never cross', () => {
    expect(segmentsCross(P(0, 0), P(1, 0), P(0, 0.2), P(1, 0.2))).toBe(false);
    expect(segmentsCross(P(0, 0), P(1, 1), P(0.1, 0), P(1.1, 1))).toBe(false);
  });

  it('lines on one straight line: separate or end to end is fine, overlapping is a tangle', () => {
    expect(segmentsCross(P(0, 0), P(0.3, 0), P(0.5, 0), P(1, 0))).toBe(false); // gap between them
    expect(segmentsCross(P(0, 0), P(0.5, 0), P(0.5, 0), P(1, 0))).toBe(false); // end to end at a shared dot
    expect(segmentsCross(P(0, 0), P(0.6, 0), P(0.4, 0), P(1, 0))).toBe(true); // overlap
    expect(segmentsCross(P(0, 0), P(1, 1), P(0.2, 0.2), P(0.5, 0.5))).toBe(true); // one inside the other
    expect(segmentsCross(P(0, 0), P(1, 0), P(0, 0), P(0.5, 0))).toBe(true); // folded back along a shared dot
    expect(segmentsCross(P(0.5, 0), P(0.5, 0.4), P(0.5, 0.6), P(0.5, 1))).toBe(false); // vertical, apart
  });

  it('a dot resting on the middle of someone else\'s line counts as tangled', () => {
    expect(segmentsCross(P(0, 0), P(1, 0), P(0.5, 0), P(0.5, 1))).toBe(true);
  });

  it('crossingPoint finds where an X meets (for the marker), and nothing for parallel lines', () => {
    const c = crossingPoint(P(0, 0), P(1, 1), P(0, 1), P(1, 0))!;
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
    expect(crossingPoint(P(0, 0), P(1, 0), P(0, 0.2), P(1, 0.2))).toBeNull();
  });
});

describe('crossings on a board', () => {
  // a square with both diagonals: only the diagonals cross
  const square = [P(0.2, 0.2), P(0.8, 0.2), P(0.8, 0.8), P(0.2, 0.8)];
  const edges: Edge[] = [[0, 1], [1, 2], [2, 3], [0, 3], [0, 2], [1, 3]];

  it('finds the crossing lines', () => {
    expect(crossingPairs(edges, square)).toEqual([[4, 5]]);
    expect([...crossingEdges(edges, square)].sort()).toEqual([4, 5]);
    expect(crossingCount(edges, square)).toBe(1);
    expect(isSolved(edges, square)).toBe(false);
  });

  it('dragging a dot to the right place solves it', () => {
    // pull dot 3 inside the triangle 0-1-2: the square becomes a triangle with a dot in the middle
    const moved = square.map((p, i) => (i === 3 ? P(0.6, 0.4) : p));
    expect(crossingCount(edges, moved)).toBe(0);
    expect(isSolved(edges, moved)).toBe(true);
    expect(crossingEdges(edges, moved).size).toBe(0);
  });
});

describe('untangle score and board edges', () => {
  it('rewards speed and never drops below 30 %', () => {
    const [easy, med, hard] = UNTANGLE_LEVELS;
    expect(untangleScore(easy, 0)).toBe(300);
    expect(untangleScore(med, 75)).toBe(250);
    expect(untangleScore(med, 9999)).toBe(150);
    expect(untangleScore(hard, 0)).toBe(700);
    expect(untangleScore(hard, 60)).toBeGreaterThan(untangleScore(easy, 60));
  });

  it('clampPoint keeps dots on the board', () => {
    expect(clampPoint(P(0.5, 0.5))).toEqual(P(0.5, 0.5));
    expect(clampPoint(P(-1, 2))).toEqual(P(DOT_MARGIN, 1 - DOT_MARGIN));
    expect(clampPoint(P(0, 1), 0.1)).toEqual(P(0.1, 0.9));
    expect(clampPoint(P(NaN, 0.3))).toEqual(P(0.5, 0.3));
  });
});
