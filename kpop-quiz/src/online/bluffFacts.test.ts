import { describe, it, expect } from 'vitest';
import { BLUFF_PROMPTS } from './bluffFacts';
import { checkFake, truths } from '../components/online/bluffBusterLogic';
import { isClean } from '../utils/cleanText';

describe('Bluff Buster prompts', () => {
  it('has plenty of prompts with unique ids', () => {
    expect(BLUFF_PROMPTS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(BLUFF_PROMPTS.map(p => p.id)).size).toBe(BLUFF_PROMPTS.length);
    expect(new Set(BLUFF_PROMPTS.map(p => p.text)).size).toBe(BLUFF_PROMPTS.length);
  });

  it('every prompt has exactly one gap', () => {
    for (const p of BLUFF_PROMPTS) expect(p.text.split('___').length - 1, p.id).toBe(1);
  });

  it('answers can be typed on the on-screen keyboard', () => {
    for (const p of BLUFF_PROMPTS) for (const a of truths(p)) expect(a, p.id).toMatch(/^[a-z]([a-z ]{0,18}[a-z])?$/);
  });

  it('is clean and every fact is filled in', () => {
    for (const p of BLUFF_PROMPTS) {
      expect(isClean(`${p.text} ${p.answer} ${p.fact}`), p.id).toBe(true);
      expect(p.fact.length, p.id).toBeGreaterThan(10);
    }
  });

  it('the real answer (and every alt) is spotted as real', () => {
    for (const p of BLUFF_PROMPTS) for (const a of truths(p)) expect(checkFake(a, p), `${p.id}: ${a}`).toBe('real');
  });

  it('the answer is not given away in the text', () => {
    for (const p of BLUFF_PROMPTS) expect(p.text.toLowerCase().includes(p.answer), p.id).toBe(false);
  });
});
