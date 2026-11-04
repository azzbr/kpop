import { describe, it, expect } from 'vitest';
import {
  createStackWorld, stepStack, dropPiece, rotatePiece, swingPeriod, PIECES, BASE_W, ROUND_TICKS, STILL_TICKS,
  TUMBLE_TICKS, MAX_HEARTS, UNITS_PER_CM, CRANE_ABOVE, BASE_TOP,
} from './stackLabLogic';
import type { StackWorld, PieceKind, StackEvent } from './stackLabLogic';
import { playStack } from './stackLabSim';

/** Steps until everything has been still long enough to count (or `max` ticks). Returns the events seen. */
function settle(w: StackWorld, max = 600): StackEvent[] {
  const seen: StackEvent[] = [];
  for (let i = 0; i < max && w.status !== 'over'; i++) {
    stepStack(w);
    seen.push(...w.events);
    if (w.stillTicks >= STILL_TICKS && w.hanging) break;
  }
  return seen;
}

/** Makes the hanging piece `kind` and drops it with its centre at x. */
function dropAt(w: StackWorld, kind: PieceKind, x: number, quarterTurns = 0) {
  while (!w.hanging) stepStack(w);
  w.hanging = { ...w.hanging, kind, angle: 0 };
  for (let i = 0; i < quarterTurns; i++) rotatePiece(w);
  w.crane.x = x;
  expect(dropPiece(w)).toBe(true);
}

describe('Stack Lab physics', () => {
  it('a cube dropped in the middle lands on the base and counts as 10 cm once still', () => {
    const w = createStackWorld(1);
    dropAt(w, 'cube', 0);
    const ev = settle(w);
    expect(ev.some(e => e.type === 'land')).toBe(true);
    expect(w.bestCm).toBe(Math.round(PIECES.cube.h / UNITS_PER_CM));
    expect(w.bestCm).toBe(10);
    expect(w.hearts).toBe(MAX_HEARTS);
    expect(ev.some(e => e.type === 'best' && e.cm === 10)).toBe(true);
  });

  it('measures a stack: cube + cube = 20 cm, a plank on top adds its thickness', () => {
    const w = createStackWorld(2);
    dropAt(w, 'cube', 0); settle(w);
    dropAt(w, 'cube', 2); settle(w);
    expect(w.bestCm).toBeGreaterThanOrEqual(19);
    expect(w.bestCm).toBeLessThanOrEqual(21);
    dropAt(w, 'plank', 0); settle(w);
    expect(w.bestCm).toBe(Math.round((64 * 2 + PIECES.plank.h) / UNITS_PER_CM));
  });

  it('a turned tower block lies flat (lower), an upright one stands tall', () => {
    const up = createStackWorld(3);
    dropAt(up, 'tall', 0); settle(up);
    expect(up.bestCm).toBe(Math.round(PIECES.tall.h / UNITS_PER_CM));
    const flat = createStackWorld(3);
    dropAt(flat, 'tall', 0, 1); settle(flat);
    expect(flat.bestCm).toBe(Math.round(PIECES.tall.w / UNITS_PER_CM));
  });

  it('a cube hanging mostly over the edge tips off and costs a heart', () => {
    const w = createStackWorld(4);
    dropAt(w, 'cube', BASE_W / 2 + 12); // centre of mass beyond the edge
    const ev = settle(w, 900);
    expect(ev.some(e => e.type === 'fall')).toBe(true);
    expect(w.hearts).toBe(MAX_HEARTS - 1);
    expect(w.pieces).toHaveLength(0);
    expect(w.bestCm).toBe(0);
  });

  it('a plank sticking out but balanced (centre over the base) stays put', () => {
    const w = createStackWorld(5);
    dropAt(w, 'plank', BASE_W / 2 - 30); // 34 units out over the edge, centre still on the base
    settle(w);
    expect(w.pieces).toHaveLength(1);
    expect(w.hearts).toBe(MAX_HEARTS);
    expect(w.bestCm).toBe(Math.round(PIECES.plank.h / UNITS_PER_CM));
  });

  it('one tumble = one heart, however many pieces fall in it; 3 tumbles end the round', () => {
    const w = createStackWorld(6);
    // Two pieces missing the base at once: one tumble.
    dropAt(w, 'cube', 260);
    dropAt(w, 'cube', -260);
    settle(w, 400);
    expect(w.fallen).toBe(2);
    expect(w.hearts).toBe(MAX_HEARTS - 1);
    // Two more misses, each well apart: the round ends.
    for (let i = 0; i < 2; i++) {
      for (let t = 0; t < TUMBLE_TICKS + 5; t++) stepStack(w);
      dropAt(w, 'cube', 300);
      settle(w, 400);
    }
    expect(w.hearts).toBe(0);
    expect(w.status).toBe('over');
    expect(w.overReason).toBe('hearts');
    expect(dropPiece(w)).toBe(false);
  });

  it("time's up after 90 seconds: no more drops, the tower settles, then the round is over", () => {
    const w = createStackWorld(7);
    dropAt(w, 'cube', 0);
    let sawTimeUp = false;
    while (w.tick < ROUND_TICKS) { stepStack(w); if (w.events.some(e => e.type === 'timeUp')) sawTimeUp = true; }
    expect(sawTimeUp).toBe(true);
    expect(w.status).toBe('settling');
    expect(w.hanging).toBeNull();
    expect(dropPiece(w)).toBe(false);
    for (let i = 0; i < 400 && w.status !== 'over'; i++) stepStack(w);
    expect(w.status).toBe('over');
    expect(w.overReason).toBe('time');
    expect(w.bestCm).toBe(10);
  });

  it('the crane waits a moment before bringing the next piece, and rises with the tower', () => {
    const w = createStackWorld(8);
    const startY = w.crane.y;
    expect(startY).toBe(BASE_TOP - CRANE_ABOVE);
    dropAt(w, 'cube', 0);
    expect(dropPiece(w)).toBe(false); // nothing to drop yet
    settle(w);
    dropAt(w, 'cube', 0); settle(w);
    dropAt(w, 'cube', 0); settle(w);
    for (let i = 0; i < 120; i++) stepStack(w);
    expect(w.crane.y).toBeLessThan(startY - 150);
    expect(swingPeriod(0)).toBeGreaterThan(swingPeriod(150));
    expect(swingPeriod(1000)).toBe(130);
  });
});

