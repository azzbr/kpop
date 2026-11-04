// ❄️ Snow Catch (snow_catch) — Winter Wonderland mini-game. Snowflakes drift down; she slides a
// basket to catch them for 30 seconds. ✨ Golden flakes count 3. Nothing bad falls and nothing is
// lost by missing — it is a cosy catch game. Pure rules, no React or canvas (SnowCatch.tsx draws).
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';

export const TICK_HZ = 30;
export const ROUND_SECONDS = 30;
export const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
/** The field in world units (the screen scales it to fit). */
export const FIELD_W = 400;
export const FIELD_H = 600;
/** The rim of the basket: a flake that crosses this line inside the basket is caught. */
export const BASKET_Y = 500;
export const BASKET_W = 92;
export const FLAKE_R = 14;
export const GOLD_POINTS = 3;
export const GOLD_CHANCE = 0.12;
/** Fastest the basket follows a finger (units per tick), and its speed with the arrow keys. */
export const BASKET_FOLLOW = 30;
export const BASKET_KEY_SPEED = 11;
/** Winter-event bonus: +1 coin per flake caught, at most this many coins a day. */
export const DAILY_BONUS_CAP = 30;

export type FlakeKind = 'snow' | 'gold';

export interface Flake {
  id: number;
  kind: FlakeKind;
  /** Where it started across, and its drift. */
  baseX: number;
  sway: number;
  phase: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vy: number;
  spin: number;
}

export type SnowEvent =
  | { type: 'catch'; kind: FlakeKind; points: number; x: number }
  | { type: 'miss' }
  | { type: 'over' };

export interface SnowWorld {
  rng: Rng;
  tick: number;
  basketX: number;
  prevBasketX: number;
  /** Where the finger is (world x), or null. */
  target: number | null;
  keyDir: -1 | 0 | 1;
  flakes: Flake[];
  nextSpawn: number;
  nextId: number;
  score: number;
  caught: number;
  golden: number;
  missed: number;
  status: 'playing' | 'over';
  events: SnowEvent[];
}

const clampBasket = (x: number) => Math.max(BASKET_W / 2, Math.min(FIELD_W - BASKET_W / 2, x));

export function createSnowWorld(seed: number): SnowWorld {
  return {
    rng: createRng(seed),
    tick: 0,
    basketX: FIELD_W / 2,
    prevBasketX: FIELD_W / 2,
    target: null,
    keyDir: 0,
    flakes: [],
    nextSpawn: 10,
    nextId: 1,
    score: 0,
    caught: 0,
    golden: 0,
    missed: 0,
    status: 'playing',
    events: [],
  };
}

/** The finger's world x (null when it lifts). */
export function setTarget(w: SnowWorld, x: number | null) { w.target = x === null ? null : clampBasket(x); }
export function setKeyDir(w: SnowWorld, d: -1 | 0 | 1) { w.keyDir = d; }

/** How far into the round (0–1): flakes come a little faster and more often as it goes on. */
const progress = (w: SnowWorld) => Math.min(1, w.tick / ROUND_TICKS);

function spawn(w: SnowWorld) {
  const t = progress(w);
  const sway = 8 + w.rng() * 22;
  const baseX = FLAKE_R + sway + w.rng() * (FIELD_W - 2 * (FLAKE_R + sway));
  const phase = w.rng() * Math.PI * 2;
  const kind: FlakeKind = w.rng() < GOLD_CHANCE ? 'gold' : 'snow';
  const y = -FLAKE_R;
  w.flakes.push({
    id: w.nextId++, kind, baseX, sway, phase, x: baseX + Math.sin(phase) * sway, y, px: baseX, py: y,
    // Golden ones fall a touch faster, so they're a little prize to chase.
    vy: 3.4 + t * 2.4 + w.rng() * 0.9 + (kind === 'gold' ? 0.6 : 0),
    spin: (w.rng() - 0.5) * 0.08,
  });
  // A new flake every ~0.5 s at the start, every ~0.3 s near the end.
  w.nextSpawn = w.tick + Math.round(16 - t * 7 + w.rng() * 4);
}

/** One fixed tick: move the basket, move the flakes, catch, spawn, and end the round at 30 s. */
export function stepSnow(w: SnowWorld): void {
  w.events = [];
  if (w.status !== 'playing') return;
  w.tick++;

  w.prevBasketX = w.basketX;
  if (w.target !== null) {
    const dx = w.target - w.basketX;
    w.basketX += Math.max(-BASKET_FOLLOW, Math.min(BASKET_FOLLOW, dx));
  } else if (w.keyDir) {
    w.basketX += w.keyDir * BASKET_KEY_SPEED;
  }
  w.basketX = clampBasket(w.basketX);

  const keep: Flake[] = [];
  for (const f of w.flakes) {
    f.px = f.x; f.py = f.y;
    f.y += f.vy;
    f.x = f.baseX + Math.sin(f.phase + w.tick * 0.06) * f.sway;
    if (f.py < BASKET_Y && f.y >= BASKET_Y && Math.abs(f.x - w.basketX) <= BASKET_W / 2) {
      const points = f.kind === 'gold' ? GOLD_POINTS : 1;
      w.score += points;
      w.caught++;
      if (f.kind === 'gold') w.golden++;
      w.events.push({ type: 'catch', kind: f.kind, points, x: f.x });
      continue;
    }
    if (f.y > FIELD_H + FLAKE_R) { w.missed++; w.events.push({ type: 'miss' }); continue; }
    keep.push(f);
  }
  w.flakes = keep;

  if (w.tick >= w.nextSpawn && w.tick < ROUND_TICKS - TICK_HZ) spawn(w);

  if (w.tick >= ROUND_TICKS) {
    w.status = 'over';
    w.events.push({ type: 'over' });
  }
}

export const secondsLeft = (w: SnowWorld) => Math.max(0, Math.ceil((ROUND_TICKS - w.tick) / TICK_HZ));

/** Winter bonus coins for this round: 1 per flake caught, keeping today's total at most DAILY_BONUS_CAP. */
export const dailyBonus = (caught: number, alreadyToday: number) =>
  Math.max(0, Math.min(caught, DAILY_BONUS_CAP - Math.max(0, alreadyToday)));
