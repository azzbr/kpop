// Riddle Rush rules — pure, no React. The host runs these; RiddleRush.tsx is only UI + sync.
//
// A round lasts ROUND_MS. Everyone sees the letter count from the start; the hint appears at
// 12 s, the first letter at 22 s and the last letter at 29 s. Each hint showing lowers the
// points for a right answer (100 / 70 / 50 / 30), plus a speed bonus of up to 50.
import type { Rng } from '../games/engine/rng';
import { levenshtein, matchTyped, normaliseAnswer } from './quiz/quizLogic';
import type { Riddle, RiddleDifficulty, RiddleKind } from './riddles';

export const ROUNDS = 8;
export const ROUND_MS = 35_000;
/** When each extra hint shows (ms into the round): the hint, the first letter, the last letter. */
export const HINT_AT = [12_000, 22_000, 29_000] as const;
export const TIER_POINTS = [100, 70, 50, 30] as const;
export const SPEED_BONUS = 50;
export const ANSWER_MS = 6500;
export const MAX_GUESS = 30;

export type Difficulty = RiddleDifficulty;
export type KindSetting = 'mixed' | RiddleKind;

/** How many hints are showing `elapsed` ms into a round (0–3). */
export function hintLevel(elapsedMs: number): number {
  return HINT_AT.filter(t => elapsedMs >= t).length;
}

/** Points for a right answer with `level` hints showing and `leftMs` of the round left. */
export function points(level: number, leftMs: number, roundMs = ROUND_MS): number {
  const base = TIER_POINTS[Math.max(0, Math.min(TIER_POINTS.length - 1, level))];
  return base + Math.round(SPEED_BONUS * Math.max(0, Math.min(1, leftMs / roundMs)));
}

/**
 * The answer as blanks, word by word. Letters show once their hint is out: the first letter
 * at level 2, the last letter at level 3 (for answers of 3+ letters). Non-letters always show.
 */
export function maskAnswer(answer: string, level: number): (string | null)[][] {
  const words = answer.trim().split(/\s+/);
  const letters = words.join('').replace(/[^a-z0-9]/gi, '');
  const total = letters.length;
  let i = 0;
  return words.map(wd => [...wd].map(ch => {
    if (!/[a-z0-9]/i.test(ch)) return ch;
    const idx = i++;
    if (level >= 2 && idx === 0) return ch.toUpperCase();
    if (level >= 3 && total >= 3 && idx === total - 1) return ch.toUpperCase();
    return null;
  }));
}

/** "5 letters" / "2 words: 4 + 5". */
export function lengthLabel(answer: string): string {
  const words = answer.trim().split(/\s+/).map(x => x.replace(/[^a-z0-9]/gi, '').length).filter(Boolean);
  if (words.length === 1) return `${words[0]} letter${words[0] === 1 ? '' : 's'}`;
  return `${words.length} words: ${words.join(' + ')}`;
}

export type Judgement = 'right' | 'close' | 'wrong';

const squash = (s: string) => normaliseAnswer(s).replace(/ /g, '');

/**
 * Right (forgiving case, spaces, "the/a", a small typo, a plural), close (a few letters off —
 * only ever told to the guesser), or wrong.
 */
export function judgeGuess(input: string, r: Pick<Riddle, 'answer' | 'alt'>): Judgement {
  const got = squash(input);
  if (!got) return 'wrong';
  const accepted = [r.answer, ...(r.alt ?? [])];
  if (matchTyped(input, accepted)) return 'right';
  for (const a of accepted) {
    const want = squash(a);
    if (!want) continue;
    if (got === `${want}s` || `${got}s` === want || got === `${want}es`) return 'right';
  }
  for (const a of accepted) {
    const want = squash(a);
    if (want.length < 3) continue;
    const d = levenshtein(got, want);
    const near = want.length >= 9 ? 3 : want.length >= 5 ? 2 : 1;
    if (d <= near) return 'close';
    const shorter = got.length < want.length ? got : want;
    const longer = got.length < want.length ? want : got;
    if (shorter.length >= 3 && longer.includes(shorter) && shorter.length / longer.length >= 0.6) return 'close';
  }
  return 'wrong';
}

const ORDER: Difficulty[] = ['easy', 'tricky', 'genius'];
const isDifficulty = (v: unknown): v is Difficulty => ORDER.includes(v as Difficulty);

/** Lobby config → settings (unknown values fall back to the defaults). */
export function readConfig(config: Record<string, string> | undefined): { difficulty: Difficulty; kind: KindSetting; board: boolean } {
  const d = config?.difficulty;
  const k = config?.kind;
  return {
    difficulty: isDifficulty(d) ? d : 'easy',
    kind: k === 'word' || k === 'emoji' ? k : 'mixed',
    board: config?.board === '1',
  };
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `n` riddles of the chosen kind and difficulty. If there aren't enough, the nearest
 * difficulty fills in (Genius → Tricky → Easy). "Mixed" mixes in about one emoji riddle in four.
 */
export function chooseRiddles(bank: readonly Riddle[], difficulty: Difficulty, kind: KindSetting, n: number, rng: Rng): Riddle[] {
  const byDistance = [...ORDER].sort((a, b) => Math.abs(ORDER.indexOf(a) - ORDER.indexOf(difficulty)) - Math.abs(ORDER.indexOf(b) - ORDER.indexOf(difficulty)));
  const take = (pool: readonly Riddle[], count: number): Riddle[] => {
    const out: Riddle[] = [];
    for (const d of byDistance) {
      if (out.length >= count) break;
      out.push(...shuffle(pool.filter(r => r.difficulty === d), rng).slice(0, count - out.length));
    }
    return out;
  };
  if (kind !== 'mixed') return take(bank.filter(r => r.kind === kind), n);
  const emojiCount = Math.round(n / 4);
  const emoji = take(bank.filter(r => r.kind === 'emoji'), emojiCount);
  const words = take(bank.filter(r => r.kind === 'word'), n - emoji.length);
  return shuffle([...words, ...emoji], rng);
}
