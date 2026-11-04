import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MASTERY, MASTERY_IDS, nextStarAt, prevStarAt, starsFor, starString, totalStars } from './mastery';
import { ALL_CHALLENGES } from '../utils/dailyChallenge';

function allSource(dir: string): string {
  return readdirSync(dir).map(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return allSource(p);
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? readFileSync(p, 'utf8') : '';
  }).join('\n');
}

describe('mastery stars data', () => {
  const src = allSource(join(__dirname, '..'));

  it('has 29 solo-game scores with rising thresholds that fit inside the maximum', () => {
    expect(MASTERY_IDS).toHaveLength(29);
    for (const id of MASTERY_IDS) {
      const { stars: [a, b, c], max } = MASTERY[id]!;
      expect(a, id).toBeGreaterThan(0);
      expect(b, id).toBeGreaterThan(a);
      expect(c, id).toBeGreaterThan(b);
      if (max !== undefined) expect(c, `${id}: 3★ above the max`).toBeLessThanOrEqual(max);
    }
  });

  it('every id is a real GameShell gameId and a routed screen', () => {
    for (const id of MASTERY_IDS) {
      expect(src.includes(`gameId="${id}"`), `${id} is never passed to GameShell`).toBe(true);
      const screen = MASTERY[id]!.screen ?? id;
      expect(src.includes(`${screen}: lazy(`), `${screen} is not routed in App.tsx`).toBe(true);
    }
  });

  it("each daily-challenge target sits between that game's 1★ and 3★", () => {
    for (const c of ALL_CHALLENGES) {
      const m = MASTERY[c.gameId];
      if (!m) continue; // Word Guess scores 0/1, so it has no stars.
      expect(c.target, c.gameId).toBeGreaterThanOrEqual(m.stars[0]);
      expect(c.target, c.gameId).toBeLessThanOrEqual(m.stars[2]);
    }
  });
});

describe('mastery helpers', () => {
  it('counts stars, the next and the previous threshold', () => {
    // paper_clash: 50 / 100 / 150
    expect([0, 49, 50, 99, 100, 150, 900].map(s => starsFor('paper_clash', s))).toEqual([0, 0, 1, 1, 2, 3, 3]);
    expect(nextStarAt('paper_clash', 0)).toBe(50);
    expect(nextStarAt('paper_clash', 120)).toBe(150);
    expect(nextStarAt('paper_clash', 150)).toBeNull();
    expect(prevStarAt('paper_clash', 0)).toBe(0);
    expect(prevStarAt('paper_clash', 120)).toBe(100);
  });

  it('games without stars give 0 and no next star', () => {
    expect(starsFor('word_guess', 1)).toBe(0);
    expect(nextStarAt('truth_or_dare', 5)).toBeNull();
    expect(starsFor('paper_clash', Number.NaN)).toBe(0);
  });

  it('totals stars over every game', () => {
    expect(totalStars({})).toEqual({ have: 0, of: 87 });
    expect(totalStars({ paper_clash: 150, game_2048: 2500, word_guess: 1 })).toEqual({ have: 5, of: 87 });
  });

  it('draws the star row', () => {
    expect(starString(0)).toBe('☆☆☆');
    expect(starString(2)).toBe('⭐⭐☆');
  });
});
