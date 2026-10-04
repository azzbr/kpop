// Quiz Tower Defense rules — pure functions, no React or canvas, so they can be unit-tested.
// Units: positions are in TILES (a tile centre is x + 0.5), time is in TICKS (TICK_HZ per second).
// Coins (💰) come ONLY from quiz answers; stopping enemies earns score, not coins.

export const TICK_HZ = 30;
export const COLS = 12;
export const ROWS = 8;
export const START_HEARTS = 10;
export const MAX_WAVES = 15;
export const BOSS_EVERY = 5;
/** Questions she can answer per break (unused ones can still be used during the next wave). */
export const QUESTIONS_PER_BREAK = 5;
/** The very first break is longer, so a shaky start still buys a couple of towers. */
export const FIRST_BREAK_QUESTIONS = 8;
/** Selling gives back this share of everything spent on the tower. */
export const SELL_REFUND = 0.7;

// ------------------------------------------------------------------ maps

export interface Pt { x: number; y: number }

export interface MapDef {
  id: string;
  name: string;
  emoji: string;
  /** Waypoints in tile coordinates. Consecutive points share a row or a column. The last one is the castle. */
  waypoints: Pt[];
  /** Colours for drawing. */
  grass: string;
  road: string;
}

export const MAPS: MapDef[] = [
  {
    id: 'meadow', name: 'Meadow Zigzag', emoji: '🌼', grass: '#2f6b3a', road: '#e8cf9a',
    waypoints: [{ x: -1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 6 }, { x: 11, y: 6 }],
  },
  {
    id: 'spiral', name: 'Snail Spiral', emoji: '🌀', grass: '#3a5f2a', road: '#d9b98a',
    waypoints: [{ x: -1, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 3 }, { x: 7, y: 3 }],
  },
  {
    id: 'river', name: 'Twisty Creek', emoji: '🌊', grass: '#2a6158', road: '#f0dca8',
    waypoints: [{ x: -1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 6 }, { x: 11, y: 6 }],
  },
];

export const mapById = (id: string) => MAPS.find(m => m.id === id) ?? MAPS[0];

/** Every in-grid tile the road covers. */
export function pathCells(map: MapDef): Set<number> {
  const out = new Set<number>();
  const wp = map.waypoints;
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i], b = wp[i + 1];
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    for (;;) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) out.add(y * COLS + x);
      if (x === b.x && y === b.y) break;
      x += dx; y += dy;
    }
  }
  return out;
}

export function pathLength(map: MapDef): number {
  let len = 0;
  const wp = map.waypoints;
  for (let i = 0; i < wp.length - 1; i++) len += Math.abs(wp[i + 1].x - wp[i].x) + Math.abs(wp[i + 1].y - wp[i].y);
  return len;
}

/** Tile-centre position at `dist` tiles along the road. */
export function posAt(map: MapDef, dist: number): Pt {
  const wp = map.waypoints;
  let d = Math.max(0, dist);
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i], b = wp[i + 1];
    const seg = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (d <= seg || i === wp.length - 2) {
      const t = seg ? Math.min(1, d / seg) : 0;
      return { x: a.x + (b.x - a.x) * t + 0.5, y: a.y + (b.y - a.y) * t + 0.5 };
    }
    d -= seg;
  }
  const last = wp[wp.length - 1];
  return { x: last.x + 0.5, y: last.y + 0.5 };
}

// ------------------------------------------------------------------ enemies

export type EnemyKind = 'slug' | 'ladybird' | 'balloon' | 'duck' | 'turtle';

export interface EnemyDef { name: string; emoji: string; hp: number; speed: number; hearts: number; size: number }

/** speed in tiles per second. */
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slug: { name: 'Slug', emoji: '🐌', hp: 8, speed: 0.9, hearts: 1, size: 0.75 },
  ladybird: { name: 'Ladybird', emoji: '🐞', hp: 5, speed: 1.5, hearts: 1, size: 0.65 },
  balloon: { name: 'Balloon', emoji: '🎈', hp: 4, speed: 2.0, hearts: 1, size: 0.7 },
  duck: { name: 'Duck', emoji: '🦆', hp: 16, speed: 1.1, hearts: 1, size: 0.8 },
  turtle: { name: 'Big Turtle', emoji: '🐢', hp: 160, speed: 0.55, hearts: 3, size: 1.15 },
};

