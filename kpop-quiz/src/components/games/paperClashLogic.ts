// Paper Clash — a Paper.io 2-style territory game. Pure logic, no React or canvas, so it can be
// unit-tested and driven step by step from the ?debug hook.
//
// Rules:
// - The map is a grid. Each cell has an owner (land) and, separately, maybe a trail. Keeping
//   them in two layers means a trail drawn across someone's land doesn't erase their ownership.
// - Leaving your land draws a trail. Getting back to your land claims the trail plus everything
//   it encloses (including other players' land).
// - Touching anyone's trail (yours included) knocks out the trail's owner.
// - Head-on collision: the player with more land survives; a tie knocks out both.
// - A player whose head ends up inside someone else's claimed loop is out.
// - Hitting the outer wall knocks you out.
// - Knocked-out land becomes neutral. Bots respawn after a delay; the human's round ends.

import type { Rng } from '../../games/engine/rng';
import { randInt } from '../../games/engine/rng';

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

export type Difficulty = 'easy' | 'normal' | 'hard';
export type DeathCause = 'trail' | 'own_trail' | 'wall' | 'head_on' | 'enclosed';

export interface Player {
  id: number; // 1-based; 0 means "nobody" in the grids
  name: string;
  emoji: string;
  color: string;
  isHuman: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  dir: Dir;
  nextDir: Dir;
  alive: boolean;
  trail: number[]; // cell indices, in the order they were laid
  kills: number;
  respawnAt: number; // tick, for bots
  deathCause?: DeathCause;
  bot: BotBrain;
}

interface BotBrain {
  plan: 'idle' | 'out' | 'side' | 'home';
  legLen: number;
  legLeft: number;
  turn: 1 | 3; // +1 = clockwise, +3 = anticlockwise
}

export interface GameEvent {
  type: 'claim' | 'death';
  playerId: number;
  /** For deaths: who caused it (0 = nobody, e.g. a wall). */
  byId?: number;
  cells?: number;
  cause?: DeathCause;
}

export interface World {
  size: number;
  owner: Uint8Array;
  trail: Uint8Array;
  players: Player[];
  tick: number;
  counts: number[]; // land cells per player id
  rng: Rng;
  difficulty: Difficulty;
  events: GameEvent[]; // events from the latest step()
}

export const TICK_HZ = 10;
const RESPAWN_TICKS = 3 * TICK_HZ;

const BOTS = [
  { name: 'Whiskers', emoji: '🐱', color: '#f97316' },
  { name: 'Foxy', emoji: '🦊', color: '#ef4444' },
  { name: 'Hopper', emoji: '🐸', color: '#22c55e' },
  { name: 'Bamboo', emoji: '🐼', color: '#64748b' },
  { name: 'Bananas', emoji: '🐵', color: '#eab308' },
  { name: 'Sparkle', emoji: '🦄', color: '#ec4899' },
];
export const HUMAN_COLOR = '#3b82f6';

const DIFF = {
  easy: { legMin: 3, legMax: 7, maxTrail: 20, awareness: 3, hunt: false },
  normal: { legMin: 4, legMax: 10, maxTrail: 30, awareness: 5, hunt: false },
  hard: { legMin: 5, legMax: 12, maxTrail: 40, awareness: 6, hunt: true },
};

export const idx = (w: World, x: number, y: number) => y * w.size + x;
const inBounds = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.size && y < w.size;

const SPARE_COLORS = ['#14b8a6', '#a855f7', '#0ea5e9', '#84cc16', '#f43f5e', '#6366f1'];

