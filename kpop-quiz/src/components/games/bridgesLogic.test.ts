import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  BRIDGES_LEVELS, generateBridges, canLink, cycleBridge, bridgeCount, islandCount, isSolved, isConnected,
  neighbourIn, bridgeAtCell, bridgesLeft, totalBridges, bridgesScore, levelSeed,
} from './bridgesLogic';
import type { Bridge, BridgesPuzzle } from './bridgesLogic';

describe('bridges generator', () => {
  it.each(BRIDGES_LEVELS.map(l => [l.name, l] as const))('%s: 250 generated puzzles are all solvable and fair', (_, level) => {
    for (let n = 1; n <= 250; n++) {
      const p = generateBridges(level, createRng(levelSeed(level.id, n)));
      const tag = `${level.id} level ${n}`;
      expect(p.size).toBe(level.size);
      expect(Math.abs(p.islands.length - level.islands), tag).toBeLessThanOrEqual(1);
      // the stored answer follows every rule
      expect(isSolved(p, p.solution), tag).toBe(true);
      // ids are the array order, islands sit inside the grid, one per cell, never side by side
      const cells = new Set<string>();
      p.islands.forEach((isl, i) => {
        expect(isl.id).toBe(i);
        expect(isl.r).toBeGreaterThanOrEqual(0);
        expect(isl.c).toBeGreaterThanOrEqual(0);
        expect(isl.r).toBeLessThan(p.size);
        expect(isl.c).toBeLessThan(p.size);
        expect(isl.n, tag).toBeGreaterThanOrEqual(1);
        expect(isl.n, tag).toBeLessThanOrEqual(8);
        cells.add(`${isl.r},${isl.c}`);
      });
      expect(cells.size).toBe(p.islands.length);
      for (const a of p.islands) {
        for (const b of p.islands) {
          expect(Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1, `${tag}: islands ${a.id} and ${b.id} touch`).toBe(false);
        }
      }
      // numbers come from the answer
      for (const isl of p.islands) expect(islandCount(p.solution, isl.id)).toBe(isl.n);
      // and it can be built tap by tap with the game's own move rules
      let built: Bridge[] = [];
      for (const br of p.solution) {
        expect(canLink(p, br.a, br.b, built), `${tag}: ${br.a}-${br.b}`).toBe(true);
        for (let k = 0; k < br.count; k++) built = cycleBridge(built, br.a, br.b);
      }
      expect(isSolved(p, built), tag).toBe(true);
    }
  });

  it('same seed gives the same puzzle; different levels give different puzzles', () => {
    for (const level of BRIDGES_LEVELS) {
      const a = generateBridges(level, createRng(levelSeed(level.id, 4)));
      const b = generateBridges(level, createRng(levelSeed(level.id, 4)));
      expect(b).toEqual(a);
      const c = generateBridges(level, createRng(levelSeed(level.id, 5)));
      expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    }
  });

  it('levelSeed is stable and different for each level', () => {
    expect(levelSeed('easy', 1)).toBe(levelSeed('easy', 1));
    expect(levelSeed('easy', 1)).not.toBe(levelSeed('easy', 2));
    expect(levelSeed('easy', 1)).not.toBe(levelSeed('medium', 1));
    const seen = new Set<number>();
    for (const l of BRIDGES_LEVELS) for (let n = 1; n <= 300; n++) seen.add(levelSeed(l.id, n));
    expect(seen.size).toBe(900);
    for (const s of seen) expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });
});

// A hand-made board:
//   0 . 1        islands 0 (0,0) n3, 1 (0,2) n3
//   . . .
//   2 . 3        islands 2 (2,0) n3, 3 (2,2) n3
// It has two answers: double across the top and bottom, or double down both sides.
const square: BridgesPuzzle = {
  size: 3,
  islands: [
    { id: 0, r: 0, c: 0, n: 3 }, { id: 1, r: 0, c: 2, n: 3 },
    { id: 2, r: 2, c: 0, n: 3 }, { id: 3, r: 2, c: 2, n: 3 },
  ],
  solution: [
    { a: 0, b: 1, count: 2 }, { a: 1, b: 3, count: 1 }, { a: 2, b: 3, count: 2 }, { a: 0, b: 2, count: 1 },
  ],
};

