// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Flight Compass — game rules and spherical geometry. No DOM access, so it is unit-testable in Node.

  const EARTH_RADIUS_KM = 6371;
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  // ---------------------------------------------------------------- geometry
  const norm360 = a => ((a % 360) + 360) % 360;

  /** Smallest difference between two compass headings, 0..180. */
  function angleDiff(a, b) {
    const d = Math.abs(norm360(a) - norm360(b));
    return Math.min(d, 360 - d);
  }

  /** Initial great-circle bearing from a to b, degrees clockwise from north. */
  function bearing(a, b) {
    const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return norm360(Math.atan2(y, x) * R2D);
  }

  function toVector(p) {
    const la = p.lat * D2R, lo = p.lon * D2R;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  }

  /** Central angle between a and b in radians (vector form: stable near 0 and near pi). */
  function centralAngle(a, b) {
    const u = toVector(a), v = toVector(b);
    const cx = u[1] * v[2] - u[2] * v[1];
    const cy = u[2] * v[0] - u[0] * v[2];
    const cz = u[0] * v[1] - u[1] * v[0];
    return Math.atan2(Math.hypot(cx, cy, cz), u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
  }

  const distanceKm = (a, b) => centralAngle(a, b) * EARTH_RADIUS_KM;

  /** Point reached from a after travelling angle d (radians) on initial bearing brg (degrees). */
  function destination(a, brg, d) {
    const p1 = a.lat * D2R, l1 = a.lon * D2R, t = brg * D2R;
    const sinP2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t);
    const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sinP2);
    return { lat: p2 * R2D, lon: norm360(l2 * R2D + 180) - 180 };
  }

  /** Points along the great circle from a to b; the long way round when longWay is true. */
  function greatCirclePath(a, b, longWay, n) {
    let brg = bearing(a, b), d = centralAngle(a, b);
    if (longWay) { brg = norm360(brg + 180); d = 2 * Math.PI - d; }
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(destination(a, brg, (i * d) / n));
    return pts;
  }

  /** Constant-compass-heading (rhumb line) bearing: what a straight line on a Mercator map shows. */
  function rhumbBearing(a, b) {
    const p1 = a.lat * D2R, p2 = b.lat * D2R;
    let dl = (b.lon - a.lon) * D2R;
    if (Math.abs(dl) > Math.PI) dl = dl > 0 ? -(2 * Math.PI - dl) : 2 * Math.PI + dl;
    const dpsi = Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    return norm360(Math.atan2(dl, dpsi) * R2D);
  }

  /** Points along the rhumb line from a to b, for drawing. */
  function rhumbPath(a, b, n) {
    let dl = b.lon - a.lon;
    if (Math.abs(dl) > 180) dl = dl > 0 ? dl - 360 : dl + 360;
    const psi = lat => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));
    const psi1 = psi(a.lat), psi2 = psi(b.lat);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const lat = Math.abs(psi2 - psi1) < 1e-9
        ? a.lat
        : (2 * Math.atan(Math.exp(psi1 + (psi2 - psi1) * f)) - Math.PI / 2) * R2D;
      pts.push({ lat, lon: norm360(a.lon + dl * f + 180) - 180 });
    }
    return pts;
  }

  const COMPASS_POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const compassWord = brg => COMPASS_POINTS[Math.round(norm360(brg) / 45) % 8];

  // ---------------------------------------------------------------- seeded randomness
  /** 32-bit string hash (cyrb53, truncated) so a text seed gives a numeric seed. */
  function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  /** mulberry32: small, fast, deterministic. Returns a function giving 0 <= x < 1. */
  function makeRng(seedText) {
    let s = hashString(String(seedText));
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- routes
  const DIFFICULTY = {
    easy: { label: 'Easy', maxTier: 2 },
    normal: { label: 'Normal', maxTier: 3 },
    hard: { label: 'Hard', maxTier: 3, startTier: 2 },
  };
  /** Middle East countries (Natural Earth codes). The daily route always starts in one of these. */
  const MIDDLE_EAST = ['BHR', 'CYP', 'EGY', 'IRN', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN', 'OMN', 'PSX', 'QAT', 'SAU', 'SYR', 'TUR', 'ARE', 'YEM'];
  const MIN_HOP_KM = 1000;
  const MAX_HOP_KM = 18500; // near-antipodal targets make the bearing almost meaningless

  const cityPoint = c => ({ lat: c.la, lon: c.lo });

  /**
   * Builds a deterministic route: a start city and `length` targets.
   * The same seed + difficulty + length always gives the same route, which is how
   * daily routes and class codes work without a server.
   */
  function buildRoute(cities, seedText, difficulty, length, options = {}) {
    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const rng = makeRng(`${seedText}|${difficulty}|${length}`);
    const pools = {};
    for (const c of cities) if (c.t <= cfg.maxTier) (pools[c.t] = pools[c.t] || []).push(c);
    const tiers = Object.keys(pools).map(Number).sort();
    if (!tiers.length) throw new Error('No cities for this difficulty');

    const used = new Set();
    const pickFrom = list => list[Math.floor(rng() * list.length)];

    // Start: a world-famous city, or (if asked) a well-known city in one of the given countries.
    let startPool = pools[1] || pools[tiers[0]];
    if (options.startMaxTier) {
      const wider = cities.filter(c => c.t <= options.startMaxTier);
      if (wider.length) startPool = wider;
    }
    if (options.startCountries) {
      const allowed = new Set(options.startCountries);
      const regional = cities.filter(c => allowed.has(c.cc) && c.t <= 2);
      if (regional.length) startPool = regional;
    }
    const start = pickFrom(startPool);
    used.add(start);

    // Early rounds lean on famous places; later rounds drift toward harder tiers.
    const lowest = cfg.startTier || 1;
    const tierWeights = round => {
      const focus = lowest + (cfg.maxTier - lowest) * Math.min(1, round / Math.max(4, length * 0.7));
      return tiers.map(t => (t < lowest ? 0.15 : 1) * Math.exp(-1.4 * Math.abs(t - focus)));
    };

    const targets = [];
    let current = start;
    for (let round = 0; round < length; round++) {
      let chosen = null;
      for (let attempt = 0; attempt < 60 && !chosen; attempt++) {
        const weights = tierWeights(round).map((w, i) => (pools[tiers[i]].some(c => !used.has(c)) ? w : 0));
        const total = weights.reduce((s, w) => s + w, 0);
        if (!total) break;
        let r = rng() * total, tierIndex = 0;
        while (r >= weights[tierIndex]) r -= weights[tierIndex++];
        const candidate = pickFrom(pools[tiers[tierIndex]]);
        if (used.has(candidate) || candidate.cc === current.cc) continue;
        const km = distanceKm(cityPoint(current), cityPoint(candidate));
        if (km < MIN_HOP_KM || km > MAX_HOP_KM) continue;
        chosen = candidate;
      }
      if (!chosen) {
        // Fallback: any unused city that satisfies the distance rule.
        chosen = cities.find(c => c.t <= cfg.maxTier && !used.has(c) && c.cc !== current.cc &&
          distanceKm(cityPoint(current), cityPoint(c)) >= MIN_HOP_KM);
        if (!chosen) break;
      }
      used.add(chosen);
      targets.push(chosen);
      current = chosen;
    }
    const legs = targets.map((to, i) => ({ from: i === 0 ? start : targets[i - 1], to }));
    return { style: 'chain', start, targets, legs };
  }

  /**
   * Random style: every leg starts somewhere new. Start cities come from the famous
   * tiers so players always know where they are standing; targets follow the same
   * difficulty curve as chained routes.
   */
  function buildRandomRoute(cities, seedText, difficulty, length) {
    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const rng = makeRng(`random|${seedText}|${difficulty}|${length}`);
    const pool = cities.filter(c => c.t <= cfg.maxTier);
    const startPool = cities.filter(c => c.t <= Math.min(2, cfg.maxTier));
    const pick = list => list[Math.floor(rng() * list.length)];
    const legs = [];
    const usedTargets = new Set();
    let previousTo = null;
    for (let i = 0; i < length; i++) {
      let leg = null;
      for (let attempt = 0; attempt < 200 && !leg; attempt++) {
        const from = pick(startPool);
        const to = pick(pool);
        if (from === to || from.cc === to.cc || usedTargets.has(to) || from === previousTo) continue;
        const km = distanceKm(cityPoint(from), cityPoint(to));
        if (km < MIN_HOP_KM || km > MAX_HOP_KM) continue;
        leg = { from, to };
      }
      if (!leg) break;
      usedTargets.add(leg.to);
      if (usedTargets.size >= pool.length - 1) usedTargets.clear(); // very long practice runs
      previousTo = leg.to;
      legs.push(leg);
    }
    return { style: 'random', start: legs[0] && legs[0].from, targets: legs.map(l => l.to), legs };
  }

  // ---------------------------------------------------------------- scoring
  const GRADES = [
    { id: 'bullseye', label: 'Bullseye!', max: 2 },
    { id: 'sharp', label: 'Sharp!', max: 8 },
    { id: 'good', label: 'Good', max: 20 },
    { id: 'near', label: 'Near', max: 35 },
  ];
  const MISS = { id: 'miss', label: 'Off course', max: 180 };
  const MAX_SCORING_ERROR = 35;
  const HINT_FACTOR = { direction: 0.7, peek: 0.4 };

  /**
   * Grades one aim. Either way round the planet is correct: the error is measured
   * against whichever of the two great-circle directions is closer.
   */
  function scoreAim({ heading, trueBearing, streakBefore, hint }) {
    const errShort = angleDiff(heading, trueBearing);
    const errLong = angleDiff(heading, trueBearing + 180);
    const error = Math.min(errShort, errLong);
    const grade = GRADES.find(g => error <= g.max) || MISS;
    const hit = grade !== MISS;
    // "The long way" only means something when the aim was on course.
    const longWay = hit && errLong < errShort;
    const streak = hit ? streakBefore + 1 : 0;
    const base = hit ? Math.round(100 * (1 - error / MAX_SCORING_ERROR)) + (grade.id === 'bullseye' ? 25 : 0) : 0;
    const multiplier = hit ? 1 + 0.1 * Math.min(streak, 10) : 1;
    const hintFactor = hint ? HINT_FACTOR[hint] : 1;
    const points = Math.round(base * multiplier * hintFactor);
    return { error, longWay, grade, hit, streak, base, multiplier, hintFactor, points };
  }

  // ---------------------------------------------------------------- class codes
  const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O, 1/I
  const DIFF_LETTER = { easy: 'E', normal: 'N', hard: 'H' };
  const LETTER_DIFF = { E: 'easy', N: 'normal', H: 'hard' };
  const ROUND_OPTIONS = [5, 10, 15, 20];

  /** Code format: difficulty letter, rounds, optional R for random starts, dash, 5 characters. */
  function makeClassCode(difficulty, rounds, rng = Math.random, style = 'chain') {
    let body = '';
    for (let i = 0; i < 5; i++) body += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
    return `${DIFF_LETTER[difficulty]}${rounds}${style === 'random' ? 'R' : ''}-${body}`;
  }

  /** Returns {difficulty, rounds, style, code} or null for an invalid code. */
  function parseClassCode(text) {
    const m = String(text || '').toUpperCase().replace(/\s+/g, '').match(/^([ENH])(\d{1,2})(R?)-?([2-9A-HJ-NP-Z]{5})$/);
    if (!m) return null;
    const rounds = Number(m[2]);
    if (!ROUND_OPTIONS.includes(rounds)) return null;
    return { difficulty: LETTER_DIFF[m[1]], rounds, style: m[3] ? 'random' : 'chain', code: `${m[1]}${rounds}${m[3]}-${m[4]}` };
  }

  /**
   * Removes hidden countries from the data the game uses (see js/hidden.js).
   * Returns new arrays; the originals are untouched.
   */
  function withoutHidden(data, hidden) {
    const list = (hidden && hidden.countries) || [];
    const a3 = new Set(list.map(h => h.a3));
    const ids = new Set(list.map(h => String(h.id)));
    return {
      cities: (data.cities || []).filter(c => !a3.has(c.cc)),
      places: (data.places || []).filter(p => !a3.has(p.cc)),
      hiddenCountryIds: ids,
    };
  }

  /** Builds either route style. options.startCountries limits where a chained route starts. */
  function makeRoute(cities, seedText, difficulty, length, style, options = {}) {
    return style === 'random'
      ? buildRandomRoute(cities, seedText, difficulty, length)
      : buildRoute(cities, seedText, difficulty, length, options);
  }

  const Core = {
    EARTH_RADIUS_KM, norm360, angleDiff, bearing, centralAngle, distanceKm, destination,
    greatCirclePath, rhumbBearing, rhumbPath, compassWord, hashString, makeRng,
    DIFFICULTY, MIDDLE_EAST, MIN_HOP_KM, MAX_HOP_KM, cityPoint, buildRoute, buildRandomRoute, makeRoute,
    GRADES, MISS, MAX_SCORING_ERROR, HINT_FACTOR, scoreAim,
    ROUND_OPTIONS, makeClassCode, parseClassCode, withoutHidden,
  };

  export default Core;
