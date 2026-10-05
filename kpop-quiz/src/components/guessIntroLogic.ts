// Pure rules for Guess the Intro (guess_intro). No React or audio here — see guessIntroLogic.test.ts.
import type { Track } from '../store';
import type { Rng } from '../games/engine/rng';

/** Several recordings of one song (e.g. two versions of "Takedown") count as one answer. */
export interface Song { key: string; title: string; files: string[] }
export interface IntroRound { song: Song; file: string }

export const ROUND_COUNT = 5;
export const OPTION_COUNT = 4;

export const LEVELS = [
  { id: 'easy', label: '🙂 Easy', clip: 3, xpScale: 0.15 },
  { id: 'medium', label: '😎 Medium', clip: 2, xpScale: 0.12 },
  { id: 'hard', label: '🔥 Hard', clip: 1, xpScale: 0.1 },
] as const;
export type LevelId = (typeof LEVELS)[number]['id'];

/** Where the clip starts in each file (seconds); other files start at DEFAULT_START. */
export const INTRO_START: Record<string, number> = {
  '01-takedown-twice.m4a': 12,
  '02-hows-it-done.m4a': 8,
  '03-soda-pop.m4a': 15,
  '04-golden.m4a': 6,
  '05-strategy.m4a': 18,
  '06-takedown.m4a': 10,
  '07-your-idol.m4a': 14,
  '08-free.m4a': 9,
};
export const DEFAULT_START = 10;
export const clipStart = (file: string) => INTRO_START[file] ?? DEFAULT_START;

export const songKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

/** "TAKEDOWN" → "Takedown": prefer a title that isn't shouted in capitals. */
function niceTitle(titles: string[]): string {
  const mixed = titles.find(t => t !== t.toUpperCase());
  if (mixed) return mixed;
  const t = titles[0];
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/** One Song per distinct title, in track order. */
export function songsFrom(tracks: Track[]): Song[] {
  const map = new Map<string, { titles: string[]; files: string[] }>();
  for (const t of tracks) {
    const k = songKey(t.title);
    if (!k) continue;
    const e = map.get(k) ?? { titles: [], files: [] };
    e.titles.push(t.title);
    e.files.push(t.file);
    map.set(k, e);
  }
  return [...map.entries()].map(([key, e]) => ({ key, title: niceTitle(e.titles), files: e.files }));
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A game's rounds: different songs every round (so no track repeats), random version of each. */
export function pickRounds(songs: Song[], rng: Rng, count = ROUND_COUNT): IntroRound[] {
  return shuffle(songs, rng).slice(0, Math.min(count, songs.length))
    .map(song => ({ song, file: song.files[Math.floor(rng() * song.files.length)] }));
}

/** The right song plus up to OPTION_COUNT − 1 other songs, shuffled. */
export function pickOptions(answer: Song, songs: Song[], rng: Rng, count = OPTION_COUNT): Song[] {
  const others = shuffle(songs.filter(s => s.key !== answer.key), rng).slice(0, count - 1);
  return shuffle([answer, ...others], rng);
}

export const isRight = (picked: Song, round: IntroRound) => picked.key === round.song.key;

export function verdict(correct: number, total: number): string {
  if (correct === total) return '🌟 Golden ears — every single one!';
  if (correct >= total - 1) return '🎵 Super listening!';
  if (correct >= Math.ceil(total / 2)) return '🎶 Nice ears — try a harder level?';
  return '👂 Good try — play again and they’ll get easier to spot!';
}
