import { describe, it, expect } from 'vitest';
import { rankByScore, duelRanking, everyoneSaidHello } from './boardSync';
import { emptyBoard, playMove, C4_COLS } from './connectFourLogic';
import { randomFleet, validFleet, fireAt, playerView, BS_N } from './battleshipLogic';
import type { Ship } from './battleshipLogic';
import { newBoard, drawEdge, isEdge, edgeGeometry } from './dotsBoxesLogic';
import { BOARD, FINISH, resolveRoll, finalRanking, PRICE, RENT, START_COINS } from './worldTourLogic';
import { createRng } from '../games/engine/rng';

describe('board sync helpers', () => {
  it('ranks by score with shared rungs for ties', () => {
    expect(rankByScore(['a', 'b', 'c', 'd'], (id) => ({ a: 1, b: 5, c: 5, d: 0 })[id]!)).toEqual([['b', 'c'], 'a', 'd']);
    expect(duelRanking('x', 'y', 1)).toEqual(['x', 'y']);
    expect(duelRanking('x', 'y', 2)).toEqual(['y', 'x']);
    expect(duelRanking('x', 'y', 3)).toEqual([['x', 'y']]);
    expect(everyoneSaidHello(['h', 'p'], new Set(['h']))).toBe(false);
    expect(everyoneSaidHello(['h', 'p'], new Set(['h', 'p']))).toBe(true);
  });
});

describe('Connect 4', () => {
  it('stacks discs, finds a vertical win and rejects full columns', () => {
    let b = emptyBoard();
    let turn = 1;
    for (const col of [0, 1, 0, 1, 0, 1]) {
      const r = playMove(b, col, turn)!;
      b = r.board;
      turn = r.turn;
    }
    const win = playMove(b, 0, 1)!;
    expect(win.winner).toBe(1);
    expect(win.winLine).toHaveLength(4);
    let full = emptyBoard();
    for (let i = 0; i < 6; i++) full = playMove(full, 3, (i % 2) + 1)!.board;
    expect(playMove(full, 3, 1)).toBeNull();
    expect(playMove(full, C4_COLS, 1)).toBeNull();
  });

  it('a full board with no line is a draw', () => {
    // Column pattern that never makes four in a row
    const order = [1, 1, 2, 2, 1, 1];
    let b = emptyBoard();
    let last = null as ReturnType<typeof playMove>;
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 6; r++) {
        // columns 0,1,2 and 4,5,6 alternate the pattern; column 3 copies column 2's
        const flip = c < 3 ? c % 2 === 1 : c === 3 ? false : c % 2 === 1;
        const disc = flip ? 3 - order[r] : order[r];
        last = playMove(b, c, disc);
        if (c * 6 + r < 41) expect(last!.winner).toBe(0);
        b = last!.board;
      }
    }
    expect(last!.winner).toBe(3);
  });
});

describe('Battleship', () => {
  it('random fleets are always valid', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) expect(validFleet(randomFleet(rng))).toBe(true);
    expect(validFleet([[0, 1, 2, 3], [7, 8, 9], [20, 21], [21, 22]])).toBe(false); // overlap
    expect(validFleet([[5, 6, 7, 8], [14, 15, 16], [28, 29], [42, 43]])).toBe(false); // wraps a row
  });

  it('fires, sinks and hides enemy ships until sunk', () => {
    const fleet: Ship[] = [[0, 1], [10, 17]].map((cells) => ({ cells, hits: [] }));
    const shots = new Map<number, boolean>();
    expect(fireAt(fleet, shots, 0)).toEqual({ hit: true, sunk: false, allSunk: false });
    expect(fireAt(fleet, shots, 0)).toBeNull();
    expect(fireAt(fleet, shots, 30)!.hit).toBe(false);
    const v = playerView([], new Map(), fleet, shots);
    expect(v.enemy[1]).toBe(0); // unhit ship cell stays hidden
    expect(v.enemy[0]).toBe(2);
    fireAt(fleet, shots, 1);
    expect(playerView([], new Map(), fleet, shots).enemy[0]).toBe(4);
    fireAt(fleet, shots, 10);
    expect(fireAt(fleet, shots, 17)!.allSunk).toBe(true);
    expect(BS_N).toBe(7);
  });
});

describe('Dots & Boxes', () => {
  it('claims a box and keeps the turn, otherwise passes it', () => {
    let b = newBoard(1, 1); // one box: grid 3x3, edges 1,3,5,7
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => isEdge(b, i))).toEqual([1, 3, 5, 7]);
    b = drawEdge(b, 1, 1)!;
    expect(b.turn).toBe(2);
    expect(drawEdge(b, 3, 1)).toBeNull(); // not your turn
    b = drawEdge(b, 3, 2)!;
    b = drawEdge(b, 5, 1)!;
    b = drawEdge(b, 7, 2)!;
    expect(b.scores[2]).toBe(1);
    expect(b.winner).toBe(2);
    expect(drawEdge(b, 1, 1)).toBeNull();
  });

  it('edge hit diamonds are centred on each edge and never overlap', () => {
    const b = newBoard(3, 3);
    const centres = [];
    for (let i = 0; i < 49; i++) if (isEdge(b, i)) centres.push(edgeGeometry(b, i));
    // Diamonds of L1-radius 0.5: two overlap only if their centres are closer than 1 (L1)
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = Math.abs(centres[i].x - centres[j].x) + Math.abs(centres[i].y - centres[j].y);
        expect(d).toBeGreaterThanOrEqual(1);
      }
    }
    expect(centres).toHaveLength(24);
  });
});

describe('World Tour Tycoon', () => {
  it('starts in Home Town, ends in London, 30 tiles', () => {
    expect(BOARD[0].label).toBe('Home Town');
    expect(BOARD[FINISH].label).toBe('London');
    expect(BOARD).toHaveLength(30);
    expect(BOARD.map((t) => t.label).join(' ')).not.toMatch(/Seoul|Busan|concert/i);
  });

  it('settles boosts, traps, rent and buying', () => {
    const pos = { a: 0, b: 0 };
    const coins = { a: START_COINS, b: START_COINS };
    const owners: Record<number, string> = {};
    expect(resolveRoll('a', 5, pos, coins, owners).final).toBe(8); // Singapore boost +3
    const trap = resolveRoll('b', 6, { ...pos, b: 1 }, coins, owners); // lands on Jakarta (7) -> back 3
    expect(trap.final).toBe(4);
    owners[8] = 'b';
    const p2 = { a: 6, b: 0 };
    const r = resolveRoll('a', 2, p2, coins, owners);
    expect(r.rent).toEqual({ to: 'b', amount: RENT });
    const r2 = resolveRoll('b', 1, { a: 0, b: 0 }, coins, owners); // Tokyo, unowned
    expect(r2.canBuy).toBe(true);
    expect(resolveRoll('a', 6, { a: 27, b: 0 }, coins, owners).final).toBe(FINISH);
  });

  it('ranks the finisher first and the rest by coins + hotels', () => {
    const coins = { a: 10, b: 100, c: 60 };
    const owners = { 1: 'c' }; // c is worth 60 + PRICE
    expect(PRICE).toBe(40);
    expect(finalRanking(['a', 'b', 'c'], 'a', coins, owners)).toEqual(['a', ['b', 'c']]);
    expect(finalRanking(['a', 'b', 'c'], 'c', coins, {})).toEqual(['c', 'b', 'a']);
  });
});
