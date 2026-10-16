// Monster Mash rules (pure). Cooperative and silly: each player secretly draws one part of a
// monster (hat / head / body / legs / feet), with guide dots where the neighbouring parts join.
// The parts are stacked and revealed, everyone names the monster, and everyone votes for the
// best name (never their own). With 6 players there are two monsters at once: each team names
// the OTHER team's monster, and the artists of a monster pick its best name.
//   +1 "Monster Maker" point for sending your part each round
//   +1 for every vote your name gets
import { isKidSafe } from '../../online/rudeWords';
import { MONSTER_THEMES, type Part, type MonsterTheme } from '../../online/monsterParts';

export const DRAW_MS = 60_000;
export const NAME_MS = 35_000;
export const VOTE_MS = 20_000;
export const GRACE_MS = 2500;
export const RESULT_MS = 9000;
export const MAX_NAME = 20;
export const MAKER_POINTS = 1;
export const VOTE_POINTS = 1;
/** The stacking animation: one part drops in every PART_DROP_MS, then a little wiggle. */
export const PART_DROP_MS = 900;
export const stackMs = (parts: number) => 2200 + parts * PART_DROP_MS;

const ORDER: Part[] = ['hat', 'head', 'body', 'legs', 'feet'];
const partsFor = (k: number): Part[] =>
  k >= 5 ? ORDER : k === 4 ? ['hat', 'head', 'body', 'legs'] : k === 3 ? ['head', 'body', 'legs'] : k === 2 ? ['head', 'body'] : ['body'];

/** Which monsters (top-to-bottom part lists) a room of `n` players builds. */
export function monsterPlan(n: number): Part[][] {
  if (n <= 5) return [partsFor(Math.max(1, n))];
  return [partsFor(Math.min(5, Math.ceil(n / 2))), partsFor(Math.min(5, Math.floor(n / 2)))];
}

export interface Slot { monster: number; slot: number; part: Part }

// Six players, three rounds: every player draws a head, a body and legs once each, and the two
// teams are mixed up every round ((i + round) % 3 is the part; this table is the team).
const TEAM6 = [[0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 1, 0], [0, 1, 0, 1, 0, 1]];

/** Who draws which part this round (`ids` in seat order; shuffle them once at the start). */
export function assignParts(ids: string[], round: number): Record<string, Slot> {
  const plan = monsterPlan(ids.length);
  const out: Record<string, Slot> = {};
  if (plan.length === 1) {
    ids.forEach((id, i) => {
      const slot = (i + round) % plan[0].length;
      out[id] = { monster: 0, slot, part: plan[0][slot] };
    });
    return out;
  }
  if (ids.length === 6) {
    ids.forEach((id, i) => {
      const slot = (i + round) % 3;
      out[id] = { monster: TEAM6[round % 3][i], slot, part: plan[0][slot] };
    });
    return out;
  }
  // Bigger rooms (not offered in the lobby): interleave the two monsters' slots and rotate.
  const slots: Slot[] = [];
  for (let k = 0; k < Math.max(plan[0].length, plan[1].length); k++) {
    for (const m of [0, 1]) if (k < plan[m].length) slots.push({ monster: m, slot: k, part: plan[m][k] });
  }
  ids.forEach((id, i) => { out[id] = slots[(i + round) % slots.length]; });
  return out;
}

/** The parts next to a slot (what the guide dots at the top and bottom edges join to). */
export function neighbours(plan: Part[][], s: Slot): { above?: Part; below?: Part } {
  const parts = plan[s.monster] ?? [];
  return { above: parts[s.slot - 1], below: parts[s.slot + 1] };
}

const SEAMS = [[0.4, 0.6], [0.3, 0.7], [0.35, 0.5, 0.65], [0.25, 0.75], [0.42, 0.58], [0.3, 0.5, 0.7]];

/** Where lines meet across each join: seams[monster][k] = x positions (0..1) between part k and k+1. */
export function makeSeams(plan: Part[][], rng: () => number = Math.random): number[][][] {
  return plan.map(parts => Array.from({ length: Math.max(0, parts.length - 1) }, () => SEAMS[Math.floor(rng() * SEAMS.length)]));
}

/** `rounds` different themes. */
export function pickThemes(rounds: number, rng: () => number = Math.random): MonsterTheme[] {
  const deck = [...MONSTER_THEMES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, rounds);
}

export const roundsFrom = (v: unknown) => (v === '2' ? 2 : 3);

// ---- Names ----

export const tidyName = (s: string) => s.replace(/[^A-Za-z ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
/** Shown with capital letters: "captain fluffy" → "Captain Fluffy". */
export const prettyName = (s: string) => tidyName(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
export const nameKey = (s: string) => tidyName(s).toLowerCase().replace(/ /g, '');

export type NameCheck = 'empty' | 'unkind' | 'ok';
export function checkName(s: string): NameCheck {
  const t = tidyName(s);
  if (!nameKey(t)) return 'empty';
  if (!isKidSafe(t)) return 'unkind';
  return 'ok';
}

/** Who names monster `m`: everyone with one monster, otherwise the players who didn't draw it. */
export function namersOf(m: number, assign: Record<string, Slot>, ids: string[], monsters: number): string[] {
  return monsters === 1 ? ids : ids.filter(id => assign[id]?.monster !== m);
}
/** Who votes on monster `m`'s names: everyone with one monster, otherwise its artists. */
export function votersOf(m: number, assign: Record<string, Slot>, ids: string[], monsters: number): string[] {
  return monsters === 1 ? ids : ids.filter(id => assign[id]?.monster === m);
}

export interface NameOption { key: string; text: string; authors: string[] }

/** The names to vote on (identical names merge and keep every author), shuffled. */
export function nameOptions(names: Record<string, string>, rng: () => number = Math.random): NameOption[] {
  const byKey = new Map<string, NameOption>();
  for (const [author, raw] of Object.entries(names)) {
    if (checkName(raw) !== 'ok') continue;
    const k = nameKey(raw);
    const have = byKey.get(k);
    if (have) have.authors.push(author);
    else byKey.set(k, { key: `n${byKey.size}`, text: prettyName(raw), authors: [author] });
  }
  const out = [...byKey.values()];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const canVoteName = (opt: NameOption | undefined, voter: string) => !!opt && !opt.authors.includes(voter);

/** Has this voter something to vote for (not only their own name)? */
export const hasNameChoice = (options: NameOption[], voter: string) => options.some(o => canVoteName(o, voter));

/** +1 to every author for each valid vote; and the winning option keys (ties share). */
export function scoreNames(options: NameOption[], votes: Record<string, string>): { points: Record<string, number>; winners: string[]; counts: Record<string, number> } {
  const points: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [voter, key] of Object.entries(votes)) {
    const opt = options.find(o => o.key === key);
    if (!canVoteName(opt, voter) || !opt) continue;
    counts[key] = (counts[key] ?? 0) + 1;
    for (const a of opt.authors) points[a] = (points[a] ?? 0) + VOTE_POINTS;
  }
  const best = Math.max(0, ...Object.values(counts));
  return { points, counts, winners: best === 0 ? [] : Object.keys(counts).filter(k => counts[k] === best) };
}

export const picId = (round: number, by: string) => `mash${round}.${by}`;
