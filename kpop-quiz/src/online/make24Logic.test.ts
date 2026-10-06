import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { MK_DIFF, mkCheck, mkGenerate, mkInit, mkMerge, mkProgress, mkSolved, solveMake } from './make24Logic';

describe('Make 24', () => {
  it('every generated target can be reached (checked with a solver)', () => {
    for (const d of Object.keys(MK_DIFF)) {
      const spec = MK_DIFF[d];
      for (let seed = 1; seed <= (d === 'legend' ? 15 : 60); seed++) {
        const p = mkGenerate(d, createRng(seed));
        expect(p.nums).toHaveLength(spec.count);
        const steps = solveMake(p.nums, p.target);
        expect(steps, `${d} ${p.nums} → ${p.target}`).not.toBeNull();
        expect(mkCheck(p, steps)).toBe(true);
      }
    }
  });

  it('host check rejects wrong or incomplete answers', () => {
    const p = { nums: [2, 3, 4, 6], target: 24 };
    expect(mkCheck(p, [{ a: 6, b: 4, op: '×' }, { a: 24, b: 3, op: '−' }, { a: 21, b: 2, op: '+' }])).toBe(false);
    expect(mkCheck(p, [{ a: 6, b: 4, op: '×' }])).toBe(false);
    expect(mkCheck(p, [{ a: 7, b: 4, op: '×' }, { a: 28, b: 3, op: '−' }, { a: 25, b: 2, op: '−' }])).toBe(false);
    // 3 ÷ 2 isn't a whole number
    expect(mkCheck({ nums: [3, 2], target: 1 }, [{ a: 3, b: 2, op: '÷' }])).toBe(false);
    expect(mkCheck(p, null)).toBe(false);
  });

  it('merging cards on the board reaches the target and replays on the host', () => {
    const p = { nums: [2, 3, 4], target: 20 };
    let s = mkInit(p);
    s = mkMerge(s, 0, 1, '+')!; // 5
    expect(mkProgress(p, s)).toBeGreaterThan(0);
    const five = s.cards.find(c => c.value === 5)!;
    s = mkMerge(s, five.id, 2, '×')!; // 20
    expect(mkSolved(p, s)).toBe(true);
    expect(mkCheck(p, s.steps)).toBe(true);
    expect(mkMerge(mkInit({ nums: [3, 2], target: 1 }), 0, 1, '÷')).toBeNull();
  });
});
