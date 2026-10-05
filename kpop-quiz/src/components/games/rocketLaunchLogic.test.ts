import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  makeTargets, isReachable, newRound, reduceRound, simulate, segmentHits,
  TARGETS_PER_ROUND, TRIES_PER_TARGET, MAX_SCORE, W, GROUND_Y,
} from './rocketLaunchLogic';
import type { RoundState, Target } from './rocketLaunchLogic';

const T: Target = { x: 400, y: 300, radius: 30 };

describe('rocket launch targets', () => {
  it('makes 5 reachable, separate targets on screen for many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const ts = makeTargets(createRng(seed));
      expect(ts).toHaveLength(TARGETS_PER_ROUND);
      for (const t of ts) {
        expect(isReachable(t)).toBe(true);
        expect(t.x).toBeGreaterThan(150);
        expect(t.x + t.radius).toBeLessThan(W);
        expect(t.y + t.radius).toBeLessThan(GROUND_Y);
        expect(t.y - t.radius).toBeGreaterThan(0);
      }
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
        expect(Math.hypot(ts[i].x - ts[j].x, ts[i].y - ts[j].y)).toBeGreaterThan(ts[i].radius + ts[j].radius);
      }
    }
  });

  it('is repeatable with the same seed and different with another', () => {
    expect(makeTargets(createRng(7))).toEqual(makeTargets(createRng(7)));
    expect(makeTargets(createRng(7))).not.toEqual(makeTargets(createRng(8)));
  });

  it('sweeps the rocket path so fast shots cannot skip through a target', () => {
    expect(segmentHits(360, 300, 440, 300, T)).toBe(true);
    expect(segmentHits(360, 200, 440, 200, T)).toBe(false);
  });

  it('a feeble shot misses a far target', () => {
    expect(simulate(45, 10, { x: 700, y: 300, radius: 26 }).hit).toBe(false);
  });
});

function play(s: RoundState, hits: boolean[]): RoundState {
  for (const hit of hits) {
    s = reduceRound(s, { type: 'launch' });
    s = reduceRound(s, { type: 'landed', hit });
    s = reduceRound(s, { type: 'next' });
  }
  return s;
}

describe('rocket launch round', () => {
  const targets = makeTargets(createRng(3));

  it('ends after the last target is hit, with full marks for first-try hits', () => {
    const s = play(newRound(targets), [true, true, true, true, true]);
    expect(s.phase).toBe('done');
    expect(s.hits).toBe(5);
    expect(s.score).toBe(MAX_SCORE);
  });

  it('ends when the tries run out on the last target (the old bug)', () => {
    const misses = Array(TARGETS_PER_ROUND * TRIES_PER_TARGET).fill(false);
    const s = play(newRound(targets), misses);
    expect(s.phase).toBe('done');
    expect(s.score).toBe(0);
    // Nothing can restart it: no more launches, no late "next".
    expect(reduceRound(s, { type: 'launch' })).toBe(s);
    expect(reduceRound(s, { type: 'next' })).toBe(s);
  });

  it('moves on after 3 misses and scores spare tries', () => {
    let s = play(newRound(targets), [false, false, false]);
    expect(s.index).toBe(1);
    expect(s.triesLeft).toBe(TRIES_PER_TARGET);
    expect(s.shotsAtTarget).toBe(0);
    s = play(s, [false, true]); // second try: 100 + 1 spare × 30
    expect(s.score).toBe(130);
    expect(s.index).toBe(2);
  });

  it('ignores launches during flight and results', () => {
    let s = reduceRound(newRound(targets), { type: 'launch' });
    expect(reduceRound(s, { type: 'launch' })).toBe(s);
    s = reduceRound(s, { type: 'landed', hit: false });
    expect(reduceRound(s, { type: 'launch' })).toBe(s);
    expect(reduceRound(s, { type: 'landed', hit: true })).toBe(s);
  });

  it('counts shots per target for the aim preview', () => {
    let s = newRound(targets);
    expect(s.shotsAtTarget).toBe(0);
    s = play(s, [false]);
    expect(s.shotsAtTarget).toBe(1);
  });
});
