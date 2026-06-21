import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import GuessRace, { type GuessRound } from './GuessRace';

// "What comes next?" number-sequence logic. Reuses the GuessRace engine.
// Difficulty changes the kinds of rules, from simple steps to Fibonacci,
// squares, cubes, two-step rules and interleaved sequences.

const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const arithmetic = (loA: number, hiA: number, loD: number, hiD: number, sign = 1): number[] => {
  const a = randInt(loA, hiA);
  const d = randInt(loD, hiD) * sign;
  return Array.from({ length: 6 }, (_, i) => a + d * i);
};
const geometric = (loA: number, hiA: number, r: number): number[] => {
  const a = randInt(loA, hiA);
  return Array.from({ length: 6 }, (_, i) => a * Math.pow(r, i));
};
const squares = (): number[] => {
  const k = randInt(1, 4);
  return Array.from({ length: 6 }, (_, i) => (k + i) * (k + i));
};
const cubes = (): number[] => {
  const k = randInt(1, 3);
  return Array.from({ length: 6 }, (_, i) => Math.pow(k + i, 3));
};
const fib = (a: number, b: number): number[] => {
  const t = [a, b];
  for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]);
  return t;
};
const triangular = (): number[] => {
  const s = randInt(1, 3);
  return Array.from({ length: 6 }, (_, i) => {
    const n = s + i;
    return (n * (n + 1)) / 2;
  });
};
const twoStep = (m: number, c: number, a0: number): number[] => {
  const t = [a0];
  for (let i = 1; i < 6; i++) t.push(t[i - 1] * m + c);
  return t;
};
const interleave = (): number[] => {
  const a0 = randInt(1, 9);
  const da = randInt(1, 6);
  const b0 = randInt(25, 45);
  const db = randInt(1, 6);
  const A = [a0, a0 + da, a0 + 2 * da];
  const B = [b0, b0 - db, b0 - 2 * db];
  return [A[0], B[0], A[1], B[1], A[2], B[2]];
};

type Gen = () => number[];

const TIERS: Record<string, Gen[]> = {
  easy: [
    () => arithmetic(1, 9, 1, 5),
    () => geometric(1, 4, 2),
    () => arithmetic(2, 6, 2, 4),
  ],
  medium: [
    () => arithmetic(2, 15, 3, 12),
    () => arithmetic(45, 70, 3, 9, -1),
    () => geometric(1, 3, 3),
    () => fib(1, 2),
  ],
  hard: [
    squares,
    () => fib(randInt(1, 3), randInt(2, 4)),
    triangular,
    () => twoStep(2, randInt(1, 3), randInt(1, 4)),
    () => geometric(1, 2, 4),
  ],
  expert: [
    cubes,
    () => fib(randInt(3, 6), randInt(5, 9)),
    interleave,
    () => twoStep(2, -1, randInt(3, 6)),
    () => geometric(2, 3, 3),
  ],
  master: [
    cubes,
    interleave,
    () => twoStep(3, randInt(1, 4), randInt(1, 3)),
    () => twoStep(2, randInt(2, 5), randInt(2, 5)),
    () => geometric(2, 4, 3),
    () => fib(randInt(4, 8), randInt(7, 12)),
  ],
};

function makeRounds(difficulty: string, n: number): GuessRound[] {
  const gens = TIERS[difficulty] || TIERS.medium;
  const seen = new Set<string>();
  const rounds: GuessRound[] = [];
  let guard = 0;
  while (rounds.length < n && guard < n * 30) {
    guard++;
    const terms = pick(gens)();
    const shown = terms.slice(0, 5);
    const prompt = `${shown.join(',  ')},  ?`;
    if (seen.has(prompt)) continue;
    seen.add(prompt);
    rounds.push({ prompt, answer: String(terms[5]) });
  }
  return rounds;
}

const PatternQuest: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  return (
    <GuessRace
      room={room}
      gp="pq"
      title="Pattern Quest"
      icon="🔢"
      themeClass="from-purple-950 via-violet-950 to-indigo-950"
      accent="text-violet-300"
      inputPlaceholder="What number comes next?"
      roundMs={25000}
      rounds={10}
      buildRounds={() => makeRounds(difficulty, 10)}
      renderPrompt={({ prompt }) => (
        <div className="text-center">
          <div className="font-fredoka font-bold text-3xl md:text-5xl tracking-wide">{prompt}</div>
          <div className="font-nunito text-violet-200 text-sm mt-2">Find the next number in the pattern</div>
        </div>
      )}
    />
  );
};

export default PatternQuest;
