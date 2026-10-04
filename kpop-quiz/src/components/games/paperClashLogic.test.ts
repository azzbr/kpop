import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { createWorld, placeAt, step, steer, claim, idx, recount, percentOf } from './paperClashLogic';
import type { World, Dir, Player } from './paperClashLogic';

/** A small empty world with N players placed by hand and bots that never think. */
function makeWorld(n: number, size = 30): World {
  const w = createWorld({ size, bots: n - 1, rng: createRng(1) });
  w.owner.fill(0);
  w.trail.fill(0);
  for (const p of w.players) { p.alive = false; p.isHuman = true; } // isHuman: no AI, no respawn
  return w;
}

function put(w: World, p: Player, x: number, y: number, d: Dir) {
  placeAt(w, p, x, y);
  p.dir = p.nextDir = d;
  recount(w);
}

/** Steer player 1 through a list of moves, stepping once per move. */
function drive(w: World, moves: Dir[]) {
  for (const d of moves) { steer(w.players[0], d); step(w); }
}

const U = 0 as Dir, R = 1 as Dir, D = 2 as Dir, L = 3 as Dir;
const rep = (d: Dir, n: number) => Array<Dir>(n).fill(d);

describe('claiming land', () => {
  it('claims a square loop and everything inside it', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 10, 10, R); // owns 8..12
    const before = w.counts[1];
    // Leave right, go down 6, left 5, back up into home.
    drive(w, [...rep(R, 4), ...rep(D, 6), ...rep(L, 5), ...rep(U, 4)]);
    expect(p.alive).toBe(true);
    expect(p.trail.length).toBe(0);
    expect(w.counts[1]).toBeGreaterThan(before + 20);
    // A cell in the middle of the loop is now ours.
    expect(w.owner[idx(w, 13, 14)]).toBe(1);
    // A cell outside is not.
    expect(w.owner[idx(w, 20, 20)]).toBe(0);
  });

  it('fills a concave (L-shaped) loop correctly', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 10, 10, D);
    // Down out of home, right, up past home level, then left back in on the top row.
    drive(w, [...rep(D, 5), ...rep(R, 6), ...rep(U, 7), ...rep(L, 4)]);
    expect(p.trail.length).toBe(0);
    expect(w.owner[idx(w, 14, 14)]).toBe(1); // inside the bend
    expect(w.owner[idx(w, 20, 14)]).toBe(0); // outside
  });

  it('works for loops that touch the map edge', () => {
    const w = makeWorld(1, 20);
    const p = w.players[0];
    put(w, p, 3, 3, U);
    // Run along the top edge (row 0) and come back down into home.
    drive(w, [...rep(U, 3), ...rep(R, 6), ...rep(D, 3), ...rep(L, 4)]);
    expect(p.alive).toBe(true);
    expect(w.owner[idx(w, 7, 1)]).toBe(1);
  });

  it("steals an enemy's land that ends up inside the loop", () => {
    const w = makeWorld(2);
    const [a, b] = w.players;
    put(w, a, 5, 5, R);
    put(w, b, 20, 20, U);
    // Give b a small island of land inside where a will loop.
    w.owner[idx(w, 10, 8)] = b.id;
    recount(w);
    drive(w, [...rep(R, 9), ...rep(D, 6), ...rep(L, 9), ...rep(U, 4)]);
    expect(w.owner[idx(w, 10, 8)]).toBe(a.id);
  });
});

