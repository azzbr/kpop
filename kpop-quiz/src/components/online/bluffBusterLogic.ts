// Bluff Buster rules (pure). A weird true fact has a gap; everyone types a FAKE answer, then
// everyone picks which option they think is the truth.
//   +2 for picking the real answer
//   +1 to every author of a fake for each other player it fooled
import { matchTyped, normaliseAnswer } from '../../online/quiz/quizLogic';
import { isRude } from '../../online/rudeWords';
import { BLUFF_PROMPTS } from '../../online/bluffFacts';
import type { BluffPrompt } from '../../online/bluffFacts';

export const ROUNDS = 5;
export const WRITE_MS = 45_000;
export const PICK_MS = 25_000;
export const MAX_FAKE = 20;
export const TRUTH_POINTS = 2;
export const FOOL_POINTS = 1;
/** Reveal time: a base plus a little per option, so the flips have time to play. */
export const revealMs = (options: number) => 7000 + 900 * options;

export const REAL_KEY = 'real';

export type FakeCheck = 'empty' | 'unkind' | 'real' | 'ok';

/** How fakes are shown: lowercase, single spaces, letters and spaces only. */
export const tidyFake = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_FAKE);

/** Two answers are "the same" if they match ignoring case, spaces and a leading the/a/an. */
export const fakeKey = (s: string) => normaliseAnswer(s).replace(/ /g, '');

export const truths = (p: BluffPrompt) => [p.answer, ...(p.alt ?? [])];

/** Is this fake allowed? (A fake that is really the true answer is refused.) */
export function checkFake(text: string, prompt?: BluffPrompt): FakeCheck {
  const t = tidyFake(text);
  if (fakeKey(t).length === 0) return 'empty';
  if (isRude(t)) return 'unkind';
  if (prompt && matchTyped(t, truths(prompt))) return 'real';
  return 'ok';
}

export interface BluffOption { key: string; text: string; authors: string[] }

/**
 * The options to pick from: the real answer once, plus each distinct fake (identical fakes
 * merge, keeping every author), shuffled with `rng`.
 */
export function buildOptions(fakes: Record<string, string>, prompt: BluffPrompt, rng: () => number = Math.random): BluffOption[] {
  const byKey = new Map<string, BluffOption>();
  let n = 0;
  for (const [author, raw] of Object.entries(fakes)) {
    if (checkFake(raw, prompt) !== 'ok') continue;
    const k = fakeKey(raw);
    const have = byKey.get(k);
    if (have) have.authors.push(author);
    else byKey.set(k, { key: `f${n++}`, text: tidyFake(raw), authors: [author] });
  }
  const opts = [{ key: REAL_KEY, text: prompt.answer, authors: [] }, ...byKey.values()];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

/** May this player pick this option? Not one they wrote themselves. */
export const canPick = (opt: BluffOption | undefined, player: string) => !!opt && !opt.authors.includes(player);

/** Points this round. `picks` maps player → option key. */
export function scoreBluff(options: BluffOption[], picks: Record<string, string>): Record<string, number> {
  const pts: Record<string, number> = {};
  const add = (id: string, n: number) => { pts[id] = (pts[id] ?? 0) + n; };
  for (const [player, key] of Object.entries(picks)) {
    const opt = options.find(o => o.key === key);
    if (!canPick(opt, player) || !opt) continue;
    if (opt.key === REAL_KEY) add(player, TRUTH_POINTS);
    else for (const a of opt.authors) add(a, FOOL_POINTS);
  }
  return pts;
}

/** `n` different prompts. */
export function pickPrompts(n: number, rng: () => number = Math.random, pool: BluffPrompt[] = BLUFF_PROMPTS): BluffPrompt[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
