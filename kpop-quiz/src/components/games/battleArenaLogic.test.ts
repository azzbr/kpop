import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  HEROES, VILLAINS, MOVES, CHEERS, MISS_LINES, GUARD_LINES, calcDamage, resolveTurn, newFighter,
  outcome, matchScore, cpuMove, SPECIAL_COST,
} from './battleArenaLogic';
import type { Move, Fighter } from './battleArenaLogic';

describe('battle arena', () => {
  it('guarding blocks most of a hit', () => {
    const open = calcDamage(90, 50, 'punch', false, () => 0.5);
    const guarded = calcDamage(90, 50, 'punch', true, () => 0.5);
    expect(guarded.dmg).toBeLessThan(open.dmg / 2);
    expect(guarded.blocked).toBe(true);
  });

  it('a kick can miss, a punch never does', () => {
    expect(calcDamage(90, 50, 'kick', false, () => 0.1).miss).toBe(true);
    expect(calcDamage(90, 50, 'punch', false, () => 0.1).miss).toBe(false);
  });

  it('special needs 60 energy', () => {
    const h = HEROES[0], v = VILLAINS[0];
    expect(resolveTurn(h, v, newFighter(h), newFighter(v), 'special', null, createRng(1))).toBeNull();
    const charged: Fighter = { ...newFighter(h), energy: SPECIAL_COST };
    const r = resolveTurn(h, v, charged, newFighter(v), 'special', null, createRng(1))!;
    expect(r.player.energy).toBe(SPECIAL_COST + 25 - SPECIAL_COST);
  });

  it('the bot only uses special when it has the energy', () => {
    const rng = createRng(5);
    for (let i = 0; i < 500; i++) expect(cpuMove(30, null, rng)).not.toBe('special');
  });

  it('every match ends in a short number of turns, for every hero and bot', () => {
    const moves: Move[] = ['punch', 'kick', 'guard'];
    for (const h of HEROES) for (const v of VILLAINS) for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      let p = newFighter(h), c = newFighter(v);
      let last: Move | null = null;
      let turns = 0;
      while (!outcome(p, c)) {
        const m: Move = p.energy >= SPECIAL_COST ? 'special' : moves[turns % 3];
        const r = resolveTurn(h, v, p, c, m, last, rng)!;
        p = r.player; c = r.cpu; last = m; turns++;
        expect(turns).toBeLessThan(40);
      }
    }
  });

  it('scores HP left × 10 on a win and 0 on a loss', () => {
    const p: Fighter = { hp: 47, maxHp: 100, energy: 0 };
    expect(matchScore(p, 'win')).toBe(470);
    expect(matchScore({ ...p, hp: 0 }, 'win')).toBe(10); // both knocked out together: still a win, small score
    expect(matchScore(p, 'lose')).toBe(0);
    expect(outcome({ ...p, hp: 0 }, { ...p, hp: 0 })).toBe('win');
  });

  it('uses friendly arcade words only', () => {
    const text = [...CHEERS, ...MISS_LINES, ...GUARD_LINES, ...Object.values(MOVES).map(m => m.label + m.desc), ...HEROES.map(h => h.spec)].join(' ');
    expect(text).not.toMatch(/k-?pop|album|fans|soul|demolish|devastat|kill|💀/i);
  });
});