export interface Enemy {
  id: number;
  kind: EnemyKind;
  dist: number;
  prevDist: number;
  hp: number;
  maxHp: number;
  slowTicks: number;
  slow: number; // 0..1, share of speed taken away
}

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFF_HP: Record<Difficulty, number> = { easy: 0.75, normal: 1, hard: 1.3 };

/** Enemy health multiplier for a wave. */
export const waveHpScale = (wave: number, d: Difficulty) => (1 + 0.22 * (wave - 1) + 0.06 * (wave - 1) ** 2) * DIFF_HP[d];

export interface SpawnItem { kind: EnemyKind; at: number } // `at` = ticks after the wave starts

export const isBossWave = (wave: number) => wave % BOSS_EVERY === 0;

/** The (deterministic) spawn list for a wave. */
export function waveSpawns(wave: number): SpawnItem[] {
  const out: SpawnItem[] = [];
  const pool: EnemyKind[] = ['slug'];
  if (wave >= 2) pool.push('ladybird');
  if (wave >= 3) pool.push('balloon');
  if (wave >= 4) pool.push('duck');
  const boss = isBossWave(wave);
  const count = Math.min(40, 5 + wave * 2 - (boss ? 4 : 0));
  const gap = Math.max(12, 30 - wave * 1.5);
  let t = 0;
  for (let i = 0; i < count; i++) {
    const kind = pool[i % pool.length];
    out.push({ kind, at: Math.round(t) });
    t += kind === 'balloon' ? gap * 0.5 : gap; // balloons float in close together
  }
  if (boss) {
    const bosses = wave / BOSS_EVERY;
    for (let b = 0; b < bosses; b++) { t += gap * 2; out.push({ kind: 'turtle', at: Math.round(t) }); }
  }
  return out;
}

// ------------------------------------------------------------------ towers

export type TowerKind = 'archer' | 'bubble' | 'freeze' | 'zapper';

export interface TowerLevel {
  range: number;
  damage: number;
  cooldown: number; // ticks between shots
  splash?: number; // radius in tiles
  slow?: number; // share of speed taken away
  slowTicks?: number;
  chain?: number; // extra enemies hit
  chainRange?: number;
}

export interface TowerDef {
  name: string;
  emoji: string;
  color: string;
  blurb: string;
  cost: number;
  /** Cost to reach level 2 and level 3. */
  upgrades: [number, number];
  levels: [TowerLevel, TowerLevel, TowerLevel];
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: {
    name: 'Archer', emoji: '🏹', color: '#f59e0b', blurb: 'Fast & cheap', cost: 50, upgrades: [60, 100],
    levels: [
      { range: 2.5, damage: 2, cooldown: 15 },
      { range: 2.8, damage: 3.5, cooldown: 12 },
      { range: 3.1, damage: 5, cooldown: 10 },
    ],
  },
  bubble: {
    name: 'Bubble Blaster', emoji: '💥', color: '#ec4899', blurb: 'Pops groups', cost: 80, upgrades: [80, 130],
    levels: [
      { range: 2.2, damage: 3, cooldown: 36, splash: 1.0 },
      { range: 2.4, damage: 5, cooldown: 30, splash: 1.2 },
      { range: 2.6, damage: 8, cooldown: 27, splash: 1.4 },
    ],
  },
  freeze: {
    name: 'Freeze', emoji: '❄️', color: '#38bdf8', blurb: 'Slows them down', cost: 60, upgrades: [60, 100],
    levels: [
      { range: 2.0, damage: 0.5, cooldown: 24, splash: 0.8, slow: 0.35, slowTicks: 45 },
      { range: 2.3, damage: 1, cooldown: 22, splash: 0.9, slow: 0.45, slowTicks: 50 },
      { range: 2.6, damage: 1.5, cooldown: 20, splash: 1.1, slow: 0.55, slowTicks: 60 },
    ],
  },
  zapper: {
    name: 'Zapper', emoji: '⚡', color: '#a78bfa', blurb: 'Zaps a chain', cost: 100, upgrades: [100, 160],
    levels: [
      { range: 2.5, damage: 3, cooldown: 30, chain: 3, chainRange: 1.6 },
      { range: 2.7, damage: 5, cooldown: 28, chain: 4, chainRange: 1.7 },
      { range: 3.0, damage: 8, cooldown: 24, chain: 5, chainRange: 1.9 },
    ],
  },
};

