import { describe, it, expect } from 'vitest';
import { ALLOWED_5 } from './words5Allowed';
import { ANSWERS_5, BLOCKLIST } from './words5Answers';

const allowedList = ALLOWED_5.split('\n');
const allowed = new Set(allowedList);

describe('Word Guess word lists', () => {
  it('allowed list is large and every entry is 5 lowercase letters', () => {
    expect(allowedList.length).toBeGreaterThan(5000);
    for (const w of allowedList) expect(w).toMatch(/^[a-z]{5}$/);
    expect(allowed.size).toBe(allowedList.length);
  });

  it('answers are 5 lowercase letters and unique', () => {
    expect(ANSWERS_5.length).toBeGreaterThanOrEqual(500);
    for (const w of ANSWERS_5) expect(w).toMatch(/^[a-z]{5}$/);
    expect(new Set(ANSWERS_5).size).toBe(ANSWERS_5.length);
  });

  it('every answer is an allowed guess', () => {
    const missing = ANSWERS_5.filter((w) => !allowed.has(w));
    expect(missing).toEqual([]);
  });

  it('no answer is on the blocklist', () => {
    const blocked = new Set(BLOCKLIST);
    expect(ANSWERS_5.filter((w) => blocked.has(w))).toEqual([]);
  });
});
