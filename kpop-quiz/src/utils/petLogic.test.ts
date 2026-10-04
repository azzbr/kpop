import { describe, it, expect } from 'vitest';
import {
  adopt, visit, feed, giveTreat, pat, addDecor, stageOf, daysToNextStage, daysBetween, moodOf, petEmoji,
  speechLines, SPECIES, STAGE_DAYS, MIN_HAPPY, MAX_HAPPY, PRESET_NAMES,
} from './petLogic';
import { PET_DECOR, PET_TREATS } from '../data/petItems';
import { isClean } from './cleanText';

const base = () => adopt('Mochi', 'chick', '2026-10-01');

describe('petLogic', () => {
  it('counts days between local date keys, across months', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0);
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('a same-day visit changes nothing until she plays', () => {
    const r = visit(base(), '2026-10-01', []);
    expect(r.pet.happiness).toBe(base().happiness);
    expect(r.grew).toBe(false);
  });

  it('grows once per day when visited on a day she played', () => {
    let p = base();
    const r1 = visit(p, '2026-10-01', ['2026-10-01']);
    expect(r1.grew).toBe(true);
    p = r1.pet;
    expect(p.growth).toBe(1);
    // Visiting again the same day doesn't grow again
    expect(visit(p, '2026-10-01', ['2026-10-01']).pet.growth).toBe(1);
    // Next day, visited but not played yet → no growth; after playing → grows
    const r2 = visit(p, '2026-10-02', ['2026-10-01']);
    expect(r2.grew).toBe(false);
    const r3 = visit(r2.pet, '2026-10-02', ['2026-10-01', '2026-10-02']);
    expect(r3.pet.growth).toBe(2);
  });

  it('happiness drops 10 per missed day but never below 10, then perks up', () => {
    const p = { ...base(), happiness: 80 };
    expect(visit(p, '2026-10-02', []).pet.happiness).toBe(85); // visited yesterday: no decay, +5
    expect(visit(p, '2026-10-04', []).pet.happiness).toBe(65); // missed 2 days
    const long = visit(p, '2027-01-01', []);
    expect(long.pet.happiness).toBeGreaterThanOrEqual(MIN_HAPPY);
    expect(long.missed).toBeGreaterThan(30);
    expect(long.pet.name).toBe('Mochi'); // still here, never gone
  });

  it('feeds once per day', () => {
    const p = { ...base(), happiness: 50 };
    const fed = feed(p, '2026-10-01')!;
    expect(fed.happiness).toBe(70);
    expect(feed(fed, '2026-10-01')).toBeNull();
    expect(feed(fed, '2026-10-02')).not.toBeNull();
  });

  it('treats and pats raise happiness up to 100', () => {
    const p = { ...base(), happiness: 95 };
    expect(giveTreat(p, 25).happiness).toBe(MAX_HAPPY);
    expect(pat(p).happiness).toBe(96);
  });

  it('stages follow the day thresholds', () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(2)).toBe(0);
    expect(stageOf(3)).toBe(1);
    expect(stageOf(7)).toBe(2);
    expect(stageOf(14)).toBe(3);
    expect(stageOf(30)).toBe(4);
    expect(stageOf(500)).toBe(4);
    expect(daysToNextStage(5)).toBe(2);
    expect(daysToNextStage(30)).toBeNull();
    expect(visit({ ...base(), growth: 2 }, '2026-10-01', ['2026-10-01']).newStage).toBe(true);
  });

  it('every species has a look for every stage', () => {
    expect(SPECIES).toHaveLength(6);
    for (const s of SPECIES) expect(s.stages).toHaveLength(STAGE_DAYS.length);
    expect(petEmoji({ species: 'chick', growth: 30 })).toBe('🐔');
    expect(petEmoji({ species: 'unknown', growth: 0 })).toBe('🥚');
  });

  it('decor ids are unique, prefixed pet_, and adding is idempotent', () => {
    expect(PET_DECOR.length).toBeGreaterThanOrEqual(16);
    expect(new Set(PET_DECOR.map(d => d.id)).size).toBe(PET_DECOR.length);
    for (const d of PET_DECOR) {
      expect(d.id.startsWith('pet_')).toBe(true);
      expect(d.price).toBeGreaterThan(0);
      if (d.slot === 'wallpaper') expect(d.bg).toBeTruthy();
    }
    for (const t of PET_TREATS) expect(t.price).toBeGreaterThan(0);
    const p = addDecor(addDecor(addDecor(base(), 'pet_ball'), 'pet_wall_sky'), 'pet_ball');
    expect(p.decor).toEqual(['pet_wall_sky', 'pet_ball']);
  });

  it('moods are kind and speech reacts to today\'s play', () => {
    expect(moodOf(90)).toBe('happy');
    expect(moodOf(50)).toBe('okay');
    expect(moodOf(10)).toBe('sleepy');
    const log = { '2026-10-01': { seconds: 300, games: { paper_clash: 2, word_guess: 1 } } };
    const lines = speechLines(base(), '2026-10-01', log);
    expect(lines.some(l => l.includes('Paper Clash'))).toBe(true);
    expect(lines.some(l => l.includes('Word Guess'))).toBe(true);
    const idle = speechLines({ ...base(), happiness: 10 }, '2026-10-05', log, 3);
    expect(idle.some(l => l.includes('missed you'))).toBe(true);
    for (const l of [...lines, ...idle]) expect(l).not.toMatch(/bad|dead|die|sad|hungry|lonely/i);
  });

  it('preset names are clean', () => {
    for (const n of PRESET_NAMES) expect(isClean(n)).toBe(true);
  });
});
