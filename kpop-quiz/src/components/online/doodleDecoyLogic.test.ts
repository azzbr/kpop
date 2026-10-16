import { describe, it, expect } from 'vitest';
import {
  titleKey, tidyTitle, checkTitle, buildOptions, canVote, votersFor, scoreDrawing, dealPrompts, drawingOrder, REAL_KEY,
} from './doodleDecoyLogic';
import { createRng } from '../../games/engine/rng';

describe('Doodle Decoy titles', () => {
  it('matches titles loosely', () => {
    expect(titleKey('A Cat riding a  skateboard!')).toBe('cat riding skateboard');
    expect(titleKey('the cat riding skateboard')).toBe(titleKey('a cat riding a skateboard'));
    expect(tidyTitle('  Big   DOG!! ')).toBe('big dog');
  });

  it('refuses empty and unkind titles', () => {
    expect(checkTitle('  ')).toBe('empty');
    expect(checkTitle('the')).toBe('empty');
    expect(checkTitle('a stupid dog')).toBe('unkind');
    expect(checkTitle('a dancing dog')).toBe('ok');
  });

  it('merges duplicate fakes and counts typing the real title as a find', () => {
    const { options, typedReal } = buildOptions('a cat riding a skateboard', {
      b: 'a dog on a bike', c: 'Dog on a bike', d: 'cat riding skateboard', e: 'a stupid cat',
    }, createRng(3));
    expect(typedReal).toEqual(['d']);
    expect(options).toHaveLength(2);
    const fake = options.find(o => o.key !== REAL_KEY)!;
    expect(fake.authors).toEqual(['b', 'c']);
    expect(fake.text).toBe('a dog on a bike');
    expect(options.find(o => o.key === REAL_KEY)!.text).toBe('a cat riding a skateboard');
  });
});

describe('Doodle Decoy votes and points', () => {
  const real = 'a frog playing guitar';
  const { options, typedReal } = buildOptions(real, { b: 'a frog singing', c: 'a green banjo', d: 'frog playing guitar' }, createRng(1));
  const key = (text: string) => options.find(o => o.text === text)!.key;

  it('only lets the right people vote', () => {
    const real = options.find(o => o.key === REAL_KEY);
    expect(canVote(real, 'a', 'a', typedReal)).toBe(false); // the artist
    expect(canVote(real, 'd', 'a', typedReal)).toBe(false); // already found it
    expect(canVote(options.find(o => o.text === 'a frog singing'), 'b', 'a', typedReal)).toBe(false); // own fake
    expect(canVote(real, 'b', 'a', typedReal)).toBe(true);
    expect(votersFor(['a', 'b', 'c', 'd'], 'a', typedReal)).toEqual(['b', 'c']);
  });

  it('scores spotting, fooling and the artist', () => {
    const pts = scoreDrawing(options, { b: REAL_KEY, c: key('a frog singing'), a: REAL_KEY, d: REAL_KEY }, typedReal, 'a');
    // b +2 spotted, +1 fooled c · d +2 typed it · artist +1 for b, +1 for d · votes by a and d don't count
    expect(pts).toEqual({ b: 3, d: 2, a: 2 });
  });
});

describe('Doodle Decoy dealing', () => {
  it('deals different prompts and orders only real drawings', () => {
    const p = dealPrompts(8, createRng(9));
    expect(new Set(p).size).toBe(8);
    const order = drawingOrder(['a', 'b', 'c'], { a: 'decoy.a', c: 'decoy.c' }, createRng(2));
    expect(order.sort()).toEqual(['a', 'c']);
  });
});
