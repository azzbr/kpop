// Snake Arena — a Slither.io-style game. Pure logic, no React or canvas, so it can be unit-tested
// and driven step by step from the ?debug hook.
//
// Rules:
// - The world is a big circle. Leaving it (touching the wall) knocks you out.
// - Snakes always move forward and turn towards a target angle at a limited turn rate.
// - Eating glowing dots makes you longer. Longer snakes are also a little thicker and turn slower.
// - Boost doubles your speed but costs length (never below MIN_LEN); some of it drops behind you as food.
// - If your HEAD touches another snake's BODY you're out, and your body turns into a trail of big food.
//   Your own body is safe to cross (like Slither.io).
// - Bots respawn after 3 seconds. The human never respawns — the component ends the round instead.

import type { Rng } from '../../games/engine/rng';

export const TICK_HZ = 30;
export const WORLD_R = 1800;
export const START_LEN = 12;
export const MIN_LEN = 10;
export const BASE_SPEED = 4.2; // world units per tick
export const BOOST_SPEED = 8.4;
export const BOOST_COST = 0.15; // length per tick while boosting
export const BASE_TURN = 0.14; // radians per tick for a short snake
export const RESPAWN_TICKS = 3 * TICK_HZ;
export const FOOD_TARGET = 650;
const HASH_CELL = 80;
export const BOT_APPETITE = 0.7;

export type DeathCause = 'snake' | 'wall';

export interface Seg { x: number; y: number; px: number; py: number }

export interface SnakeInput {
  /** Where the finger points (radians), or null to keep going straight. */
  angle: number | null;
  /** Keyboard steering: −1 = turn left, +1 = turn right (overrides `angle`). */
  turn: -1 | 0 | 1;
  boost: boolean;
}

interface BotBrain {
  foodId: number; // target food id, −1 = none
  retargetAt: number;
  huntUntil: number; // tick; while > now the bot tries to cut in front of the player
  wanderAngle: number;
}

export interface Snake {
  id: number; // 1-based
  name: string;
  emoji: string;
  color: string;
  isHuman: boolean;
  alive: boolean;
  segs: Seg[]; // segs[0] is the head
  angle: number;
  len: number;
  maxLen: number;
  boosting: boolean;
  input: SnakeInput;
  kills: number;
  respawnAt: number;
  deathCause?: DeathCause;
  killedBy?: number;
  bot: BotBrain;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  value: number;
  r: number; // draw radius
  color: string;
  big: boolean;
}

export interface SnakeEvent {
  type: 'eat' | 'death' | 'respawn';
  snakeId: number;
  byId?: number;
  cause?: DeathCause;
  value?: number;
}

export interface SnakeWorld {
  tick: number;
  snakes: Snake[];
  food: Food[];
  nextFoodId: number;
  rng: Rng;
  events: SnakeEvent[];
  /** Spatial hash of body segments, rebuilt every tick: cell key → packed (snakeIndex, segIndex). */
  hash: Map<number, number[]>;
  /** Wall deaths per snake id, handy for tests and tuning. */
  wallDeaths: number;
}

const BOTS = [
  { name: 'Whiskers', emoji: '🐱', color: '#f97316' },
  { name: 'Foxy', emoji: '🦊', color: '#ef4444' },
  { name: 'Hopper', emoji: '🐸', color: '#22c55e' },
  { name: 'Bamboo', emoji: '🐼', color: '#94a3b8' },
  { name: 'Bananas', emoji: '🐵', color: '#eab308' },
  { name: 'Sparkle', emoji: '🦄', color: '#ec4899' },
];
const FOOD_COLORS = ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf'];

export const radiusOf = (len: number) => 7 + Math.min(16, Math.sqrt(len) * 0.9);
export const spacingOf = (len: number) => radiusOf(len) * 0.45;
export const turnRateOf = (len: number) => Math.max(0.07, BASE_TURN / (1 + Math.max(0, len - START_LEN) / 250));
export const segCountOf = (len: number) => Math.max(4, Math.round(len));
export const lengthScore = (s: Snake) => Math.floor(s.maxLen);

