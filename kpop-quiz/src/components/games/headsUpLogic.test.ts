import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  tiltAngle, angleDiff, upAngleFromGravity, normaliseScreenAngle, calibrate, feedTilt, manualAction, createTilt,
  createDeck, drawCard, countGot, TRIGGER_DEG, DEBOUNCE_MS,
} from './headsUpLogic';
import type { Reading, TiltState } from './headsUpLogic';
import { HEADS_UP_CATEGORIES } from '../../data/headsUpCards';
import { isClean } from '../../utils/cleanText';

const RAD = Math.PI / 180;

/**
 * The beta/gamma a browser reports for a physical pose: iPad turned so that screen-up is
 * `upAngle` (90 / 270 = the two landscapes, 0 = portrait), pitched `pitch` degrees
 * (negative = screen toward the floor). Uses the browser's ranges (beta [-180,180), gamma [-90,90)),
 * so the Euler flip around upright landscape is exercised.
 */
function pose(upAngle: number, pitch: number, roll = 0): Reading {
  const t = upAngle * RAD;
  const p = pitch * RAD;
  const r = roll * RAD;
  // screen up and screen right in device axes
  const sUp = [Math.sin(t), Math.cos(t), 0];
  const sRight = [Math.cos(t), -Math.sin(t), 0];
  const z = [0, 0, 1];
  const u = [0, 1, 2].map(i => Math.cos(r) * (Math.cos(p) * sUp[i] + Math.sin(p) * z[i]) + Math.sin(r) * sRight[i]);
  let beta = Math.asin(Math.max(-1, Math.min(1, u[1]))) / RAD;
  let gamma = Math.atan2(-u[0], u[2]) / RAD;
  if (gamma >= 90 || gamma < -90) {
    beta = beta >= 0 ? 180 - beta : -180 - beta;
    gamma = gamma > 0 ? gamma - 180 : gamma + 180;
  }
  if (beta >= 180) beta -= 360;
  return { beta, gamma };
}

const LANDSCAPES = [90, 270];

describe('tilt angle', () => {
  it('upright is 0 and follows the pitch smoothly in both landscapes and portrait', () => {
    for (const up of [...LANDSCAPES, 0]) {
      for (let pitch = -85; pitch <= 85; pitch += 1) {
        const r = pose(up, pitch);
        expect(tiltAngle(r.beta, r.gamma, up)).toBeCloseTo(pitch, 6);
      }
    }
  });

  it('the pose helper really does hit the Euler flip (gamma changes sign)', () => {
    const a = pose(90, -5);
    const b = pose(90, 5);
    expect(Math.sign(a.gamma)).not.toBe(Math.sign(b.gamma));
  });

  it('reads screen-up from gravity, null when flat', () => {
    for (const up of [0, 90, 180, 270]) {
      const r = pose(up, 15, 10);
      expect(upAngleFromGravity(r.beta, r.gamma)).toBe(up);
    }
    expect(upAngleFromGravity(0, 0)).toBeNull();
  });

  it('normalises angles and differences', () => {
    expect(normaliseScreenAngle(-90)).toBe(270);
    expect(normaliseScreenAngle(360)).toBe(0);
    expect(normaliseScreenAngle(undefined)).toBe(0);
    expect(angleDiff(170, -170)).toBe(-20);
    expect(angleDiff(-170, 170)).toBe(20);
  });
});

