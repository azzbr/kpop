// Smooth outlines for Paper Clash land: trace the edges between a player's cells and the rest
// (closed loops on the cell-corner grid), drop straight-line points, then round the staircase
// with Chaikin corner cutting. Pure — the component turns the loops into cached Path2Ds.

/**
 * Outline loops per player id (flat x,y pairs in cell units, one point per cell corner). Outer
 * loops run clockwise on screen, holes the other way.
 */
export function traceOutlines(owner: Uint8Array, size: number, ids: number[]): Map<number, number[][]> {
  const want = new Set(ids);
  const W = size + 1;
  // Directed edges per player: from-vertex → list of to-vertices.
  const edges = new Map<number, Map<number, number[]>>();
  for (const id of ids) edges.set(id, new Map());
  const add = (id: number, a: number, b: number) => {
    const m = edges.get(id)!;
    const list = m.get(a);
    if (list) list.push(b); else m.set(a, [b]);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = owner[y * size + x];
      if (!o || !want.has(o)) continue;
      if (y === 0 || owner[(y - 1) * size + x] !== o) add(o, y * W + x, y * W + x + 1);
      if (x === size - 1 || owner[y * size + x + 1] !== o) add(o, y * W + x + 1, (y + 1) * W + x + 1);
      if (y === size - 1 || owner[(y + 1) * size + x] !== o) add(o, (y + 1) * W + x + 1, (y + 1) * W + x);
      if (x === 0 || owner[y * size + x - 1] !== o) add(o, (y + 1) * W + x, y * W + x);
    }
  }
  const out = new Map<number, number[][]>();
  for (const [id, m] of edges) {
    const loops: number[][] = [];
    for (const [start, firstList] of m) {
      while (firstList.length) {
        const pts: number[] = [];
        let from = start;
        let to = firstList.pop()!;
        let guard = 0;
        pts.push(start % W, Math.floor(start / W));
        while (to !== start && guard++ < 1e6) {
          pts.push(to % W, Math.floor(to / W));
          const next = m.get(to);
          if (!next || !next.length) break;
          // At a pinch point (two ways on), turn right so touching corners stay separate loops.
          let pick = next.length - 1;
          if (next.length > 1) {
            const dx = to % W - from % W, dy = Math.floor(to / W) - Math.floor(from / W);
            pick = Math.max(0, next.findIndex(n => (n % W - to % W) === -dy && (Math.floor(n / W) - Math.floor(to / W)) === dx));
          }
          from = to;
          to = next.splice(pick, 1)[0];
        }
        if (pts.length >= 6) loops.push(pts);
      }
    }
    out.set(id, loops);
  }
  return out;
}

/** Removes points in the middle of straight runs (keeps the corners). */
export function dropStraight(pts: number[]): number[] {
  const n = pts.length / 2;
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    const ax = pts[a * 2], ay = pts[a * 2 + 1], x = pts[i * 2], y = pts[i * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    if ((x - ax) * (by - y) - (y - ay) * (bx - x) !== 0) keep.push(x, y);
  }
  return keep.length >= 6 ? keep : pts;
}

/** Chaikin corner cutting on a closed loop: each pass rounds every corner. */
export function chaikin(pts: number[], passes = 2): number[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const n = p.length / 2;
    const q: number[] = new Array(n * 4);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[j * 2], y1 = p[j * 2 + 1];
      q[i * 4] = 0.75 * x0 + 0.25 * x1;
      q[i * 4 + 1] = 0.75 * y0 + 0.25 * y1;
      q[i * 4 + 2] = 0.25 * x0 + 0.75 * x1;
      q[i * 4 + 3] = 0.25 * y0 + 0.75 * y1;
    }
    p = q;
  }
  return p;
}

/** Signed area of a loop (positive = clockwise on screen, y down). */
export function loopArea(pts: number[]): number {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
  }
  return a / 2;
}

/**
 * Turns a staircase loop into a smooth curve: take the middle of every unit edge (those lie on
 * the true slope), average neighbours a few times, then keep every other point.
 */
export function smoothLoop(pts: number[], passes = 3): number[] {
  const n = pts.length / 2;
  if (n < 4) return pts;
  let p: number[] = new Array(n * 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p[i * 2] = (pts[i * 2] + pts[j * 2]) / 2;
    p[i * 2 + 1] = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2;
  }
  for (let k = 0; k < passes; k++) {
    const q: number[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n, b = (i + 1) % n;
      q[i * 2] = (p[a * 2] + 2 * p[i * 2] + p[b * 2]) / 4;
      q[i * 2 + 1] = (p[a * 2 + 1] + 2 * p[i * 2 + 1] + p[b * 2 + 1]) / 4;
    }
    p = q;
  }
  if (n < 16) return p;
  const out: number[] = [];
  for (let i = 0; i < n; i += 2) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}
