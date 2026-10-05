import { describe, it, expect } from 'vitest';
import { buildCalls, dealCard, canMark, findLine, bingoRanking, CARD_SIZE } from './timesTableBingoLogic';
import { createRng } from '../../games/engine/rng';

describe('Times-Table Bingo logic', () => {
  it('calls correct sums, one per answer', () => {
    const calls = buildCalls(createRng(7));
    expect(calls.every(c => c.a * c.b === c.answer && c.a >= 2 && c.a <= 12 && c.b >= 2 && c.b <= 12)).toBe(true);
    expect(new Set(calls.map(c => c.answer)).size).toBe(calls.length);
  });

  it('deals 16 different numbers that will all be called (every card can win)', () => {
    const calls = buildCalls(createRng(1));
    const card = dealCard(calls, createRng(2));
    expect(card).toHaveLength(CARD_SIZE);
    expect(new Set(card).size).toBe(CARD_SIZE);
    const all = new Set(calls.map(c => c.answer));
    expect(card.every(v => all.has(v))).toBe(true);
  });

  it('only marks called numbers and spots lines', () => {
    const card = Array.from({ length: 16 }, (_, i) => i + 10);
    expect(canMark(card, 0, new Set([10]))).toBe(true);
    expect(canMark(card, 1, new Set([10]))).toBe(false);
    expect(canMark(card, 16, new Set([10]))).toBe(false);
    expect(findLine([0, 1, 2])).toBe(null);
    expect(findLine([5, 0, 15, 10])).toEqual([0, 5, 10, 15]);
  });

  it('ranks the winner first, then by squares marked', () => {
    expect(bingoRanking('a', { a: [1, 2, 3, 4], b: [1], c: [1], d: [] })).toEqual(['a', ['b', 'c'], 'd']);
    expect(bingoRanking(null, { a: [1], b: [1, 2] })).toEqual(['b', 'a']);
  });
});
