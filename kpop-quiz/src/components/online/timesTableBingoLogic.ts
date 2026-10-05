// Times-Table Bingo rules (pure).
import { rankByScore } from '../../online/helloGate';

export const CALL_EVERY_MS = 8000;
export const CARD_SIZE = 16; // 4×4

export const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

export interface Call { a: number; b: number; answer: number }

const shuffle = <T,>(arr: T[], rand: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Every product of 2–12 × 2–12 once (one sum for each answer), in random order. */
export function buildCalls(rand: () => number = Math.random): Call[] {
  const pairs: [number, number][] = [];
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) pairs.push([a, b]);
  const seen = new Set<number>();
  const calls: Call[] = [];
  for (const [a, b] of shuffle(pairs, rand)) {
    if (seen.has(a * b)) continue;
    seen.add(a * b);
    calls.push({ a, b, answer: a * b });
  }
  return calls;
}

/** 16 different answers from the calls. */
export const dealCard = (calls: Call[], rand: () => number = Math.random) =>
  shuffle(calls.map(c => c.answer), rand).slice(0, CARD_SIZE);

/** A cell can be marked once its number has been called. */
export const canMark = (card: number[], cell: number, called: ReadonlySet<number>) =>
  Number.isInteger(cell) && cell >= 0 && cell < card.length && called.has(card[cell]);

/** The first full line in the marked cells, or null. */
export const findLine = (marked: number[]) => LINES.find(line => line.every(c => marked.includes(c))) ?? null;

/** Bingo winner first, then everyone by how many squares they marked (equal = shared place). */
export function bingoRanking(winner: string | null, marks: Record<string, number[]>): (string | string[])[] {
  const counts: Record<string, number> = {};
  for (const [id, m] of Object.entries(marks)) counts[id] = m.length;
  if (!winner) return rankByScore(counts);
  return [winner, ...rankByScore(counts, Object.keys(counts).filter(id => id !== winner))];
}