/** Smallest signed difference a − b, in (−π, π]. */
export function angleDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(opts: {
  rng: Rng; bots?: number; humanName?: string; humanEmoji?: string; humanColor?: string; foodCount?: number;
}): SnakeWorld {
  const w: SnakeWorld = { tick: 0, snakes: [], food: [], nextFoodId: 1, rng: opts.rng, events: [], hash: new Map(), wallDeaths: 0 };
  const total = 1 + (opts.bots ?? 6);
  for (let i = 0; i < total; i++) {
    const bot = i === 0 ? null : BOTS[(i - 1) % BOTS.length];
    w.snakes.push({
      id: i + 1,
      name: bot ? bot.name : opts.humanName || 'You',
      emoji: bot ? bot.emoji : opts.humanEmoji || '😎',
      color: bot ? bot.color : opts.humanColor || '#3b82f6',
      isHuman: i === 0,
      alive: false,
      segs: [],
      angle: 0,
      len: START_LEN,
      maxLen: START_LEN,
      boosting: false,
      input: { angle: null, turn: 0, boost: false },
      kills: 0,
      respawnAt: 0,
      bot: { foodId: -1, retargetAt: 0, huntUntil: 0, wanderAngle: 0 },
    });
  }
  // The human starts near the middle, bots spread around.
  spawnAt(w.snakes[0], 0, 0, w.rng() * Math.PI * 2, START_LEN);
  for (const s of w.snakes.slice(1)) respawn(w, s, START_LEN + Math.floor(w.rng() * 20));
  const n = opts.foodCount ?? FOOD_TARGET;
  for (let i = 0; i < n; i++) addRandomFood(w);
  rebuildHash(w);
  return w;
}

/** Places a snake with its body trailing straight behind the head. */
export function spawnAt(s: Snake, x: number, y: number, angle: number, len: number) {
  s.alive = true;
  s.angle = angle;
  s.len = len;
  s.maxLen = Math.max(s.isHuman ? s.maxLen : 0, len);
  s.boosting = false;
  s.deathCause = undefined;
  s.killedBy = undefined;
  s.input = { angle: null, turn: 0, boost: false };
  const sp = spacingOf(len);
  s.segs = [];
  for (let i = 0; i < segCountOf(len); i++) {
    const sx = x - Math.cos(angle) * sp * i;
    const sy = y - Math.sin(angle) * sp * i;
    s.segs.push({ x: sx, y: sy, px: sx, py: sy });
  }
}

function respawn(w: SnakeWorld, s: Snake, len: number) {
  const me = w.snakes[0];
  let best = { x: 0, y: 0, score: -Infinity };
  for (let tries = 0; tries < 20; tries++) {
    const a = w.rng() * Math.PI * 2;
    const d = Math.sqrt(w.rng()) * WORLD_R * 0.75;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    // Prefer a spot far from everyone's body, and never right on top of the player.
    let near = Infinity;
    for (const o of w.snakes) {
      if (!o.alive || o === s) continue;
      for (let i = 0; i < o.segs.length; i += 4) near = Math.min(near, Math.hypot(o.segs[i].x - x, o.segs[i].y - y));
    }
    if (me.alive && me !== s && Math.hypot(me.segs[0].x - x, me.segs[0].y - y) < 450) near = Math.min(near, 0);
    if (near > best.score) best = { x, y, score: near };
    if (near > 300) break;
  }
  // Face roughly towards the middle so it doesn't spawn heading into the wall.
  const toCenter = Math.atan2(-best.y, -best.x);
  spawnAt(s, best.x, best.y, toCenter + (w.rng() - 0.5) * 2, len);
  s.bot = { foodId: -1, retargetAt: 0, huntUntil: 0, wanderAngle: s.angle };
}

export function addFood(w: SnakeWorld, x: number, y: number, value: number, r: number, color: string, big: boolean) {
  w.food.push({ id: w.nextFoodId++, x, y, value, r, color, big });
}

function addRandomFood(w: SnakeWorld) {
  const a = w.rng() * Math.PI * 2;
  const d = Math.sqrt(w.rng()) * (WORLD_R - 40);
  const value = w.rng() < 0.15 ? 2 : 1;
  addFood(w, Math.cos(a) * d, Math.sin(a) * d, value, value === 2 ? 6 : 4, FOOD_COLORS[Math.floor(w.rng() * FOOD_COLORS.length)], false);
}

const hashKey = (cx: number, cy: number) => (cx + 512) * 1024 + (cy + 512);

