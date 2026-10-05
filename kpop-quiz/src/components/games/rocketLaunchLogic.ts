// Rocket Launch rules — pure (no React, no canvas), so they can be tested.
// The world is an 800×420 logical canvas; physics run at a fixed 60 ticks per second.

import type { Rng } from '../../games/engine/rng';

export const W = 800;
export const H = 420;
export const GRAVITY = 0.22;
export const LAUNCH_X = 80;
export const GROUND_Y = 370;
export const LAUNCH_Y = GROUND_Y - 50;
export const TARGETS_PER_ROUND = 5;
export const TRIES_PER_TARGET = 3;
export const MIN_ANGLE = 5;
export const MAX_ANGLE = 85;
export const MIN_POWER = 10;
export const MAX_POWER = 100;

/** Points: 100 per target hit + 30 for every try still unused (same units as the old game). */
export const HIT_POINTS = 100;
export const SPARE_TRY_POINTS = 30;
export const MAX_SCORE = TARGETS_PER_ROUND * (HIT_POINTS + (TRIES_PER_TARGET - 1) * SPARE_TRY_POINTS);

export interface Target { x: number; y: number; radius: number }
export interface Shot { x: number; y: number; vx: number; vy: number }

export const clampAngle = (a: number) => Math.round(Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, a)));
export const clampPower = (p: number) => Math.round(Math.min(MAX_POWER, Math.max(MIN_POWER, p)));

export function launchShot(angle: number, power: number): Shot {
  const rad = (angle * Math.PI) / 180;
  const v = power * 0.19;
  return { x: LAUNCH_X, y: LAUNCH_Y, vx: v * Math.cos(rad), vy: -v * Math.sin(rad) };
}

/** One physics tick. */
export function stepShot(s: Shot): Shot {
  const vy = s.vy + GRAVITY;
  return { x: s.x + s.vx, y: s.y + vy, vx: s.vx, vy };
}

export const isOut = (s: Shot) => s.y > GROUND_Y || s.x > W + 50 || s.x < -50;

/** Does the segment a→b pass within the target's radius? (Swept, so a fast rocket can't skip through.) */
export function segmentHits(ax: number, ay: number, bx: number, by: number, t: Target): boolean {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.y - ay) * dy) / len2));
  const cx = ax + u * dx - t.x, cy = ay + u * dy - t.y;
  return cx * cx + cy * cy < t.radius * t.radius;
}

/** Fly a whole shot without drawing. Returns whether it hit, and the path (for the aim preview). */
export function simulate(angle: number, power: number, target: Target | null, maxTicks = 600) {
  let s = launchShot(angle, power);
  const path: { x: number; y: number }[] = [{ x: s.x, y: s.y }];
  for (let i = 0; i < maxTicks; i++) {
    const n = stepShot(s);
    if (target && segmentHits(s.x, s.y, n.x, n.y, target)) return { hit: true, path };
    s = n;
    path.push({ x: s.x, y: s.y });
    if (isOut(s)) break;
  }
  return { hit: false, path };
}

/** Is there an angle/power on the dials that hits this target? */
export function isReachable(t: Target): boolean {
  for (let a = MIN_ANGLE; a <= MAX_ANGLE; a += 1) {
    for (let p = MIN_POWER; p <= MAX_POWER; p += 1) {
      if (simulate(a, p, t).hit) return true;
    }
  }
  return false;
}

/**
 * Five targets at random spots, getting smaller and generally further away.
 * Every target is checked to be hittable and not to overlap the others.
 */
export function makeTargets(rng: Rng): Target[] {
  const out: Target[] = [];
  for (let i = 0; i < TARGETS_PER_ROUND; i++) {
    const radius = 38 - i * 3; // 38 → 26
    const minX = 220 + i * 70;
    const maxX = Math.min(740, 420 + i * 80);
    let t: Target = { x: 0, y: 0, radius };
    for (let attempt = 0; attempt < 60; attempt++) {
      t = {
        x: Math.round(minX + rng() * (maxX - minX)),
        y: Math.round(GROUND_Y - 50 - rng() * 190),
        radius,
      };
      const apart = out.every(o => Math.hypot(o.x - t.x, o.y - t.y) > o.radius + t.radius + 20);
      if (apart && isReachable(t)) break;
    }
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Round state — one reducer, so a late timer can never undo the end of a round.

export type Phase = 'aim' | 'flight' | 'result' | 'done';

export interface RoundState {
  phase: Phase;
  targets: Target[];
  /** Index of the target being aimed at. */
  index: number;
  triesLeft: number;
  /** Shots already fired at the current target (the aim preview shows only before the first). */
  shotsAtTarget: number;
  score: number;
  hits: number;
  /** Outcome of the last shot, shown while phase is 'result'. */
  last: { hit: boolean; points: number; outOfTries: boolean } | null;
}

export type RoundAction =
  | { type: 'launch' }
  | { type: 'landed'; hit: boolean }
  /** After the result pause: next shot, next target, or the end. */
  | { type: 'next' };

export function newRound(targets: Target[]): RoundState {
  return { phase: 'aim', targets, index: 0, triesLeft: TRIES_PER_TARGET, shotsAtTarget: 0, score: 0, hits: 0, last: null };
}

export function reduceRound(s: RoundState, a: RoundAction): RoundState {
  if (s.phase === 'done') return s; // the end is final
  switch (a.type) {
    case 'launch':
      return s.phase === 'aim' ? { ...s, phase: 'flight', shotsAtTarget: s.shotsAtTarget + 1 } : s;
    case 'landed': {
      if (s.phase !== 'flight') return s;
      if (a.hit) {
        const points = HIT_POINTS + (s.triesLeft - 1) * SPARE_TRY_POINTS;
        return { ...s, phase: 'result', score: s.score + points, hits: s.hits + 1, last: { hit: true, points, outOfTries: false } };
      }
      const triesLeft = s.triesLeft - 1;
      return { ...s, phase: 'result', triesLeft, last: { hit: false, points: 0, outOfTries: triesLeft <= 0 } };
    }
    case 'next': {
      if (s.phase !== 'result' || !s.last) return s;
      const moveOn = s.last.hit || s.last.outOfTries;
      if (!moveOn) return { ...s, phase: 'aim' };
      const index = s.index + 1;
      if (index >= s.targets.length) return { ...s, phase: 'done' };
      return { ...s, phase: 'aim', index, triesLeft: TRIES_PER_TARGET, shotsAtTarget: 0 };
    }
  }
}
