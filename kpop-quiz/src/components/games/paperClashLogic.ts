// Paper Clash — a paper.io 2-style territory game. Pure logic, no React or canvas, so it can be
// unit-tested and stepped from the ?debug hook. (The old 4-way grid version lives on as
// paperClashClassicLogic.ts — "Classic squares".)
//
// The world is still a grid (fine: GRID×GRID cells, inside a round arena), which keeps capture
// simple and robust. Players move freely: a position and a heading, constant speed and a turn
// rate limit, so turns are smooth arcs. Each tick the segment the head travelled is rasterised
// (4-connected), which guarantees that crossing a trail always touches one of its cells and that
// a closed trail never leaks in the flood fill.
//
// Rules (same as Classic):
// - Leaving your land draws a trail. Getting back to your land claims the trail plus everything
//   it encloses that can't reach the arena edge without crossing your land (incl. others' land).
// - Touching anyone's trail knocks out the trail's owner. Your own newest few cells (your "neck")
//   don't count, so a tight turn can't knock you out.
// - Heads meeting: the player with more land survives; a tie knocks out both.
// - A head inside someone's freshly claimed land is out. Leaving the arena circle is out.
// - Knocked-out land becomes neutral. Bots respawn after a delay; the human's round ends.

import type { Rng } from '../../games/engine/rng';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type DeathCause = 'trail' | 'own_trail' | 'wall' | 'head_on' | 'enclosed';

// ---- Tuning ----
// scripts/paperClashSim.ts plays 200 seeded rounds with a bot brain in the player's seat on both
// engines (peak % held). Tuned 2026-10 so a score means about what it did on the old grid:
//   easy   old median 7.2% / p90 14.7%   new 5.9% / 11.7%
//   normal old median 6.4% / p90 15.9%   new 6.7% / 12.5%   (≥10%: old 34%, new 23%)
//   hard   old median 0.3% / p90 4.6%    new 4.6% / 10.3%   (old hard bots ganged up on the player)
// Typical rounds match; the very best rounds are ~20% harder, so old best scores stay meaningful
// and the 10% daily challenge stays reachable. A smaller arena made it *harder* (more crowding).
export const GRID = 250;
export const TICK_HZ = 20;
/** Cells per second. */
export const SPEED = 21;
/** Radians per second. */
export const TURN_RATE = 5.2;
/** Own trail cells laid in the last NECK_TICKS ticks can't knock you out. */
export const NECK_TICKS = 4;
/** Heads closer than this (cells) collide. */
export const HEAD_RADIUS = 2.6;
export const START_RADIUS = 6.5;
/** Arena circle radius in cells (a little inside the grid). */
export const arenaRadius = (size: number) => (size / 2 - 1.5) * ARENA_SCALE;
const ARENA_SCALE = 1;
const RESPAWN_TICKS = 3 * TICK_HZ;
/** Bots curve their loops at this fraction of the full turn rate (wider petals = more land). */
export let ARC_RATE = 0.55;
export function setArcRate(v: number) { ARC_RATE = v; }

export interface Player {
  id: number; // 1-based; 0 means "nobody" in the grids
  name: string;
  emoji: string;
  color: string;
  isHuman: boolean;
  /** Bots think; a human player in the simulator can think too. */
  thinks: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  heading: number;
  targetHeading: number;
  alive: boolean;
  trail: number[]; // cell indices in the order they were laid
  /** Head positions while out of your land, for drawing the trail line. */
  trailPath: number[]; // flat x,y pairs
  kills: number;
  respawnAt: number;
  deathCause?: DeathCause;
  bot: BotBrain;
}

interface BotBrain {
  plan: 'home' | 'out' | 'arc' | 'back';
  ticksLeft: number;
  turnDir: 1 | -1;
  arcTurned: number;
  arcGoal: number;
  /** Where it left its land (heads back here). */
  exitX: number;
  exitY: number;
}

export interface GameEvent {
  type: 'claim' | 'death';
  playerId: number;
  byId?: number;
  cells?: number;
  cause?: DeathCause;
  /** Players whose land changed (for redrawing outlines). */
  touched?: number[];
}