// A plus shape, for crossings and islands in the way:
//   . 0 .
//   1 4 2     4 = (1,1) sits between 0/3 and between 1/2
//   . 3 .
const plus: BridgesPuzzle = {
  size: 3,
  islands: [
    { id: 0, r: 0, c: 1, n: 1 }, { id: 1, r: 1, c: 0, n: 1 }, { id: 2, r: 1, c: 2, n: 1 },
    { id: 3, r: 2, c: 1, n: 1 }, { id: 4, r: 1, c: 1, n: 4 },
  ],
  solution: [{ a: 0, b: 4, count: 1 }, { a: 1, b: 4, count: 1 }, { a: 2, b: 4, count: 1 }, { a: 3, b: 4, count: 1 }],
};

// The same plus without the middle island: a bridge 0–3 and a bridge 1–2 would cross at (1,1).
const cross: BridgesPuzzle = {
  size: 3,
  islands: [
    { id: 0, r: 0, c: 1, n: 1 }, { id: 1, r: 1, c: 0, n: 1 }, { id: 2, r: 1, c: 2, n: 1 }, { id: 3, r: 2, c: 1, n: 1 },
  ],
  solution: [],
};

describe('bridges moves', () => {
  it('cycles none → single → double → none', () => {
    let b: Bridge[] = [];
    b = cycleBridge(b, 1, 0);
    expect(b).toEqual([{ a: 0, b: 1, count: 1 }]);
    b = cycleBridge(b, 0, 1);
    expect(b).toEqual([{ a: 0, b: 1, count: 2 }]);
    expect(bridgeCount(b, 1, 0)).toBe(2);
    b = cycleBridge(b, 1, 0);
    expect(b).toEqual([]);
  });

  it('cycling never changes the list it was given', () => {
    const before: Bridge[] = [{ a: 0, b: 1, count: 1 }];
    cycleBridge(before, 0, 1);
    expect(before).toEqual([{ a: 0, b: 1, count: 1 }]);
  });

  it('only links islands in a straight line', () => {
    expect(canLink(square, 0, 1)).toBe(true);
    expect(canLink(square, 0, 2)).toBe(true);
    expect(canLink(square, 0, 3)).toBe(false); // diagonal
    expect(canLink(square, 0, 0)).toBe(false);
  });

  it('blocks a bridge with an island in between', () => {
    expect(canLink(plus, 0, 3)).toBe(false);
    expect(canLink(plus, 1, 2)).toBe(false);
    expect(canLink(plus, 0, 4)).toBe(true);
  });

  it('blocks a bridge that would cross another one, but not the same pair again', () => {
    const across: Bridge[] = [{ a: 1, b: 2, count: 1 }];
    expect(canLink(cross, 0, 3, [])).toBe(true);
    expect(canLink(cross, 0, 3, across)).toBe(false);
    expect(canLink(cross, 1, 2, across)).toBe(true); // making it double is fine
    // bridges meeting at an island don't cross
    expect(canLink(square, 0, 2, [{ a: 0, b: 1, count: 2 }])).toBe(true);
  });

  it('finds the next island in each direction and the bridge over a cell', () => {
    expect(neighbourIn(square, 0, 1)).toBe(1);
    expect(neighbourIn(square, 0, 2)).toBe(2);
    expect(neighbourIn(square, 0, 0)).toBe(-1);
    expect(neighbourIn(square, 0, 3)).toBe(-1);
    expect(neighbourIn(plus, 0, 2)).toBe(4); // stops at the first island
    const b: Bridge[] = [{ a: 0, b: 1, count: 1 }];
    expect(bridgeAtCell(square, b, 0, 1)).toEqual(b[0]);
    expect(bridgeAtCell(square, b, 1, 1)).toBeNull();
    expect(bridgeAtCell(square, b, 0, 0)).toBeNull(); // the island itself, not the bridge
  });

  it('counts bridges touching an island and bridges left', () => {
    const b: Bridge[] = [{ a: 0, b: 1, count: 2 }, { a: 0, b: 2, count: 1 }];
    expect(islandCount(b, 0)).toBe(3);
    expect(islandCount(b, 1)).toBe(2);
    expect(islandCount(b, 3)).toBe(0);
    expect(totalBridges(square)).toBe(6);
    expect(bridgesLeft(square, b)).toBe(3);
  });
});

