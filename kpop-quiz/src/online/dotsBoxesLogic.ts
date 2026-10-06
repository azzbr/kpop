// Dots & Boxes rules (pure). The board is a (2R+1)×(2C+1) grid: even/even = dot,
// odd/odd = box, the rest are edges. Ids are gr * (2C+1) + gc.
export const DB_SIZES: Record<string, { R: number; C: number }> = {
  small: { R: 3, C: 3 },
  medium: { R: 4, C: 4 },
  large: { R: 5, C: 5 },
};

export interface DbBoard {
  R: number;
  C: number;
  drawn: number[];
  owners: Record<number, number>; // box id -> 1 | 2
  scores: { 1: number; 2: number };
  turn: number;
  winner: number; // 0 playing, 1/2 seat, 3 draw
}

export const newBoard = (R: number, C: number, turn = 1): DbBoard => ({
  R, C, drawn: [], owners: {}, scores: { 1: 0, 2: 0 }, turn, winner: 0,
});

export const isEdge = (b: Pick<DbBoard, 'R' | 'C'>, id: number) => {
  const gC = 2 * b.C + 1;
  const gR = 2 * b.R + 1;
  if (!Number.isInteger(id) || id < 0 || id >= gR * gC) return false;
  const gr = Math.floor(id / gC);
  const gc = id % gC;
  return (gr % 2 === 0 && gc % 2 === 1) || (gr % 2 === 1 && gc % 2 === 0);
};

/** Draw an edge for `disc`. Returns the new board, or null if it isn't that seat's turn / not a free edge. */
export function drawEdge(b: DbBoard, edge: number, disc: number): DbBoard | null {
  if (b.winner || disc !== b.turn || !isEdge(b, edge) || b.drawn.includes(edge)) return null;
  const gC = 2 * b.C + 1;
  const gR = 2 * b.R + 1;
  const drawn = new Set(b.drawn);
  drawn.add(edge);
  const owners = { ...b.owners };
  const scores = { ...b.scores };
  const gr = Math.floor(edge / gC);
  const gc = edge % gC;
  const eid = (r: number, c: number) => r * gC + c;
  const boxDone = (br: number, bc: number) =>
    drawn.has(eid(br - 1, bc)) && drawn.has(eid(br + 1, bc)) && drawn.has(eid(br, bc - 1)) && drawn.has(eid(br, bc + 1));
  const boxes = gr % 2 === 0 ? [[gr - 1, gc], [gr + 1, gc]] : [[gr, gc - 1], [gr, gc + 1]];
  let claimed = 0;
  for (const [br, bc] of boxes) {
    if (br > 0 && br < gR && bc > 0 && bc < gC) {
      const bid = eid(br, bc);
      if (!owners[bid] && boxDone(br, bc)) {
        owners[bid] = disc;
        scores[disc as 1 | 2]++;
        claimed++;
      }
    }
  }
  let { turn, winner } = b;
  if (scores[1] + scores[2] >= b.R * b.C) winner = scores[1] > scores[2] ? 1 : scores[2] > scores[1] ? 2 : 3;
  else if (claimed === 0) turn = turn === 1 ? 2 : 1;
  return { ...b, drawn: [...drawn], owners, scores, turn, winner };
}

/**
 * Hit area of every edge: a diamond centred on the edge's middle, one box-width across.
 * The diamonds tile the board (each point belongs to its nearest edge), so neighbouring
 * hit areas never overlap. Returned in box units (dots at integer x/y).
 */
export function edgeGeometry(b: Pick<DbBoard, 'R' | 'C'>, id: number): { x: number; y: number; horiz: boolean } {
  const gC = 2 * b.C + 1;
  const gr = Math.floor(id / gC);
  const gc = id % gC;
  return { x: gc / 2, y: gr / 2, horiz: gr % 2 === 0 };
}