export interface World {
  size: number;
  /** 1 = inside the round arena. */
  arena: Uint8Array;
  arenaCells: number;
  owner: Uint8Array;
  trail: Uint8Array;
  trailTick: Int32Array;
  players: Player[];
  tick: number;
  counts: number[];
  rng: Rng;
  difficulty: Difficulty;
  events: GameEvent[];
  // Reused flood-fill buffers (no allocation per claim).
  seen: Uint8Array;
  queue: Int32Array;
}

const BOTS = [
  { name: 'Whiskers', emoji: '🐱', color: '#f97316' },
  { name: 'Foxy', emoji: '🦊', color: '#ef4444' },
  { name: 'Hopper', emoji: '🐸', color: '#22c55e' },
  { name: 'Bamboo', emoji: '🐼', color: '#64748b' },
  { name: 'Bananas', emoji: '🐵', color: '#eab308' },
  { name: 'Sparkle', emoji: '🦄', color: '#ec4899' },
];
export const HUMAN_COLOR = '#3b82f6';
const SPARE_COLORS = ['#14b8a6', '#a855f7', '#0ea5e9', '#84cc16', '#f43f5e', '#6366f1'];

/** Bot settings, in cells and ticks. */
export const DIFF = {
  easy: { outMin: 10, outMax: 30, arcMin: 2.2, arcMax: 3.4, maxTrail: 100, awareness: 14, hunt: 0 },
  normal: { outMin: 12, outMax: 46, arcMin: 2.4, arcMax: 3.9, maxTrail: 165, awareness: 18, hunt: 0 },
  hard: { outMin: 12, outMax: 34, arcMin: 2.6, arcMax: 4.0, maxTrail: 130, awareness: 22, hunt: 34 },
};

export const idx = (w: World, x: number, y: number) => y * w.size + x;
const cellOf = (w: World, x: number, y: number) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  return cx < 0 || cy < 0 || cx >= w.size || cy >= w.size ? -1 : cy * w.size + cx;
};
export const inArena = (w: World, x: number, y: number) => {
  const c = cellOf(w, x, y);
  return c >= 0 && w.arena[c] === 1;
};
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const randRange = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

export interface WorldOptions {
  size?: number;
  bots?: number;
  rng: Rng;
  difficulty?: Difficulty;
  humanName?: string;
  humanEmoji?: string;
  humanColor?: string;
  /** Simulator only: the human player is driven by the bot brain. */
  humanThinks?: boolean;
}

export function createWorld(opts: WorldOptions): World {
  const size = opts.size ?? GRID;
  const n = size * size;
  const arena = new Uint8Array(n);
  const c = size / 2, r = arenaRadius(size);
  let arenaCells = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c;
    if (dx * dx + dy * dy <= r * r) { arena[y * size + x] = 1; arenaCells++; }
  }
  const w: World = {
    size, arena, arenaCells,
    owner: new Uint8Array(n),
    trail: new Uint8Array(n),
    trailTick: new Int32Array(n),
    players: [],
    tick: 0,
    counts: [],
    rng: opts.rng,
    difficulty: opts.difficulty ?? 'normal',
    events: [],
    seen: new Uint8Array(n),
    queue: new Int32Array(n),
  };
  const total = 1 + (opts.bots ?? 6);
  const humanColor = opts.humanColor || HUMAN_COLOR;
  const spare = SPARE_COLORS.filter(col => col.toLowerCase() !== humanColor.toLowerCase());
  const botColor = (col: string, i: number) => (col.toLowerCase() === humanColor.toLowerCase() ? spare[i % spare.length] : col);
  for (let i = 0; i < total; i++) {
    const bot = i === 0 ? null : BOTS[(i - 1) % BOTS.length];
    w.players.push({
      id: i + 1,
      name: bot ? bot.name : opts.humanName || 'You',
      emoji: bot ? bot.emoji : opts.humanEmoji || '😎',
      color: bot ? botColor(bot.color, i) : humanColor,
      isHuman: i === 0,
      thinks: i !== 0 || !!opts.humanThinks,
      x: 0, y: 0, prevX: 0, prevY: 0, heading: 0, targetHeading: 0,
      alive: false,
      trail: [], trailPath: [],
      kills: 0,
      respawnAt: 0,
      bot: { plan: 'home', ticksLeft: 0, turnDir: 1, arcTurned: 0, arcGoal: 0, exitX: 0, exitY: 0 },
    });
  }
  for (const p of w.players) spawn(w, p);
  recount(w);
  return w;
}

