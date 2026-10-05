// Pure rules shared by the two race engines (GuessRace = type the answer, TapRace = tap the
// answer). No React — tested in raceLogic.test.ts.
import { matchTyped, normaliseAnswer } from '../../online/quiz/quizLogic';
import type { RoomPlayer } from '../../online/useRoom';

/** A player by id, or a friendly stand-in for someone who has left. */
export const lookupPlayer = (players: RoomPlayer[], id: string): RoomPlayer =>
  players.find(p => p.id === id) || { id, name: 'A friend', emoji: '🙂', isHost: false, joinedAt: 0 };

/** Which keyboard / matching a GuessRace uses. */
export type AnswerKind = 'words' | 'digits';

/**
 * Is a typed guess right?
 * - digits: only the digits count, they must match exactly (no leading-zero tricks: "07" ≠ "7"
 *   unless the answer is "07", which Memory Digits needs).
 * - words, fuzzy: case, punctuation, spaces, "the/a/an" and one small typo on longer words are
 *   forgiven (riddles, emoji puzzles). Any of `alts` is also accepted.
 * - words, strict: case, spaces and punctuation are ignored but the letters must be exact
 *   (Word Scramble — the letters are on screen, so a typo is a different word).
 */
export function checkGuess(input: string, answer: string, alts: string[] = [], kind: AnswerKind = 'words', fuzzy = true): boolean {
  if (kind === 'digits') {
    const got = input.replace(/\D/g, '');
    return got.length > 0 && [answer, ...alts].some(a => a.replace(/\D/g, '') === got);
  }
  if (fuzzy) return matchTyped(input, [answer, ...alts]);
  const squash = (s: string) => normaliseAnswer(s).replace(/ /g, '');
  const got = squash(input);
  return got.length > 0 && [answer, ...alts].some(a => squash(a) === got);
}

/** Letters/digits in an answer (the "7 letters" hint). */
export const answerLength = (s: string) => s.replace(/[^a-z0-9]/gi, '').length;

/** Speed points: 100 for a right answer plus up to 100 more for answering early. */
export function speedPoints(leftMs: number, roundMs: number): number {
  const frac = Math.max(0, Math.min(1, leftMs / roundMs));
  return 100 + Math.round(100 * frac);
}

/**
 * Final ranking, best first, with tied players sharing a rung (the shape finishArenaGame takes).
 * Everyone in `ids` is ranked (a player with no points is on the last rung, not dropped).
 */
export function rankScores(scores: Record<string, number>, ids: string[]): string[][] {
  const all = [...new Set([...ids, ...Object.keys(scores)])];
  const byScore = new Map<number, string[]>();
  for (const id of all) {
    const s = scores[id] ?? 0;
    byScore.set(s, [...(byScore.get(s) ?? []), id]);
  }
  return [...byScore.entries()].sort((a, b) => b[0] - a[0]).map(([, rung]) => rung);
}

/** Has every player in the room had their go this round? (Empty room → false.) */
export function everyoneDone(playerIds: string[], done: Record<string, boolean>): boolean {
  return playerIds.length > 0 && playerIds.every(id => done[id]);
}

/** Has every non-host player said hello (so the host can start without waiting 3 s)? */
export function everyoneHere(playerIds: string[], hostId: string, hellos: Set<string>): boolean {
  return playerIds.every(id => id === hostId || hellos.has(id));
}

/** Place labels for a tied ranking: [[a],[b,c],[d]] → { a: 1, b: 2, c: 2, d: 4 }. */
export function placesOf(ranked: string[][]): Record<string, number> {
  const out: Record<string, number> = {};
  let place = 1;
  for (const rung of ranked) {
    for (const id of rung) out[id] = place;
    place += rung.length;
  }
  return out;
}