export function rebuildHash(w: SnakeWorld) {
  w.hash.clear();
  w.snakes.forEach((s, si) => {
    if (!s.alive) return;
    for (let i = 0; i < s.segs.length; i++) {
      const k = hashKey(Math.floor(s.segs[i].x / HASH_CELL), Math.floor(s.segs[i].y / HASH_CELL));
      let list = w.hash.get(k);
      if (!list) { list = []; w.hash.set(k, list); }
      list.push(si * 100000 + i);
    }
  });
}

/**
 * Finds a body segment of another snake within `pad` of the circle (x, y, r).
 * Returns the snake index or −1. Skips `skip` (the asking snake) and every snake's head segment.
 */
export function bodyHit(w: SnakeWorld, x: number, y: number, r: number, skip: number, pad = 0): number {
  const reach = r + 24 + pad; // 23 = max body radius
  const cx0 = Math.floor((x - reach) / HASH_CELL);
  const cx1 = Math.floor((x + reach) / HASH_CELL);
  const cy0 = Math.floor((y - reach) / HASH_CELL);
  const cy1 = Math.floor((y + reach) / HASH_CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const list = w.hash.get(hashKey(cx, cy));
      if (!list) continue;
      for (const packed of list) {
        const si = Math.floor(packed / 100000);
        const i = packed % 100000;
        if (si === skip || i === 0) continue;
        const o = w.snakes[si];
        const seg = o.segs[i];
        if (!seg) continue;
        const rr = r + radiusOf(o.len) * 0.85 + pad;
        const dx = seg.x - x;
        const dy = seg.y - y;
        if (dx * dx + dy * dy < rr * rr) return si;
      }
    }
  }
  return -1;
}

// ─── Movement ───────────────────────────────────────────────────────────────

/** Turns towards the input and moves one tick. Exported for tests. */
export function moveSnake(w: SnakeWorld, s: Snake) {
  for (const g of s.segs) { g.px = g.x; g.py = g.y; }

  const rate = turnRateOf(s.len);
  if (s.input.turn !== 0) {
    s.angle += s.input.turn * rate;
  } else if (s.input.angle !== null) {
    const d = angleDiff(s.input.angle, s.angle);
    s.angle += Math.max(-rate, Math.min(rate, d));
  }
  s.angle = angleDiff(s.angle, 0);

  s.boosting = s.input.boost && s.len > MIN_LEN + 0.5;
  const speed = s.boosting ? BOOST_SPEED : BASE_SPEED;
  const head = s.segs[0];
  head.x += Math.cos(s.angle) * speed;
  head.y += Math.sin(s.angle) * speed;

  if (s.boosting) {
    s.len = Math.max(MIN_LEN, s.len - BOOST_COST);
    // Drop a little food behind the tail now and then (about 2/3 of what boosting costs).
    if (w.tick % 3 === 0) {
      const tail = s.segs[s.segs.length - 1];
      addFood(w, tail.x + (w.rng() - 0.5) * 6, tail.y + (w.rng() - 0.5) * 6, BOOST_COST * 3 * 0.66, 4, s.color, false);
    }
  }

  // Grow or shrink the body to match the length, then pull the body along like a rope.
  const want = segCountOf(s.len);
  while (s.segs.length < want) {
    const t = s.segs[s.segs.length - 1];
    s.segs.push({ x: t.x, y: t.y, px: t.px, py: t.py });
  }
  while (s.segs.length > want) s.segs.pop();

  const sp = spacingOf(s.len);
  for (let i = 1; i < s.segs.length; i++) {
    const a = s.segs[i - 1];
    const b = s.segs[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > sp) {
      b.x = a.x + (dx / d) * sp;
      b.y = a.y + (dy / d) * sp;
    }
  }
}

// ─── Bots ───────────────────────────────────────────────────────────────────

