import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  cleanEmojiList, judgeGuess, guessPoints, hintFor, hintLevel, turnCount, tellerOrder, pickPhrases, guessOk, MAX_EMOJI,
} from './emojiCharadesLogic';
import type { CharadePhrase } from '../../online/charadePhrases';

const party: CharadePhrase = { text: 'birthday party', cat: 'events', level: 1 };
const fish: CharadePhrase = { text: 'goldfish', cat: 'animals', level: 1 };
const cat: CharadePhrase = { text: 'sleepy cat', cat: 'animals', level: 1, alt: ['tired cat'] };

describe('Emoji Charades', () => {
  it('only lets picker emoji through', () => {
    expect(cleanEmojiList(['🎂', '🎉'])).toEqual(['🎂', '🎉']);
    expect(cleanEmojiList(['A'])).toBeNull();
    expect(cleanEmojiList(['1️⃣'])).toBeNull();
    expect(cleanEmojiList(['🎂 cake'])).toBeNull();
    expect(cleanEmojiList(Array(MAX_EMOJI + 1).fill('🎂'))).toBeNull();
    expect(cleanEmojiList('🎂')).toBeNull();
    expect(cleanEmojiList([])).toEqual([]);
  });
  it('judges guesses kindly', () => {
    expect(judgeGuess('Birthday Party', party)).toBe('right');
    expect(judgeGuess('birthdy party', party)).toBe('right');
    expect(judgeGuess('the tired cat', cat)).toBe('right');
    expect(judgeGuess('gldfsh', fish)).toBe('close');
    expect(judgeGuess('goldfsh', fish)).toBe('right');
    expect(judgeGuess('brthdy prty', party)).toBe('close');
    expect(judgeGuess('party', party)).toBe('part');
    expect(judgeGuess('pizza', party)).toBe('wrong');
    expect(judgeGuess('', party)).toBe('wrong');
  });
  it('scores faster guesses higher', () => {
    expect(guessPoints(60_000)).toBe(100);
    expect(guessPoints(30_000)).toBe(75);
    expect(guessPoints(0)).toBe(50);
  });
  it('unlocks hints over time', () => {
    expect(hintLevel(5_000)).toBe(0);
    expect(hintLevel(20_000)).toBe(1);
    expect(hintLevel(45_000)).toBe(2);
    expect(hintFor(party, 0)).toEqual({ cat: 'Special day', catEmoji: '🎉' });
    expect(hintFor(party, 1).words).toBe(2);
    expect(hintFor(party, 2).first).toBe('B');
  });
  it('lets each player tell once, capped by the option', () => {
    expect(turnCount(12, '5')).toBe(5);
    expect(turnCount(3, '5')).toBe(3);
    expect(turnCount(12, 'all')).toBe(12);
    expect(turnCount(4, undefined)).toBe(4);
    const order = tellerOrder(['a', 'b', 'c', 'd'], 3, createRng(1));
    expect(new Set(order).size).toBe(3);
  });
  it('picks different phrases by difficulty', () => {
    const easy = pickPhrases(10, 'easy', createRng(2));
    expect(easy.every(p => p.level === 1)).toBe(true);
    expect(new Set(easy.map(p => p.text)).size).toBe(10);
    expect(pickPhrases(10, 'tricky', createRng(2)).every(p => p.level >= 2)).toBe(true);
  });
  it('refuses unkind guesses', () => {
    expect(guessOk('cake')).toBe(true);
    expect(guessOk('stupid')).toBe(false);
    expect(guessOk('   ')).toBe(false);
  });
});