export function createWorld(opts: { size?: number; bots?: number; rng: Rng; difficulty?: Difficulty; humanName?: string; humanEmoji?: string; humanColor?: string }): World {
  const size = opts.size ?? 100;
  const w: World = {
    size,
    owner: new Uint8Array(size * size),
    trail: new Uint8Array(size * size),
    players: [],
    tick: 0,
    counts: [],
    rng: opts.rng,
    difficulty: opts.difficulty ?? 'normal',
    events: [],
  };
  const total = 1 + (opts.bots ?? 6);
  const humanColor = opts.humanColor || HUMAN_COLOR;
  // A bot never gets the same colour as the player's Locker colour.
  const spare = SPARE_COLORS.filter(c => c !== humanColor);
  const botColor = (c: string, i: number) => (c.toLowerCase() === humanColor.toLowerCase() ? spare[i % spare.length] : c);
  for (let i = 0; i < total; i++) {
    const bot = i === 0 ? null : BOTS[(i - 1) % BOTS.length];
    w.players.push({
      id: i + 1,
      name: bot ? bot.name : opts.humanName || 'You',
      emoji: bot ? bot.emoji : opts.humanEmoji || '😎',
      color: bot ? botColor(bot.color, i) : humanColor,
      isHuman: i === 0,
      x: 0, y: 0, prevX: 0, prevY: 0,
      dir: 0, nextDir: 0,
      alive: false,
      trail: [],
      kills: 0,
      respawnAt: 0,
      bot: { plan: 'idle', legLen: 0, legLeft: 0, turn: 1 },
    });
  }
  for (const p of w.players) spawn(w, p);
  recount(w);
  return w;
}

/** Puts a player on the map with a fresh 5×5 block of land, away from everyone else. */
export function spawn(w: World, p: Player): boolean {
  for (let attempt = 0; attempt < 400; attempt++) {
    const cx = randInt(w.rng, 4, w.size - 5);
    const cy = randInt(w.rng, 4, w.size - 5);
    if (!areaFree(w, cx, cy, 4)) continue;
    placeAt(w, p, cx, cy);
    return true;
  }
  return false;
}

/** Deterministic placement (used by tests). */
export function placeAt(w: World, p: Player, cx: number, cy: number) {
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) w.owner[idx(w, x, y)] = p.id;
  p.x = p.prevX = cx;
  p.y = p.prevY = cy;
  p.dir = p.nextDir = randInt(w.rng, 0, 3) as Dir;
  p.alive = true;
  p.trail = [];
  p.deathCause = undefined;
  p.bot = { plan: 'idle', legLen: 0, legLeft: 0, turn: w.rng() < 0.5 ? 1 : 3 };
}

function areaFree(w: World, cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(w, x, y)) return false;
      const c = idx(w, x, y);
      if (w.owner[c] || w.trail[c]) return false;
    }
  }
  for (const q of w.players) if (q.alive && Math.abs(q.x - cx) <= r + 2 && Math.abs(q.y - cy) <= r + 2) return false;
  return true;
}

export function recount(w: World) {
  const counts = new Array(w.players.length + 1).fill(0);
  for (let i = 0; i < w.owner.length; i++) counts[w.owner[i]]++;
  w.counts = counts;
}

export const percentOf = (w: World, id: number) => (w.counts[id] / (w.size * w.size)) * 100;

/** Change direction (ignored if it would reverse straight into your own trail). */
export function steer(p: Player, d: Dir) {
  if (d !== opposite(p.dir)) p.nextDir = d;
}

function kill(w: World, p: Player, byId: number, cause: DeathCause) {
  if (!p.alive) return;
  p.alive = false;
  p.deathCause = cause;
  for (const c of p.trail) if (w.trail[c] === p.id) w.trail[c] = 0;
  p.trail = [];
  for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === p.id) w.owner[i] = 0;
  p.respawnAt = w.tick + RESPAWN_TICKS;
  if (byId && byId !== p.id) {
    const killer = w.players[byId - 1];
    if (killer) killer.kills++;
  }
  w.events.push({ type: 'death', playerId: p.id, byId, cause });
}

/**
 * Turns the player's trail into land, then claims every cell that can't reach the map edge
 * without crossing the player's land. Returns the indices of the newly enclosed cells
 * (not counting the trail itself).
 */