export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];

export interface Tower {
  id: number;
  kind: TowerKind;
  x: number; // tile
  y: number;
  level: number; // 1..3
  cooldown: number;
  spent: number;
  shots: number;
}

export const towerStats = (t: Pick<Tower, 'kind' | 'level'>) => TOWERS[t.kind].levels[t.level - 1];

// ------------------------------------------------------------------ world

export type Phase = 'build' | 'wave' | 'won' | 'lost';

export type GameEvent =
  | { type: 'shot'; kind: TowerKind; towerId: number; from: Pt; hits: Pt[] }
  | { type: 'pop'; x: number; y: number; emoji: string; boss: boolean }
  | { type: 'leak'; x: number; y: number; hearts: number }
  | { type: 'waveClear'; wave: number }
  | { type: 'spawn'; kind: EnemyKind };

export interface World {
  map: MapDef;
  road: Set<number>;
  length: number;
  difficulty: Difficulty;
  hearts: number;
  coins: number;
  wave: number; // waves started
  cleared: number; // waves survived
  phase: Phase;
  enemies: Enemy[];
  towers: Tower[];
  queue: SpawnItem[];
  waveTick: number;
  tick: number;
  stopped: number;
  leaked: number;
  nextId: number;
  events: GameEvent[];
  // quiz economy
  questionsLeft: number;
  streak: number;
  bestStreak: number;
  answered: number;
  correct: number;
  earned: number;
}

export function createWorld(opts: { mapId?: string; difficulty?: Difficulty; coins?: number } = {}): World {
  const map = mapById(opts.mapId ?? MAPS[0].id);
  return {
    map, road: pathCells(map), length: pathLength(map),
    difficulty: opts.difficulty ?? 'normal',
    hearts: START_HEARTS, coins: opts.coins ?? 0,
    wave: 0, cleared: 0, phase: 'build',
    enemies: [], towers: [], queue: [], waveTick: 0, tick: 0,
    stopped: 0, leaked: 0, nextId: 1, events: [],
    questionsLeft: FIRST_BREAK_QUESTIONS, streak: 0, bestStreak: 0, answered: 0, correct: 0, earned: 0,
  };
}

export const scoreOf = (w: World) => w.cleared * 100 + w.stopped;

export const enemyPos = (w: World, e: Enemy, alpha = 1) => posAt(w.map, e.prevDist + (e.dist - e.prevDist) * alpha);

export function spawnEnemy(w: World, kind: EnemyKind, dist = 0): Enemy {
  const def = ENEMIES[kind];
  const hp = Math.round(def.hp * waveHpScale(Math.max(1, w.wave), w.difficulty) * 10) / 10;
  const e: Enemy = { id: w.nextId++, kind, dist, prevDist: dist, hp, maxHp: hp, slowTicks: 0, slow: 0 };
  w.enemies.push(e);
  return e;
}

export function startWave(w: World): boolean {
  if (w.phase !== 'build' || w.wave >= MAX_WAVES) return false;
  w.wave++;
  w.queue = waveSpawns(w.wave);
  w.waveTick = 0;
  w.phase = 'wave';
  return true;
}

// ------------------------------------------------------------------ economy

export function tileFree(w: World, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (w.road.has(y * COLS + x)) return false;
  return !w.towers.some(t => t.x === x && t.y === y);
}

