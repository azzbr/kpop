// Flight Compass by the family (azzbr/flight-compass): its unit tests (tests/core.test.cjs),
// run with vitest here. Plus a few Fun Quest checks at the end.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import Core from './core.js';
import CITIES from './data/cities.js';
import HIDDEN from './hidden.js';
import places from './data/places.js';

const near = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected}±${tol}, got ${actual}`);

const LONDON = { lat: 51.5074, lon: -0.1278 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const SYDNEY = { lat: -33.8688, lon: 151.2093 };

test('bearing: London to New York is about 288 degrees', () => {
  near(Core.bearing(LONDON, NEW_YORK), 288.3, 0.5);
});

test('bearing: due north, east, south along simple cases', () => {
  near(Core.bearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }), 0, 1e-9);
  near(Core.bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }), 90, 1e-9);
  near(Core.bearing({ lat: 10, lon: 0 }, { lat: 0, lon: 0 }), 180, 1e-9);
});

test('bearing works across the date line', () => {
  // Tokyo to Honolulu heads east-ish across 180 degrees.
  const b = Core.bearing({ lat: 35.68, lon: 139.69 }, { lat: 21.31, lon: -157.86 });
  assert.ok(b > 60 && b < 110, `got ${b}`);
});

test('distance: London to New York is about 5570 km', () => {
  near(Core.distanceKm(LONDON, NEW_YORK), 5570, 15);
});

test('distance: antipodes are half the circumference', () => {
  near(Core.distanceKm({ lat: 10, lon: 20 }, { lat: -10, lon: -160 }), Math.PI * Core.EARTH_RADIUS_KM, 1e-6);
});

test('destination along the bearing reaches the target', () => {
  const d = Core.centralAngle(LONDON, SYDNEY);
  const end = Core.destination(LONDON, Core.bearing(LONDON, SYDNEY), d);
  near(end.lat, SYDNEY.lat, 1e-6);
  near(end.lon, SYDNEY.lon, 1e-6);
});

test('great-circle path ends at the target, both ways round', () => {
  for (const longWay of [false, true]) {
    const pts = Core.greatCirclePath(LONDON, NEW_YORK, longWay, 50);
    const end = pts[pts.length - 1];
    near(end.lat, NEW_YORK.lat, 1e-6, `longWay=${longWay}`);
    near(end.lon, NEW_YORK.lon, 1e-6, `longWay=${longWay}`);
  }
});

test('rhumb bearing differs from great-circle bearing at high latitude', () => {
  const rhumb = Core.rhumbBearing(LONDON, NEW_YORK);
  near(rhumb, 260, 2);
  assert.ok(Core.angleDiff(rhumb, Core.bearing(LONDON, NEW_YORK)) > 20);
  const pts = Core.rhumbPath(LONDON, NEW_YORK, 20);
  near(pts[20].lat, NEW_YORK.lat, 1e-6);
  near(pts[20].lon, NEW_YORK.lon, 1e-6);
});

test('angleDiff wraps around north', () => {
  assert.equal(Core.angleDiff(350, 10), 20);
  assert.equal(Core.angleDiff(0, 180), 180);
  assert.equal(Core.angleDiff(-90, 270), 0);
});

test('scoring grades and points', () => {
  const s = (e: number) => Core.scoreAim({ heading: 100 + e, trueBearing: 100, streakBefore: 0, hint: null });
  assert.equal(s(0).grade.id, 'bullseye');
  assert.equal(s(0).base, 125);
  assert.equal(s(5).grade.id, 'sharp');
  assert.equal(s(15).grade.id, 'good');
  assert.equal(s(30).grade.id, 'near');
  assert.equal(s(35).base, 0);
  assert.equal(s(36).grade.id, 'miss');
  assert.equal(s(36).hit, false);
});

test('scoring: the long way round counts the same', () => {
  const r = Core.scoreAim({ heading: 281, trueBearing: 100, streakBefore: 0, hint: null });
  assert.equal(r.longWay, true);
  assert.equal(r.error, 1);
  assert.equal(r.grade.id, 'bullseye');
});

test('scoring: a miss is never reported as the long way round', () => {
  // 91 degrees off the short way is 89 off the long way, but both are misses.
  const r = Core.scoreAim({ heading: 91, trueBearing: 0, streakBefore: 0, hint: null });
  assert.equal(r.hit, false);
  assert.equal(r.longWay, false);
});

test('scoring: streak multiplier grows to x2 and resets on a miss', () => {
  assert.equal(Core.scoreAim({ heading: 0, trueBearing: 0, streakBefore: 0 }).multiplier, 1.1);
  assert.equal(Core.scoreAim({ heading: 0, trueBearing: 0, streakBefore: 25 }).multiplier, 2);
  const miss = Core.scoreAim({ heading: 90, trueBearing: 0, streakBefore: 7 });
  assert.equal(miss.streak, 0);
  assert.equal(miss.points, 0);
});

test('scoring: hints reduce points', () => {
  const plain = Core.scoreAim({ heading: 0, trueBearing: 0, streakBefore: 0 }).points;
  const peek = Core.scoreAim({ heading: 0, trueBearing: 0, streakBefore: 0, hint: 'peek' }).points;
  assert.equal(peek, Math.round(plain * 0.4));
});

test('routes are deterministic and follow the hop rules', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const a = Core.buildRoute(CITIES, 'seed-123', difficulty, 20);
    const b = Core.buildRoute(CITIES, 'seed-123', difficulty, 20);
    assert.deepEqual(a, b);
    assert.equal(a.targets.length, 20);
    const maxTier = Core.DIFFICULTY[difficulty].maxTier;
    let prev = a.start;
    const seen = new Set([a.start.n + a.start.c]);
    for (const t of a.targets) {
      assert.ok(t.t <= maxTier, `${difficulty}: tier ${t.t}`);
      assert.notEqual(t.cc, prev.cc, 'consecutive cities in the same country');
      const km = Core.distanceKm(Core.cityPoint(prev), Core.cityPoint(t));
      assert.ok(km >= Core.MIN_HOP_KM && km <= Core.MAX_HOP_KM, `hop ${km} km`);
      assert.ok(!seen.has(t.n + t.c), 'city repeated');
      seen.add(t.n + t.c);
      prev = t;
    }
  }
});

test('different seeds give different routes', () => {
  const a = Core.buildRoute(CITIES, 'day-1', 'normal', 10);
  const b = Core.buildRoute(CITIES, 'day-2', 'normal', 10);
  assert.notDeepEqual(a.targets.map(t => t.n), b.targets.map(t => t.n));
});

test('long practice runs do not run out of cities', () => {
  const r = Core.buildRoute(CITIES, 'endless', 'easy', 120);
  assert.equal(r.targets.length, 120);
});

test('random routes: new start every leg, deterministic, hop rules hold', () => {
  const a = Core.buildRandomRoute(CITIES, 'r-1', 'normal', 15);
  assert.deepEqual(a, Core.buildRandomRoute(CITIES, 'r-1', 'normal', 15));
  assert.equal(a.legs.length, 15);
  for (const [i, leg] of a.legs.entries()) {
    assert.ok(leg.from.t <= 2, 'start cities come from the famous tiers');
    assert.notEqual(leg.from.cc, leg.to.cc);
    const km = Core.distanceKm(Core.cityPoint(leg.from), Core.cityPoint(leg.to));
    assert.ok(km >= Core.MIN_HOP_KM && km <= Core.MAX_HOP_KM);
    if (i > 0) assert.notEqual(leg.from, a.legs[i - 1].to, 'a random leg does not continue from the last target');
  }
  const starts = new Set(a.legs.map(l => l.from.n));
  assert.ok(starts.size > 10, 'starts vary');
  assert.equal(Core.buildRandomRoute(CITIES, 'r-2', 'easy', 150).legs.length, 150);
});

test('daily routes always start in the Middle East, and the start varies by day', () => {
  const starts = new Set();
  for (let day = 1; day <= 60; day++) {
    const seed = `daily-2026-${String(Math.ceil(day / 28)).padStart(2, '0')}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`;
    const r = Core.makeRoute(CITIES, seed, 'normal', 10, 'chain', { startCountries: Core.MIDDLE_EAST });
    assert.ok(Core.MIDDLE_EAST.includes(r.start.cc), `${r.start.n} (${r.start.cc}) is not in the Middle East`);
    assert.ok(r.start.t <= 2, 'starts from a well-known city');
    assert.equal(r.targets.length, 10);
    assert.notEqual(r.targets[0].cc, r.start.cc);
    starts.add(r.start.n);
  }
  assert.ok(starts.size >= 8, `only ${starts.size} different start cities`);
});

test('hidden countries never appear: not as targets, starts or labels', () => {
  const hidden = HIDDEN;
  const codes = new Set(hidden.countries.map(h => h.a3));
  const DATA = { cities: CITIES, places };
  const visible = Core.withoutHidden(DATA, hidden);
  assert.ok(visible.cities.length < CITIES.length, 'something was hidden');
  assert.ok(!visible.cities.some(c => codes.has(c.cc)));
  assert.ok(!visible.places.some(p => codes.has(p.cc)));
  for (let day = 1; day <= 40; day++) {
    const r = Core.makeRoute(visible.cities, `daily-x-${day}`, 'normal', 10, 'chain', { startCountries: Core.MIDDLE_EAST });
    assert.ok(![r.start, ...r.targets].some(c => codes.has(c.cc)));
    const rr = Core.makeRoute(visible.cities, `random-${day}`, 'hard', 10, 'random');
    assert.ok(!rr.legs.some(l => codes.has(l.from.cc) || codes.has(l.to.cc)));
  }
  // Nothing hidden when the list is empty (how content is revealed later).
  assert.equal(Core.withoutHidden(DATA, { countries: [] }).cities.length, CITIES.length);
});

test('chained routes expose legs that join up', () => {
  const r = Core.makeRoute(CITIES, 's', 'normal', 8, 'chain');
  r.legs.forEach((leg, i) => assert.equal(leg.from, i === 0 ? r.start : r.legs[i - 1].to));
});

test('class codes carry the route style', () => {
  const code = Core.makeClassCode('normal', 10, Core.makeRng('y'), 'random');
  assert.match(code, /^N10R-/);
  assert.equal(Core.parseClassCode(code)!.style, 'random');
  assert.equal(Core.parseClassCode('N10-ABCDE')!.style, 'chain');
});

test('class codes round-trip and reject bad input', () => {
  const code = Core.makeClassCode('hard', 15, Core.makeRng('x'));
  const parsed = Core.parseClassCode(code.toLowerCase())!;
  assert.deepEqual({ d: parsed.difficulty, r: parsed.rounds, c: parsed.code }, { d: 'hard', r: 15, c: code });
  assert.equal(Core.parseClassCode('N7-ABCDE'), null);   // 7 rounds is not offered
  assert.equal(Core.parseClassCode('N10-ABCD0'), null);  // 0 is not in the alphabet
  assert.equal(Core.parseClassCode('hello'), null);
});

// ---------------------------------------------------------------- Fun Quest checks
test('Fun Quest: the hidden list is the same as the family\'s game, and leaves those countries out of play', () => {
  assert.deepEqual(HIDDEN.countries.map(h => h.a3), ['ISR']);
  const { cities } = Core.withoutHidden({ cities: CITIES, places }, HIDDEN);
  for (const seed of ['a', 'b', 'c', 'daily-2026-11-18']) {
    const route = Core.makeRoute(cities, seed, 'normal', 10, 'chain', { startCountries: Core.MIDDLE_EAST });
    for (const c of [route.start, ...route.targets]) assert.ok(!HIDDEN.countries.some(h => h.a3 === c.cc), `${seed}: ${c.n}`);
  }
});

test('Fun Quest: a daily route has 10 cities and starts in the Middle East', () => {
  const { cities } = Core.withoutHidden({ cities: CITIES, places }, HIDDEN);
  const route = Core.makeRoute(cities, 'daily-2026-11-18', 'normal', 10, 'chain', { startCountries: Core.MIDDLE_EAST });
  assert.equal(route.targets.length, 10);
  assert.ok(Core.MIDDLE_EAST.includes(route.start.cc));
});

test('Fun Quest: a perfect 10-city run scores in the range the rewards are tuned for', () => {
  // Every aim a Bullseye: 125 base points, the streak multiplier climbing to ×2.
  let streak = 0, total = 0;
  for (let i = 0; i < 10; i++) {
    const r = Core.scoreAim({ heading: 90, trueBearing: 90, streakBefore: streak, hint: null });
    streak = r.streak; total += r.points;
  }
  assert.ok(total > 1500 && total < 2100, `perfect run ${total}`);
});
