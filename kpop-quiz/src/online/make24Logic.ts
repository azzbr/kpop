// Make 24 rules for the PuzzleRace engine: combine ALL the numbers, two at a time, with
// + − × ÷ (whole-number division only) to hit the target.
import type { Rng } from '../games/engine/rng';

export type Op = '+' | '−' | '×' | '÷';
export interface Step { a: number; b: number; op: Op }
export interface MkSpec { count: number; maxNum: number; tlo: number; thi: number }
export interface MkPuzzle { nums: number[]; target: number }
export interface MkCard { id: number; value: number }
export interface MkState { cards: MkCard[]; steps: Step[]; nextId: number }

export const MK_DIFF: Record<string, MkSpec> = {
  easy: { count: 3, maxNum: 9, tlo: 6, thi: 15 },
  medium: { count: 4, maxNum: 9, tlo: 10, thi: 24 },
  hard: { count: 4, maxNum: 12, tlo: 20, thi: 30 },
  expert: { count: 4, maxNum: 13, tlo: 24, thi: 50 },
  master: { count: 4, maxNum: 15, tlo: 35, thi: 99 },
  legend: { count: 5, maxNum: 13, tlo: 40, thi: 120 },
};

export function applyOp(a: number, b: number, op: Op): number | null {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b !== 0 && a % b === 0 ? a / b : null;
  return null;
}
const OPS: Op[] = ['+', '−', '×', '÷'];

// Every value reachable by combining all the numbers, memoised by sorted multiset.
const reachMemo = new Map<string, Set<number>>();
export function reach(nums: number[]): Set<number> {
  if (nums.length === 1) return new Set([nums[0]]);
  const key = [...nums].sort((a, b) => a - b).join(',');
  const cached = reachMemo.get(key);
  if (cached) return cached;
  const out = new Set<number>();
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        const r = applyOp(nums[i], nums[j], op);
        if (r !== null) for (const v of reach([...rest, r])) out.add(v);
      }
    }
  }
  reachMemo.set(key, out);
  return out;
}

/** One way to make the target (the steps), or null when it can't be done. */
export function solveMake(nums: number[], target: number): Step[] | null {
  if (nums.length === 1) return nums[0] === target ? [] : null;
  if (!reach(nums).has(target)) return null;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        const r = applyOp(nums[i], nums[j], op);
        if (r === null) continue;
        const sub = solveMake([...rest, r], target);
        if (sub) return [{ a: nums[i], b: nums[j], op }, ...sub];
      }
    }
  }
  return null;
}

export function mkGenerate(difficulty: string | undefined, rng: Rng): MkPuzzle {
  const spec = MK_DIFF[difficulty || 'medium'] || MK_DIFF.medium;
  for (let tries = 0; tries < 500; tries++) {
    const nums = Array.from({ length: spec.count }, () => 1 + Math.floor(rng() * spec.maxNum));
    const cands = [...reach(nums)].filter(v => v >= spec.tlo && v <= spec.thi).sort((a, b) => a - b);
    const good = cands.filter(v => v > 1 && !nums.includes(v));
    const list = good.length ? good : cands;
    if (list.length) return { nums, target: list[Math.floor(rng() * list.length)] };
  }
  return { nums: [2, 3, 4, 6], target: 24 }; // safe fallback
}

/** Replays the steps from the starting numbers: valid, uses every number, ends on the target. */
export function mkCheck(p: MkPuzzle, steps: unknown): boolean {
  if (!Array.isArray(steps) || steps.length !== p.nums.length - 1) return false;
  const pool = [...p.nums];
  for (const s of steps as Step[]) {
    if (!s || typeof s.a !== 'number' || typeof s.b !== 'number') return false;
    const ia = pool.indexOf(s.a);
    if (ia < 0) return false;
    pool.splice(ia, 1);
    const ib = pool.indexOf(s.b);
    if (ib < 0) return false;
    pool.splice(ib, 1);
    const r = applyOp(s.a, s.b, s.op);
    if (r === null) return false;
    pool.push(r);
  }
  return pool.length === 1 && pool[0] === p.target;
}

export const mkInit = (p: MkPuzzle): MkState => ({
  cards: p.nums.map((value, id) => ({ id, value })),
  steps: [],
  nextId: p.nums.length,
});

export const mkSolved = (p: MkPuzzle, s: MkState) => s.cards.length === 1 && s.cards[0].value === p.target;

/** Merges two cards. Returns null if the move isn't allowed (e.g. a division with a remainder). */
export function mkMerge(s: MkState, idA: number, idB: number, op: Op): MkState | null {
  const a = s.cards.find(c => c.id === idA);
  const b = s.cards.find(c => c.id === idB);
  if (!a || !b || a === b) return null;
  const r = applyOp(a.value, b.value, op);
  if (r === null) return null;
  return {
    cards: [...s.cards.filter(c => c !== a && c !== b), { id: s.nextId, value: r }],
    steps: [...s.steps, { a: a.value, b: b.value, op }],
    nextId: s.nextId + 1,
  };
}

/** Steps taken so far, but only while the target is still reachable from the cards left. */
export function mkProgress(p: MkPuzzle, s: MkState): number {
  if (mkSolved(p, s)) return 1;
  if (!reach(s.cards.map(c => c.value)).has(p.target)) return 0;
  return (s.steps.length / (p.nums.length - 1)) * 0.9;
}
