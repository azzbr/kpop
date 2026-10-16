import { describe, it, expect } from 'vitest';
import { CHARADE_PHRASES, CHARADE_CATS, EMOJI_GROUPS } from './charadePhrases';
import { isRude } from './rudeWords';
import { normaliseAnswer } from './quiz/quizLogic';

describe('Emoji Charades content', () => {
  it('has 150 different phrases with categories and levels', () => {
    expect(CHARADE_PHRASES.length).toBe(150);
    expect(new Set(CHARADE_PHRASES.map(p => normaliseAnswer(p.text))).size).toBe(150);
    for (const p of CHARADE_PHRASES) {
      expect(CHARADE_CATS[p.cat], p.text).toBeDefined();
      expect([1, 2, 3]).toContain(p.level);
      expect(p.text, p.text).toMatch(/^[a-z][a-z ]*[a-z]$/);
      expect(p.text.split(' ').length, p.text).toBeLessThanOrEqual(4);
      expect(isRude(p.text), p.text).toBe(false);
      for (const a of p.alt ?? []) expect(a, a).toMatch(/^[a-z][a-z ]*[a-z]$/);
    }
  });
  it('covers every category and level', () => {
    for (const c of Object.keys(CHARADE_CATS)) expect(CHARADE_PHRASES.filter(p => p.cat === c).length, c).toBeGreaterThanOrEqual(10);
    for (const l of [1, 2, 3]) expect(CHARADE_PHRASES.filter(p => p.level === l).length).toBeGreaterThanOrEqual(30);
  });
  it('has a big emoji picker with no letters, numbers or repeats', () => {
    const all = EMOJI_GROUPS.flatMap(g => g.emoji);
    expect(all.length).toBeGreaterThanOrEqual(300);
    expect(new Set(all).size).toBe(all.length);
    for (const e of all) {
      expect(/[A-Za-z0-9]/.test(e), e).toBe(false);
      expect(/\p{Extended_Pictographic}/u.test(e), e).toBe(true);
      expect(/[\u{1F1E6}-\u{1F1FF}]/u.test(e), e).toBe(false); // flag letters
      expect(e.includes('⃣'), e).toBe(false); // keycaps
    }
  });
});
