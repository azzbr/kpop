import { describe, it, expect } from 'vitest';
import { HEROES, HERO_QUESTIONS, TIE_BREAK, emptyScores, addAnswer, leaders, tieBreakAnswers, sidekick, type HeroId } from './heroQuiz';
import { isClean } from '../utils/cleanText';

const BANNED = /kpop|k-pop|idol|huntr|rumi|mira|zoey|celine/i;
const ids = HEROES.map(h => h.id);

describe('Which Arcade Hero Are You?', () => {
  it('has 4 heroes with unique ids, names and emojis', () => {
    expect(HEROES).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(new Set(HEROES.map(h => h.name)).size).toBe(4);
    expect(new Set(HEROES.map(h => h.emoji)).size).toBe(4);
  });

  it('has 10 questions with unique ids, and every answer maps to a different hero', () => {
    expect(HERO_QUESTIONS).toHaveLength(10);
    expect(new Set(HERO_QUESTIONS.map(q => q.id)).size).toBe(10);
    for (const q of [...HERO_QUESTIONS, TIE_BREAK]) {
      expect(q.answers).toHaveLength(4);
      expect(new Set(q.answers.map(a => a.hero))).toEqual(new Set(ids));
      expect(new Set(q.answers.map(a => a.text)).size).toBe(4);
    }
  });

  it('answer A is not always the same hero', () => {
    expect(new Set(HERO_QUESTIONS.map(q => q.answers[0].hero)).size).toBe(4);
  });

  it('text fits, is clean and has no old theme words', () => {
    const texts = [
      ...HEROES.flatMap(h => [h.name, h.tagline, h.description, h.power, ...h.strengths]),
      ...[...HERO_QUESTIONS, TIE_BREAK].flatMap(q => [q.text, ...q.answers.map(a => a.text)]),
    ];
    for (const t of texts) {
      expect(isClean(t), t).toBe(true);
      expect(t, t).not.toMatch(BANNED);
    }
    for (const q of HERO_QUESTIONS) {
      expect(q.text.length).toBeLessThanOrEqual(60);
      for (const a of q.answers) expect(a.text.length, a.text).toBeLessThanOrEqual(40);
    }
    for (const h of HEROES) expect(h.description.length).toBeLessThanOrEqual(180);
  });

  it('scores, finds leaders and handles ties', () => {
    let s = emptyScores();
    s = addAnswer(s, 'puzzler');
    expect(leaders(s)).toEqual(['puzzler']);
    s = addAnswer(s, 'party');
    expect(leaders(s)).toEqual(['puzzler', 'party']);
    expect(tieBreakAnswers(['puzzler', 'party']).map(a => a.hero)).toEqual(['puzzler', 'party']);
    // A tie-break answer always produces a single winner among the tied heroes.
    for (const a of tieBreakAnswers(leaders(s))) expect(leaders(addAnswer(s, a.hero))).toEqual([a.hero]);
    // Every hero can win.
    for (const id of ids) {
      let x = emptyScores();
      for (let i = 0; i < 10; i++) x = addAnswer(x, id as HeroId);
      expect(leaders(x)).toEqual([id]);
      expect(sidekick(x, id as HeroId)).toBeNull();
    }
  });

  it('sidekick is a close runner-up', () => {
    const s = { speedster: 4, puzzler: 3, party: 2, inventor: 1 };
    expect(sidekick(s, 'speedster')).toBe('puzzler');
    expect(sidekick({ speedster: 7, puzzler: 1, party: 1, inventor: 1 }, 'speedster')).toBeNull();
  });
});
