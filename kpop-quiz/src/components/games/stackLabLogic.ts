// 🏗️ Stack Lab — rules and physics, no React or canvas (StackLab.tsx draws it).
// A crane swings a piece over a small base; she taps to drop it and builds the tallest tower she
// can in 90 seconds. Pieces that fall off the base cost a heart (one heart per tumble, however many
// pieces fall in it); 3 tumbles end the round. The score is the best *still* height in cm: the
// tower only counts once every piece has stopped moving, so a wobbly tower that's about to fall
// doesn't score.
//
// Physics is matter-js (MIT), stepped once per fixed 60 Hz tick so a 120 Hz iPad plays at the same
// speed. The piece order comes from a seeded shuffled bag, so `?seed=42` is repeatable.
import Matter from 'matter-js';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export const TICK_HZ = 60;
export const ROUND_SECONDS = 90;
export const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
/** World units (≈ px at zoom 1) per centimetre: a cube is 64 units = 10 cm. */
export const UNITS_PER_CM = 6.4;
export const BASE_W = 260;
export const BASE_H = 40;
/** The base's top edge is y = 0; up is negative y (matter-js has y pointing down). */
export const BASE_TOP = 0;
/** A piece below this, or this far to the side, has fallen off. */
export const FALL_Y = 420;
export const FALL_X = 720;
export const MAX_HEARTS = 3;
/** Falls this close together are one tumble (one heart). */
export const TUMBLE_TICKS = 180;
/** Everything must be still this long before the height counts. */
export const STILL_TICKS = 30;
/** After a drop, the crane brings the next piece after this many ticks. */
export const RESPAWN_TICKS = 45;
/** After time's up the tower gets this long to settle before the final height is read. */
export const SETTLE_TICKS = 240;
export const CRANE_AMP = 190;
/** Hook height above the top of the tower, and the hanging piece below the hook. */
export const CRANE_ABOVE = 230;
export const HANG_BELOW = 70;
/** Physics sub-steps per tick: smaller steps keep a tall stack from creeping and jittering. */
export const SUBSTEPS = 3;

/** Very slow movement is damped away (a stack's creep), fast movement (a real topple) is not. */
export const CREEP_SPEED = 0.35;
const CREEP_DAMP = 0.75;
/** Ticks of stillness before matter-js puts a piece to sleep (a sleeping piece can't creep). */
const SLEEP = 40;

export type PieceKind = 'cube' | 'plank' | 'tall' | 'jelly' | 'gem' | 'hill';

export interface PieceInfo { name: string; w: number; h: number; colors: string[] }

export const PIECES: Record<PieceKind, PieceInfo> = {
  cube: { name: 'Cube', w: 64, h: 64, colors: ['#f97316', '#3b82f6', '#22c55e'] },
  plank: { name: 'Plank', w: 128, h: 30, colors: ['#eab308', '#a855f7'] },
  tall: { name: 'Tower block', w: 44, h: 88, colors: ['#ec4899', '#14b8a6'] },
  jelly: { name: 'Jelly', w: 80, h: 48, colors: ['#f43f5e', '#8b5cf6', '#10b981'] },
  gem: { name: 'Gem', w: 70, h: 70, colors: ['#0ea5e9', '#f59e0b'] },
  hill: { name: 'Hill', w: 100, h: 52, colors: ['#84cc16', '#6366f1'] },
};

/** One bag = this many of each kind, shuffled; a new bag when it runs out. */
const BAG: [PieceKind, number][] = [['cube', 3], ['plank', 2], ['tall', 2], ['jelly', 2], ['hill', 1], ['gem', 1]];

export interface Hanging { kind: PieceKind; angle: number; color: string; face: number }

export interface StackPiece {
  id: number;
  kind: PieceKind;
  color: string;
  face: number;
  body: Matter.Body;
  /** Position and angle at the previous tick, for smooth drawing between ticks. */
  prev: { x: number; y: number; angle: number };
  landed: boolean;
  droppedAt: number;
}

export type StackEvent =
  | { type: 'drop'; kind: PieceKind }
  | { type: 'land'; id: number }
  | { type: 'fall'; id: number }
  | { type: 'heart'; hearts: number }
  | { type: 'best'; cm: number }
  | { type: 'timeUp' }
  | { type: 'over'; reason: 'time' | 'hearts' };

