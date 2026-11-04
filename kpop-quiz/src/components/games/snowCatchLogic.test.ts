import { describe, it, expect } from 'vitest';
import {
  createSnowWorld, stepSnow, setTarget, setKeyDir, secondsLeft, dailyBonus,
  BASKET_Y, BASKET_W, FIELD_W, GOLD_POINTS, ROUND_TICKS, DAILY_BONUS_CAP,
} from './snowCatchLogic';
import type { SnowWorld, Flake } from './snowCatchLogic';

/** A still flake (no sway) just above the basket rim at x. */
function flakeAt(w: SnowWorld, x: number, kind: Flake['kind'] = 'snow'): Flake {
  const f: Flake = { id: 999 + w.flakes.length, kind, baseX: x, sway: 0, phase: 0, x, y: BASKET_Y - 2, px: x, py: BASKET_Y - 4, vy: 4, spin: 0 };
  w.flakes.push(f);
  return f;
}

/** A world with no automatic flakes for the next few ticks. */
function quietWorld() {
  const w = createSnowWorld(1);
  w.nextSpawn = 1e9;
  return w;
}

describe('Snow Catch', () => {
  it('a flake that lands in the basket is caught', () => {
    const w = quietWorld();
    flakeAt(w, w.basketX + BASKET_W / 2 - 4);
    stepSnow(w);
    expect(w.score).toBe(1);
    expect(w.caught).toBe(1);
    expect(w.flakes).toHaveLength(0);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'catch', points: 1 }));
  });

  it('a flake beside the basket keeps falling and is missed at the bottom', () => {
    const w = quietWorld();
    flakeAt(w, w.basketX + BASKET_W / 2 + 20);
    stepSnow(w);
    expect(w.score).toBe(0);
    expect(w.flakes).toHaveLength(1);
    for (let i = 0; i < 60; i++) stepSnow(w);
    expect(w.flakes).toHaveLength(0);
    expect(w.missed).toBe(1);
    expect(w.score).toBe(0);
  });

  it('golden flakes count 3', () => {
    const w = quietWorld();
    flakeAt(w, w.basketX, 'gold');
    stepSnow(w);
    expect(w.score).toBe(GOLD_POINTS);
    expect(w.golden).toBe(1);
  });

  it('the basket follows a finger (quickly, not instantly) and stays on the field', () => {
    const w = quietWorld();
    setTarget(w, 0);
    stepSnow(w);
    expect(w.basketX).toBeLessThan(FIELD_W / 2);
    for (let i = 0; i < 20; i++) stepSnow(w);
    expect(w.basketX).toBe(BASKET_W / 2);
    setTarget(w, null);
    setKeyDir(w, 1);
    for (let i = 0; i < 100; i++) stepSnow(w);
    expect(w.basketX).toBe(FIELD_W - BASKET_W / 2);
  });

  it('the round ends after 30 seconds', () => {
    const w = createSnowWorld(5);
    expect(secondsLeft(w)).toBe(30);
    for (let i = 0; i < ROUND_TICKS - 1; i++) stepSnow(w);
    expect(w.status).toBe('playing');
    stepSnow(w);
    expect(w.status).toBe('over');
    expect(w.events).toContainEqual({ type: 'over' });
    expect(secondsLeft(w)).toBe(0);
    stepSnow(w);
    expect(w.tick).toBe(ROUND_TICKS);
  });

  it('the same seed gives the same snowfall', () => {
    const run = (seed: number) => {
      const w = createSnowWorld(seed);
      for (let i = 0; i < 300; i++) stepSnow(w);
      return w.flakes.map(f => [f.kind, Math.round(f.x), Math.round(f.y)]);
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('a round has a sensible amount of snow: a keen chaser catches lots, standing still catches a few', () => {
    const play = (seed: number, chase: boolean) => {
      const w = createSnowWorld(seed);
      while (w.status === 'playing') {
        if (chase) {
          // Chase the lowest flake that can still be caught.
          const next = w.flakes.filter(f => f.y < BASKET_Y).sort((a, b) => b.y - a.y)[0];
          setTarget(w, next ? next.x : null);
        }
        stepSnow(w);
      }
      return w;
    };
    for (const seed of [1, 2, 3, 4, 5]) {
      const keen = play(seed, true);
      const still = play(seed, false);
      const total = keen.caught + keen.missed + keen.flakes.length;
      expect(total, `seed ${seed}`).toBeGreaterThan(55);
      expect(total, `seed ${seed}`).toBeLessThan(95);
      expect(keen.score, `seed ${seed}`).toBeGreaterThan(45);
      expect(keen.score, `seed ${seed}`).toBeLessThan(130);
      expect(still.score, `seed ${seed}`).toBeLessThan(keen.score / 2);
    }
  });

  it('the winter bonus is 1 coin per flake, at most 30 a day', () => {
    expect(dailyBonus(12, 0)).toBe(12);
    expect(dailyBonus(40, 0)).toBe(DAILY_BONUS_CAP);
    expect(dailyBonus(12, 25)).toBe(5);
    expect(dailyBonus(12, 30)).toBe(0);
    expect(dailyBonus(12, 99)).toBe(0);
  });
});
