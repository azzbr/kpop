import { describe, it, expect } from 'vitest';
import { QUIP_PROMPTS } from './quipPrompts';
import { isRude } from './rudeWords';

describe('Quip Clash prompts', () => {
  it('has 200 different prompts', () => {
    expect(QUIP_PROMPTS.length).toBe(200);
    expect(new Set(QUIP_PROMPTS.map(p => p.toLowerCase())).size).toBe(QUIP_PROMPTS.length);
  });
  it('are short, tidy and kind', () => {
    for (const p of QUIP_PROMPTS) {
      expect(p.length, p).toBeGreaterThan(10);
      expect(p.length, p).toBeLessThanOrEqual(80);
      expect(p, p).toBe(p.trim());
      expect(isRude(p), p).toBe(false);
      expect(/\b(kill|dead|die|blood|weapon|hate)\b/i.test(p), p).toBe(false);
    }
  });
});