/** How dangerous it is to head in direction `a`: walls and other snakes' bodies along the way. */
function dangerAlong(w: SnakeWorld, s: Snake, si: number, a: number): number {
  const head = s.segs[0];
  const r = radiusOf(s.len);
  let danger = 0;
  const probes = [r + 12, r + 35, r + 65, r + 100, r + 140];
  for (let k = 0; k < probes.length; k++) {
    const px = head.x + Math.cos(a) * probes[k];
    const py = head.y + Math.sin(a) * probes[k];
    const weight = 1 / (k + 1);
    if (Math.hypot(px, py) > WORLD_R - r - 25) danger += 12 * weight;
    if (bodyHit(w, px, py, r, si, 6) >= 0) danger += 10 * weight;
  }
  // Other snakes' heads nearby (they might cut across).
  for (const o of w.snakes) {
    if (!o.alive || o === s) continue;
    const oh = o.segs[0];
    const ax = head.x + Math.cos(a) * (r + 40);
    const ay = head.y + Math.sin(a) * (r + 40);
    const d = Math.hypot(oh.x - ax, oh.y - ay);
    if (d < radiusOf(o.len) + r + 40) danger += 3;
  }
  return danger;
}

function thinkBot(w: SnakeWorld, s: Snake, si: number) {
  const head = s.segs[0];
  const brain = s.bot;
  const me = w.snakes[0];
  let desired = s.angle;
  let boost = false;

  // Sometimes try to cut in front of the player.
  if (me.alive && brain.huntUntil <= w.tick && s.len > 18) {
    const dMe = Math.hypot(me.segs[0].x - head.x, me.segs[0].y - head.y);
    if (dMe < 380 && w.rng() < 0.006) brain.huntUntil = w.tick + TICK_HZ * 2 + Math.floor(w.rng() * TICK_HZ);
  }

  if (me.alive && brain.huntUntil > w.tick) {
    const mh = me.segs[0];
    const lead = 110 + radiusOf(me.len) * 3;
    const tx = mh.x + Math.cos(me.angle) * lead;
    const ty = mh.y + Math.sin(me.angle) * lead;
    desired = Math.atan2(ty - head.y, tx - head.x);
    boost = s.len > 30 && Math.hypot(tx - head.x, ty - head.y) > 120;
  } else {
    // Seek food: pick the best value-for-distance dot nearby every few ticks.
    let target = brain.foodId >= 0 ? w.food.find(f => f.id === brain.foodId) : undefined;
    if (!target || w.tick >= brain.retargetAt) {
      let bestScore = 0;
      target = undefined;
      for (const f of w.food) {
        const d = Math.hypot(f.x - head.x, f.y - head.y);
        if (d > 520) continue;
        // Prefer dots in front (turning around is slow).
        const ahead = Math.cos(angleDiff(Math.atan2(f.y - head.y, f.x - head.x), s.angle));
        const score = (f.value * (f.big ? 2 : 1)) / (d + 40) * (1.4 + ahead);
        if (score > bestScore && Math.hypot(f.x, f.y) < WORLD_R - 120) { bestScore = score; target = f; }
      }
      brain.foodId = target ? target.id : -1;
      brain.retargetAt = w.tick + 8 + Math.floor(w.rng() * 6);
    }
    if (target) {
      desired = Math.atan2(target.y - head.y, target.x - head.x);
    } else {
      if (w.rng() < 0.02) brain.wanderAngle = s.angle + (w.rng() - 0.5) * 2;
      desired = brain.wanderAngle;
    }
  }

  // Keep well away from the wall: steer towards the middle when getting close.
  const fromCenter = Math.hypot(head.x, head.y);
  if (fromCenter > WORLD_R - 260) {
    const inward = Math.atan2(-head.y, -head.x);
    const t = Math.min(1, (fromCenter - (WORLD_R - 260)) / 160);
    desired = desired + angleDiff(inward, desired) * t;
  }

  // Avoid danger ahead: look at a fan of directions and pick the safest one closest to what it wants.
  const straight = dangerAlong(w, s, si, s.angle);
  const toDesired = dangerAlong(w, s, si, desired);
  if (straight > 0 || toDesired > 0) {
    let best = desired;
    let bestCost = toDesired * 4;
    for (let k = -6; k <= 6; k++) {
      if (k === 0) continue;
      const a = s.angle + k * 0.4;
      const cost = dangerAlong(w, s, si, a) * 4 + Math.abs(angleDiff(a, desired)) * 0.6;
      if (cost < bestCost) { bestCost = cost; best = a; }
    }
    desired = best;
    if (bestCost > 4) boost = false;
  }

  s.input.angle = desired;
  s.input.turn = 0;
  s.input.boost = boost;
}

// ─── Step ───────────────────────────────────────────────────────────────────

