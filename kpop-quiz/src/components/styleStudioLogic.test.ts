import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOOK, VIBES, JUDGES, MAX_REWARDED_PER_DAY, scoreLook, rewardCheck, recordReward, rewardsLeft, emptyLog,
  parseLog, sanitizeLook, lookKey, type Look,
} from './styleStudioLogic';

const T = '2026-10-05';

describe('Style Studio runway', () => {
  it('scores are fixed for a look and within range', () => {
    const a = scoreLook(DEFAULT_LOOK);
    expect(scoreLook({ ...DEFAULT_LOOK })).toEqual(a);
    expect(a.judges).toHaveLength(JUDGES.length);
    for (const j of a.judges) { expect(j).toBeGreaterThanOrEqual(6); expect(j).toBeLessThanOrEqual(10); }
    expect(a.score).toBeGreaterThanOrEqual(18);
    expect(a.score).toBeLessThanOrEqual(37);
  });

  it('vibes add a bonus and have kind names', () => {
    const royal: Look = { ...DEFAULT_LOOK, hat: '👑', outfit: '👗' };
    const r = scoreLook(royal);
    expect(r.vibe?.id).toBe('royal');
    expect(r.score).toBe(r.judges.reduce((x, y) => x + y, 0) + 5);
    for (const v of VIBES) expect(v.name).not.toMatch(/idol|babe|k-?pop|huntr/i);
    expect(new Set(VIBES.map(v => v.id)).size).toBe(VIBES.length);
  });

  it('a look is rewarded once, and at most 3 a day', () => {
    let log = emptyLog(T);
    const looks: Look[] = [0, 1, 2, 3].map(bg => ({ ...DEFAULT_LOOK, bg }));
    expect(rewardCheck(log, looks[0], T).ok).toBe(true);
    log = recordReward(log, looks[0], T);
    expect(rewardCheck(log, looks[0], T)).toEqual({ ok: false, reason: 'seen' });
    log = recordReward(log, looks[1], T);
    log = recordReward(log, looks[2], T);
    expect(rewardsLeft(log, T)).toBe(0);
    expect(rewardCheck(log, looks[3], T)).toEqual({ ok: false, reason: 'limit' });
    // Next day: new looks are rewarded again, old ones still aren't.
    expect(rewardsLeft(log, '2026-10-06')).toBe(MAX_REWARDED_PER_DAY);
    expect(rewardCheck(log, looks[3], '2026-10-06').ok).toBe(true);
    expect(rewardCheck(log, looks[0], '2026-10-06').ok).toBe(false);
  });

  it('parses junk safely and repairs old looks', () => {
    expect(parseLog('x', T)).toEqual(emptyLog(T));
    expect(parseLog({ date: T, count: 2, looks: ['a', 3] }, T)).toEqual({ date: T, count: 2, looks: ['a'] });
    const old = sanitizeLook({ model: '👩', hat: '🪖', outfit: '👗', shoes: '👟', accessory: '🍭', bg: 9 });
    expect(old).toEqual({ ...DEFAULT_LOOK, outfit: '👗', shoes: '👟' });
    expect(sanitizeLook(null)).toBeNull();
    expect(lookKey(DEFAULT_LOOK)).toContain('|');
  });
});