describe('knock-outs', () => {
  it('crossing a trail knocks out the trail owner, not the crosser', () => {
    const w = makeWorld(2);
    const [a, b] = w.players;
    put(w, a, 5, 10, R);
    put(w, b, 12, 4, D);
    // b walks down out of its land, laying a trail down column 12.
    for (let i = 0; i < 7; i++) step(w); // a moves right too, crossing column 12 at row 10
    expect(a.alive).toBe(true);
    expect(b.alive).toBe(false);
    expect(b.deathCause).toBe('trail');
    expect(a.kills).toBe(1);
  });

  it('running into your own trail knocks you out', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 10, 10, R);
    drive(w, [...rep(R, 4), D, L, U]);
    expect(p.alive).toBe(false);
    expect(p.deathCause).toBe('own_trail');
  });

  it('head-on: the player with more land survives', () => {
    const w = makeWorld(2);
    const [a, b] = w.players;
    put(w, a, 5, 10, R);
    put(w, b, 15, 10, L);
    for (let y = 0; y < 5; y++) w.owner[idx(w, 0, y)] = a.id; // a gets 5 extra cells
    recount(w);
    for (let i = 0; i < 8 && a.alive && b.alive; i++) step(w);
    expect(a.alive).toBe(true);
    expect(b.alive).toBe(false);
    expect(b.deathCause).toBe('head_on');
  });

  it('head-on with equal land knocks out both', () => {
    const w = makeWorld(2);
    const [a, b] = w.players;
    put(w, a, 5, 10, R);
    put(w, b, 15, 10, L);
    for (let i = 0; i < 8 && (a.alive || b.alive); i++) step(w);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
  });

  it('a player caught inside a claimed loop is knocked out', () => {
    const w = makeWorld(2);
    const [a, b] = w.players;
    put(w, a, 5, 5, R);
    put(w, b, 11, 8, R); // b's land is x 9..13, y 6..10 — inside the loop a is about to draw
    const circle: Dir[] = [R, D, L, U]; // b runs in a tight circle on its own land
    const moves: Dir[] = [...rep(R, 9), ...rep(D, 6), ...rep(L, 9), ...rep(U, 4)];
    moves.forEach((d, i) => {
      steer(a, d);
      b.nextDir = circle[i % 4];
      step(w);
    });
    expect(a.alive).toBe(true);
    expect(b.alive).toBe(false);
    expect(b.deathCause).toBe('enclosed');
    expect(a.kills).toBe(1);
  });

  it('hitting the wall knocks you out', () => {
    const w = makeWorld(1, 20);
    const p = w.players[0];
    put(w, p, 3, 3, L);
    for (let i = 0; i < 6; i++) step(w);
    expect(p.alive).toBe(false);
    expect(p.deathCause).toBe('wall');
  });

  it('a knocked-out player loses their land', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 10, 10, R);
    drive(w, [...rep(R, 4), D, L, U]);
    expect(w.counts[1]).toBe(0);
    expect(percentOf(w, 1)).toBe(0);
  });
});

describe('claim()', () => {
  it('does not claim the open map when the trail is a straight line', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 10, 10, R);
    p.trail = [idx(w, 13, 10), idx(w, 14, 10)];
    const enclosed = claim(w, p);
    expect(enclosed.length).toBe(0);
  });
});

describe('a full bot game', () => {
  it('runs 2,000 ticks with bots without crashing and keeps land counts consistent', () => {
    const w = createWorld({ rng: createRng(42), difficulty: 'hard' });
    w.players[0].isHuman = false; // let the human slot play as a bot too
    for (let i = 0; i < 2000; i++) step(w);
    const total = w.counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(w.size * w.size);
    expect(w.players.some(p => p.alive)).toBe(true);
    // Trail layer and players' trail lists agree.
    for (const p of w.players) for (const c of p.trail) expect(w.trail[c]).toBe(p.id);
  });
});

describe('bots', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`grow their land on ${difficulty} and don't mostly crash into walls`, () => {
      const w = createWorld({ rng: createRng(7), difficulty });
      w.players[0].alive = false; // human sits out
      let maxPct = 0;
      const causes: Record<string, number> = {};
      for (let i = 0; i < 1800; i++) {
        step(w);
        for (const e of w.events) if (e.type === 'death') causes[e.cause!] = (causes[e.cause!] ?? 0) + 1;
        for (const p of w.players.slice(1)) maxPct = Math.max(maxPct, percentOf(w, p.id));
      }
      expect(maxPct).toBeGreaterThan(2);
      expect(causes.wall ?? 0).toBeLessThan(5);
      expect(causes.own_trail ?? 0).toBeLessThan(5);
    });
  }
});