export const towerAt = (w: World, x: number, y: number) => w.towers.find(t => t.x === x && t.y === y) ?? null;

export const canPlace = (w: World, x: number, y: number, kind: TowerKind) =>
  (w.phase === 'build' || w.phase === 'wave') && tileFree(w, x, y) && w.coins >= TOWERS[kind].cost;

export function placeTower(w: World, x: number, y: number, kind: TowerKind): Tower | null {
  if (!canPlace(w, x, y, kind)) return null;
  const cost = TOWERS[kind].cost;
  w.coins -= cost;
  const t: Tower = { id: w.nextId++, kind, x, y, level: 1, cooldown: 0, spent: cost, shots: 0 };
  w.towers.push(t);
  return t;
}

/** Cost of the next upgrade, or null at max level. */
export const upgradeCost = (t: Tower): number | null => (t.level >= 3 ? null : TOWERS[t.kind].upgrades[t.level - 1]);

export function upgradeTower(w: World, id: number): boolean {
  const t = w.towers.find(x => x.id === id);
  if (!t) return false;
  const cost = upgradeCost(t);
  if (cost === null || w.coins < cost) return false;
  w.coins -= cost;
  t.spent += cost;
  t.level++;
  return true;
}

export const sellValue = (t: Tower) => Math.floor(t.spent * SELL_REFUND);

export function sellTower(w: World, id: number): number {
  const i = w.towers.findIndex(x => x.id === id);
  if (i < 0) return 0;
  const refund = sellValue(w.towers[i]);
  w.coins += refund;
  w.towers.splice(i, 1);
  return refund;
}

/** Answer reward: right = 20 + up to 10 for speed + streak bonus (max +15); wrong = 5. */
export function answerReward(correct: boolean, ms: number, streakAfter: number): number {
  if (!correct) return 5;
  const speed = Math.round(10 * Math.max(0, Math.min(1, 1 - ms / 15000)));
  const streak = Math.min(15, 5 * Math.max(0, streakAfter - 1));
  return 20 + speed + streak;
}

/** Records an answered question: uses one question, updates the streak and adds 💰. Returns the coins gained. */
export function applyAnswer(w: World, correct: boolean, ms: number): number {
  if (w.questionsLeft <= 0) return 0;
  w.questionsLeft--;
  w.answered++;
  if (correct) { w.correct++; w.streak++; w.bestStreak = Math.max(w.bestStreak, w.streak); } else w.streak = 0;
  const gain = answerReward(correct, ms, w.streak);
  w.coins += gain;
  w.earned += gain;
  return gain;
}

// ------------------------------------------------------------------ simulation

const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Enemies within range of a tower, furthest along the road first. */
export function enemiesInRange(w: World, t: Tower): Enemy[] {
  const c = { x: t.x + 0.5, y: t.y + 0.5 };
  const r = towerStats(t).range;
  return w.enemies
    .filter(e => e.hp > 0 && dist2(enemyPos(w, e), c) <= r * r)
    .sort((a, b) => b.dist - a.dist);
}

/** Target = the enemy in range that is furthest along the road ("first"). */
export const pickTarget = (w: World, t: Tower): Enemy | null => enemiesInRange(w, t)[0] ?? null;

function hit(e: Enemy, dmg: number, s: TowerLevel) {
  e.hp -= dmg;
  if (s.slow && s.slowTicks) {
    if (s.slow >= e.slow || e.slowTicks <= 0) e.slow = s.slow;
    e.slowTicks = Math.max(e.slowTicks, s.slowTicks);
  }
}

