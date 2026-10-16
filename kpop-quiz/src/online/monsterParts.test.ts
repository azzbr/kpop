import { describe, it, expect } from 'vitest';
import { MONSTER_THEMES, PARTS } from './monsterParts';
import { isKidSafe } from './rudeWords';

const NOT_FOR_KIDS = /\b(scary|scare|blood|kill|dead|die|zombie|skull|creep|evil|ghost|vampire|knife|gun|sword|fight|attack|horror|spooky|bite|weapon|claw|fang|angry|eat people)/;

describe('Monster Mash themes', () => {
  it('has 60 different themes', () => {
    expect(MONSTER_THEMES).toHaveLength(60);
    expect(new Set(MONSTER_THEMES.map(t => t.id)).size).toBe(60);
    expect(new Set(MONSTER_THEMES.map(t => t.text)).size).toBe(60);
    expect(new Set(MONSTER_THEMES.map(t => t.emoji)).size).toBe(60);
  });

  it('every theme is a short, cute monster idea', () => {
    for (const t of MONSTER_THEMES) {
      expect(t.text, t.id).toMatch(/^(a|an) [a-z -]+$/);
      expect(t.text, t.id).toMatch(/monster/);
      expect(t.text.length, t.id).toBeLessThanOrEqual(48);
      expect(t.emoji.length, t.id).toBeGreaterThan(0);
      expect(isKidSafe(t.text), t.id).toBe(true);
      expect(NOT_FOR_KIDS.test(t.text), t.id).toBe(false);
    }
  });

  it('every part has a label, emoji and a kind tip', () => {
    for (const [k, p] of Object.entries(PARTS)) {
      expect(p.label, k).toBeTruthy();
      expect(p.emoji, k).toBeTruthy();
      expect(isKidSafe(p.tip), k).toBe(true);
      expect(NOT_FOR_KIDS.test(p.tip.toLowerCase()), k).toBe(false);
    }
  });
});
