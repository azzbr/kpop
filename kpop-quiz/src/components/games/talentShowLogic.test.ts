import { describe, expect, it } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { cheerFor, dealIdeas, judgesFor, showAwards, showScore, CHEERS, MAX_JUDGES, STAR_LABELS, TALENT_IDEAS, TOP_AWARD } from './talentShowLogic';

describe('talentShowLogic', () => {
  it('has plenty of G-rated ideas with no K-pop / idol wording', () => {
    expect(TALENT_IDEAS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(TALENT_IDEAS).size).toBe(TALENT_IDEAS.length);
    for (const t of TALENT_IDEAS) expect(t).not.toMatch(/k-?pop|k-?drama|idol|kill|blood/i);
  });

  it('labels and cheers are all kind', () => {
    const lines = [...Object.values(STAR_LABELS), ...Object.values(CHEERS).flat()];
    for (const l of lines) expect(l).not.toMatch(/💀|💩|honest|bad|worst|terrible|nope/i);
    expect(Object.keys(STAR_LABELS)).toEqual(['1', '2', '3', '4', '5']);
    expect(cheerFor(1, createRng(1))).toBeTruthy();
  });

  it('judges are the other players, at most 3', () => {
    expect(judgesFor(['A', 'B'], 0)).toEqual([1]);
    expect(judgesFor(['A', 'B', 'C', 'D', 'E'], 3)).toEqual([4, 0, 1]);
    for (let p = 0; p < 6; p++) {
      const j = judgesFor(['a', 'b', 'c', 'd', 'e', 'f'], p);
      expect(j).not.toContain(p);
      expect(j.length).toBe(MAX_JUDGES);
    }
  });

  it('deals different ideas', () => {
    const a = dealIdeas(createRng(1));
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
  });

  it('everyone gets an award; the best average is Star of the Show', () => {
    const acts = [
      { performer: 'Mia', talent: 'x', stars: [3, 4] },
      { performer: 'Leo', talent: 'y', stars: [5, 5] },
      { performer: 'Ava', talent: 'z', stars: [2, 3] },
    ];
    const awards = showAwards(acts);
    expect(awards.find(a => a.performer === 'Leo')!.award).toBe(TOP_AWARD);
    expect(awards.filter(a => a.award === TOP_AWARD)).toHaveLength(1);
    expect(new Set(awards.map(a => a.award)).size).toBe(3);
    expect(showScore(acts)).toBe(22);
  });
});
