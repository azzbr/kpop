import { describe, it, expect } from 'vitest';
import { stepsFor, stepMode, bookOf, taskPayload, fileStep, revealCountAt, coopRanking, type Book } from './pictureTelephoneLogic';
import { placeScore } from '../../online/arenaRewards';

describe('Picture Telephone logic', () => {
  it('alternates draw / write and never hands a player their own book back', () => {
    expect([0, 1, 2].map(stepMode)).toEqual(['draw', 'write', 'draw']);
    for (const P of [3, 4, 5, 8, 12]) {
      const steps = stepsFor(P);
      for (let pi = 0; pi < P; pi++) {
        const seen = new Set<number>();
        for (let s = 0; s < steps; s++) seen.add(bookOf(pi, s, P));
        expect(seen.size).toBe(steps); // a different book every step
      }
      // every step, each book is worked on by exactly one player
      for (let s = 0; s < steps; s++) expect(new Set(Array.from({ length: P }, (_, pi) => bookOf(pi, s, P))).size).toBe(P);
    }
  });

  it('passes the previous entry on and fills gaps', () => {
    const order = ['a', 'b', 'c'];
    let books: Book[] = order.map((owner, i) => ({ owner, seed: ['cat', 'dog', 'sun'][i], entries: [] }));
    expect(taskPayload(books, 0, 0)).toBe('cat');
    books = fileStep(books, order, 0, { a: 'data:image/jpeg;A', b: 'data:image/jpeg;B' });
    expect(books[2].entries[0]).toEqual({ kind: 'draw', by: 'c', content: '' });
    // step 1: player b (index 1) works on book 0 → sees a's drawing
    expect(taskPayload(books, 1, 1)).toBe('data:image/jpeg;A');
    books = fileStep(books, order, 1, { b: 'kitten' });
    expect(books[0].entries[1]).toEqual({ kind: 'write', by: 'b', content: 'kitten' });
    expect(books[1].entries[1].content).toBe('???');
  });

  it('reveals the seed then one entry every 1.5 s', () => {
    expect(revealCountAt(0, 3)).toBe(1);
    expect(revealCountAt(1500, 3)).toBe(2);
    expect(revealCountAt(99999, 3)).toBe(4);
  });

  it('is cooperative: everyone gets the winner reward', () => {
    const r = coopRanking(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(placeScore(r, id)).toBe(100);
  });
});