export function claim(w: World, p: Player): number[] {
  for (const c of p.trail) {
    w.owner[c] = p.id;
    if (w.trail[c] === p.id) w.trail[c] = 0;
  }
  p.trail = [];

  const n = w.size;
  const seen = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  const push = (c: number) => {
    if (!seen[c] && w.owner[c] !== p.id) { seen[c] = 1; queue[tail++] = c; }
  };
  for (let i = 0; i < n; i++) {
    push(i); push((n - 1) * n + i); push(i * n); push(i * n + n - 1);
  }
  while (head < tail) {
    const c = queue[head++];
    const x = c % n;
    const y = (c / n) | 0;
    if (x > 0) push(c - 1);
    if (x < n - 1) push(c + 1);
    if (y > 0) push(c - n);
    if (y < n - 1) push(c + n);
  }
  const enclosed: number[] = [];
  for (let c = 0; c < n * n; c++) {
    if (!seen[c] && w.owner[c] !== p.id) {
      w.owner[c] = p.id;
      enclosed.push(c);
    }
  }
  return enclosed;
}

/** Advance the world by one tick. */
export function step(w: World) {
  w.tick++;
  w.events = [];

  for (const p of w.players) {
    if (!p.alive && !p.isHuman && w.tick >= p.respawnAt) spawn(w, p);
  }

  const alive = w.players.filter(p => p.alive);
  for (const p of alive) if (!p.isHuman) think(w, p);

  // 1. Everyone picks their next cell.
  const moves = alive.map(p => {
    p.dir = p.nextDir;
    return { p, nx: p.x + DX[p.dir], ny: p.y + DY[p.dir] };
  });

  // 2. Walls.
  for (const m of moves) if (!inBounds(w, m.nx, m.ny)) kill(w, m.p, 0, 'wall');

  // 3. Head-on collisions (same target cell, or swapping places).
  for (let i = 0; i < moves.length; i++) {
    for (let j = i + 1; j < moves.length; j++) {
      const a = moves[i];
      const b = moves[j];
      if (!a.p.alive || !b.p.alive) continue;
      const same = a.nx === b.nx && a.ny === b.ny;
      const swap = a.nx === b.p.x && a.ny === b.p.y && b.nx === a.p.x && b.ny === a.p.y;
      if (!same && !swap) continue;
      const la = w.counts[a.p.id];
      const lb = w.counts[b.p.id];
      if (la >= lb) kill(w, b.p, a.p.id, 'head_on');
      if (lb >= la) kill(w, a.p, b.p.id, 'head_on');
    }
  }

  // 4. Trail cuts, judged against the trails as they were at the start of the tick.
  const cuts: { victim: Player; by: Player }[] = [];
  for (const m of moves) {
    if (!m.p.alive) continue;
    const t = w.trail[idx(w, m.nx, m.ny)];
    if (t) cuts.push({ victim: w.players[t - 1], by: m.p });
  }
  for (const { victim, by } of cuts) kill(w, victim, by.id, victim === by ? 'own_trail' : 'trail');

  // 5. Survivors move: lay trail, or claim on getting home.
  let claimed = false;
  for (const m of moves) {
    const p = m.p;
    if (!p.alive) continue;
    p.prevX = p.x;
    p.prevY = p.y;
    p.x = m.nx;
    p.y = m.ny;
    const c = idx(w, p.x, p.y);
    if (w.owner[c] === p.id) {
      if (p.trail.length) {
        const trailLen = p.trail.length;
        const enclosed = claim(w, p);
        claimed = true;
        w.events.push({ type: 'claim', playerId: p.id, cells: trailLen + enclosed.length });
        const inside = new Set(enclosed);
        for (const q of w.players) {
          if (q !== p && q.alive && inside.has(idx(w, q.x, q.y))) kill(w, q, p.id, 'enclosed');
        }
      }
    } else {
      w.trail[c] = p.id;
      p.trail.push(c);
    }
  }

  if (claimed || w.events.some(e => e.type === 'death')) recount(w);
}

// ---------------------------------------------------------------- bots