describe('Stack Lab pieces', () => {
  it('the same seed gives the same pieces, and each bag of 11 is fair', () => {
    const order = (seed: number) => {
      const w = createStackWorld(seed);
      const kinds: PieceKind[] = [];
      for (let i = 0; i < 22; i++) {
        kinds.push(w.hanging!.kind);
        w.hanging = null; // as if dropped: the crane fetches the next piece
        w.respawnAt = w.tick;
        stepStack(w);
      }
      return kinds;
    };
    const a = order(42);
    expect(order(42)).toEqual(a);
    expect(order(43)).not.toEqual(a);
    const count = (ks: PieceKind[]) => ks.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});
    // 22 pieces = exactly two bags.
    expect(count(a)).toEqual({ cube: 6, plank: 4, tall: 4, jelly: 4, hill: 2, gem: 2 });
    expect(count(a.slice(0, 11))).toEqual({ cube: 3, plank: 2, tall: 2, jelly: 2, hill: 1, gem: 1 });
  });

  it('every round starts on an easy piece', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const k = createStackWorld(seed).hanging!.kind;
      expect(['gem', 'hill'], `seed ${seed}`).not.toContain(k);
    }
  });

  it('a careful pretend player builds higher than a wild one', () => {
    const careful = [1, 2, 3].map(s => playStack(s, { aim: 6, patient: true, layTallFlat: true }).bestCm);
    const wild = [1, 2, 3].map(s => playStack(s, { aim: 45, patient: false }).bestCm);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(careful)).toBeGreaterThan(sum(wild));
    expect(Math.max(...careful)).toBeGreaterThanOrEqual(40); // 1★ is reachable
  });
});
