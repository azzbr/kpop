// Pet Pal rules — pure functions, no React. The pet never dies or runs away: if she stays away it
// just gets a bit sleepy, and it cheers up as soon as she comes back.
import type { PetState, PlayLog } from '../store';

/** PetState plus the day it last grew (saved inside the same pet object). */
export interface PetRecord extends PetState { grewDate?: string }

export interface Species { id: string; name: string; stages: string[]; colour: string }

/** Five looks per species: start → baby → kid → big → super (super also wears a crown). */
export const SPECIES: Species[] = [
  { id: 'chick', name: 'Chick', stages: ['🥚', '🐣', '🐥', '🐤', '🐔'], colour: '#fde047' },
  { id: 'dragon', name: 'Dragon', stages: ['🥚', '🦎', '🐲', '🐉', '🐉'], colour: '#4ade80' },
  { id: 'bunny', name: 'Bunny', stages: ['🧺', '🐇', '🐰', '🐇', '🐰'], colour: '#f9a8d4' },
  { id: 'kitty', name: 'Kitty', stages: ['🧶', '🐾', '🐱', '🐈', '🐈'], colour: '#fdba74' },
  { id: 'puppy', name: 'Puppy', stages: ['🧺', '🐾', '🐶', '🐕', '🐕'], colour: '#d6a46b' },
  { id: 'unicorn', name: 'Unicorn', stages: ['🥚', '🦄', '🦄', '🦄', '🦄'], colour: '#c4b5fd' },
];

/** Days of play needed for each stage. */
export const STAGE_DAYS = [0, 3, 7, 14, 30];
export const STAGE_NAMES = ['Sleepy Egg', 'Baby', 'Little One', 'Big Pal', 'Super Pal'];
/** Emoji size grows with each stage (rem). */
export const STAGE_SIZE = [4.5, 5, 6, 7, 7.5];

export const MAX_HAPPY = 100;
export const MIN_HAPPY = 10;
export const DECAY_PER_DAY = 10;
export const VISIT_BONUS = 5;
export const FEED_BONUS = 20;
export const PET_BONUS = 1;

export const PRESET_NAMES = ['Mochi', 'Pip', 'Sunny', 'Bubbles', 'Nugget', 'Sparkle', 'Biscuit', 'Luna', 'Pickle', 'Ziggy', 'Coco', 'Waffles'];

export const speciesById = (id: string): Species => SPECIES.find(s => s.id === id) ?? SPECIES[0];

export function stageOf(growth: number): number {
  let s = 0;
  for (let i = 0; i < STAGE_DAYS.length; i++) if (growth >= STAGE_DAYS[i]) s = i;
  return s;
}

/** Days of play until the next stage, or null when fully grown. */
export function daysToNextStage(growth: number): number | null {
  const s = stageOf(growth);
  return s + 1 < STAGE_DAYS.length ? STAGE_DAYS[s + 1] - growth : null;
}

export function petEmoji(pet: Pick<PetState, 'species' | 'growth'>): string {
  return speciesById(pet.species).stages[stageOf(pet.growth)];
}

const toUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
/** Whole days from a to b (local date keys YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

const clampHappy = (h: number) => Math.max(MIN_HAPPY, Math.min(MAX_HAPPY, Math.round(h)));

export function adopt(name: string, species: string, today: string): PetRecord {
  return { name, species, growth: 0, happiness: 80, lastVisitDate: today, lastFedDate: '', decor: [], born: today };
}

export interface VisitResult {
  pet: PetRecord;
  /** Whole days with no visit since last time. */
  missed: number;
  /** It grew a day older on this visit. */
  grew: boolean;
  /** It reached a new stage on this visit. */
  newStage: boolean;
}

/**
 * Opening Pet Pal. On a new day, happiness drops 10 for each missed day (never below 10) and then
 * perks up a little for the visit. It grows +1 once per day when she has also played a game today.
 * Calling it again the same day is safe (nothing changes unless she has played since).
 */