/** Puts a player in the arena with a round blob of land, away from everyone else. */
export function spawn(w: World, p: Player): boolean {
  const c = w.size / 2;
  const maxR = arenaRadius(w.size) - START_RADIUS - 6;
  for (let attempt = 0; attempt < 300; attempt++) {
    const a = w.rng() * Math.PI * 2;
    const d = Math.sqrt(w.rng()) * maxR;
    const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
    if (!areaFree(w, x, y, START_RADIUS + 4)) continue;
    placeAt(w, p, x, y);
    return true;
  }
  return false;
}

/** Deterministic placement (tests): a round blob of land centred on (x, y). */
export function placeAt(w: World, p: Player, x: number, y: number, radius = START_RADIUS, heading?: number) {
  const r2 = radius * radius;
  for (let cy = Math.floor(y - radius); cy <= Math.ceil(y + radius); cy++) {
    for (let cx = Math.floor(x - radius); cx <= Math.ceil(x + radius); cx++) {
      if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) continue;
      const dx = cx + 0.5 - x, dy = cy + 0.5 - y;
      const c = cy * w.size + cx;
      if (dx * dx + dy * dy <= r2 && w.arena[c]) w.owner[c] = p.id;
    }
  }
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.heading = p.targetHeading = heading ?? w.rng() * Math.PI * 2 - Math.PI;
  p.alive = true;
  p.trail = [];
  p.trailPath = [];
  p.deathCause = undefined;
  p.bot = { plan: 'home', ticksLeft: 0, turnDir: w.rng() < 0.5 ? 1 : -1, arcTurned: 0, arcGoal: 0, exitX: x, exitY: y };
}

function areaFree(w: World, x: number, y: number, r: number) {
  for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++) {
    for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) {
      if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return false;
      const c = cy * w.size + cx;
      if (!w.arena[c] || w.owner[c] || w.trail[c]) return false;
    }
  }
  for (const q of w.players) if (q.alive && Math.hypot(q.x - x, q.y - y) < r + 8) return false;
  return true;
}

export function recount(w: World) {
  const counts = new Array(w.players.length + 1).fill(0);
  for (let i = 0; i < w.owner.length; i++) counts[w.owner[i]]++;
  w.counts = counts;
}

export const percentOf = (w: World, id: number) => (w.counts[id] / w.arenaCells) * 100;

/** Steer towards an angle (radians; 0 = right, π/2 = down). */
export function steerAngle(p: Player, angle: number) {
  p.targetHeading = wrapAngle(angle);
}

/** Up / right / down / left (keys, arrow pad, tests). */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
export function steerDir(p: Player, d: Dir) {
  steerAngle(p, DIR_ANGLE[d]);
}

function kill(w: World, p: Player, byId: number, cause: DeathCause) {
  if (!p.alive) return;
  p.alive = false;
  p.deathCause = cause;
  for (const c of p.trail) if (w.trail[c] === p.id) w.trail[c] = 0;
  p.trail = [];
  p.trailPath = [];
  for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === p.id) w.owner[i] = 0;
  p.respawnAt = w.tick + RESPAWN_TICKS;
  if (byId && byId !== p.id) {
    const killer = w.players[byId - 1];
    if (killer) killer.kills++;
  }
  w.events.push({ type: 'death', playerId: p.id, byId, cause, touched: [p.id] });
}

/**
 * Turns the trail into land, then claims every arena cell that can't reach the outside of the
 * arena without crossing the player's land. Returns the newly enclosed cells (not the trail) and
 * which other players lost land.
 */
