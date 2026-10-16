import { describe, it, expect } from 'vitest';
import { CLUB_ANIMALS, CLUB_WORDS, clubFromCode, parseClubCode, makeClub } from './clubWords';
import { createRng } from '../games/engine/rng';
import { isKidSafe } from '../online/rudeWords';

describe('club codes', () => {
  it('has no duplicate animals, emoji or words', () => {
    expect(new Set(CLUB_ANIMALS.map(a => a.code)).size).toBe(CLUB_ANIMALS.length);
    expect(new Set(CLUB_ANIMALS.map(a => a.emoji)).size).toBe(CLUB_ANIMALS.length);
    expect(new Set(CLUB_WORDS).size).toBe(CLUB_WORDS.length);
    for (const w of [...CLUB_WORDS, ...CLUB_ANIMALS.map(a => a.code)]) expect(w).toMatch(/^[A-Z]+$/);
  });

  it('every animal + word reads back as exactly that club, and the name is kid-safe', () => {
    for (const a of CLUB_ANIMALS) for (const w of CLUB_WORDS) {
      const code = `${a.code}-${w}-42`;
      const c = clubFromCode(code)!;
      expect(c.emoji).toBe(a.emoji);
      expect(parseClubCode(`${a.code}${w}42`)).toEqual(c);
      expect(parseClubCode(`${a.code.toLowerCase()} ${w.toLowerCase()} 42`)).toEqual(c);
      expect(isKidSafe(c.name)).toBe(true);
    }
  });

  it('rejects anything that is not a club code', () => {
    for (const bad of ['', 'ABCD', 'FOX-RAINBOW', 'FOX-RAINBOW-7', 'CAT-RAINBOW-12', 'FOX-BANANA-12', 'FOXRAINBOW123']) {
      expect(parseClubCode(bad), bad).toBeNull();
    }
    expect(clubFromCode('fox-rainbow-27')).toBeNull();
  });

  it('makes valid clubs', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const c = makeClub(rng);
      expect(clubFromCode(c.code)).toEqual(c);
      expect(c.code).toMatch(/^[A-Z]+-[A-Z]+-[1-9]\d$/);
    }
    expect(clubFromCode('FOX-RAINBOW-27')).toEqual({ code: 'FOX-RAINBOW-27', name: 'Rainbow Foxes', emoji: '🦊' });
  });
});