describe('tilt state machine', () => {
  const T0 = 10_000;

  for (const up of LANDSCAPES) {
    describe(`landscape ${up}°`, () => {
      // Head leaning back a little at calibration.
      const neutralPitch = 10;
      const start = () => calibrate(pose(up, neutralPitch), up, T0);

      it('calibrates the neutral position', () => {
        const s = start();
        expect(s.neutral).toBeCloseTo(neutralPitch, 6);
        expect(s.upAngle).toBe(up);
        expect(s.armed).toBe(true);
      });

      it('tilt down = correct, tilt up = pass (past the threshold, relative to neutral)', () => {
        const t = T0 + DEBOUNCE_MS + 1;
        expect(feedTilt(start(), pose(up, neutralPitch - TRIGGER_DEG - 5), t).event).toBe('correct');
        expect(feedTilt(start(), pose(up, neutralPitch + TRIGGER_DEG + 5), t).event).toBe('pass');
        // Small nods don't count.
        expect(feedTilt(start(), pose(up, neutralPitch - TRIGGER_DEG + 8), t).event).toBeNull();
        expect(feedTilt(start(), pose(up, neutralPitch + TRIGGER_DEG - 8), t).event).toBeNull();
        // Absolute -30° is only 40° from this neutral, which still counts.
        expect(feedTilt(start(), pose(up, -30), t).event).toBe('correct');
      });

      it('counts with a bit of side-to-side roll too', () => {
        const t = T0 + DEBOUNCE_MS + 1;
        expect(feedTilt(start(), pose(up, -45, 15), t).event).toBe('correct');
        expect(feedTilt(start(), pose(up, 60, -15), t).event).toBe('pass');
      });

      it('ignores tilts during the debounce after a card', () => {
        const s = start();
        expect(feedTilt(s, pose(up, -60), T0 + DEBOUNCE_MS - 1).event).toBeNull();
        expect(feedTilt(s, pose(up, -60), T0 + DEBOUNCE_MS).event).toBe('correct');
        const after = manualAction(s, T0 + 5000);
        expect(feedTilt(after, pose(up, 70), T0 + 5000 + 100).event).toBeNull();
        expect(feedTilt(after, pose(up, 70), T0 + 5000 + DEBOUNCE_MS).event).toBe('pass');
      });

      it('must return to neutral before the next tilt counts', () => {
        let s: TiltState = start();
        let t = T0 + 1000;
        const step = (pitch: number) => { t += 100; const res = feedTilt(s, pose(up, pitch), t); s = res.state; return res.event; };
        expect(step(-50)).toBe('correct');
        // Still tilted down, long after the debounce: nothing.
        t += 2000;
        expect(step(-50)).toBeNull();
        // Straight to tilted up without passing neutral: nothing.
        expect(step(70)).toBeNull();
        t += 2000;
        expect(step(70)).toBeNull();
        // Halfway back isn't neutral yet.
        expect(step(neutralPitch + 25)).toBeNull();
        expect(s.armed).toBe(false);
        // Back to neutral arms it; then a tilt up counts.
        expect(step(neutralPitch + 5)).toBeNull();
        expect(s.armed).toBe(true);
        expect(step(neutralPitch + 50)).toBe('pass');
      });
    });
  }

  it('trusts gravity over a wrong orientation API angle', () => {
    const s = calibrate(pose(90, 0), 270, 0);
    expect(s.upAngle).toBe(90);
    expect(feedTilt(s, pose(90, -50), 1000).event).toBe('correct');
  });

  it('uses the API angle when the device is flat at calibration', () => {
    expect(calibrate({ beta: 0, gamma: 0 }, -90, 0).upAngle).toBe(270);
  });

  it('does nothing before calibration', () => {
    expect(feedTilt(createTilt(), pose(90, -80), 99_999).event).toBeNull();
  });
});

describe('deck', () => {
  it('draws every card once before any repeat, and never the same card twice in a row', () => {
    const cards = ['a', 'b', 'c', 'd', 'e', 'a'];
    for (let seed = 1; seed < 50; seed++) {
      const rng = createRng(seed);
      let deck = createDeck(cards, rng);
      const drawn: string[] = [];
      for (let i = 0; i < 25; i++) {
        const res = drawCard(deck, rng);
        drawn.push(res.card);
        deck = res.deck;
      }
      expect(new Set(drawn.slice(0, 5)).size).toBe(5);
      expect(new Set(drawn.slice(5, 10)).size).toBe(5);
      for (let i = 1; i < drawn.length; i++) expect(drawn[i]).not.toBe(drawn[i - 1]);
    }
  });

  it('counts cards got', () => {
    expect(countGot([{ card: 'a', got: true }, { card: 'b', got: false }, { card: 'c', got: true }])).toBe(2);
  });
});

describe('heads up cards', () => {
  it('has 8 categories of ~40 unique, clean cards', () => {
    expect(HEADS_UP_CATEGORIES).toHaveLength(8);
    for (const c of HEADS_UP_CATEGORIES) {
      expect(c.cards.length).toBeGreaterThanOrEqual(36);
      expect(new Set(c.cards.map(w => w.toLowerCase())).size).toBe(c.cards.length);
      c.cards.forEach(w => expect(isClean(w)).toBe(true));
    }
  });
});
