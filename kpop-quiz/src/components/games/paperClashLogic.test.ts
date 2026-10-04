import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { createWorld, placeAt, step, steerAngle, steerDir, claim, idx, recount, percentOf, supercover, TICK_HZ, SPEED } from './paperClashLogic';
import type { World, Player, Dir } from './paperClashLogic';

/** An empty world with N players placed by hand and nobody thinking (no AI, no respawn). */
function makeWorld(n: number, size = 120): World {
  const w = createWorld({ size, bots: n - 1, rng: createRng(1) });
  w.owner.fill(0);
  w.trail.fill(0);
  for (const p of w.players) { p.alive = false; p.isHuman = true; p.thinks = false; }
  return w;
}
function put(w: World, p: Player, x: number, y: number, heading: number, r = 5) {
  placeAt(w, p, x, y, r, heading);
  recount(w);
}
const U = 0 as Dir, R = 1 as Dir, D = 2 as Dir, L = 3 as Dir;
/** Steer player 1 in a direction for `ticks` ticks. */
function drive(w: World, plan: [Dir, number][]) {
  const p = w.players[0];
  for (const [d, t] of plan) for (let i = 0; i < t; i++) { steerDir(p, d); step(w); }
}
const cellsPerTick = SPEED / TICK_HZ;
const ticksFor = (cells: number) => Math.ceil(cells / cellsPerTick);
const ownerAt = (w: World, x: number, y: number) => w.owner[idx(w, Math.floor(x), Math.floor(y))];

describe('supercover rasterising', () => {
  it('visits 4-connected cells with no diagonal gaps', () => {
    const out: number[] = [];
    supercover(0.5, 0.5, 3.5, 2.5, out, 10);
    const cells = [0, ...out].map(c => [c % 10, Math.floor(c / 10)]);
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i][0] - cells[i - 1][0]) + Math.abs(cells[i][1] - cells[i - 1][1])).toBe(1);
    }
    expect(cells.at(-1)).toEqual([3, 2]);
  });
});

describe('claiming land', () => {
  it('a square loop claims its inside', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 40, 60, 0);
    const before = w.counts[1];
    // Out right, up, left, then down back into the blob.
    drive(w, [[R, ticksFor(18)], [U, ticksFor(16)], [L, ticksFor(16)], [D, ticksFor(20)]]);
    expect(p.alive).toBe(true);
    expect(p.trail).toHaveLength(0);
    expect(w.counts[1]).toBeGreaterThan(before + 150);
    // A point well inside the loop is ours.
    expect(ownerAt(w, 48, 52)).toBe(1);
  });

  it('a concave L-shaped loop claims only its inside', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 40, 60, 0);
    drive(w, [[R, ticksFor(28)], [U, ticksFor(10)], [L, ticksFor(12)], [U, ticksFor(10)], [L, ticksFor(19)], [D, ticksFor(25)]]);
    expect(p.alive).toBe(true);
    expect(p.trail).toHaveLength(0);
    expect(ownerAt(w, 60, 55)).toBe(1); // inside the bottom arm
    expect(ownerAt(w, 62, 38)).toBe(0); // the notch stays free
  });

  it('claims enemy land inside the loop', () => {
    const w = makeWorld(2);
    const [p, q] = w.players;
    put(w, p, 40, 60, 0);
    put(w, q, 52, 52, 0, 2.5);
    q.alive = false; // land only, nobody home
    const qBefore = w.counts[2];
    expect(qBefore).toBeGreaterThan(0);
    drive(w, [[R, ticksFor(22)], [U, ticksFor(18)], [L, ticksFor(20)], [D, ticksFor(22)]]);
    expect(p.alive).toBe(true);
    recount(w);
    expect(w.counts[2]).toBeLessThan(qBefore);
  });

  it('a straight line out and back home claims nothing extra', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 40, 60, 0);
    const before = w.counts[1];
    drive(w, [[R, ticksFor(10)]]);
    const trailLen = p.trail.length;
    expect(trailLen).toBeGreaterThan(0);
    // Turn around in a wide U and come back in parallel: encloses only a thin strip.
    drive(w, [[U, ticksFor(3)], [L, ticksFor(14)]]);
    expect(p.alive).toBe(true);
    expect(w.counts[1] - before).toBeLessThan(trailLen * 6);
  });

  it('claim() fills holes but never cells outside the arena', () => {
    const w = makeWorld(1, 60);
    const p = w.players[0];
    put(w, p, 30, 30, 0, 10);
    const res = claim(w, p);
    expect(res.enclosed.length).toBe(0);
    for (let c = 0; c < w.owner.length; c++) if (!w.arena[c]) expect(w.owner[c]).toBe(0);
  });
});

