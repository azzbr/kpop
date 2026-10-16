// Doodle Decoy rules (pure). Everyone draws a secret silly prompt. Then, one drawing at a time,
// everyone except the artist writes a FAKE title, and then votes for the real one.
//   +2 for spotting the real title (typing it exactly also counts as spotting it)
//   +1 to a faker for every vote their fake gets
//   artist +1 for every player who found the real title
import { isKidSafe } from '../../online/rudeWords';
import { DECOY_PROMPTS } from '../../online/decoyPrompts';

export const DRAW_MS = 75_000;
export const TITLE_MS = 40_000;
export const VOTE_MS = 20_000;
export const GRACE_MS = 2500;
export const MAX_TITLE = 32;
export const SPOT_POINTS = 2;
export const FOOL_POINTS = 1;
export const ARTIST_POINTS = 1;
export const REAL_KEY = 'real';

/** Reveal time: a base plus time for every option to flip over. */
export const revealMs = (options: number) => 6000 + 1300 * options;

const SMALL = new Set(['a', 'an', 'the']);
/** Two titles are "the same" if they match ignoring case, punctuation, spaces and a/an/the. */
export const titleKey = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !SMALL.has(w)).join(' ');

/** How a typed title is shown: lower case letters, digits and single spaces. */
export const tidyTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

export type TitleCheck = 'empty' | 'unkind' | 'ok';
export function checkTitle(text: string): TitleCheck {
  const t = tidyTitle(text);
  if (!titleKey(t)) return 'empty';
  if (!isKidSafe(t)) return 'unkind';
  return 'ok';
}

export interface DecoyOption { key: string; text: string; authors: string[] }

/**
 * The titles to vote on: the real one, plus each distinct fake (identical fakes merge and keep
 * every author). A fake that IS the real title isn't shown: its writer found it (`typedReal`).
 */
export function buildOptions(real: string, fakes: Record<string, string>, rng: () => number = Math.random): { options: DecoyOption[]; typedReal: string[] } {
  const realKey = titleKey(real);
  const byKey = new Map<string, DecoyOption>();
  const typedReal: string[] = [];
  let n = 0;
  for (const [author, raw] of Object.entries(fakes)) {
    if (checkTitle(raw) !== 'ok') continue;
    const k = titleKey(raw);
    if (k === realKey) { typedReal.push(author); continue; }
    const have = byKey.get(k);
    if (have) have.authors.push(author);
    else byKey.set(k, { key: `f${n++}`, text: tidyTitle(raw), authors: [author] });
  }
  const options: DecoyOption[] = [{ key: REAL_KEY, text: real, authors: [] }, ...byKey.values()];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, typedReal };
}

/** May this player vote for this option? Not the artist, not someone who already found it, not your own fake. */
export function canVote(opt: DecoyOption | undefined, voter: string, artist: string, typedReal: string[] = []): boolean {
  return !!opt && voter !== artist && !typedReal.includes(voter) && !opt.authors.includes(voter);
}

/** Who still has to vote: everyone except the artist and the players who typed the real title. */
export const votersFor = (ids: string[], artist: string, typedReal: string[]) => ids.filter(id => id !== artist && !typedReal.includes(id));

/** Points for one drawing. `votes` maps voter → option key. */
export function scoreDrawing(options: DecoyOption[], votes: Record<string, string>, typedReal: string[], artist: string): Record<string, number> {
  const pts: Record<string, number> = {};
  const add = (id: string, n: number) => { pts[id] = (pts[id] ?? 0) + n; };
  for (const id of typedReal) { if (id === artist) continue; add(id, SPOT_POINTS); add(artist, ARTIST_POINTS); }
  for (const [voter, key] of Object.entries(votes)) {
    const opt = options.find(o => o.key === key);
    if (!opt || !canVote(opt, voter, artist, typedReal)) continue;
    if (opt.key === REAL_KEY) { add(voter, SPOT_POINTS); add(artist, ARTIST_POINTS); } else for (const a of opt.authors) add(a, FOOL_POINTS);
  }
  return pts;
}

/** `n` different prompts (cycling only if there are more players than prompts). */
export function dealPrompts(n: number, rng: () => number = Math.random): string[] {
  const deck = [...DECOY_PROMPTS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: n }, (_, i) => deck[i % deck.length]);
}

/** The order drawings are shown in: everyone who drew, shuffled. */
export function drawingOrder(ids: string[], drew: Record<string, string>, rng: () => number = Math.random): string[] {
  const out = ids.filter(id => drew[id]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const picId = (by: string) => `decoy.${by}`;