function think(w: World, p: Player) {
  const cfg = DIFF[w.difficulty];
  const home = w.owner[idx(w, p.x, p.y)] === p.id;
  const b = p.bot;

  if (home && p.trail.length === 0) {
    if (b.plan === 'home' || b.plan === 'idle' || b.plan === 'side') {
      // Head out in a random direction that isn't straight into a nearby wall.
      b.plan = 'out';
      b.legLen = randInt(w.rng, cfg.legMin, cfg.legMax);
      b.legLeft = b.legLen;
      b.turn = w.rng() < 0.5 ? 1 : 3;
      const options = ([0, 1, 2, 3] as Dir[]).filter(d => d !== opposite(p.dir) && roomAhead(w, p.x, p.y, d) > b.legLen + 2);
      if (options.length) p.nextDir = options[randInt(w.rng, 0, options.length - 1)];
    }
  } else {
    const danger = threatNear(w, p, cfg.awareness);
    if (danger || p.trail.length >= cfg.maxTrail) b.plan = 'home';

    if (cfg.hunt && b.plan !== 'home') {
      const target = huntTarget(w, p);
      if (target !== null) { goToward(w, p, target % w.size, (target / w.size) | 0); return; }
    }

    if (b.plan === 'out' || b.plan === 'side') {
      b.legLeft--;
      if (b.legLeft <= 0) {
        if (b.plan === 'out') { b.plan = 'side'; b.legLeft = randInt(w.rng, 2, b.legLen); }
        else b.plan = 'home';
        p.nextDir = ((p.dir + b.turn) % 4) as Dir;
      }
    }
    if (b.plan === 'home') {
      const t = nearestOwned(w, p);
      if (t !== null) { goToward(w, p, t % w.size, (t / w.size) | 0); return; }
    }
  }
  avoidDanger(w, p);
}

function roomAhead(w: World, x: number, y: number, d: Dir) {
  let n = 0;
  while (inBounds(w, x + DX[d] * (n + 1), y + DY[d] * (n + 1))) n++;
  return n;
}

/** Is another player's head close to this bot's head or the start of its trail? */
function threatNear(w: World, p: Player, r: number) {
  if (!p.trail.length) return false;
  const first = p.trail[0];
  const fx = first % w.size;
  const fy = (first / w.size) | 0;
  for (const q of w.players) {
    if (q === p || !q.alive) continue;
    if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= r) return true;
    if (Math.abs(q.x - fx) + Math.abs(q.y - fy) <= r) return true;
  }
  return false;
}

function nearestOwned(w: World, p: Player): number | null {
  const n = w.size;
  for (let r = 1; r < 40; r++) {
    let best: number | null = null;
    for (let dy = -r; dy <= r; dy++) {
      const span = r - Math.abs(dy);
      for (const dx of span === 0 ? [0] : [-span, span]) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        if (w.owner[y * n + x] === p.id) { best = y * n + x; break; }
      }
      if (best !== null) return best;
    }
  }
  return null;
}

function huntTarget(w: World, p: Player): number | null {
  const human = w.players[0];
  if (!human.alive || !human.trail.length) return null;
  let best: number | null = null;
  let bestD = 12;
  for (const c of human.trail) {
    const d = Math.abs((c % w.size) - p.x) + Math.abs(((c / w.size) | 0) - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function isSafe(w: World, p: Player, d: Dir) {
  const x = p.x + DX[d];
  const y = p.y + DY[d];
  if (!inBounds(w, x, y)) return false;
  return w.trail[idx(w, x, y)] !== p.id;
}

function goToward(w: World, p: Player, tx: number, ty: number) {
  const options = ([0, 1, 2, 3] as Dir[]).filter(d => d !== opposite(p.dir) && isSafe(w, p, d));
  if (!options.length) return;
  options.sort((a, b) => dist(p.x + DX[a], p.y + DY[a], tx, ty) - dist(p.x + DX[b], p.y + DY[b], tx, ty));
  p.nextDir = options[0];
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);

function avoidDanger(w: World, p: Player) {
  if (isSafe(w, p, p.nextDir) && p.nextDir !== opposite(p.dir)) return;
  const options = ([0, 1, 2, 3] as Dir[]).filter(d => d !== opposite(p.dir) && isSafe(w, p, d));
  if (options.length) p.nextDir = options[randInt(w.rng, 0, options.length - 1)];
}