export function claim(w: World, p: Player): { enclosed: number[]; touched: number[] } {
  for (const c of p.trail) {
    w.owner[c] = p.id;
    if (w.trail[c] === p.id) w.trail[c] = 0;
  }
  p.trail = [];
  p.trailPath = [];

  const n = w.size;
  const { seen, queue, owner, arena } = w;
  seen.fill(0);
  let head = 0, tail = 0;
  // Everything outside the arena is "outside"; the flood spreads from there.
  for (let c = 0; c < n * n; c++) if (!arena[c]) { seen[c] = 1; queue[tail++] = c; }
  while (head < tail) {
    const c = queue[head++];
    const x = c % n;
    if (x > 0) { const d = c - 1; if (!seen[d] && owner[d] !== p.id) { seen[d] = 1; queue[tail++] = d; } }
    if (x < n - 1) { const d = c + 1; if (!seen[d] && owner[d] !== p.id) { seen[d] = 1; queue[tail++] = d; } }
    if (c >= n) { const d = c - n; if (!seen[d] && owner[d] !== p.id) { seen[d] = 1; queue[tail++] = d; } }
    if (c < n * n - n) { const d = c + n; if (!seen[d] && owner[d] !== p.id) { seen[d] = 1; queue[tail++] = d; } }
  }
  const enclosed: number[] = [];
  const touched = new Set<number>();
  for (let c = 0; c < n * n; c++) {
    if (!seen[c] && owner[c] !== p.id) {
      if (owner[c]) touched.add(owner[c]);
      owner[c] = p.id;
      enclosed.push(c);
    }
  }
  return { enclosed, touched: [...touched] };
}

/** Cells a segment passes through, 4-connected (no diagonal gaps). */
export function supercover(x0: number, y0: number, x1: number, y1: number, out: number[], size: number) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tDeltaY : Infinity;
  const push = () => { if (cx >= 0 && cy >= 0 && cx < size && cy < size) out.push(cy * size + cx); else out.push(-1); };
  let guard = 0;
  while ((cx !== ex || cy !== ey) && guard++ < 64) {
    if (tMaxX < tMaxY) { cx += stepX; tMaxX += tDeltaX; }
    else { cy += stepY; tMaxY += tDeltaY; }
    push();
  }
}

/** Advance the world by one tick. */
export function step(w: World) {
  w.tick++;
  w.events = [];
  const dt = 1 / TICK_HZ;
  const n = w.size;

  for (const p of w.players) if (!p.alive && !p.isHuman && w.tick >= p.respawnAt) spawn(w, p);

  const alive = w.players.filter(p => p.alive);
  for (const p of alive) if (p.thinks) think(w, p);

  // 1. Turn (limited) and move. Collect the cells each head passes this tick.
  const paths = new Map<Player, number[]>();
  for (const p of alive) {
    const diff = wrapAngle(p.targetHeading - p.heading);
    const maxTurn = TURN_RATE * dt;
    p.heading = wrapAngle(p.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    p.prevX = p.x; p.prevY = p.y;
    p.x += Math.cos(p.heading) * SPEED * dt;
    p.y += Math.sin(p.heading) * SPEED * dt;
    const cells: number[] = [];
    supercover(p.prevX, p.prevY, p.x, p.y, cells, n);
    paths.set(p, cells);
  }

  // 2. Arena edge.
  for (const p of alive) {
    if (paths.get(p)!.some(c => c < 0 || !w.arena[c])) kill(w, p, 0, 'wall');
  }

  // 3. Heads meeting.
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (!a.alive || !b.alive) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > HEAD_RADIUS) continue;
      const la = w.counts[a.id], lb = w.counts[b.id];
      if (la >= lb) kill(w, b, a.id, 'head_on');
      if (lb >= la) kill(w, a, b.id, 'head_on');
    }
  }

  // 4. Trail cuts, against the trails as they were at the start of the tick.
  const cuts: { victim: Player; by: Player }[] = [];
  for (const p of alive) {
    if (!p.alive) continue;
    for (const c of paths.get(p)!) {
      const t = w.trail[c];
      if (!t) continue;
      if (t === p.id && w.tick - w.trailTick[c] <= NECK_TICKS) continue;
      cuts.push({ victim: w.players[t - 1], by: p });
      break;
    }
  }
  for (const { victim, by } of cuts) kill(w, victim, by.id, victim === by ? 'own_trail' : 'trail');

  // 5. Survivors lay trail, or claim on getting home.
  let changed = false;
  for (const p of alive) {
    if (!p.alive) continue;
    let claimed = false;
    for (const c of paths.get(p)!) {
      if (w.owner[c] === p.id) {
        if (p.trail.length && !claimed) {
          const trailLen = p.trail.length;
          const { enclosed, touched } = claim(w, p);
          claimed = changed = true;
          w.events.push({ type: 'claim', playerId: p.id, cells: trailLen + enclosed.length, touched: [p.id, ...touched] });
          const inside = new Set(enclosed);
          for (const q of w.players) {
            if (q !== p && q.alive) {
              const qc = cellOf(w, q.x, q.y);
              if (qc >= 0 && inside.has(qc)) kill(w, q, p.id, 'enclosed');
            }
          }
        }
      } else if (w.trail[c] !== p.id) {
        w.trail[c] = p.id;
        w.trailTick[c] = w.tick;
        p.trail.push(c);
      }
    }
    if (p.trail.length) {
      if (!p.trailPath.length) p.trailPath.push(p.prevX, p.prevY);
      p.trailPath.push(p.x, p.y);
    } else p.trailPath = [];
  }

  if (changed || w.events.some(e => e.type === 'death')) recount(w);
}

