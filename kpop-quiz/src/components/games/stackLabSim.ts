// A pretend player for Stack Lab, used to tune star thresholds (scripts/stackLabSim.ts) and in tests.
// It aims each piece at the middle of the top of the tower, misses by a random amount (`aim`, in
// world units, 1 sd), and — if patient — waits for the tower to stop wobbling before dropping.
import { createRng } from '../../games/engine/rng';
import { createStackWorld, stepStack, dropPiece, rotatePiece, hangingPos, BASE_TOP } from './stackLabLogic';
import type { StackWorld } from './stackLabLogic';

export interface SimSkill { aim: number; patient: boolean; layTallFlat?: boolean }
export interface SimResult { bestCm: number; dropped: number; fallen: number; hearts: number; reason: string | null; seconds: number }

/** World x of the middle of the highest still piece (0 = the base). */
export function towerTopX(w: StackWorld): number {
  let best: { x: number; y: number } | null = null;
  for (const p of w.pieces) {
    if (!p.landed) continue;
    const y = p.body.bounds.min.y;
    if (y < BASE_TOP && (!best || y < best.y)) best = { x: p.body.position.x, y };
  }
  return best ? best.x : 0;
}

export function playStack(seed: number, skill: SimSkill): SimResult {
  const w = createStackWorld(seed);
  const rng = createRng(seed * 7 + 1);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  let aimAt: number | null = null;
  let guard = 0;
  while (w.status !== 'over' && guard++ < 20000) {
    if (w.hanging) {
      if (skill.layTallFlat && w.hanging.kind === 'tall' && w.hanging.angle === 0) rotatePiece(w);
      if (aimAt === null) aimAt = towerTopX(w) + gauss() * skill.aim;
      const ready = !skill.patient || w.stillTicks >= 8;
      if (ready && Math.abs(hangingPos(w).x - aimAt) < 5) { dropPiece(w); aimAt = null; }
    }
    stepStack(w);
  }
  return { bestCm: w.bestCm, dropped: w.dropped, fallen: w.fallen, hearts: w.hearts, reason: w.overReason, seconds: Math.round(w.tick / 60) };
}
