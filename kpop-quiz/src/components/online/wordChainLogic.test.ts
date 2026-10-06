import { describe, it, expect } from 'vitest';
import { checkWord, cleanWord, nextAlive, loseHeart, knockOut, resolveVote, chainRanking, inDictionary } from './wordChainLogic';

const base = () => ({ hearts: { a: 3, b: 1, c: 2 }, alive: ['a', 'b', 'c'], outAt: {} as Record<string, number> });

describe('Word Chain', () => {
  it('needs the last letter, 3+ letters and no repeats', () => {
    expect(checkWord('tiger', 'cat', [])).toBe('ok');
    expect(checkWord('Tiger!', 'cat', [])).toBe('ok');
    expect(checkWord('dog', 'cat', [])).toBe('letter');
    expect(checkWord('to', 'cat', [])).toBe('short');
    expect(checkWord('tiger', 'cat', ['cat', 'tiger'])).toBe('used');
    expect(checkWord('apple', '', [])).toBe('ok');
    expect(cleanWord(' Big Cat ')).toBe('bigcat');
  });

  it('knows dictionary words', () => {
    expect(inDictionary('elephant')).toBe(true);
    expect(inDictionary('flurb')).toBe(false);
  });

  it('skips players who are out', () => {
    expect(nextAlive(['a', 'b', 'c'], ['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextAlive(['a', 'b', 'c'], ['a', 'c'], 'a')).toBe('c');
    expect(nextAlive(['a', 'b', 'c'], ['a', 'c'], 'c')).toBe('a');
    expect(nextAlive(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('a'); // c just went out
    expect(nextAlive(['a', 'b', 'c'], ['a'], 'a')).toBeNull();
  });

  it('takes hearts and knocks out at 0', () => {
    let s = loseHeart(base(), 'a', 1);
    expect(s.hearts.a).toBe(2);
    expect(s.alive).toContain('a');
    s = loseHeart(s, 'b', 2);
    expect(s.alive).toEqual(['a', 'c']);
    expect(s.outAt.b).toBe(2);
    expect(knockOut(s, 'c', 3).alive).toEqual(['a']);
  });

  it('accepts a made-up word only with more 👍 than 👎', () => {
    expect(resolveVote(2, 1)).toBe(true);
    expect(resolveVote(1, 1)).toBe(false);
    expect(resolveVote(0, 0)).toBe(false);
  });

  it('ranks the survivor first, then by who went out later', () => {
    const s = { hearts: { a: 2, b: 0, c: 0, d: 0 }, alive: ['a'], outAt: { b: 5, c: 2, d: 5 } };
    expect(chainRanking(s, ['a', 'b', 'c', 'd'])).toEqual(['a', ['b', 'd'], 'c']);
  });

  it('after the cap, ranks players still in by hearts', () => {
    const s = { hearts: { a: 2, b: 3, c: 2, d: 0 }, alive: ['a', 'b', 'c'], outAt: { d: 4 } };
    expect(chainRanking(s, ['a', 'b', 'c', 'd'])).toEqual(['b', ['a', 'c'], 'd']);
  });
});