// ---------------------------------------------------------------- bots

const ownsAt = (w: World, p: Player, x: number, y: number) => {
  const c = cellOf(w, x, y);
  return c >= 0 && w.owner[c] === p.id;
};

/** Is the way ahead (a short ray) clear of the arena edge and the bot's own older trail? */
function rayClear(w: World, p: Player, angle: number, dist: number) {
  for (let d = 2; d <= dist; d += 0.5) {
    const x = p.x + Math.cos(angle) * d, y = p.y + Math.sin(angle) * d;
    const c = cellOf(w, x, y);
    if (c < 0 || !w.arena[c]) return false;
    if (w.trail[c] === p.id && w.tick - w.trailTick[c] > NECK_TICKS) return false;
  }
  return true;
}

function think(w: World, p: Player) {
  const cfg = DIFF[w.difficulty];
  const b = p.bot;
  const home = ownsAt(w, p, p.x, p.y);
  const c = w.size / 2;

  if (home && p.trail.length === 0) {
    if (b.plan !== 'home') { b.plan = 'home'; b.ticksLeft = Math.floor(randRange(w.rng, 2, 8)); }
    b.ticksLeft--;
    // Wander inside home, then pick a way out with room to spare, leaning away from the edge.
    if (b.ticksLeft <= 0) {
      const toCentre = Math.atan2(c - p.y, c - p.x);
      const nearEdge = Math.hypot(p.x - c, p.y - c) > arenaRadius(w.size) - 45;
      const a = nearEdge ? toCentre + randRange(w.rng, -1, 1) : randRange(w.rng, -Math.PI, Math.PI);
      p.targetHeading = wrapAngle(a);
      b.plan = 'out';
      b.ticksLeft = Math.floor(randRange(w.rng, cfg.outMin, cfg.outMax));
      b.turnDir = w.rng() < 0.5 ? 1 : -1;
      b.arcGoal = randRange(w.rng, cfg.arcMin, cfg.arcMax);
      b.arcTurned = 0;
      b.exitX = p.x; b.exitY = p.y;
    }
    return;
  }

  if (b.plan === 'home') { b.plan = 'out'; b.ticksLeft = cfg.outMin; b.exitX = p.prevX; b.exitY = p.prevY; }

  const danger = threatNear(w, p, cfg.awareness);
  if (danger || p.trail.length >= cfg.maxTrail) b.plan = 'back';

  if (cfg.hunt && b.plan !== 'back') {
    const t = huntTarget(w, p, cfg.hunt);
    if (t) { p.targetHeading = Math.atan2(t[1] - p.y, t[0] - p.x); avoid(w, p); return; }
  }

  if (b.plan === 'out') {
    if (--b.ticksLeft <= 0) b.plan = 'arc';
  } else if (b.plan === 'arc') {
    // Curve round in a petal shape, then head home.
    const turn = (TURN_RATE / TICK_HZ) * ARC_RATE;
    p.targetHeading = wrapAngle(p.heading + b.turnDir * turn);
    b.arcTurned += turn;
    if (b.arcTurned >= b.arcGoal) b.plan = 'back';
  }
  if (b.plan === 'back') {
    const a = homeHeading(w, p);
    p.targetHeading = a ?? Math.atan2(b.exitY - p.y, b.exitX - p.x);
  }
  avoid(w, p);
}

