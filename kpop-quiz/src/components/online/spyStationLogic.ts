// Spy Station rules (pure). Everyone but the spy knows the secret place. Players take turns
// asking each other question cards and answering with one word; then everyone votes for the spy.
//   Spy caught and can't name the place → every local +2
//   Spy escapes, steals by naming the place, or calls it right early → spy +3
//   Spy calls it early and is wrong → every local +2
import { isRude } from '../../online/rudeWords';
import { SPY_PLACES, SPY_QUESTIONS } from '../../online/spyPlaces';
import type { SpyPlace, SpyQuestionId } from '../../online/spyPlaces';

export const ROUNDS = 2;
export const INTRO_MS = 10_000;
export const ASK_MS = 25_000;
export const ANSWER_MS = 25_000;
export const VOTE_MS = 30_000;
export const GUESS_MS = 25_000;
export const RESULT_MS = 10_000;
export const LOCAL_POINTS = 2;
export const SPY_POINTS = 3;
export const GUESS_OPTIONS = 12;
export const CHIPS = 6;
export const MAX_WORD = 14;
/** Questions before the vote: about two laps, capped so a big room stays quick. */
export const questionCount = (players: number) => Math.max(4, Math.min(2 * players, 12));
/** Anyone may call the vote early after this many answers. */
export const EARLY_VOTE_AFTER = 3;

type Rng = () => number;

function shuffle<T>(a: T[], rng: Rng): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const placeById = (id: string, places: SpyPlace[] = SPY_PLACES) => places.find(p => p.id === id);

/** A different spy every round (if there are enough players). */
export function pickSpies(ids: string[], rounds: number, rng: Rng = Math.random): string[] {
  const order = shuffle(ids, rng);
  return Array.from({ length: rounds }, (_, i) => order[i % order.length]);
}

/** Different places every round. */
export const pickPlaces = (rounds: number, rng: Rng = Math.random, places: SpyPlace[] = SPY_PLACES) => shuffle(places, rng).slice(0, rounds);

/** Locals get the place's roles (shuffled, repeating if needed); the spy gets none. */
export function assignRoles(ids: string[], spy: string, place: SpyPlace, rng: Rng = Math.random): Record<string, string> {
  const roles = shuffle(place.roles, rng);
  const out: Record<string, string> = {};
  ids.filter(id => id !== spy).forEach((id, i) => { out[id] = roles[i % roles.length]; });
  return out;
}

/** Three different question cards, avoiding the last ones asked where possible. */
export function questionCards(rng: Rng = Math.random, recent: SpyQuestionId[] = []): SpyQuestionId[] {
  const fresh = SPY_QUESTIONS.map(q => q.id).filter(q => !recent.includes(q));
  const pool = fresh.length >= 3 ? fresh : SPY_QUESTIONS.map(q => q.id);
  return shuffle(pool, rng).slice(0, 3);
}

const lower = (s: string) => s.toLowerCase();

/**
 * Answer chips for one question: locals get 3 answers that fit the place + 3 decoys from other
 * places; the spy (who doesn't know the place) gets 2 that fit + 4 decoys, so it isn't obvious.
 */
export function answerChips(place: SpyPlace, q: SpyQuestionId, isSpy: boolean, rng: Rng = Math.random, places: SpyPlace[] = SPY_PLACES): string[] {
  const real = place.answers[q];
  const realSet = new Set(real.map(lower));
  const fit = isSpy ? 2 : 3;
  const decoyPool = Array.from(new Map(places.filter(p => p.id !== place.id).flatMap(p => p.answers[q])
    .filter(a => !realSet.has(lower(a))).map(a => [lower(a), a])).values());
  return shuffle([...shuffle(real, rng).slice(0, fit), ...shuffle(decoyPool, rng).slice(0, CHIPS - fit)], rng);
}

/** The places the spy can guess from: the real one plus others, shuffled. */
export function guessOptions(place: SpyPlace, rng: Rng = Math.random, places: SpyPlace[] = SPY_PLACES, n = GUESS_OPTIONS): string[] {
  const others = shuffle(places.filter(p => p.id !== place.id), rng).slice(0, n - 1).map(p => p.id);
  return shuffle([place.id, ...others], rng);
}

/** Who got the most votes (null when nobody voted or it's a tie). */
export function tallyVotes(votes: Record<string, string>): { counts: Record<string, number>; top: string | null } {
  const counts: Record<string, number> = {};
  for (const [voter, suspect] of Object.entries(votes)) if (voter !== suspect) counts[suspect] = (counts[suspect] ?? 0) + 1;
  const best = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter(k => counts[k] === best);
  return { counts, top: best > 0 && leaders.length === 1 ? leaders[0] : null };
}

export type Outcome = 'caught_missed' | 'caught_stole' | 'escaped' | 'called_right' | 'called_wrong';

export const spyWins = (o: Outcome) => o === 'caught_stole' || o === 'escaped' || o === 'called_right';

/** Points for a round. */
export function scoreRound(outcome: Outcome, spy: string, ids: string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  if (spyWins(outcome)) out[spy] = SPY_POINTS;
  else for (const id of ids) if (id !== spy) out[id] = LOCAL_POINTS;
  return out;
}

/** A typed answer: one word, letters (and hyphens) only. */
export const tidyWord = (s: string) => s.replace(/[^a-z-]/gi, '').slice(0, MAX_WORD);
export type WordCheck = 'empty' | 'unkind' | 'ok';
export function checkWord(s: string): WordCheck {
  const t = tidyWord(s);
  if (!/[a-z]/i.test(t)) return 'empty';
  return isRude(t) ? 'unkind' : 'ok';
}
/** Title-case a one-word answer for showing. */
export const showWord = (s: string) => {
  const t = tidyWord(s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
