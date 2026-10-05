import { describe, it, expect } from 'vitest';
import {
  modeOf, assignTeams, teamSizes, applyPull, goalReached, clampTaps, tugRanking, addRocketTaps, rocketRanking,
  ROCKET_GOAL, MAX_TAPS_PER_MSG, PULL,
} from './teamTugLogic';

describe('Team Tug logic', () => {
  it('reads the mode from the lobby config', () => {
    expect(modeOf({ mode: 'rocket' })).toBe('rocket');
    expect(modeOf({ mode: 'tug' })).toBe('tug');
    expect(modeOf(undefined)).toBe('tug');
  });

  it('splits teams evenly and pulls fairly for team size', () => {
    const t = assignTeams(['a', 'b', 'c']);
    expect(t).toEqual({ a: 0, b: 1, c: 0 });
    expect(teamSizes(t)).toEqual([2, 1]);
    // two players tapping once each on team 0 pull as far as one player tapping once on team 1
    expect(applyPull(50, [2, 1], [2, 1])).toBe(50);
    expect(applyPull(50, [0, 1], [1, 1])).toBe(50 + PULL);
    expect(applyPull(1, [10, 0], [1, 1])).toBe(0);
    expect(goalReached(5)).toBe(0);
    expect(goalReached(95)).toBe(1);
    expect(goalReached(50)).toBe(null);
  });

  it('ignores silly tap counts', () => {
    expect(clampTaps(5)).toBe(5);
    expect(clampTaps(999)).toBe(MAX_TAPS_PER_MSG);
    expect(clampTaps(-3)).toBe(0);
    expect(clampTaps('x')).toBe(0);
  });

  it('ranks the winning team together', () => {
    expect(tugRanking({ a: 0, b: 1, c: 0 }, 0)).toEqual([['a', 'c'], ['b']]);
  });

  it('rocket: first to the moon wins, the rest by distance', () => {
    let p: Record<string, number> = { a: 0, b: 0, c: 0 };
    let landed = false;
    for (let i = 0; i < 20 && !landed; i++) ({ progress: p, landed } = addRocketTaps(p, 'a', 20));
    expect(landed).toBe(true);
    expect(p.a).toBe(ROCKET_GOAL);
    expect(addRocketTaps(p, 'a', 5).landed).toBe(false); // only once
    expect(addRocketTaps(p, 'zz', 5).progress).toBe(p); // not racing
    p = { ...p, b: 40, c: 40 };
    expect(rocketRanking(p, 'a')).toEqual(['a', ['b', 'c']]);
    expect(rocketRanking({ a: 150, b: 90, c: 10 }, 'a')).toEqual(['a', 'b', 'c']);
  });
});
