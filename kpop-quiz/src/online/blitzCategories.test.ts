import { describe, it, expect } from 'vitest';
import { BLITZ_CATEGORIES, BLITZ_LETTERS } from './blitzCategories';
import { isClean } from '../utils/cleanText';

describe('Category Blitz content', () => {
  it('has 35–45 categories with unique ids and names', () => {
    expect(BLITZ_CATEGORIES.length).toBeGreaterThanOrEqual(35);
    expect(BLITZ_CATEGORIES.length).toBeLessThanOrEqual(45);
    expect(new Set(BLITZ_CATEGORIES.map(c => c.id)).size).toBe(BLITZ_CATEGORIES.length);
    expect(new Set(BLITZ_CATEGORIES.map(c => c.name)).size).toBe(BLITZ_CATEGORIES.length);
  });
  it('has at most 2 food categories', () => {
    expect(BLITZ_CATEGORIES.filter(c => c.food).length).toBeLessThanOrEqual(2);
  });
  it('uses only fair letters', () => {
    for (const l of 'QXZUVY') expect(BLITZ_LETTERS as readonly string[]).not.toContain(l);
    expect(new Set(BLITZ_LETTERS).size).toBe(BLITZ_LETTERS.length);
  });
  it('is clean', () => {
    for (const c of BLITZ_CATEGORIES) expect(isClean(c.name), c.id).toBe(true);
  });
});