export function visit(pet: PetRecord, today: string, datesPlayed: string[]): VisitResult {
  let next: PetRecord = { ...pet };
  let missed = 0;
  if (pet.lastVisitDate !== today) {
    missed = Math.max(0, daysBetween(pet.lastVisitDate, today) - 1);
    next.happiness = clampHappy(clampHappy(pet.happiness - DECAY_PER_DAY * missed) + VISIT_BONUS);
    next.lastVisitDate = today;
  }
  const grew = datesPlayed.includes(today) && pet.grewDate !== today;
  if (grew) next = { ...next, growth: pet.growth + 1, grewDate: today };
  return { pet: next, missed, grew, newStage: grew && stageOf(next.growth) > stageOf(pet.growth) };
}

export const canFeed = (pet: PetState, today: string) => pet.lastFedDate !== today;

/** Free daily meal. Returns null if it already ate today. */
export function feed(pet: PetRecord, today: string): PetRecord | null {
  if (!canFeed(pet, today)) return null;
  return { ...pet, lastFedDate: today, happiness: clampHappy(pet.happiness + FEED_BONUS) };
}

export function giveTreat(pet: PetRecord, happiness: number): PetRecord {
  return { ...pet, happiness: clampHappy(pet.happiness + happiness) };
}

export function pat(pet: PetRecord): PetRecord {
  return { ...pet, happiness: clampHappy(pet.happiness + PET_BONUS) };
}

/** Adds a bought decor id (once). A wallpaper that's already owned moves to the end, so it shows. */
export function addDecor(pet: PetRecord, id: string): PetRecord {
  return { ...pet, decor: [...pet.decor.filter(d => d !== id), id] };
}

export type Mood = 'happy' | 'okay' | 'sleepy';
export function moodOf(happiness: number): Mood {
  if (happiness >= 70) return 'happy';
  if (happiness >= 40) return 'okay';
  return 'sleepy';
}
export const MOOD_FACE: Record<Mood, string> = { happy: '😄', okay: '🙂', sleepy: '😴' };

/** Friendly names for speech bubbles. */
export const GAME_LABELS: Record<string, string> = {
  paper_clash: 'Paper Clash 🗺️', snake_arena: 'Snake Arena 🐍', game_2048: '2048 🔢', block_blast: 'Block Blast 🧱',
  word_guess: 'Word Guess 🟩', quiz_arena: 'Quiz Arena ❓', quiz_party: 'Quiz Party 🎉', real_or_fake: 'Real or Fake 🤔',
  emoji_guess: 'Emoji Guess 🕵️', would_you_rather: 'Would You Rather 🤷', kpop_rush: 'Rush Runner 🏃',
  ninja_slice: 'Ninja Slice 🥷', rocket_launch: 'Rocket Launch 🚀', battle_arena: 'Battle Arena ⚔️',
  pattern_memory: 'Pattern Memory 🧠', sparkle_match: 'Gem Match 💎', tower_defense: 'Tower Defense 🏰',
  heads_up: 'Heads Up 🙆', imposter: 'Imposter 🎭',
};

/** What the pet says today, based on what she played (playLog) and how it feels. Always kind. */
export function speechLines(pet: PetState, today: string, playLog: PlayLog, missed = 0): string[] {
  const lines: string[] = [];
  if (missed >= 2) lines.push(`I missed you! I'm so happy you're back! 🤗`);
  else if (missed === 1) lines.push(`Yay, you're here! 💖`);
  const games = Object.entries(playLog[today]?.games ?? {})
    .filter(([id]) => GAME_LABELS[id])
    .sort((a, b) => b[1] - a[1]);
  for (const [id, n] of games.slice(0, 3)) {
    lines.push(n > 1 ? `You played ${GAME_LABELS[id]} ${n} times today! Wow!` : `You played ${GAME_LABELS[id]} today!`);
  }
  if (games.length >= 3) lines.push(`So many games today — you're a superstar! ⭐`);
  if (games.length === 0) lines.push(`Play any game today and I'll grow a little bigger! 🌱`);
  const mood = moodOf(pet.happiness);
  if (mood === 'sleepy') lines.push(`I'm a bit sleepy… a snack or a pat would cheer me up! 😴`);
  else if (mood === 'happy') lines.push(`I love hanging out with you! 💕`);
  if (canFeed(pet, today)) lines.push(`My tummy says it's snack time! 🍽️`);
  return lines;
}