export interface StackWorld {
  engine: Matter.Engine;
  base: Matter.Body;
  pieces: StackPiece[];
  rng: Rng;
  bag: PieceKind[];
  tick: number;
  status: 'playing' | 'settling' | 'over';
  crane: { x: number; y: number; px: number; py: number; phase: number };
  hanging: Hanging | null;
  next: Hanging;
  respawnAt: number;
  hearts: number;
  lastHeartTick: number;
  stillTicks: number;
  settleTicks: number;
  /** Height of the still pieces right now, and the best still height this round (cm). */
  currentCm: number;
  bestCm: number;
  /** Top of the resting tower (world y, ≤ BASE_TOP). */
  topY: number;
  dropped: number;
  fallen: number;
  overReason: 'time' | 'hearts' | null;
  events: StackEvent[];
}

let nextId = 1;

function refillBag(w: StackWorld) {
  const bag: PieceKind[] = [];
  for (const [kind, n] of BAG) for (let i = 0; i < n; i++) bag.push(kind);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  w.bag.push(...bag);
}

function takePiece(w: StackWorld): Hanging {
  if (w.bag.length === 0) refillBag(w);
  // Start every round on an easy piece.
  if (w.tick === 0 && w.hanging === null) {
    const easy = w.bag.findIndex(k => k !== 'gem' && k !== 'hill');
    w.bag.unshift(...w.bag.splice(easy, 1));
  }
  const kind = w.bag.shift()!;
  const colors = PIECES[kind].colors;
  return { kind, angle: 0, color: colors[Math.floor(w.rng() * colors.length)], face: Math.floor(w.rng() * 4) };
}

/** The matter-js body for a piece, centred on (x, y). Sharp corners on purpose: chamfered (rounded)
 *  bodies make matter-js stacks jitter and creep; StackLab.tsx draws the corners rounded. */
export function makeBody(kind: PieceKind, x: number, y: number, angle = 0): Matter.Body {
  const p = PIECES[kind];
  const common = { friction: 0.9, frictionStatic: 1.2, frictionAir: 0.02, restitution: 0, density: 0.0015, slop: 0.05, sleepThreshold: SLEEP };
  let body: Matter.Body;
  switch (kind) {
    case 'gem':
      // An octagon: it rolls a little, then stops on a flat side.
      body = Bodies.polygon(x, y, 8, p.w / 2, common);
      break;
    case 'jelly':
      body = Bodies.rectangle(x, y, p.w, p.h, { ...common, friction: 1, restitution: 0.1 });
      break;
    case 'hill':
      body = Bodies.trapezoid(x, y, p.w, p.h, 0.45, common);
      break;
    default:
      body = Bodies.rectangle(x, y, p.w, p.h, common);
  }
  if (angle) Body.setAngle(body, angle);
  return body;
}

export function createStackWorld(seed: number): StackWorld {
  const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  const base = Bodies.rectangle(0, BASE_TOP + BASE_H / 2, BASE_W, BASE_H, {
    isStatic: true, friction: 1, frictionStatic: 1.5, label: 'base',
  });
  Composite.add(engine.world, base);
  const w: StackWorld = {
    engine, base, pieces: [], rng: createRng(seed), bag: [], tick: 0, status: 'playing',
    crane: { x: 0, y: BASE_TOP - CRANE_ABOVE, px: 0, py: BASE_TOP - CRANE_ABOVE, phase: 0 },
    hanging: null, next: null as unknown as Hanging, respawnAt: 0, hearts: MAX_HEARTS, lastHeartTick: -1e9,
    stillTicks: 0, settleTicks: 0, currentCm: 0, bestCm: 0, topY: BASE_TOP, dropped: 0, fallen: 0,
    overReason: null, events: [],
  };
  w.hanging = takePiece(w);
  w.next = takePiece(w);
  // First contact of a dropped piece = 'land' (a soft thud in the game).
  Events.on(engine, 'collisionStart', ev => {
    for (const pair of ev.pairs) {
      for (const b of [pair.bodyA, pair.bodyB]) {
        const piece = w.pieces.find(p => p.body === b || p.body === b.parent);
        if (piece && !piece.landed) { piece.landed = true; w.events.push({ type: 'land', id: piece.id }); }
      }
    }
  });
  return w;
}

/** How fast the crane swings: one full swing takes 200 ticks (3.3 s) at first, down to 130 as the tower grows. */
export function swingPeriod(cm: number): number {
  return Math.max(130, 200 - cm * 0.4);
}

/** Where the hanging piece's centre is. */
export function hangingPos(w: StackWorld): { x: number; y: number } {
  return { x: w.crane.x, y: w.crane.y + HANG_BELOW };
}

