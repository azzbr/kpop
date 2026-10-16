import { describe, it, expect } from 'vitest';
import {
  monsterPlan, assignParts, neighbours, makeSeams, pickThemes, roundsFrom, tidyName, prettyName, checkName,
  namersOf, votersOf, nameOptions, canVoteName, hasNameChoice, scoreNames,
} from './monsterMashLogic';
import { createRng } from '../../games/engine/rng';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('Monster Mash parts', () => {
  it('plans one monster for 3–5 players and two for 6', () => {
    expect(monsterPlan(3)).toEqual([['head', 'body', 'legs']]);
    expect(monsterPlan(4)).toEqual([['hat', 'head', 'body', 'legs']]);
    expect(monsterPlan(5)).toEqual([['hat', 'head', 'body', 'legs', 'feet']]);
    expect(monsterPlan(6)).toEqual([['head', 'body', 'legs'], ['head', 'body', 'legs']]);
    expect(monsterPlan(2)).toEqual([['head', 'body']]); // board mode with two players
  });

  it('fills every slot exactly once and gives everyone a new part each round', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const plan = monsterPlan(n);
      const total = plan.reduce((a, p) => a + p.length, 0);
      const seen: Record<string, Set<string>> = {};
      for (let r = 0; r < 3; r++) {
        const a = assignParts(ids(n), r);
        const slots = Object.values(a).map(s => `${s.monster}:${s.slot}`);
        if (n <= 6) expect(new Set(slots).size).toBe(total);
        for (const s of Object.values(a)) expect(plan[s.monster][s.slot]).toBe(s.part);
        for (const [id, s] of Object.entries(a)) (seen[id] ??= new Set()).add(s.part);
      }
      if (n >= 3 && n <= 6) for (const id of ids(n)) expect(seen[id].size).toBe(3);
    }
  });

  it('mixes the two teams of six every round', () => {
    const teams = [0, 1, 2].map(r => {
      const a = assignParts(ids(6), r);
      return ids(6).filter(id => a[id].monster === 0).join(',');
    });
    expect(new Set(teams).size).toBe(3);
  });

  it('knows the neighbouring parts and where they join', () => {
    const plan = monsterPlan(4);
    expect(neighbours(plan, { monster: 0, slot: 0, part: 'hat' })).toEqual({ above: undefined, below: 'head' });
    expect(neighbours(plan, { monster: 0, slot: 2, part: 'body' })).toEqual({ above: 'head', below: 'legs' });
    const seams = makeSeams(monsterPlan(6), createRng(4));
    expect(seams).toHaveLength(2);
    expect(seams[0]).toHaveLength(2);
    for (const xs of seams.flat()) for (const x of xs) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1); }
  });

  it('picks different themes and reads the rounds option', () => {
    const t = pickThemes(3, createRng(2));
    expect(new Set(t.map(x => x.id)).size).toBe(3);
    expect(roundsFrom('2')).toBe(2);
    expect(roundsFrom(undefined)).toBe(3);
  });
});

describe('Monster Mash names', () => {
  it('tidies, prettifies and checks names', () => {
    expect(tidyName('  sir   wobbles!! 3 ')).toBe('sir wobbles');
    expect(prettyName('CAPTAIN fluffy')).toBe('Captain Fluffy');
    expect(checkName('')).toBe('empty');
    expect(checkName('stinky')).toBe('unkind');
    expect(checkName('Mr Muffin')).toBe('ok');
  });

  it('two monsters: teams name the other monster and vote on their own', () => {
    const a = assignParts(ids(6), 0);
    const team0 = ids(6).filter(id => a[id].monster === 0);
    expect(votersOf(0, a, ids(6), 2)).toEqual(team0);
    expect(namersOf(0, a, ids(6), 2)).toEqual(ids(6).filter(id => !team0.includes(id)));
    expect(namersOf(0, a, ids(3), 1)).toEqual(ids(3));
  });

  it('merges names, refuses your own and scores votes', () => {
    const opts = nameOptions({ a: 'Mr Muffin', b: 'mr  muffin', c: 'Blobby', d: 'stinky' }, createRng(5));
    expect(opts).toHaveLength(2);
    const muffin = opts.find(o => o.text === 'Mr Muffin')!;
    const blobby = opts.find(o => o.text === 'Blobby')!;
    expect(muffin.authors).toEqual(['a', 'b']);
    expect(canVoteName(muffin, 'a')).toBe(false);
    expect(hasNameChoice([muffin], 'a')).toBe(false);
    const r = scoreNames(opts, { a: muffin.key, b: blobby.key, c: muffin.key, d: muffin.key });
    expect(r.points).toEqual({ a: 2, b: 2, c: 1 });
    expect(r.winners).toEqual([muffin.key]);
    expect(scoreNames(opts, {}).winners).toEqual([]);
  });
});
