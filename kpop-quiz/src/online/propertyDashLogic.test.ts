import { describe, it, expect } from 'vitest';
import {
  buildDeck, PropertyDashGame, COLORS, COLOR_IDS, ACTION_INFO, rentFor, fullSetCount, finalRanking,
  HAND_LIMIT, PAY_MS, JSN_MS, TURN_MS,
} from './propertyDashLogic';
import type { Card } from './propertyDashLogic';
import { createRng } from '../games/engine/rng';

const ids = ['a', 'b', 'c'];
const card = (g: PropertyDashGame, pred: (c: Card) => boolean): Card => {
  const all = [...g.deck, ...Object.values(g.hands).flat()];
  const c = all.find(pred);
  if (!c) throw new Error('card not found');
  g.deck = g.deck.filter((x) => x.id !== c.id);
  Object.keys(g.hands).forEach((k) => (g.hands[k] = g.hands[k].filter((x) => x.id !== c.id)));
  return c;
};
const give = (g: PropertyDashGame, pid: string, pred: (c: Card) => boolean) => {
  const c = card(g, pred);
  g.hands[pid].push(c);
  return c;
};
const fresh = () => {
  const g = new PropertyDashGame(ids, (id) => id, createRng(7));
  g.deal(0);
  return g;
};

describe('Property Dash deck', () => {
  it('has the classic 106 cards with the same counts', () => {
    const d = buildDeck(createRng(1));
    expect(d).toHaveLength(106);
    expect(new Set(d.map((c) => c.id)).size).toBe(106);
    const count = (k: Card['kind']) => d.filter((c) => c.kind === k).length;
    expect(count('property')).toBe(28);
    expect(count('wild')).toBe(11);
    expect(count('action')).toBe(34);
    expect(count('rent')).toBe(13);
    expect(count('money')).toBe(20);
    expect(d.filter((c) => c.kind === 'money').reduce((s, c) => s + c.value, 0)).toBe(57);
  });

  it('every set has as many streets as its size, and all names are invented and unique', () => {
    const names = COLOR_IDS.flatMap((c) => COLORS[c].streets);
    COLOR_IDS.forEach((c) => expect(COLORS[c].streets).toHaveLength(COLORS[c].size));
    expect(new Set(names).size).toBe(names.length);
    const banned = /monopoly|boardwalk|park place|mayfair|railroad|avenue|\bave\b|marvin|\bgo\b/i;
    for (const n of [...names, ...Object.values(ACTION_INFO).map((a) => a.label)]) expect(n).not.toMatch(banned);
  });
});

