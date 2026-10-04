// Plays seeded Paper Clash rounds with a bot brain in the player's seat, on both engines, so the
// new free-steering version can be tuned to make a score mean what it did on the old grid
// (daily challenge 10%, badges at 10/25/50%). Run: npx tsx scripts/paperClashSim.ts
import { createRng } from '../../games/engine/rng';
import * as New from './paperClashLogic';
import * as Old from './paperClashClassicLogic';

const ROUND_SECONDS = 180;

/** Peak % of the map the player held before being knocked out (or time running out). */
export function playNew(seed: number, difficulty: New.Difficulty = 'normal'): number {
  const w = New.createWorld({ rng: createRng(seed), difficulty, humanThinks: true });
  let peak = New.percentOf(w, 1);
  for (let t = 0; t < ROUND_SECONDS * New.TICK_HZ && w.players[0].alive; t++) {
    New.step(w);
    peak = Math.max(peak, New.percentOf(w, 1));
  }
  return peak;
}

export function playOld(seed: number, difficulty: Old.Difficulty = 'normal'): number {
  const w = Old.createWorld({ rng: createRng(seed), difficulty });
  const me = w.players[0];
  me.isHuman = false; // let the bot brain drive the player's seat
  let peak = Old.percentOf(w, 1);
  for (let t = 0; t < ROUND_SECONDS * Old.TICK_HZ && me.alive; t++) {
    Old.step(w);
    peak = Math.max(peak, Old.percentOf(w, 1));
  }
  return peak;
}

export function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: q(0.5), p90: q(0.9), over10: s.filter(v => v >= 10).length / s.length };
}