describe('bridges answers', () => {
  it('accepts the stored answer and any other valid one', () => {
    expect(isSolved(square, square.solution)).toBe(true);
    const other: Bridge[] = [{ a: 0, b: 1, count: 1 }, { a: 1, b: 3, count: 2 }, { a: 2, b: 3, count: 1 }, { a: 0, b: 2, count: 2 }];
    expect(isSolved(square, other)).toBe(true);
    expect(isSolved(plus, plus.solution)).toBe(true);
  });

  it('rejects a missing bridge', () => {
    expect(isSolved(square, square.solution.slice(1))).toBe(false);
    expect(isSolved(square, [])).toBe(false);
  });

  it('rejects an answer that is not all joined up', () => {
    // two separate pairs: every number is met, but the top pair and the bottom pair never meet
    //   0 . 1 . .
    //   . . . . .     each island n = 1
    //   2 . 3 . .
    const twoPairs: BridgesPuzzle = {
      size: 5,
      islands: [
        { id: 0, r: 0, c: 0, n: 1 }, { id: 1, r: 0, c: 2, n: 1 },
        { id: 2, r: 2, c: 0, n: 1 }, { id: 3, r: 2, c: 2, n: 1 },
      ],
      solution: [],
    };
    const split: Bridge[] = [{ a: 0, b: 1, count: 1 }, { a: 2, b: 3, count: 1 }];
    for (const isl of twoPairs.islands) expect(islandCount(split, isl.id)).toBe(isl.n);
    expect(isConnected(twoPairs, split)).toBe(false);
    expect(isSolved(twoPairs, split)).toBe(false);
  });

  it('rejects crossings, islands in between, too many bridges and stray pairs', () => {
    // Only the crossing is wrong here: numbers met, all joined, but 1–4 and 2–3 cross at (2,2).
    //   0 . 1 . .
    //   . . . . .
    //   2 . . . 3
    //   . . . . .
    //   . . 4 . .
    const crossBoard: BridgesPuzzle = {
      size: 5,
      islands: [
        { id: 0, r: 0, c: 0, n: 2 }, { id: 1, r: 0, c: 2, n: 2 }, { id: 2, r: 2, c: 0, n: 2 },
        { id: 3, r: 2, c: 4, n: 1 }, { id: 4, r: 4, c: 2, n: 1 },
      ],
      solution: [],
    };
    const crossing: Bridge[] = [
      { a: 0, b: 1, count: 1 }, { a: 0, b: 2, count: 1 }, { a: 1, b: 4, count: 1 }, { a: 2, b: 3, count: 1 },
    ];
    for (const isl of crossBoard.islands) expect(islandCount(crossing, isl.id)).toBe(isl.n);
    expect(isConnected(crossBoard, crossing)).toBe(true);
    expect(isSolved(crossBoard, crossing)).toBe(false);
    expect(canLink(crossBoard, 2, 3, crossing.slice(0, 3))).toBe(false);
    // jumping over the middle island
    expect(isSolved(plus, [{ a: 0, b: 3, count: 1 }, { a: 1, b: 2, count: 1 }])).toBe(false);
    // the same pair listed twice adding up to 3
    expect(isSolved(square, [...square.solution, { a: 0, b: 1, count: 1 }])).toBe(false);
    // diagonal
    expect(isSolved(square, [{ a: 0, b: 3, count: 1 }])).toBe(false);
    // too many on an island
    expect(isSolved(square, square.solution.map(b => ({ ...b, count: 2 as const })))).toBe(false);
  });
});

describe('bridges score', () => {
  it('rewards speed and never drops below 30 %', () => {
    const med = BRIDGES_LEVELS[1];
    expect(bridgesScore(med, 0)).toBe(500);
    expect(bridgesScore(med, 120)).toBe(250);
    expect(bridgesScore(med, 99999)).toBe(150);
    expect(bridgesScore(BRIDGES_LEVELS[2], 60)).toBeGreaterThan(bridgesScore(BRIDGES_LEVELS[0], 60));
  });
});
