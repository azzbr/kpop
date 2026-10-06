import { describe, it, expect } from 'vitest';
import { buildOptions, checkFake, scoreBluff, pickPrompts, canPick, tidyFake, REAL_KEY } from './bluffBusterLogic';
import type { BluffPrompt } from '../../online/bluffFacts';
import { BLUFF_PROMPTS } from '../../online/bluffFacts';
import { createRng } from '../../games/engine/rng';

const P: BluffPrompt = { id: 't', text: 'A group of owls is a ___.', answer: 'parliament', fact: 'x' };
const Z: BluffPrompt = { id: 'z', text: 'Zebras: a ___.', answer: 'dazzle', alt: ['zeal'], fact: 'x' };

describe('Bluff Buster', () => {
  it('checks fakes', () => {
    expect(checkFake('', P)).toBe('empty');
    expect(checkFake('   ', P)).toBe('empty');
    expect(checkFake('HOOT', P)).toBe('ok');
    expect(checkFake('stupid', P)).toBe('unkind');
    expect(checkFake('PARLIAMENT', P)).toBe('real');
    expect(checkFake('parliment', P)).toBe('real'); // a near miss is still the truth
    expect(checkFake('the parliament', P)).toBe('real');
    expect(checkFake('zeal', Z)).toBe('real'); // alts count too
  });

  it('tidies fakes for showing', () => {
    expect(tidyFake('  HOOT   HOOT ')).toBe('hoot hoot');
    expect(tidyFake('ABCDEFGHIJKLMNOPQRSTUVWXYZ').length).toBe(20);
  });

  it('merges identical fakes and keeps the truth exactly once', () => {
    const opts = buildOptions({ a: 'HOOT', b: 'hoot', c: 'the hoot', d: 'parliament', e: 'wisdom' }, P, createRng(1));
    expect(opts.filter(o => o.key === REAL_KEY)).toHaveLength(1);
    expect(opts.filter(o => o.text === 'parliament')).toHaveLength(1);
    const hoot = opts.find(o => o.text === 'hoot');
    expect(hoot?.authors.sort()).toEqual(['a', 'b', 'c']);
    expect(opts).toHaveLength(3); // truth, hoot, wisdom (d's "fake" was the real answer)
  });

  it('shuffles with the seed', () => {
    const f = { a: 'one', b: 'two', c: 'three', d: 'four' };
    expect(buildOptions(f, P, createRng(7)).map(o => o.text)).toEqual(buildOptions(f, P, createRng(7)).map(o => o.text));
  });

  it('scores the truth and fooling friends', () => {
    const opts = buildOptions({ a: 'hoot', b: 'hoot', c: 'wisdom' }, P, createRng(2));
    const hoot = opts.find(o => o.text === 'hoot')!.key;
    const wis = opts.find(o => o.text === 'wisdom')!.key;
    // c picks hoot (fools a and b), a picks the truth, b picks wisdom (fools c), d picks hoot
    const pts = scoreBluff(opts, { c: hoot, a: REAL_KEY, b: wis, d: hoot });
    expect(pts).toEqual({ a: 2 + 2, b: 2, c: 1 });
  });

  it('refuses a pick of your own fake', () => {
    const opts = buildOptions({ a: 'hoot' }, P, createRng(3));
    const hoot = opts.find(o => o.text === 'hoot')!;
    expect(canPick(hoot, 'a')).toBe(false);
    expect(canPick(hoot, 'b')).toBe(true);
    expect(scoreBluff(opts, { a: hoot.key })).toEqual({});
    expect(scoreBluff(opts, { a: 'nope' })).toEqual({});
  });

  it('picks different prompts', () => {
    const ps = pickPrompts(5, createRng(4));
    expect(new Set(ps.map(p => p.id)).size).toBe(5);
    expect(pickPrompts(BLUFF_PROMPTS.length + 3).length).toBe(BLUFF_PROMPTS.length);
  });
});