/** Drop the hanging piece. False when there's nothing to drop (the crane is fetching the next one). */
export function dropPiece(w: StackWorld): boolean {
  if (w.status !== 'playing' || !w.hanging) return false;
  const h = w.hanging;
  const { x, y } = hangingPos(w);
  const body = makeBody(h.kind, x, y, h.angle);
  Composite.add(w.engine.world, body);
  w.pieces.push({ id: nextId++, kind: h.kind, color: h.color, face: h.face, body, prev: { x, y, angle: h.angle }, landed: false, droppedAt: w.tick });
  w.hanging = null;
  w.respawnAt = w.tick + RESPAWN_TICKS;
  w.dropped++;
  w.stillTicks = 0;
  w.events.push({ type: 'drop', kind: h.kind });
  return true;
}

/** Turn the hanging piece a quarter turn. */
export function rotatePiece(w: StackWorld): boolean {
  if (w.status !== 'playing' || !w.hanging) return false;
  w.hanging.angle = (w.hanging.angle + Math.PI / 2) % (Math.PI * 2);
  return true;
}

const isResting = (b: Matter.Body) => b.isSleeping || (b.speed < 0.2 && Math.abs(b.angularVelocity) < 0.01);

/** The top of the pieces that are lying still (world y; BASE_TOP when there are none). */
export function restingTop(w: StackWorld): number {
  let top = BASE_TOP;
  for (const p of w.pieces) if (p.landed && isResting(p.body)) top = Math.min(top, p.body.bounds.min.y);
  return top;
}

export const toCm = (y: number) => Math.max(0, Math.round((BASE_TOP - y) / UNITS_PER_CM));

export function stepStack(w: StackWorld) {
  w.events = [];
  if (w.status === 'over') return;
  w.tick++;
  for (const p of w.pieces) p.prev = { x: p.body.position.x, y: p.body.position.y, angle: p.body.angle };
  for (let i = 0; i < SUBSTEPS; i++) Engine.update(w.engine, 1000 / TICK_HZ / SUBSTEPS);
  for (const p of w.pieces) {
    const b = p.body;
    if (!p.landed || b.isSleeping || b.speed > CREEP_SPEED || Math.abs(b.angularVelocity) > 0.012) continue;
    Body.setVelocity(b, { x: b.velocity.x * CREEP_DAMP, y: b.velocity.y * CREEP_DAMP });
    Body.setAngularVelocity(b, b.angularVelocity * CREEP_DAMP);
  }

  // Fallen pieces leave the world; one heart per tumble.
  for (const p of [...w.pieces]) {
    const { x, y } = p.body.position;
    if (y > FALL_Y || Math.abs(x) > FALL_X) {
      Composite.remove(w.engine.world, p.body);
      w.pieces.splice(w.pieces.indexOf(p), 1);
      w.fallen++;
      w.events.push({ type: 'fall', id: p.id });
      if (w.tick - w.lastHeartTick > TUMBLE_TICKS) {
        w.hearts--;
        w.lastHeartTick = w.tick;
        w.events.push({ type: 'heart', hearts: w.hearts });
      }
    }
  }

  // Height: only when every piece has landed and is still.
  const allStill = w.pieces.every(p => p.landed && isResting(p.body));
  w.stillTicks = allStill ? w.stillTicks + 1 : 0;
  w.topY = restingTop(w);
  w.currentCm = toCm(w.topY);
  if (w.stillTicks >= STILL_TICKS && w.currentCm > w.bestCm) {
    w.bestCm = w.currentCm;
    w.events.push({ type: 'best', cm: w.bestCm });
  }

  // The crane swings, and rises with the tower.
  const c = w.crane;
  c.px = c.x; c.py = c.y;
  c.phase += (Math.PI * 2) / swingPeriod(w.bestCm);
  c.x = CRANE_AMP * Math.sin(c.phase);
  const targetY = Math.min(BASE_TOP, w.topY) - CRANE_ABOVE;
  c.y += Math.max(-4, Math.min(4, targetY - c.y));

  if (w.status === 'playing') {
    if (!w.hanging && w.tick >= w.respawnAt) { w.hanging = w.next; w.next = takePiece(w); }
    if (w.hearts <= 0) return finish(w, 'hearts');
    if (w.tick >= ROUND_TICKS) {
      w.status = 'settling';
      w.hanging = null;
      w.events.push({ type: 'timeUp' });
    }
  } else if (w.status === 'settling') {
    w.settleTicks++;
    if (w.hearts <= 0) finish(w, 'hearts');
    else if (w.settleTicks >= SETTLE_TICKS || (w.settleTicks > 10 && w.stillTicks >= STILL_TICKS)) finish(w, 'time');
  }
}

function finish(w: StackWorld, reason: 'time' | 'hearts') {
  w.status = 'over';
  w.overReason = reason;
  w.hanging = null;
  w.events.push({ type: 'over', reason });
}

export const secondsLeft = (w: StackWorld) => Math.max(0, Math.ceil((ROUND_TICKS - w.tick) / TICK_HZ));