function killSnake(w: SnakeWorld, s: Snake, cause: DeathCause, byIndex: number) {
  s.alive = false;
  s.deathCause = cause;
  s.respawnAt = w.tick + RESPAWN_TICKS;
  if (cause === 'wall') w.wallDeaths++;
  const by = byIndex >= 0 ? w.snakes[byIndex] : undefined;
  if (by) { by.kills++; s.killedBy = by.id; }
  // Body → a trail of big food worth about half the length.
  const n = Math.min(120, Math.max(4, Math.floor(s.segs.length / 2)));
  const each = Math.max(1, (s.len * 0.5) / n);
  const step = s.segs.length / n;
  const r = radiusOf(s.len);
  for (let k = 0; k < n; k++) {
    const g = s.segs[Math.floor(k * step)];
    let fx = g.x + (w.rng() - 0.5) * r;
    let fy = g.y + (w.rng() - 0.5) * r;
    const d = Math.hypot(fx, fy);
    if (d > WORLD_R - 20) { fx *= (WORLD_R - 20) / d; fy *= (WORLD_R - 20) / d; }
    addFood(w, fx, fy, each, 7 + Math.min(4, each), s.color, true);
  }
  w.events.push({ type: 'death', snakeId: s.id, byId: by?.id, cause });
}

export function step(w: SnakeWorld) {
  w.events = [];
  w.tick++;

  // Bots decide where to go, then everyone moves.
  w.snakes.forEach((s, si) => { if (s.alive && !s.isHuman) thinkBot(w, s, si); });
  for (const s of w.snakes) if (s.alive) moveSnake(w, s);
  rebuildHash(w);

  // Collisions (decided together, so two heads hitting each other's bodies on the same tick both go).
  const deaths: { s: Snake; cause: DeathCause; by: number }[] = [];
  w.snakes.forEach((s, si) => {
    if (!s.alive) return;
    const h = s.segs[0];
    const r = radiusOf(s.len);
    if (Math.hypot(h.x, h.y) + r > WORLD_R) { deaths.push({ s, cause: 'wall', by: -1 }); return; }
    const hit = bodyHit(w, h.x, h.y, r * 0.8, si);
    if (hit >= 0) deaths.push({ s, cause: 'snake', by: hit });
  });
  for (const d of deaths) killSnake(w, d.s, d.cause, d.by);
  if (deaths.length) rebuildHash(w);

  // Eating.
  const eaten = new Set<number>();
  for (const s of w.snakes) {
    if (!s.alive) continue;
    const h = s.segs[0];
    const reach = radiusOf(s.len) + 10;
    let gained = 0;
    for (const f of w.food) {
      if (eaten.has(f.id)) continue;
      const dx = f.x - h.x;
      const dy = f.y - h.y;
      const rr = reach + f.r;
      if (dx * dx + dy * dy < rr * rr) { eaten.add(f.id); gained += f.value; }
    }
    if (gained) {
      // Bots digest a bit slower, so a good player can top the leaderboard.
      s.len += s.isHuman ? gained : gained * BOT_APPETITE;
      s.maxLen = Math.max(s.maxLen, s.len);
      w.events.push({ type: 'eat', snakeId: s.id, value: gained });
    }
  }
  if (eaten.size) w.food = w.food.filter(f => !eaten.has(f.id));

  // Keep the world stocked (only natural dots count towards the target, so big food doesn't block it).
  let natural = 0;
  for (const f of w.food) if (!f.big) natural++;
  for (let i = 0; i < 4 && natural < FOOD_TARGET; i++, natural++) addRandomFood(w);
  // Old boost crumbs and leftover big food can pile up; cap the total.
  if (w.food.length > 2200) w.food.splice(0, w.food.length - 2200);

  // Respawn bots.
  for (const s of w.snakes) {
    if (!s.alive && !s.isHuman && w.tick >= s.respawnAt) {
      respawn(w, s, START_LEN + Math.floor(w.rng() * 25));
      w.events.push({ type: 'respawn', snakeId: s.id });
    }
  }
}

/** Snakes sorted by current length (alive ones, plus the human even when out). */
export function leaderboard(w: SnakeWorld) {
  return w.snakes.filter(s => s.alive || s.isHuman).sort((a, b) => b.len - a.len);
}
