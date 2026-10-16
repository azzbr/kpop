import { describe, it, expect } from 'vitest';
import { DECOY_PROMPTS } from './decoyPrompts';
import { titleKey, MAX_TITLE } from '../components/online/doodleDecoyLogic';
import { isKidSafe } from './rudeWords';

const NOT_FOR_KIDS = /\b(scary|scare|blood|kill|dead|die|zombie|skull|creep|evil|ghost|vampire|knife|gun|sword|fight|attack|horror|spooky|bite|weapon|monster)/;

describe('Doodle Decoy prompts', () => {
  it('has 120 different prompts', () => {
    expect(DECOY_PROMPTS).toHaveLength(120);
    expect(new Set(DECOY_PROMPTS).size).toBe(120);
    // no two prompts count as "the same title" either
    expect(new Set(DECOY_PROMPTS.map(titleKey)).size).toBe(120);
  });

  it('are short, lower case, drawable phrases', () => {
    for (const p of DECOY_PROMPTS) {
      expect(p, p).toMatch(/^(a|an) [a-z ]+$/);
      expect(p.length, p).toBeLessThanOrEqual(MAX_TITLE);
      expect(p.split(' ').length, p).toBeGreaterThanOrEqual(3);
    }
  });

  it('are kind and never scary', () => {
    for (const p of DECOY_PROMPTS) {
      expect(isKidSafe(p), p).toBe(true);
      expect(NOT_FOR_KIDS.test(p), p).toBe(false);
    }
  });
});
