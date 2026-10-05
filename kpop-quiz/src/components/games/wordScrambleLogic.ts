// Word Scramble rules: words, shuffling, points per word and the end-of-round rating.
import type { Rng } from '../../games/engine/rng';

export interface ScrambleWord { word: string; hint: string; emoji: string }

export const SCRAMBLE_WORDS: ScrambleWord[] = [
  { word: 'PLANET', hint: 'Earth is one', emoji: '🪐' },
  { word: 'VOLCANO', hint: 'A mountain that can erupt', emoji: '🌋' },
  { word: 'DOLPHIN', hint: 'A very clever sea mammal', emoji: '🐬' },
  { word: 'PYRAMID', hint: 'Ancient Egyptian tomb', emoji: '🔺' },
  { word: 'GALAXY', hint: 'A huge group of stars', emoji: '🌌' },
  { word: 'JUNGLE', hint: 'Thick tropical forest', emoji: '🌴' },
  { word: 'PENGUIN', hint: "A bird that can't fly but swims", emoji: '🐧' },
  { word: 'MYSTERY', hint: 'Something unexplained', emoji: '🕵️' },
  { word: 'TREASURE', hint: 'Pirates bury it', emoji: '💰' },
  { word: 'DRAGON', hint: 'A fire-breathing creature from stories', emoji: '🐉' },
  { word: 'ROCKET', hint: 'It blasts off into space', emoji: '🚀' },
  { word: 'CASTLE', hint: 'A king or queen might live here', emoji: '🏰' },
  { word: 'THUNDER', hint: 'The boom after lightning', emoji: '⛈️' },
  { word: 'PUZZLE', hint: 'You are solving one right now', emoji: '🧩' },
  { word: 'CHAMPION', hint: 'The winner of a competition', emoji: '🏆' },
  { word: 'SKATEBOARD', hint: 'Stand on it and roll along on four little wheels', emoji: '🛹' },
  { word: 'CHOCOLATE', hint: 'A sweet treat made from cocoa', emoji: '🍫' },
  { word: 'ADVENTURE', hint: 'An exciting journey', emoji: '🗺️' },
  { word: 'GRAVITY', hint: 'What keeps your feet on the ground', emoji: '🍎' },
  { word: 'TORNADO', hint: 'A spinning windstorm', emoji: '🌪️' },
  { word: 'MELODY', hint: 'A musical tune', emoji: '🎶' },
  { word: 'RAINBOW', hint: 'An arc of colours after the rain', emoji: '🌈' },
  { word: 'INVENTOR', hint: 'Someone who creates new things', emoji: '💡' },
  { word: 'ASTRONAUT', hint: 'A person who travels to space', emoji: '👩‍🚀' },
  { word: 'KANGAROO', hint: 'An animal that hops, with a pouch', emoji: '🦘' },
  { word: 'BLIZZARD', hint: 'A huge snowstorm', emoji: '❄️' },
  { word: 'NINJA', hint: 'A sneaky secret agent from old Japan', emoji: '🥷' },
  { word: 'ORCHESTRA', hint: 'A big group of musicians', emoji: '🎻' },
  { word: 'SUPERHERO', hint: 'Saves the day with powers', emoji: '🦸' },
  { word: 'ELECTRIC', hint: 'Lightning and plugs are full of this kind of power', emoji: '⚡' },
];

export const WORDS_PER_ROUND = 10;
export const TIME_PER_WORD = 20;

export function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The word's letters in a new order (never the word itself). */
export function scramble(word: string, rng: Rng): string[] {
  for (let tries = 0; tries < 20; tries++) {
    const arr = shuffled(word.split(''), rng);
    if (arr.join('') !== word) return arr;
  }
  const arr = word.split('');
  // fallback: rotate by one (differs unless every letter is the same)
  return [...arr.slice(1), arr[0]];
}

/** 100 a word, +20 per streak word before it, +5 for every second left over 5. */
export function wordPoints(timeLeft: number, streak: number): number {
  return 100 + streak * 20 + Math.max(0, timeLeft - 5) * 5;
}

export function rating(solved: number, total: number): string {
  const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
  if (pct >= 90) return '🏆 Word Wizard!';
  if (pct >= 60) return '⭐ Super Speller!';
  if (pct >= 30) return '🌟 Great effort!';
  return '🌱 Keep practising — you’ll get there!';
}
