import { describe, it, expect } from 'vitest';
import { createRng } from '../games/engine/rng';
import { isClean } from '../utils/cleanText';
import {
  AGENT_WORDS, CODE_TYPES, EMOJI_KEY, GRID, allPuzzles, caesarShiftFor, checkAnswer, decode, encode, pickNext, puzzleId, hintFor,
} from './secretAgentLogic';

describe('word list', () => {
  it('has about 40 unique, clean, 4–8 letter words with no J', () => {
    expect(AGENT_WORDS.length).toBeGreaterThanOrEqual(36);
    expect(new Set(AGENT_WORDS).size).toBe(AGENT_WORDS.length);
    for (const w of AGENT_WORDS) {
      expect(w).toMatch(/^[A-IK-Z]{4,8}$/);
      expect(isClean(w)).toBe(true);
    }
  });

  it('has no K-Pop words', () => {
    for (const w of ['KPOP', 'IDOL', 'HUNTRX', 'STAGE']) expect(AGENT_WORDS).not.toContain(w);
  });
});

describe('codes', () => {
  it('every type round-trips for every word', () => {
    for (const w of AGENT_WORDS) for (const t of CODE_TYPES) {
      const p = encode(w, t);
      expect(decode(p)).toBe(w);
      expect(p.tokens.length).toBe(w.length);
    }
  });

  it('encodes known examples', () => {
    expect(encode('HI', 'number').tokens.join('-')).toBe('8-9');
    expect(encode('HELLO', 'reverse').tokens.join('')).toBe('OLLEH');
    expect(encode('HELLO', 'shift1').tokens.join('')).toBe('IFMMP');
    expect(encode('HELLO', 'caesar', 2).tokens.join('')).toBe('JGNNQ');
    expect(encode('ZEBRA', 'shift1').tokens.join('')).toBe('AFCSB');
    expect(encode('HE', 'grid').tokens.join('-')).toBe('23-15');
    expect(encode('HE', 'emoji').tokens.join('')).toBe('🐴🥚');
  });

  it('caesar shift is 2–5 and shown on the puzzle', () => {
    for (const w of AGENT_WORDS) {
      const n = caesarShiftFor(w);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
      expect(encode(w, 'caesar').param).toBe(n);
    }
  });

  it('emoji key has 26 different emoji and the grid has 25 letters', () => {
    expect(new Set(Object.values(EMOJI_KEY)).size).toBe(26);
    const g = GRID.flat();
    expect(g.length).toBe(25);
    expect(new Set(g).size).toBe(25);
    expect(g).not.toContain('J');
  });

  it('puzzle ids are unique', () => {
    const ids = allPuzzles().map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('checkAnswer', () => {
  it('ignores case and spaces', () => {
    expect(checkAnswer('rocket', 'ROCKET')).toBe(true);
    expect(checkAnswer(' Ro Cket ', 'ROCKET')).toBe(true);
    expect(checkAnswer('ROCKE', 'ROCKET')).toBe(false);
    expect(checkAnswer('', 'ROCKET')).toBe(false);
    expect(checkAnswer('   ', 'ROCKET')).toBe(false);
  });
});

describe('pickNext', () => {
  it('never returns the current puzzle', () => {
    const rng = createRng(42);
    let cur = pickNext([], rng);
    for (let i = 0; i < 500; i++) {
      const next = pickNext([], rng, cur.id);
      expect(next.id).not.toBe(cur.id);
      cur = next;
    }
  });

  it('prefers unsolved puzzles', () => {
    const all = allPuzzles().map(p => p.id);
    const left = puzzleId('grid', 'OCEAN');
    const solved = all.filter(id => id !== left);
    const rng = createRng(7);
    for (let i = 0; i < 20; i++) expect(pickNext(solved, rng).id).toBe(left);
  });

  it('still picks something different when everything is solved', () => {
    const all = allPuzzles().map(p => p.id);
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) expect(pickNext(all, rng, all[0]).id).not.toBe(all[0]);
  });

  it('avoids the only unsolved one if it is on screen', () => {
    const all = allPuzzles().map(p => p.id);
    const left = all[5];
    const p = pickNext(all.filter(id => id !== left), createRng(1), left);
    expect(p.id).not.toBe(left);
  });
});

describe('hintFor', () => {
  it('shows the first two letters', () => {
    expect(hintFor('ROCKET')).toBe('RO____');
    expect(hintFor('MOON')).toBe('MO__');
  });
});
