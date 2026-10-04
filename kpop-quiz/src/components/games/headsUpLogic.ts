// Heads Up rules — pure functions (no React, no DOM), so the tilt detection can be unit-tested.
//
// Tilt maths: DeviceOrientationEvent gives beta/gamma as Euler angles, which flip (beta jumps by
// 180°, gamma changes sign) right where a landscape iPad held upright sits. So instead of using
// the raw angles we turn them into the "world up" direction in the device's own axes, then
// measure it against the screen's current up direction (which depends on which way the iPad is
// turned). That gives one smooth pitch angle for any orientation:
//    0° = screen upright facing the friends, −90° = screen facing the floor, +90° = the ceiling.

import type { Rng } from '../../games/engine/rng';

export const TRIGGER_DEG = 38; // tilt this far from neutral to count
export const NEUTRAL_DEG = 18; // must come back within this to arm the next tilt
export const DEBOUNCE_MS = 600; // ignore tilts right after a card changes
export const ROUND_CHOICES = [30, 60, 90] as const;
export const COUNTDOWN_SECS = 3;

const RAD = Math.PI / 180;

/** The screen orientation angle (0/90/180/270) from screen.orientation.angle or window.orientation. */
export function normaliseScreenAngle(angle: number | null | undefined): number {
  return Math.round((((angle ?? 0) % 360) + 360) % 360) % 360;
}

/**
 * Pitch of the screen in degrees: 0 upright, negative = screen tipping toward the floor,
 * positive = toward the ceiling. `screenAngle` is the screen orientation angle.
 */
export function tiltAngle(beta: number, gamma: number, screenAngle: number): number {
  const b = beta * RAD;
  const g = gamma * RAD;
  // World "up" expressed in device axes (x right, y top, z out of the screen in portrait).
  const ux = -Math.cos(b) * Math.sin(g);
  const uy = Math.sin(b);
  const uz = Math.cos(b) * Math.cos(g);
  // The screen's up direction in device axes for this orientation.
  const t = normaliseScreenAngle(screenAngle) * RAD;
  const along = ux * Math.sin(t) + uy * Math.cos(t);
  return Math.atan2(uz, along) / RAD;
}

/** Smallest signed difference a − b in degrees, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Which way is "screen up" (0/90/180/270), worked out from gravity while the iPad is held
 * upright. More reliable than the orientation APIs, which disagree between browsers.
 * Null when the device is too flat to tell.
 */
export function upAngleFromGravity(beta: number, gamma: number): number | null {
  const b = beta * RAD;
  const g = gamma * RAD;
  const ux = -Math.cos(b) * Math.sin(g);
  const uy = Math.sin(b);
  if (Math.hypot(ux, uy) < 0.5) return null;
  return normaliseScreenAngle(Math.round(Math.atan2(ux, uy) / RAD / 90) * 90);
}

export type TiltEvent = 'correct' | 'pass';

export interface Reading { beta: number; gamma: number }

export interface TiltState {
  /** Calibrated neutral pitch, null until calibrated. */
  neutral: number | null;
  /** Screen-up direction locked in at calibration. */
  upAngle: number;
  /** True once the head is back near neutral, so the next tilt can count. */
  armed: boolean;
  /** Tilts before this time (ms) are ignored. */
  lockUntil: number;
}

export const createTilt = (): TiltState => ({ neutral: null, upAngle: 90, armed: false, lockUntil: 0 });

/**
 * Take the current position as neutral (at the end of the 3-2-1). `screenAngle` from the
 * orientation API is only used when gravity can't tell which way is up.
 */
export function calibrate(r: Reading, screenAngle: number, now: number): TiltState {
  const upAngle = upAngleFromGravity(r.beta, r.gamma) ?? normaliseScreenAngle(screenAngle);
  return { neutral: tiltAngle(r.beta, r.gamma, upAngle), upAngle, armed: true, lockUntil: now + DEBOUNCE_MS };
}

/** Feed one sensor reading; returns the new state and an event when a tilt counts. */
export function feedTilt(state: TiltState, r: Reading, now: number): { state: TiltState; event: TiltEvent | null } {
  if (state.neutral === null) return { state, event: null };
  const d = angleDiff(tiltAngle(r.beta, r.gamma, state.upAngle), state.neutral);
  if (!state.armed) {
    if (Math.abs(d) <= NEUTRAL_DEG) return { state: { ...state, armed: true }, event: null };
    return { state, event: null };
  }
  if (now < state.lockUntil) return { state, event: null };
  if (d <= -TRIGGER_DEG) return { state: { ...state, armed: false, lockUntil: now + DEBOUNCE_MS }, event: 'correct' };
  if (d >= TRIGGER_DEG) return { state: { ...state, armed: false, lockUntil: now + DEBOUNCE_MS }, event: 'pass' };
  return { state, event: null };
}

/** A button or key press moved to the next card: lock tilts briefly (arming is unchanged). */
export function manualAction(state: TiltState, now: number): TiltState {
  return { ...state, lockUntil: now + DEBOUNCE_MS };
}

// ------------------------------------------------------------------ deck

export interface Deck { order: string[]; index: number }

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffled deck with no repeated cards (duplicates in the source are dropped). */
export function createDeck(cards: readonly string[], rng: Rng): Deck {
  return { order: shuffle([...new Set(cards)], rng), index: 0 };
}

/**
 * Next card. Every card comes up once before any repeats; if the deck runs out it is reshuffled
 * so the last card isn't shown twice in a row.
 */
export function drawCard(deck: Deck, rng: Rng): { card: string; deck: Deck } {
  if (deck.order.length === 0) throw new Error('empty deck');
  if (deck.index < deck.order.length) {
    return { card: deck.order[deck.index], deck: { ...deck, index: deck.index + 1 } };
  }
  const last = deck.order[deck.order.length - 1];
  let order = shuffle(deck.order, rng);
  if (order.length > 1 && order[0] === last) order = [...order.slice(1), order[0]];
  return { card: order[0], deck: { order, index: 1 } };
}

export interface CardResult { card: string; got: boolean }

export const countGot = (results: readonly CardResult[]) => results.filter(r => r.got).length;
