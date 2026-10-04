import { describe, it, expect } from 'vitest';
import { WOULD_YOU_RATHER, WYR_REACTIONS } from './wouldYouRather';
import { REAL_OR_FAKE } from './realOrFake';

describe('Would You Rather', () => {
  it('has 120 questions', () => {
    expect(WOULD_YOU_RATHER).toHaveLength(120);
  });

  it('options are short, non-empty and have no prefix', () => {
    for (const q of WOULD_YOU_RATHER) {
      for (const s of [q.a, q.b]) {
        expect(s.trim().length).toBeGreaterThan(0);
        expect(s.length).toBeLessThanOrEqual(60);
        expect(s.toLowerCase()).not.toMatch(/would you rather/);
      }
      expect(q.a).not.toBe(q.b);
      expect(q.emojiA.length).toBeGreaterThan(0);
      expect(q.emojiB.length).toBeGreaterThan(0);
    }
  });

  it('questions are unique', () => {
    const keys = WOULD_YOU_RATHER.map((q) => `${q.a.toLowerCase()}|${q.b.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    const options = WOULD_YOU_RATHER.flatMap((q) => [q.a.toLowerCase(), q.b.toLowerCase()]);
    expect(new Set(options).size).toBe(options.length);
  });

  it('aPct is an integer between 20 and 80 and varies', () => {
    for (const q of WOULD_YOU_RATHER) {
      expect(Number.isInteger(q.aPct)).toBe(true);
      expect(q.aPct).toBeGreaterThanOrEqual(20);
      expect(q.aPct).toBeLessThanOrEqual(80);
    }
    expect(new Set(WOULD_YOU_RATHER.map((q) => q.aPct)).size).toBeGreaterThan(20);
  });

  it('has 20 unique reactions', () => {
    expect(WYR_REACTIONS).toHaveLength(20);
    expect(new Set(WYR_REACTIONS).size).toBe(20);
  });
});

describe('Real or Fake', () => {
  it('has 80 facts, about half real', () => {
    expect(REAL_OR_FAKE).toHaveLength(80);
    const real = REAL_OR_FAKE.filter((x) => x.real).length;
    expect(real).toBeGreaterThanOrEqual(35);
    expect(real).toBeLessThanOrEqual(45);
  });

  it('texts are short and unique, with an explanation and emoji', () => {
    for (const x of REAL_OR_FAKE) {
      expect(x.text.trim().length).toBeGreaterThan(0);
      expect(x.text.length).toBeLessThanOrEqual(120);
      expect(x.explain.trim().length).toBeGreaterThan(0);
      expect(x.emoji.length).toBeGreaterThan(0);
    }
    const texts = REAL_OR_FAKE.map((x) => x.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
});
