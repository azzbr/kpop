import { describe, it, expect } from 'vitest';
import { CARD_AVATARS, CARD_COLORS, CARD_TITLES, CARD_POWERS, CARD_GAMES, CARD_MOTTOS, defaultCard, parseCard } from './playerCard';
import { isClean } from '../utils/cleanText';

const BANNED = /kpop|k-pop|idol|huntr|debut|fan club/i;

describe('Player Card', () => {
  it('options have unique ids', () => {
    expect(new Set(CARD_AVATARS).size).toBe(CARD_AVATARS.length);
    for (const list of [CARD_COLORS, CARD_TITLES, CARD_POWERS, CARD_GAMES]) {
      expect(new Set(list.map(o => o.id)).size).toBe(list.length);
    }
  });

  it('has 20 unique, short, clean mottos', () => {
    expect(CARD_MOTTOS).toHaveLength(20);
    expect(new Set(CARD_MOTTOS).size).toBe(20);
    for (const m of CARD_MOTTOS) expect(m.length, m).toBeLessThanOrEqual(36);
  });

  it('labels are clean, short and on-theme', () => {
    const labels = [
      ...CARD_COLORS.map(o => o.name), ...[CARD_TITLES, CARD_POWERS, CARD_GAMES].flat().map(o => o.label), ...CARD_MOTTOS,
    ];
    for (const t of labels) {
      expect(isClean(t), t).toBe(true);
      expect(t, t).not.toMatch(BANNED);
    }
    for (const o of [CARD_TITLES, CARD_POWERS, CARD_GAMES].flat()) expect(o.label.length, o.label).toBeLessThanOrEqual(18);
  });

  it('parseCard accepts a good card and rejects junk', () => {
    const c = defaultCard('2026-10-05');
    expect(parseCard(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(parseCard(null)).toBeNull();
    expect(parseCard({ ...c, title: 'nope' })).toBeNull();
    expect(parseCard({ ...c, motto: 20 })).toBeNull();
    expect(parseCard({ ...c, avatar: '💩' })).toBeNull();
  });
});
