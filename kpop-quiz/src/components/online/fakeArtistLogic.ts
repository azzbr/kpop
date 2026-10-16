// Fake Artist rules (pure — no React, no canvas).
// Everyone draws ONE shared picture of a secret word, one stroke per turn, two laps. One
// player — the fake artist — only knows the category and has to blend in. Then everyone votes.
import { FAKE_ARTIST_CATEGORIES } from '../../online/fakeArtistWords';

export const CARD_MS = 7_000;
export const TURN_MS = 20_000;
export const VOTE_MS = 35_000;
export const DRUM_MS = 3_000;
export const UNMASK_MS = 5_500;
export const GUESS_MS = 20_000;
export const REVEAL_MS = 7_500;
export const LAPS = 2;
export const STROKES_PER_TURN = 1;
export const CHOICES = 6;
export const ARTIST_POINTS = 2;
export const FAKE_POINTS = 3;

/** One pen colour per player, in seat order (easy to tell apart on white paper). */
export const PLAYER_COLORS = ['#ef4444', '#2563eb', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#92400e', '#38bdf8', '#15803d', '#1f2937'];

export interface FaConfig { rounds: number; category: string; board: boolean }

export function parseConfig(config: Record<string, string> = {}): FaConfig {
  const category = FAKE_ARTIST_CATEGORIES.some(c => c.category === config.category) ? config.category : 'mixed';
  return { rounds: config.rounds === '3' ? 3 : 2, category, board: config.board === '1' };
}

const shuffle = <T>(a: T[], rand: () => number): T[] => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const colorsFor = (ids: string[]): Record<string, string> =>
  Object.fromEntries(ids.map((id, i) => [id, PLAYER_COLORS[i % PLAYER_COLORS.length]]));

/** Who is the fake each round: a different player every round while possible. */
export function fakeOrder(ids: string[], rounds: number, rand: () => number = Math.random): string[] {
  const out: string[] = [];
  while (out.length < rounds && ids.length) out.push(...shuffle(ids, rand));
  return out.slice(0, rounds);
}

/** Drawing turns for a round: a shuffled seat order, the fake never first, repeated LAPS times. */
export function turnOrder(ids: string[], fake: string, rand: () => number = Math.random, laps = LAPS): string[] {
  const seat = shuffle(ids, rand);
  if (seat.length > 1 && seat[0] === fake) [seat[0], seat[1]] = [seat[1], seat[0]];
  return Array.from({ length: laps }, () => seat).flat();
}

export interface SecretWord { word: string; category: string }

/** A fresh secret word (from one category or any), avoiding words already used this game. */
export function pickWord(category: string, used: string[], rand: () => number = Math.random): SecretWord {
  const cats = FAKE_ARTIST_CATEGORIES.filter(c => category === 'mixed' || c.category === category);
  const pool = (cats.length ? cats : FAKE_ARTIST_CATEGORIES).flatMap(c => c.words.map(word => ({ word, category: c.category })));
  const fresh = pool.filter(p => !used.includes(p.word));
  const src = fresh.length ? fresh : pool;
  return src[Math.floor(rand() * src.length)];
}

/** The fake's last chance: the real word and 5 others from the same category, shuffled. */
export function guessChoices(secret: SecretWord, rand: () => number = Math.random): string[] {
  const cat = FAKE_ARTIST_CATEGORIES.find(c => c.category === secret.category);
  const others = shuffle((cat?.words ?? []).filter(w => w !== secret.word), rand).slice(0, CHOICES - 1);
  return shuffle([secret.word, ...others], rand);
}

export const validVote = (from: string, target: unknown, ids: string[]): target is string =>
  typeof target === 'string' && from !== target && ids.includes(from) && ids.includes(target);

export function tally(votes: Record<string, string>): Record<string, number> {
  const t: Record<string, number> = {};
  for (const v of Object.values(votes)) t[v] = (t[v] ?? 0) + 1;
  return t;
}

/** The one player with the most votes, or null for a tie / no votes (then the fake escapes). */
export function mostVoted(votes: Record<string, string>): string | null {
  const t = Object.entries(tally(votes)).sort((a, b) => b[1] - a[1]);
  if (!t.length || (t[1] && t[1][1] === t[0][1])) return null;
  return t[0][0];
}

/** Points for a round: artists +2 each if the fake is caught and misses the word; else the fake +3. */
export function roundPoints(ids: string[], fake: string, caught: boolean, guessedRight: boolean): Record<string, number> {
  const fakeWins = !caught || guessedRight;
  return Object.fromEntries(ids.map(id => [id, id === fake ? (fakeWins ? FAKE_POINTS : 0) : fakeWins ? 0 : ARTIST_POINTS]));
}

/** All present voters have voted (the vote can end early). */
export const allVoted = (voters: string[], votes: Record<string, string>) => voters.length > 0 && voters.every(id => votes[id] !== undefined);
