// Talent Show (pass-the-iPad) — pure rules and content, no React.
import type { Rng } from '../../games/engine/rng';
import { shuffle } from './drawLogic';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
/** At most this many judges per act, so a show stays short. */
export const MAX_JUDGES = 3;
export const PERFORM_SECS = 30;
/** Idea chips shown at a time. */
export const IDEAS_SHOWN = 4;

// G-rated, indoor-safe, no props needed (or things every home has).
export const TALENT_IDEAS = [
  '🐒 Do your best animal impressions',
  '👅 Say a tongue twister 3 times fast',
  '🎩 Mime a magic trick',
  '🤖 Do a robot dance',
  '💃 Freestyle dance for 15 seconds',
  '🎵 Beatbox a cool beat',
  '😂 Tell your funniest joke',
  '🎨 Draw something in 20 seconds, then reveal it',
  '🔤 Say the alphabet backwards',
  '🐔 Sing a song using only "cluck"',
  '🧊 Be a statue that slowly melts',
  '🦸 Strike 5 superhero poses',
  '🎤 Sing "Happy Birthday" like an opera star',
  '🐶 Be a puppy learning a new trick',
  '🐧 Walk like a penguin, then a crab, then a cat',
  '📢 Be a sports commentator for something in the room',
  '🍝 Pretend to eat the world\'s longest spaghetti',
  '🧙 Cast a spell and turn into an animal',
  '🎺 Play an invisible instrument',
  '🌪️ Act out the weather forecast with big moves',
] as const;

/** Friendly label for each star choice — every score is a nice one. */
export const STAR_LABELS: Record<number, string> = {
  1: 'Good try! 👍',
  2: 'Nice! 😊',
  3: 'Super! 🌟',
  4: 'Wow! 🤩',
  5: 'Amazing! 🏆',
};

/** A cheer for the act, picked by its average stars. All of them are encouraging. */
export const CHEERS: Record<'great' | 'good' | 'brave', string[]> = {
  great: ['A star is born! 🌟', 'Standing ovation! 👏👏👏', 'Show-stopper! 🎆'],
  good: ['The crowd loved it! 🎉', 'What a performance! 🎭', 'Bravo! 👏'],
  brave: ['So brave on stage! 🦁', 'Thanks for the fun! 😄', 'Great energy! ⚡'],
};

export function cheerFor(avg: number, rng: Rng): string {
  const pool = avg >= 4 ? CHEERS.great : avg >= 2.5 ? CHEERS.good : CHEERS.brave;
  return pool[Math.floor(rng() * pool.length)];
}

/** The judges for one act: the next players after the performer, up to MAX_JUDGES. Never the performer. */
export function judgesFor(players: string[], performer: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < players.length && out.length < MAX_JUDGES; k++) out.push((performer + k) % players.length);
  return out;
}

/** A few random ideas to choose from. */
export const dealIdeas = (rng: Rng, n = IDEAS_SHOWN): string[] => shuffle([...TALENT_IDEAS], rng).slice(0, n);

export interface Act {
  performer: string;
  talent: string;
  stars: number[]; // one per judge, 1–5
}

export const actStars = (a: Act) => a.stars.reduce((s, x) => s + x, 0);
export const actAverage = (a: Act) => (a.stars.length ? actStars(a) / a.stars.length : 0);

/** The score saved for a show: every star the judges gave. */
export const showScore = (acts: Act[]) => acts.reduce((s, a) => s + actStars(a), 0);

const AWARDS = ['🎉 Crowd Pleaser', '💡 Most Creative', '🦁 Bravest Performer', '😂 Funniest Moment', '✨ Rising Star', '🎨 Most Original', '⚡ Most Energy'];
export const TOP_AWARD = '🏆 Star of the Show';

/**
 * Everyone gets an award. The best average (ties included) is Star of the Show; the others get a
 * different friendly award each — no rankings, no last place.
 */
export function showAwards(acts: Act[]): { performer: string; award: string }[] {
  if (!acts.length) return [];
  const top = Math.max(...acts.map(actAverage));
  let k = 0;
  return acts.map(a => ({
    performer: a.performer,
    award: actAverage(a) === top ? TOP_AWARD : AWARDS[k++ % AWARDS.length],
  }));
}
