import { describe, it, expect } from 'vitest';
import {
  stepsFor, stepMode, stepMs, bookOf, taskPayload, fileStep, bookPages, stepReveal, canVote, doneVoting, tallyAwards,
  sheetLayout, picId, tidyText, startMode, START_MS, DRAW_MS, WRITE_MS, MAX_STEPS, type Book, type Page, type Votes,
} from './pictureTelephoneLogic';

describe('Picture Telephone chain', () => {
  it('always ends on a guess and never hands a player the same book twice', () => {
    for (const start of ['cards', 'write'] as const) {
      for (const P of [3, 4, 5, 6, 7, 8, 9, 12]) {
        const steps = stepsFor(P, start);
        expect(steps).toBeLessThanOrEqual(Math.min(P, MAX_STEPS));
        expect(stepMode(steps - 1, start)).toBe('write');
        for (let pi = 0; pi < P; pi++) {
          const seen = new Set<number>();
          for (let s = 0; s < steps; s++) seen.add(bookOf(pi, s, P));
          expect(seen.size).toBe(steps);
        }
        for (let s = 0; s < steps; s++) expect(new Set(Array.from({ length: P }, (_, pi) => bookOf(pi, s, P))).size).toBe(P);
      }
    }
    expect(stepsFor(3, 'cards')).toBe(2);
    expect(stepsFor(4, 'cards')).toBe(4);
    expect(stepsFor(3, 'write')).toBe(3);
    expect(stepsFor(4, 'write')).toBe(3);
    expect(stepsFor(12, 'cards')).toBe(8);
    expect(stepsFor(12, 'write')).toBe(9);
    // board mode with only two players still gets a chain that ends on a guess
    expect(stepMode(stepsFor(2, 'write') - 1, 'write')).toBe('write');
  });

  it('alternates draw and write from the right start', () => {
    expect([0, 1, 2, 3].map(s => stepMode(s, 'cards'))).toEqual(['draw', 'write', 'draw', 'write']);
    expect([0, 1, 2].map(s => stepMode(s, 'write'))).toEqual(['write', 'draw', 'write']);
    expect(stepMs(0, 'write')).toBe(START_MS);
    expect(stepMs(1, 'write')).toBe(DRAW_MS);
    expect(stepMs(1, 'cards')).toBe(WRITE_MS);
    expect(startMode('write')).toBe('write');
    expect(startMode(undefined)).toBe('cards');
  });

  it('passes the previous page on and fills gaps', () => {
    const order = ['a', 'b', 'c'];
    let books: Book[] = order.map((owner, i) => ({ owner, seed: ['cat', 'dog', 'sun'][i], entries: [] }));
    expect(taskPayload(books, 0, 0)).toBe('cat');
    books = fileStep(books, order, 0, { a: picId(0, 'a'), b: picId(0, 'b') });
    expect(books[2].entries[0]).toEqual({ kind: 'draw', by: 'c', content: '' });
    expect(taskPayload(books, 1, 1)).toBe('pt0.a');
    books = fileStep(books, order, 1, { b: 'kitten' });
    expect(books[0].entries[1]).toEqual({ kind: 'write', by: 'b', content: 'kitten' });
    expect(books[1].entries[1].content).toBe('???');
  });

  it('write mode: a missing start falls back to the word card', () => {
    const order = ['a', 'b', 'c'];
    let books: Book[] = order.map((owner, i) => ({ owner, seed: ['cat', 'dog', 'sun'][i], entries: [] }));
    expect(taskPayload(books, 0, 0, 'write')).toBe('');
    books = fileStep(books, order, 0, { a: 'a frog on a bike', b: '' }, 'write');
    expect(books[0].entries[0]).toEqual({ kind: 'write', by: 'a', content: 'a frog on a bike' });
    expect(books[1].entries[0].content).toBe('dog');
    expect(books[2].entries[0].content).toBe('sun');
    expect(taskPayload(books, 1, 1, 'write')).toBe('a frog on a bike');
    expect(bookPages(books[0], 0, 'write')[0]).toMatchObject({ kind: 'start', by: 'a', key: '0:0' });
  });

  it('tidies typed text', () => {
    expect(tidyText('  a   big   dog ')).toBe('a big dog');
    expect(tidyText('x'.repeat(50))).toHaveLength(32);
  });
});