function fire(w: World, t: Tower, target: Enemy) {
  const s = towerStats(t);
  const from = { x: t.x + 0.5, y: t.y + 0.5 };
  const tp = enemyPos(w, target);
  const hits: Pt[] = [tp];
  if (t.kind === 'zapper' && s.chain) {
    hit(target, s.damage, s);
    const done = new Set([target.id]);
    let curPos = tp, dmg = s.damage;
    for (let i = 0; i < s.chain; i++) {
      const cr = (s.chainRange ?? 1.5) ** 2;
      let best: Enemy | null = null, bestD = Infinity;
      for (const e of w.enemies) {
        if (done.has(e.id) || e.hp <= 0) continue;
        const d = dist2(enemyPos(w, e), curPos);
        if (d <= cr && d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      dmg *= 0.8;
      hit(best, dmg, s);
      done.add(best.id);
      curPos = enemyPos(w, best);
      hits.push(curPos);
    }
  } else if (s.splash) {
    const r2 = s.splash * s.splash;
    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      const p = enemyPos(w, e);
      if (e === target || dist2(p, tp) <= r2) {
        hit(e, s.damage, s);
        if (e !== target) hits.push(p);
      }
    }
  } else {
    hit(target, s.damage, s);
  }
  t.shots++;
  w.events.push({ type: 'shot', kind: t.kind, towerId: t.id, from, hits });
}

/** Advances the game one tick. */
export function step(w: World) {
  w.events = [];
  if (w.phase !== 'wave') return;
  w.tick++;

  // Spawn
  while (w.queue.length && w.queue[0].at <= w.waveTick) {
    const s = w.queue.shift()!;
    spawnEnemy(w, s.kind);
    w.events.push({ type: 'spawn', kind: s.kind });
  }
  w.waveTick++;

  // Move
  for (const e of w.enemies) {
    e.prevDist = e.dist;
    let sp = ENEMIES[e.kind].speed / TICK_HZ;
    if (e.slowTicks > 0) { sp *= 1 - e.slow; e.slowTicks--; if (e.slowTicks <= 0) e.slow = 0; }
    e.dist += sp;
  }

  // Leaks
  for (const e of w.enemies) {
    if (e.dist >= w.length && e.hp > 0) {
      const lost = ENEMIES[e.kind].hearts;
      w.hearts = Math.max(0, w.hearts - lost);
      w.leaked++;
      const p = posAt(w.map, w.length);
      w.events.push({ type: 'leak', x: p.x, y: p.y, hearts: lost });
      e.hp = -Infinity; // removed below, not counted as stopped
    }
  }
  w.enemies = w.enemies.filter(e => e.hp !== -Infinity);

  // Towers
  for (const t of w.towers) {
    if (t.cooldown > 0) { t.cooldown--; continue; }
    const target = pickTarget(w, t);
    if (!target) continue;
    fire(w, t, target);
    t.cooldown = towerStats(t).cooldown - 1;
  }

  // Pops
  const alive: Enemy[] = [];
  for (const e of w.enemies) {
    if (e.hp > 0) { alive.push(e); continue; }
    w.stopped++;
    const p = enemyPos(w, e);
    w.events.push({ type: 'pop', x: p.x, y: p.y, emoji: ENEMIES[e.kind].emoji, boss: e.kind === 'turtle' });
  }
  w.enemies = alive;

  if (w.hearts <= 0) { w.phase = 'lost'; return; }
  if (!w.queue.length && !w.enemies.length) {
    w.cleared = w.wave;
    w.events.push({ type: 'waveClear', wave: w.wave });
    if (w.wave >= MAX_WAVES) { w.phase = 'won'; return; }
    w.phase = 'build';
    w.questionsLeft = QUESTIONS_PER_BREAK;
    for (const t of w.towers) t.cooldown = 0;
  }
}

/** Runs a whole wave to the end (tests / balance checks). Returns ticks taken. */
export function runWave(w: World, maxTicks = TICK_HZ * 600): number {
  if (!startWave(w)) return 0;
  let n = 0;
  while (w.phase === 'wave' && n < maxTicks) { step(w); n++; }
  return n;
}

/** How many road tiles a tile at (x, y) covers within `range` — used to suggest good spots. */
export function coverage(w: World, x: number, y: number, range: number): number {
  let n = 0;
  const r2 = range * range;
  for (const c of w.road) {
    const cx = c % COLS, cy = Math.floor(c / COLS);
    if ((cx - x) ** 2 + (cy - y) ** 2 <= r2) n++;
  }
  return n;
}
