import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CHALLENGES, challengeFor } from './dailyChallenge';

function allSource(dir: string): string {
  return readdirSync(dir).map(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return allSource(p);
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? readFileSync(p, 'utf8') : '';
  }).join('\n');
}

describe('daily challenge', () => {
  const src = allSource(join(__dirname, '..'));

  it('is the same all day and changes between days', () => {
    expect(challengeFor('2026-10-04')).toEqual(challengeFor('2026-10-04'));
    const week = new Set(['01', '02', '03', '04', '05', '06', '07'].map(d => challengeFor(`2026-10-${d}`).gameId));
    expect(week.size).toBeGreaterThan(2);
  });

  it('every challenge points at a game that really submits that score id', () => {
    for (const c of ALL_CHALLENGES) {
      const submits = src.includes(`gameId="${c.gameId}"`) || src.includes(`finishRound('${c.gameId}'`);
      expect(submits, `${c.gameId} is never passed to finishRound/GameShell`).toBe(true);
      expect(src.includes(`${c.screen}: lazy(`), `screen ${c.screen} is not routed in App.tsx`).toBe(true);
    }
  });
});