describe('knock-outs', () => {
  it('crossing a trail knocks out the trail owner', () => {
    const w = makeWorld(2);
    const [p, q] = w.players;
    put(w, q, 60, 30, Math.PI / 2);
    // q heads down first, laying a trail down x≈60…
    for (let i = 0; i < ticksFor(40); i++) { steerDir(q, D); step(w); }
    // …then p drives right along y=60 and cuts across it.
    put(w, p, 30, 60, 0);
    for (let i = 0; i < ticksFor(40) && q.alive; i++) { steerDir(p, R); steerDir(q, D); step(w); }
    expect(q.alive).toBe(false);
    expect(q.deathCause).toBe('trail');
    expect(p.alive).toBe(true);
    expect(p.kills).toBe(1);
  });

  it('crossing your own older trail knocks you out', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 40, 60, 0);
    drive(w, [[R, ticksFor(20)], [U, ticksFor(10)], [L, ticksFor(8)], [D, ticksFor(16)]]);
    expect(p.alive).toBe(false);
    expect(p.deathCause).toBe('own_trail');
  });

  it('the neck never knocks you out on the tightest turn', () => {
    const w = makeWorld(1);
    const p = w.players[0];
    put(w, p, 40, 60, 0);
    drive(w, [[R, ticksFor(12)]]);
    for (let i = 0; i < 12; i++) { steerAngle(p, p.heading + Math.PI * 0.99); step(w); }
    expect(p.deathCause).not.toBe('own_trail');
  });

  it('heads meeting: more land wins, a tie knocks out both', () => {
    const w = makeWorld(2);
    const [p, q] = w.players;
    put(w, p, 30, 60, 0, 7);
    put(w, q, 70, 60, Math.PI, 5);
    for (let i = 0; i < 60 && p.alive && q.alive; i++) { steerDir(p, R); steerDir(q, L); step(w); }
    expect(q.alive).toBe(false);
    expect(q.deathCause).toBe('head_on');
    expect(p.alive).toBe(true);

    const t = makeWorld(2);
    const [a, b] = t.players;
    put(t, a, 30, 60, 0, 5);
    put(t, b, 70, 60, Math.PI, 5);
    for (let i = 0; i < 60 && a.alive && b.alive; i++) { steerDir(a, R); steerDir(b, L); step(t); }
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
  });

  it('leaving the arena knocks you out, and your land is cleared', () => {
    const w = makeWorld(1, 80);
    const p = w.players[0];
    put(w, p, 40, 40, 0);
    expect(w.counts[1]).toBeGreaterThan(0);
    drive(w, [[R, ticksFor(60)]]);
    expect(p.alive).toBe(false);
    expect(p.deathCause).toBe('wall');
    expect(w.counts[1]).toBe(0);
  });

  it('a head inside a freshly claimed loop is knocked out', () => {
    const w = makeWorld(2);
    const [p, q] = w.players;
    put(w, p, 40, 60, 0);
    put(w, q, 54, 48, 0, 9); // q circles on its own big blob, so it never lays a trail
    const loop: [Dir, number][] = [[R, ticksFor(30)], [U, ticksFor(25)], [L, ticksFor(32)], [D, ticksFor(30)]];
    for (const [d, n] of loop) for (let i = 0; i < n && p.alive; i++) {
      steerDir(p, d);
      steerAngle(q, q.heading - 0.3);
      step(w);
    }
    expect(p.alive).toBe(true);
    expect(q.alive).toBe(false);
    expect(q.deathCause).toBe('enclosed');
  });
});

describe('a full bot game', () => {
  it('stays consistent: land totals, trails and no NaNs', () => {
    const w = createWorld({ rng: createRng(5), difficulty: 'hard', humanThinks: true });
    for (let t = 0; t < 2000; t++) step(w);
    recount(w);
    expect(w.counts.reduce((a, b) => a + b, 0)).toBe(w.size * w.size);
    for (const p of w.players) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      if (p.alive) for (const c of p.trail) expect(w.trail[c]).toBe(p.id);
    }
    for (let c = 0; c < w.owner.length; c++) if (!w.arena[c]) expect(w.owner[c]).toBe(0);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s bots grab land and rarely knock themselves out', diff => {
    const w = createWorld({ rng: createRng(9), difficulty: diff });
    let wall = 0, own = 0, peak = 0;
    for (let t = 0; t < 180 * TICK_HZ; t++) {
      step(w);
      for (const e of w.events) if (e.type === 'death' && e.playerId !== 1) {
        if (e.cause === 'wall') wall++;
        if (e.cause === 'own_trail') own++;
      }
      for (let id = 2; id <= w.players.length; id++) peak = Math.max(peak, percentOf(w, id));
    }
    expect(peak).toBeGreaterThan(2);
    expect(wall).toBeLessThan(6);
    expect(own).toBeLessThan(6);
  });
});

describe('performance (iPad is ~3× slower than this machine)', () => {
  it('one step with 7 players stays well under 1 ms on average', () => {
    const w = createWorld({ rng: createRng(3), humanThinks: true });
    const t0 = performance.now();
    for (let i = 0; i < 1200; i++) step(w);
    expect((performance.now() - t0) / 1200).toBeLessThan(1);
  });

  it('a single worst-case capture (a huge loop) takes under 4 ms', () => {
    const w = makeWorld(1, 250);
    const p = w.players[0];
    put(w, p, 125, 125, 0, 8);
    // Fake a big trail ring of radius 100 that starts and ends on the blob, then claim once.
    for (let a = 0; a < Math.PI * 2; a += 0.002) {
      const c = idx(w, Math.floor(125 + Math.cos(a) * 100), Math.floor(125 + Math.sin(a) * 100));
      if (w.trail[c] !== 1) { w.trail[c] = 1; p.trail.push(c); }
    }
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      claim(w, p);
      runs.push(performance.now() - t0);
      w.owner.fill(0);
    }
    runs.sort((a, b) => a - b);
    expect(runs[2]).toBeLessThan(4);
  });
});