const RING = Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2), Math.sin((i / 24) * Math.PI * 2)]);

/** Heading to the nearest bit of its own land that it can reach without crossing its own trail. */
function homeHeading(w: World, p: Player): number | null {
  for (let r = 3; r <= 90; r += 2.5) {
    let best: number | null = null;
    let bestTurn = Infinity;
    for (const [cx, cy] of RING) {
      const x = p.x + cx * r, y = p.y + cy * r;
      if (!ownsAt(w, p, x, y)) continue;
      const a = Math.atan2(cy, cx);
      if (!rayClear(w, p, a, r) || !pathClear(w, p, a, 8)) continue;
      const turn = Math.abs(wrapAngle(a - p.heading));
      if (turn < bestTurn) { bestTurn = turn; best = a; }
    }
    if (best !== null) return best;
  }
  return null;
}

/**
 * Would steering towards `angle` for the next few ticks (with the real turn limit, so along the
 * actual arc) stay clear of the edge and its own older trail?
 */
function pathClear(w: World, p: Player, angle: number, ticks = 10) {
  let x = p.x, y = p.y, h = p.heading;
  const maxTurn = TURN_RATE / TICK_HZ, v = SPEED / TICK_HZ;
  const cells: number[] = [];
  for (let t = 1; t <= ticks; t++) {
    h += Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(angle - h)));
    const nx = x + Math.cos(h) * v, ny = y + Math.sin(h) * v;
    cells.length = 0;
    // The same 4-connected cells step() will test, so a "clear" path really is clear.
    supercover(x, y, nx, ny, cells, w.size);
    for (const c of cells) {
      if (c < 0 || !w.arena[c]) return false;
      if (w.trail[c] === p.id && w.tick + t - w.trailTick[c] > NECK_TICKS) return false;
      if (w.owner[c] === p.id && p.trail.length) return true; // home before trouble
    }
    x = nx; y = ny;
  }
  return true;
}

/** Bends the target heading away from the edge and its own trail. */
function avoid(w: World, p: Player) {
  if (pathClear(w, p, p.targetHeading)) return;
  for (const off of [0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6]) {
    const a = p.targetHeading + off * p.bot.turnDir;
    if (pathClear(w, p, a)) { p.targetHeading = wrapAngle(a); return; }
  }
}

function threatNear(w: World, p: Player, r: number) {
  if (!p.trail.length) return false;
  const fx = p.bot.exitX, fy = p.bot.exitY;
  for (const q of w.players) {
    if (q === p || !q.alive) continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) <= r) return true;
    if (Math.hypot(q.x - fx, q.y - fy) <= r) return true;
  }
  return false;
}

function huntTarget(w: World, p: Player, range: number): [number, number] | null {
  const human = w.players[0];
  if (!human.alive || human === p || human.trailPath.length < 4) return null;
  let best: [number, number] | null = null;
  let bestD = range;
  const tp = human.trailPath;
  for (let i = 0; i < tp.length; i += 2) {
    const d = Math.hypot(tp[i] - p.x, tp[i + 1] - p.y);
    if (d < bestD) { bestD = d; best = [tp[i], tp[i + 1]]; }
  }
  return best;
}