describe('Picture Telephone reveal and votes', () => {
  const books: Book[] = [
    { owner: 'a', seed: 'cat', entries: [{ kind: 'draw', by: 'a', content: 'pt0.a' }, { kind: 'write', by: 'b', content: 'tiger' }] },
    { owner: 'b', seed: 'sun', entries: [{ kind: 'draw', by: 'b', content: '' }, { kind: 'write', by: 'a', content: '???' }] },
  ];
  const all: Page[][] = books.map((b, i) => bookPages(b, i));

  it('lists the card first, then every page', () => {
    expect(all[0].map(p => p.kind)).toEqual(['seed', 'draw', 'write']);
    expect(all[0].map(p => p.key)).toEqual(['0:card', '0:0', '0:1']);
  });

  it('steps through books page by page', () => {
    const counts = all.map(p => p.length);
    expect(stepReveal({ book: 0, page: 0 }, counts, 1)).toEqual({ book: 0, page: 1 });
    expect(stepReveal({ book: 0, page: 2 }, counts, 1)).toEqual({ book: 1, page: 0 });
    expect(stepReveal({ book: 1, page: 2 }, counts, 1)).toBe('end');
    expect(stepReveal({ book: 1, page: 0 }, counts, -1)).toEqual({ book: 0, page: 2 });
    expect(stepReveal({ book: 0, page: 0 }, counts, -1)).toEqual({ book: 0, page: 0 });
  });

  it('never lets you vote for your own page, blanks or the card', () => {
    expect(canVote(all[0][1], 'a', 'art')).toBe(false); // own drawing
    expect(canVote(all[0][1], 'b', 'art')).toBe(true);
    expect(canVote(all[0][2], 'a', 'art')).toBe(false); // a guess isn't a drawing
    expect(canVote(all[0][2], 'a', 'fun')).toBe(true);
    expect(canVote(all[1][1], 'a', 'art')).toBe(false); // blank
    expect(canVote(all[1][2], 'b', 'fun')).toBe(false); // ???
    expect(canVote(all[0][0], 'b', 'fun')).toBe(false); // the card
  });

  it('counts a voter with nothing left to pick as done', () => {
    const votes: Votes = { fun: { b: '0:1' }, art: {} };
    expect(doneVoting(all, votes, 'b')).toBe(false); // b can still vote 🎨 for a's drawing
    expect(doneVoting(all, { fun: { a: '0:1' }, art: {} }, 'a')).toBe(true); // no drawings by others
  });

  it('gives a point per vote and finds the winners', () => {
    const votes: Votes = { fun: { a: '0:1', c: '0:1', b: '0:0' }, art: { b: '0:0', c: '0:0', a: '0:0' } };
    const r = tallyAwards(all, votes, ['a', 'b', 'c']);
    expect(r.fun).toEqual([{ key: '0:1', votes: 2 }]);
    expect(r.art).toEqual([{ key: '0:0', votes: 2 }]); // a's own vote doesn't count
    expect(r.points).toEqual({ a: 3, b: 2, c: 0 });
    expect(tallyAwards(all, { fun: {}, art: {} }, ['a']).fun).toEqual([]);
  });

  it('lays out a book sheet inside the board', () => {
    for (let n = 1; n <= 10; n++) {
      const cells = sheetLayout(n);
      expect(cells).toHaveLength(n);
      for (const c of cells) {
        expect(c.x + c.w).toBeLessThanOrEqual(1200.001);
        expect(c.y + c.h).toBeLessThanOrEqual(900.001);
        expect(c.y).toBeGreaterThanOrEqual(90);
      }
    }
  });
});
