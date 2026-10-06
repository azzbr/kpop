import { describe, it, expect } from 'vitest';
import { CHAIN_WORDS, START_WORDS } from './wordChainWords';
import { BLOCKLIST } from '../data/words5Answers';
import { isRude } from './rudeWords';

describe('Word Chain dictionary', () => {
  it('has the everyday words', () => {
    for (const w of ['cat', 'elephant', 'apple', 'tiger', 'rainbow', 'dog']) expect(CHAIN_WORDS.has(w), w).toBe(true);
    expect(CHAIN_WORDS.size).toBeGreaterThan(10000);
  });
  it('has no blocked or rude words', () => {
    for (const w of BLOCKLIST) expect(CHAIN_WORDS.has(w), w).toBe(false);
    for (const w of ['bitch', 'penis', 'boobs', 'drugs', 'stupid', 'butts']) expect(CHAIN_WORDS.has(w), w).toBe(false);
    for (const w of CHAIN_WORDS) expect(isRude(w), w).toBe(false);
    for (const w of CHAIN_WORDS) expect(w).toMatch(/^[a-z]{3,}$/);
  });
  it('start words are friendly dictionary words', () => {
    expect(START_WORDS.length).toBeGreaterThan(200);
    for (const w of START_WORDS) {
      expect(CHAIN_WORDS.has(w), w).toBe(true);
      expect(w).not.toMatch(/[jqxzy]$/);
    }
  });
  it('keeps everyday words the rude filter must not catch', () => {
    for (const w of ['hello', 'title', 'grape', 'class', 'scrape', 'assist', 'weeds']) expect(isRude(w), w).toBe(false);
  });
});