describe('Property Dash rules', () => {
  it('deals 5 each and the first player draws 2', () => {
    const g = fresh();
    expect(g.hands.a).toHaveLength(7);
    expect(g.hands.b).toHaveLength(5);
    expect(g.playsLeft).toBe(3);
    expect(g.current).toBe('a');
  });

  it('banks money, lays properties and charges rent everyone pays', () => {
    const g = fresh();
    const p = give(g, 'a', (c) => c.kind === 'property' && c.color === 'ocean');
    expect(g.handle('a', { t: 'pd_play', cardId: p.id, mode: 'property' }, 0)).toBe(true);
    expect(rentFor(g.table.a, 'ocean')).toBe(3);
    const m = give(g, 'b', (c) => c.kind === 'money' && c.value === 5);
    g.bank.b.push(m);
    g.hands.b = g.hands.b.filter((c) => c.id !== m.id);
    g.hands.b = g.hands.b.filter((c) => c.action !== 'noway');
    g.hands.c = g.hands.c.filter((c) => c.action !== 'noway');
    const r = give(g, 'a', (c) => c.kind === 'rent' && !!c.colors?.includes('ocean'));
    g.handle('a', { t: 'pd_play', cardId: r.id, mode: 'rent', color: 'ocean' }, 0);
    // c has nothing to pay with -> let off; b must pay 3
    const pend = g.pendings.find((x) => x.targetId === 'b')!;
    expect(pend.amount).toBe(3);
    expect(g.handle('b', { t: 'pd_pay', pendingId: pend.pid, cardIds: [m.id] }, 0)).toBe(true);
    expect(g.bank.a.reduce((s, c) => s + c.value, 0)).toBe(5);
    expect(g.playsLeft).toBe(1);
  });

  it('a player who does not pay in time pays automatically', () => {
    const g = fresh();
    g.hands.b = g.hands.b.filter((c) => c.action !== 'noway');
    g.hands.c = g.hands.c.filter((c) => c.action !== 'noway');
    const m = card(g, (c) => c.kind === 'money' && c.value === 3);
    g.bank.b.push(m);
    const bd = give(g, 'a', (c) => c.action === 'birthday');
    g.handle('a', { t: 'pd_play', cardId: bd.id, mode: 'action' }, 0);
    expect(g.pendings).toHaveLength(1);
    expect(g.sweep(PAY_MS + 1)).toBe(true);
    expect(g.pendings).toHaveLength(0);
    expect(g.bank.a.map((c) => c.id)).toContain(m.id);
  });

  it('No Way! blocks, and the attacker can answer back', () => {
    const g = fresh();
    const prop = card(g, (c) => c.kind === 'property' && c.color === 'sky');
    g.table.b.sky = { cards: [prop], house: null, hotel: null };
    g.hands.b = g.hands.b.filter((c) => c.action !== 'noway');
    give(g, 'b', (c) => c.action === 'noway');
    g.hands.a = g.hands.a.filter((c) => c.action !== 'noway');
    give(g, 'a', (c) => c.action === 'noway');
    const sw = give(g, 'a', (c) => c.action === 'swipe');
    g.handle('a', { t: 'pd_play', cardId: sw.id, mode: 'action', target: 'b', propId: prop.id }, 0);
    const p = g.pendings[0];
    expect(p.jsnDecider).toBe('b');
    g.handle('b', { t: 'pd_jsn', pendingId: p.pid, use: true }, 0);
    expect(g.pendings[0].jsnDecider).toBe('a');
    g.handle('a', { t: 'pd_jsn', pendingId: p.pid, use: true }, 0);
    // b has no more No Way! cards -> the swipe goes through
    expect(g.pendings).toHaveLength(0);
    expect(g.table.a.sky.cards[0].id).toBe(prop.id);
  });

  it('a No Way! window that runs out lets the action happen', () => {
    const g = fresh();
    const prop = card(g, (c) => c.kind === 'property' && c.color === 'ruby');
    g.table.b.ruby = { cards: [prop], house: null, hotel: null };
    g.hands.b = g.hands.b.filter((c) => c.action !== 'noway');
    give(g, 'b', (c) => c.action === 'noway');
    const sw = give(g, 'a', (c) => c.action === 'swipe');
    g.handle('a', { t: 'pd_play', cardId: sw.id, mode: 'action', target: 'b', propId: prop.id }, 0);
    g.sweep(JSN_MS + 1);
    expect(g.table.a.ruby?.cards.map((c) => c.id)).toEqual([prop.id]);
  });

  it('cannot swipe from a complete set', () => {
    const g = fresh();
    const two = [card(g, (c) => c.kind === 'property' && c.color === 'ocean'), card(g, (c) => c.kind === 'property' && c.color === 'ocean')];
    g.table.b.ocean = { cards: two, house: null, hotel: null };
    const sw = give(g, 'a', (c) => c.action === 'swipe');
    expect(g.handle('a', { t: 'pd_play', cardId: sw.id, mode: 'action', target: 'b', propId: two[0].id }, 0)).toBe(false);
  });

  it('wins with 3 real sets on your own turn, and ranks the rest by sets then money', () => {
    const g = fresh();
    for (const color of ['galaxy', 'ocean'] as const) {
      g.table.a[color] = { cards: [card(g, (c) => c.color === color), card(g, (c) => c.color === color)], house: null, hotel: null };
    }
    g.table.c.power = { cards: [card(g, (c) => c.color === 'power'), card(g, (c) => c.color === 'power')], house: null, hotel: null };
    expect(fullSetCount(g.table.a)).toBe(2);
    g.table.a.sky = { cards: [card(g, (c) => c.color === 'sky'), card(g, (c) => c.color === 'sky')], house: null, hotel: null };
    const last = give(g, 'a', (c) => c.kind === 'property' && c.color === 'sky');
    g.handle('a', { t: 'pd_play', cardId: last.id, mode: 'property' }, 0);
    expect(g.winner).toBe('a');
    expect(g.ranked).toEqual(['a', 'c', 'b']);
    expect(finalRanking(['a', 'b', 'c'], 'a', { a: {}, b: {}, c: {} }, { a: [], b: [], c: [] })).toEqual(['a', ['b', 'c']]);
  });

  it('turn timer passes the turn, and the hand limit forces a discard', () => {
    const g = fresh();
    expect(g.hands.a.length).toBeGreaterThan(HAND_LIMIT - 1);
    while (g.hands.a.length <= HAND_LIMIT) give(g, 'a', (c) => c.kind === 'money');
    g.handle('a', { t: 'pd_end' }, 0);
    expect(g.discarding?.pid).toBe('a');
    const need = g.discarding!.need;
    expect(g.handle('a', { t: 'pd_discard', cardIds: g.hands.a.slice(0, need).map((c) => c.id) }, 0)).toBe(true);
    expect(g.current).toBe('b');
    expect(g.sweep(TURN_MS + 1)).toBe(true);
    expect(g.current).toBe('c');
  });

  it('ignores moves out of turn and from strangers', () => {
    const g = fresh();
    const c0 = g.hands.b[0];
    expect(g.handle('b', { t: 'pd_play', cardId: c0.id, mode: 'money' }, 0)).toBe(false);
    expect(g.handle('zz', { t: 'pd_end' }, 0)).toBe(false);
  });
});
