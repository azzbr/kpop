// Flight Compass — app controller: screens, round flow, saving.
// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Changes for Fun Quest: ES imports instead of globals; everything is looked up inside the
// screen's own root element; the screen tells Fun Quest when a run starts and when it ends
// (onRunStart / onSummary, for rewards); destroy() cleans up when she leaves; the detailed
// coastline is a lazy import; sound volume and vibration follow the Grown-ups settings.
import { geoInterpolate } from 'd3-geo';
import Core from './core.js';
import Globe from './globe.js';
import Dial from './dial.js';
import Feedback from './audio.js';
import HIDDEN from './hidden.js';
import cities from './data/cities.js';
import places from './data/places.js';
// Map shapes are JSON (the bundler reads one big string far faster than a huge JS literal).
import world110 from './data/world110.json';

  const root = window;
  const d3 = { geoInterpolate };
  const RAW = { cities, places, land110: world110.land110, countries110: world110.countries110 };
  // Countries listed in hidden.js are left out of play and off the map labels.
  const DATA = Object.assign({}, RAW, Core.withoutHidden(RAW, HIDDEN));
  const COLORS = Globe.COLORS;

  const LIVES = 3;
  const HINTS = { direction: 2, peek: 1 };
  const DAILY_ROUNDS = 10;
  const PRACTICE_LENGTH = 150; // practice runs until three misses

  // ------------------------------------------------------------- helpers
  // Every lookup stays inside the game's own root element (set by the App constructor).
  let scope = document;
  const $ = sel => scope.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const fmtDeg = d => `${String(Math.round(d) % 360).padStart(3, '0')}°`;
  const fmtKm = km => `${Math.round(km).toLocaleString()} km`;
  const cityName = c => `${c.n}, ${c.c}`;
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  /** Route-building options carried in a run's settings (where it may start). */
  const routeOptions = c => ({ startCountries: c.startCountries, startMaxTier: c.startMaxTier });
  const prefersReducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Local storage can be missing or blocked (private windows, school devices): never rely on it.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ }
    },
  };

  // The game used to be called "Bearings": carry saved settings and scores over once.
  try {
    for (const k of ['settings', 'daily', 'saved', 'best', 'flights']) {
      const old = localStorage.getItem('bearings.' + k);
      if (old !== null && localStorage.getItem('flight-compass.' + k) === null) localStorage.setItem('flight-compass.' + k, old);
      localStorage.removeItem('bearings.' + k);
    }
    for (const key of Object.keys(localStorage)) if (key.startsWith('bearings.')) localStorage.removeItem(key);
  } catch (_) { /* storage blocked */ }

  const GRADE_EMOJI = { bullseye: '🎯', sharp: '🟢', good: '🟡', near: '🟠', miss: '❌', skipped: '⬜' };

  // ------------------------------------------------------------- app
  class App {
    /**
     * @param {HTMLElement} rootEl  element holding the game's markup (markup.js)
     * @param {{onRunStart?: () => void, onSummary?: (info: object) => void, sfxVolume?: number, vibrate?: boolean}} options
     */
    constructor(rootEl, options = {}) {
      scope = rootEl;
      this.rootEl = rootEl;
      this.options = options;
      this.destroyed = false;
      this._listeners = [];
      this._observers = [];
      this.settings = Object.assign(
        { sound: true, vibrate: true, reduceMotion: prefersReducedMotion() },
        store.get('flight-compass.settings', {}),
      );
      this.feedback = new Feedback();
      this.feedback.setVolume(options.sfxVolume ?? 1);
      this.applySettings();

      this.globe = new Globe($('#globe'), DATA);
      this.dial = new Dial($('#stage'), {
        onChange: heading => this.onHeading(heading),
        onStep: kind => this.feedback.play(kind === 'major' ? 'tickMajor' : 'tickMinor'),
        onLock: () => this.lock(),
      });
      this.panel = $('#panel');
      this.aimZoom = 7; // regional view while aiming (~700 km to the dial's rim); + / − change it and it is remembered
      this.run = null;
      this.stopSpin = null;
      this.busy = false;

      this.bindChrome();
      const watch = (el, fn) => { const o = new ResizeObserver(fn); o.observe(el); this._observers.push(o); };
      watch($('#runHeader'), () => this.drawTicketShape());
      watch($('#panel'), () => this.drawTicketShape($('#continueBtn')));
      // Fun Quest: speed — the detailed coastline is only needed for aiming, so it loads once the
      // home screen is idle (or as soon as a route starts), not while the game is opening.
      const load = () => this.loadDetailedLand();
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(load, { timeout: 2500 });
        this._cancelLandLoad = () => window.cancelIdleCallback(id);
      } else {   // Safari
        const id = setTimeout(load, 1500);
        this._cancelLandLoad = () => clearTimeout(id);
      }
      this.showHome();
    }

    // ----------------------------------------------------------- chrome
    bindChrome() {
      $('#homeBtn').addEventListener('click', () => {
        if (this.run && !this.run.over) this.saveRun();
        this.showHome();
      });
      $('#helpBtn').addEventListener('click', () => $('#helpDialog').showModal());
      $('#hintClose').addEventListener('click', () => this.hideHint());
      $('#settingsBtn').addEventListener('click', () => this.openSettings());
      const zoomBy = factor => {
        if (this.globe.mode !== 'globe') return;
        this.globe.setZoom(this.globe.zoom * factor);
        if (this.run && this.run.phase === 'aim' && this.dial.enabled) this.aimZoom = this.globe.zoom;
      };
      $('#zoomIn').addEventListener('click', () => zoomBy(1.4));
      $('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.4));
      $('#stage').addEventListener('wheel', e => {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
      }, { passive: false });
      this._on(document, 'pointerdown', () => this.feedback.unlock(), { once: false, passive: true });
      this._on(document, 'keydown', e => {
        if (!this.run || this.run.phase !== 'aim' || e.target.closest('input, dialog')) return;
        if (e.key === 'h' || e.key === 'H') this.useHint('direction');
        if (e.key === 'p' || e.key === 'P') this.useHint('peek');
      });
      for (const dialog of scope.querySelectorAll('dialog')) {
        dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
      }
    }

    loadDetailedLand() {
      // The 1:50m coastline is larger, so it loads after the game is already usable.
      if (this._landLoad) return this._landLoad;
      this._landLoad = import('./data/land50.json').then(m => {
        const d = m.default;
        if (!this.destroyed && d.land50) this.globe.useDetailedLand(d.land50, d.borders50);
      }).catch(() => { /* offline before it was stored: the 1:110m coastline still works */ });
    }

    /** Adds a listener that destroy() removes again. */
    _on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this._listeners.push(() => target.removeEventListener(type, fn, opts));
    }

    /** Fun Quest: stop everything when the screen closes. */
    destroy() {
      this.destroyed = true;
      this.stopHomeFlight();
      this.globe.destroy();
      this.dial.destroy();
      this.feedback.close();
      clearTimeout(this._toastTimer);
      clearTimeout(this._peekTimer);
      if (this._cancelLandLoad) this._cancelLandLoad();
      for (const off of this._listeners) off();
      for (const o of this._observers) o.disconnect();
      for (const dialog of scope.querySelectorAll('dialog')) if (dialog.open) dialog.close();
    }

    /** Fun Quest test hook (?debug): read the run and aim without a finger. */
    debugApi() {
      return {
        state: () => {
          const r = this.run;
          return r ? { phase: r.phase, index: r.index, score: r.score, lives: r.lives, streak: r.streak, mode: r.mode, over: r.over, targets: r.route.targets.length } : { phase: 'home' };
        },
        aim: deg => { this.dial.set(deg, true); },
        aimTrue: () => {
          const r = this.run;
          if (!r || r.phase !== 'aim') return null;
          const brg = Core.bearing(Core.cityPoint(this.from), Core.cityPoint(this.to));
          this.dial.set(brg, true);
          return brg;
        },
        lock: () => this.lock(),
        next: () => { const b = $('#nextBtn'); if (b) b.click(); },
        setReduceMotion: on => { this.settings.reduceMotion = !!on; this.applySettings(); },
      };
    }

    applySettings() {
      this.feedback.soundOn = this.settings.sound;
      this.feedback.vibrateOn = this.settings.vibrate && this.options.vibrate !== false;
      this.rootEl.classList.toggle('reduce-motion', this.settings.reduceMotion);
    }

    openSettings() {
      const dlg = $('#settingsDialog');
      for (const key of ['sound', 'vibrate', 'reduceMotion']) dlg.querySelector(`[name="${key}"]`).checked = this.settings[key];
      dlg.showModal();
      dlg.querySelector('form').onsubmit = e => {
        if (!e.submitter || e.submitter.value !== 'save') return;
        for (const key of ['sound', 'vibrate', 'reduceMotion']) this.settings[key] = dlg.querySelector(`[name="${key}"]`).checked;
        store.set('flight-compass.settings', this.settings);
        this.applySettings();
      };
    }

    toast(message) {
      const t = $('#toast');
      t.textContent = message;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
    }

    /**
     * The boarding card at the top of the screen during a run: where you are, the leg,
     * the target, and a tear-off stub with points and lives. Hidden outside runs.
     */
    setHud(bump = false) {
      const header = $('#runHeader');
      const r = this.run;
      const inRun = !!r && r.phase !== 'summary';
      $('.app').classList.toggle('in-run', inRun);
      header.hidden = !inRun;
      if (!inRun) return;
      const legIndex = r.phase === 'aim' ? r.index : Math.max(0, r.index - 1);
      const leg = r.route.legs[legIndex];
      const animate = bump && !this.settings.reduceMotion;
      const star = on => `<svg class="life${on ? ' on' : ''}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.2 6.3 6.3 2.2-6.3 2.2L10 18.5l-2.2-6.3L1.5 10l6.3-2.2z"/></svg>`;
      const streakText = r.streak > 1 ? `<span class="tk-streak${animate ? ' bump' : ''}">Streak ${r.streak} · ×${(1 + 0.1 * Math.min(r.streak, 10)).toFixed(1)}</span>` : '';
      header.innerHTML = `
        <button class="back-btn" id="backBtn" aria-label="Leave this run">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="tk" id="ticket" role="group" aria-label="Boarding card">
          <svg class="tk-shape" aria-hidden="true"></svg>
          <div class="tk-main">
            <div class="tk-row">
              <span class="tk-from">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>
                <span>${esc(leg.from.n)}</span>
              </span>
              <span class="tk-leg">Leg ${legIndex + 1}${r.rounds ? ` / ${r.rounds}` : ''}</span>
            </div>
            <div class="tk-target-row">
              <span class="tk-target">${esc(leg.to.n)}</span>
              <span class="tk-ask">bearing?</span>
            </div>
            <div class="tk-row tk-foot"><span class="tk-country">${esc(leg.to.c)}</span>${streakText}</div>
          </div>
          <div class="tk-stub">
            <span class="tk-points${animate ? ' bump' : ''}">${r.score.toLocaleString()}</span>
            <span class="tk-points-label">Points</span>
            <span class="tk-lives" aria-label="${r.lives} of ${LIVES} lives left">${[0, 1, 2].map(i => star(i < r.lives)).join('')}</span>
          </div>
        </div>`;
      $('#backBtn').addEventListener('click', () => {
        // Nothing is lost: the flight is saved and shows up as "Continue your flight".
        const leaving = this.run && !this.run.over;
        if (leaving) this.saveRun();
        this.showHome();
        if (leaving) this.toast('Flight saved. Continue it any time from here.');
      });
      this.drawTicketShape();
    }

    /**
     * Draws the card outline as SVG so the ink border can follow the round notches:
     * a rounded rectangle with a half-circle bitten out of the top and bottom edges
     * where the stub tears off, a dotted tear line, a hard offset shadow, and a map
     * scale bar along the top edge.
     */
    drawTicketShape(card = $('#ticket')) {
      if (!card) return;
      const svg = card.querySelector('.tk-shape');
      const stub = card.querySelector('.tk-stub');
      const w = card.clientWidth, h = card.clientHeight;
      if (!w || !h) return;
      const sx = w - stub.offsetWidth; // tear line
      const n = 11, rad = 16, sh = 4;
      const outline = (dx, dy) => [
        `M${rad + dx} ${dy}`, `H${sx - n + dx}`, `A${n} ${n} 0 0 0 ${sx + n + dx} ${dy}`, `H${w - rad + dx}`,
        `A${rad} ${rad} 0 0 1 ${w + dx} ${rad + dy}`, `V${h - rad + dy}`, `A${rad} ${rad} 0 0 1 ${w - rad + dx} ${h + dy}`,
        `H${sx + n + dx}`, `A${n} ${n} 0 0 0 ${sx - n + dx} ${h + dy}`, `H${rad + dx}`,
        `A${rad} ${rad} 0 0 1 ${dx} ${h - rad + dy}`, `V${rad + dy}`, `A${rad} ${rad} 0 0 1 ${rad + dx} ${dy}`, 'Z',
      ].join(' ');
      // Scale bar: alternating ink and paper blocks along the top edge, inside the outline.
      let bar = '';
      const seg = 18;
      for (let x = rad - 2, i = 0; x < w - rad; x += seg, i++) {
        if (i % 2 === 0 && (x + seg < sx - n - 2 || x > sx + n + 2)) bar += `<rect x="${x}" y="5" width="${Math.min(seg, w - rad - x)}" height="5"/>`;
      }
      svg.setAttribute('viewBox', `-2 -2 ${w + sh + 4} ${h + sh + 4}`);
      svg.setAttribute('width', w + sh + 4);
      svg.setAttribute('height', h + sh + 4);
      svg.innerHTML = `
        <path class="tk-shadow" d="${outline(sh, sh)}"/>
        <path class="tk-paper" d="${outline(0, 0)}"/>
        <rect class="tk-bar-frame" x="${rad - 2}" y="5" width="${Math.max(0, sx - n - 3 - (rad - 2))}" height="5"/>
        <rect class="tk-bar-frame" x="${sx + n + 3}" y="5" width="${Math.max(0, w - rad + 2 - (sx + n + 3))}" height="5"/>
        <g class="tk-bar">${bar}</g>
        <line class="tk-tear" x1="${sx}" y1="${n + 6}" x2="${sx}" y2="${h - n - 6}"/>
        <path class="tk-edge" d="${outline(0, 0)}"/>`;
    }

    // ----------------------------------------------------------- home
    showHome() {
      this.globe.stopAnimation();
      this.hideHint();
      this.run = null;
      this.setHud();
      this.dial.setEnabled(false);
      this.globe.aim = null;
      this.globe.labels = null;
      this.globe.lines = [];
      this.globe.markers = [];
      this.globe.plane = null;
      this.globe.setZoom(1);
      this.startHomeFlight();
      $('#stage').classList.add('home-mode'); // no zoom buttons on the home globe (after the restart above clears it)

      const daily = store.get('flight-compass.daily', null);
      const playedToday = daily && daily.date === todayKey();
      const saved = store.get('flight-compass.saved', null);
      const bests = store.get('flight-compass.best', {});
      const record = Math.max(0, ...Object.values(bests).filter(v => typeof v === 'number'));
      const flights = store.get('flight-compass.flights', 0);
      const dateWord = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
      const icon = {
        calendar: '<path d="M7 2v3M17 2v3M3.5 9h17M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7.5 12.5h2v2h-2zM11 12.5h2v2h-2zM14.5 12.5h2v2h-2zM7.5 16h2v2h-2zM11 16h2v2h-2z" fill="currentColor"/>',
        takeoff: '<path d="M2.5 19.5h19M3 13.6l2.3-.6 2.6 2 4.4-1.2L8 7.4l2-.5 6.7 5.3 4.1-1.1a1.7 1.7 0 0 1 .9 3.3L5.6 18.6 3 13.6z" fill="currentColor"/>',
        people: '<circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.5 19.5c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6z" fill="currentColor"/><circle cx="17" cy="9" r="2.6" fill="currentColor"/><path d="M15.6 13.7c3.1-.4 5.3 1.4 5.9 4.8h-4.2c-.2-1.9-.8-3.5-1.7-4.8z" fill="currentColor"/>',
        chevron: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
        play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
      };
      const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icon[name]}</svg>`;
      const savedLeg = saved && saved.config && Core.makeRoute(DATA.cities, saved.config.seed, saved.config.difficulty,
        saved.config.rounds || PRACTICE_LENGTH, saved.config.style || 'chain', routeOptions(saved.config)).legs[saved.index];
      const star = on => `<svg class="life${on ? ' on' : ''}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.2 6.3 6.3 2.2-6.3 2.2L10 18.5l-2.2-6.3L1.5 10l6.3-2.2z"/></svg>`;

      this.panel.className = 'panel panel-home';
      this.panel.innerHTML = `
        <div class="home">
          <button class="card card-daily${playedToday ? ' done' : ''}" id="dailyBtn">
            <span class="badge badge-teal">${svg('calendar')}</span>
            <span class="card-text">
              <strong>Daily route · ${esc(dateWord)}</strong>
              <em>${playedToday ? `Flown today · ${daily.score.toLocaleString()} points` : 'Ten cities from the Middle East. Same for everyone today.'}</em>
            </span>
            <span class="card-go">${svg(playedToday ? 'check' : 'chevron')}</span>
          </button>
          ${savedLeg ? `
          <button class="tk tk-continue" id="continueBtn" aria-label="Continue your flight from ${esc(savedLeg.from.n)}">
            <svg class="tk-shape" aria-hidden="true"></svg>
            <span class="tk-main">
              <span class="tk-ask">Continue your flight</span>
              <span class="tk-target">${esc(savedLeg.from.n)}</span>
              <span class="tk-leg">Leg ${saved.index + 1}${saved.config.rounds ? ` / ${saved.config.rounds}` : ''} · ${saved.score.toLocaleString()} pts</span>
            </span>
            <span class="tk-stub">
              <span class="tk-play">${svg('play')}</span>
              <span class="tk-lives">${[0, 1, 2].map(i => star(i < saved.lives)).join('')}</span>
            </span>
          </button>` : ''}
          <div class="big-actions">
            <button class="big-btn big-new" id="newFlightBtn">${svg('takeoff')}<span>New flight</span></button>
            <button class="big-btn big-challenge" id="challengeBtn">${svg('people')}<span>Challenge</span></button>
          </div>
          <p class="record-line">${record ? `Record ${record.toLocaleString()}` : 'No record yet'} · ${flights} flight${flights === 1 ? '' : 's'} flown</p>
        </div>`;

      $('#dailyBtn').addEventListener('click', () => {
        if (playedToday && !root.confirm('You already flew today\'s route. Fly it again just for fun? It won\'t replace your score.')) return;
        this.start({
          mode: 'daily', difficulty: 'normal', style: 'chain', rounds: DAILY_ROUNDS, seed: `daily-${todayKey()}`,
          label: `Daily route · ${todayKey()}`, practiceReplay: playedToday, startCountries: Core.MIDDLE_EAST,
        });
      });
      $('#newFlightBtn').addEventListener('click', () => {
        this.start({
          mode: 'practice', difficulty: 'normal', style: 'chain', rounds: null, startMaxTier: 2,
          seed: `flight-${Date.now()}-${Math.random()}`, label: 'New flight',
        });
      });
      $('#challengeBtn').addEventListener('click', () => this.openClassDialog());
      const cont = $('#continueBtn');
      if (cont) {
        cont.addEventListener('click', () => this.resume(saved));
        this.drawTicketShape(cont);
      }
    }

    // ----------------------------------------------------------- home globe: a plane on its rounds
    /** A plane flies between famous cities with a two-colour trail behind it. */
    startHomeFlight() {
      this.stopHomeFlight();
      const token = { stopped: false };
      this.homeFlight = token;
      const famous = DATA.cities.filter(c => c.t === 1);
      const pick = () => famous[Math.floor(Math.random() * famous.length)];
      const globe = this.globe;
      const TRAIL = 70; // longest trail, in path points (of 160)
      const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      const easeOut = x => 1 - Math.pow(1 - x, 3);
      const turn = (a, b, t) => Core.norm360(a + ((((b - a) % 360) + 540) % 360 - 180) * t);
      // Point a fraction f (0..n-1) along the path, between two path points.
      const along = (path, f) => {
        const i = Math.min(path.length - 2, Math.floor(f));
        const a = path[i], b = path[i + 1];
        const p = d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(f - i);
        return { lon: p[0], lat: p[1] };
      };
      // Heading at the start of a path, and the heading a plane arrives on at its end.
      const departHeading = path => Core.bearing(path[0], path[1]);
      const arriveHeading = path => Core.norm360(Core.bearing(path[path.length - 1], path[path.length - 2]) + 180);
      const setTrail = (path, tailF, headF, plane) => {
        const tail = Math.max(0, tailF), i = Math.floor(headF);
        const trail = headF - tail < 0.5 ? [] : [along(path, tail), ...path.slice(Math.ceil(tail), i + 1), plane.point];
        globe.lines = trail.length > 1 ? [
          { points: trail, color: COLORS.trailA, width: 3.4 },
          { points: trail, color: COLORS.trailB, width: 3.4, dash: [7, 7] },
        ] : [];
        globe.plane = { ...plane, badge: true };
      };
      // Runs draw(t) every frame for `ms` milliseconds; resolves false if stopped part-way.
      const animate = (ms, draw) => new Promise(resolve => {
        const t0 = performance.now();
        const step = now => {
          if (token.stopped) return resolve(false);
          const raw = Math.max(0, Math.min(1, (now - t0) / ms));
          draw(raw);
          globe.draw();
          if (raw >= 1) resolve(true);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const wait = ms => new Promise(r => setTimeout(r, ms));
      let from = pick();
      const nextLeg = () => {
        let to = pick();
        for (let i = 0; i < 40; i++) {
          const km = Core.distanceKm(Core.cityPoint(from), Core.cityPoint(to));
          if (to !== from && km > 3000 && km < 9000) break;
          to = pick();
        }
        return to;
      };
      const run = async () => {
        let first = true;
        let heading = null; // the way the plane is facing after its last landing
        while (!token.stopped) {
          const to = nextLeg();
          const path = Core.greatCirclePath(Core.cityPoint(from), Core.cityPoint(to), false, 160);
          const last = path.length - 1;
          const mid = path[80];
          const depart = departHeading(path);
          if (this.settings.reduceMotion) {
            globe.setCenter(mid);
            setTrail(path, 110 - TRAIL, 110, { point: path[110], heading: Core.bearing(path[110], path[111]) });
            globe.invalidate();
            return; // one still picture
          }

          // 1. Turn the globe to the new route while the plane, parked at its city with no
          //    trail, swings round to face the next destination.
          if (first) {
            globe.setCenter(mid);
            first = false;
          } else {
            const start = globe.center;
            const pan = d3.geoInterpolate([start.lon, start.lat], [mid.lon, mid.lat]);
            const bump = Math.min(0.6, Core.centralAngle(start, mid) * 0.4);
            const h0 = heading == null ? depart : heading;
            const ok = await animate(1600, raw => {
              const t = ease(raw);
              const p = pan(t);
              globe.center = { lon: p[0], lat: p[1] };
              globe.zoom = 1 - bump * Math.sin(Math.PI * t);
              setTrail(path, 0, 0, { point: path[0], heading: turn(h0, depart, ease(Math.min(1, raw * 1.2))) });
            });
            if (!ok) return;
            globe.zoom = 1;
          }

          // 2. Fly. The trail grows out behind the plane, up to its full length.
          let ok = await animate(5200, raw => {
            const f = ease(raw) * last;
            const point = raw >= 1 ? path[last] : along(path, f);
            const h = raw >= 1 ? arriveHeading(path) : Core.bearing(point, path[Math.min(last, Math.floor(f) + 1)]);
            setTrail(path, f - TRAIL, f, { point, heading: h });
            // Drift the view slowly with the plane so it feels like flying, not sliding.
            globe.center = Core.destination(mid, Core.bearing(mid, point), Core.centralAngle(mid, point) * 0.25);
          });
          if (!ok) return;

          // 3. Landed: the trail draws in behind the plane until it is gone.
          heading = arriveHeading(path);
          const tailFrom = last - TRAIL;
          ok = await animate(1100, raw => {
            setTrail(path, tailFrom + (last - tailFrom) * easeOut(raw), last, { point: path[last], heading });
          });
          if (!ok) return;
          await wait(350);
          from = to;
        }
      };
      run();
    }

    stopHomeFlight() {
      if (this.homeFlight) this.homeFlight.stopped = true;
      this.homeFlight = null;
      this.globe.stopAnimation();
      $('#stage').classList.remove('home-mode');
    }

    openClassDialog() {
      const dlg = $('#classDialog');
      const codeInput = dlg.querySelector('#classCode');
      const err = dlg.querySelector('#classError');
      const out = dlg.querySelector('#newCode');
      err.textContent = '';
      out.hidden = true;
      codeInput.value = '';
      dlg.showModal();
      dlg.querySelector('#joinBtn').onclick = e => {
        e.preventDefault();
        const parsed = Core.parseClassCode(codeInput.value);
        if (!parsed) { err.textContent = 'That code doesn\'t look right. It should look like N10-K7Q2M.'; return; }
        dlg.close();
        this.start({ mode: 'class', difficulty: parsed.difficulty, style: parsed.style, rounds: parsed.rounds, seed: `class-${parsed.code}`, label: `Challenge · ${parsed.code}`, code: parsed.code });
      };
      dlg.querySelector('#makeBtn').onclick = e => {
        e.preventDefault();
        const code = Core.makeClassCode('normal', Number(dlg.querySelector('#newRounds').value), Math.random, 'chain');
        out.hidden = false;
        out.querySelector('code').textContent = code;
        codeInput.value = code;
      };
      dlg.querySelector('#copyCode').onclick = e => {
        e.preventDefault();
        copyText(out.querySelector('code').textContent).then(ok => { if (ok) this.toast('Code copied'); });
      };
    }

    // ----------------------------------------------------------- run flow
    /** Fun Quest's over card "Fly again": a new flight from a new city (same as the home button). */
    newFlight() {
      this.start({
        mode: 'practice', difficulty: 'normal', style: 'chain', rounds: null, startMaxTier: 2,
        seed: `flight-${Date.now()}-${Math.random()}`, label: 'New flight',
      });
    }

    start(config) {
      this.loadDetailedLand();
      if (this.options.onRunStart) this.options.onRunStart();
      this.stopHomeFlight();
      this.feedback.unlock();
      const route = Core.makeRoute(DATA.cities, config.seed, config.difficulty, config.rounds || PRACTICE_LENGTH,
        config.style || 'chain', routeOptions(config));
      this.run = Object.assign({}, config, {
        route, index: 0, score: 0, lives: LIVES, streak: 0, bestStreak: 0,
        hints: Object.assign({}, HINTS), results: [], hops: [], phase: 'aim', over: false,
      });
      this.saveRun();
      this.beginRound(); // turns the globe from wherever it is to the first city
    }

    // ----------------------------------------------------------- save / continue
    /** Keeps the unfinished flight in this browser so it can be continued from the home screen. */
    saveRun() {
      const r = this.run;
      if (!r || r.over) return;
      const config = {};
      for (const k of ['mode', 'difficulty', 'style', 'rounds', 'seed', 'label', 'code', 'practiceReplay', 'startCountries', 'startMaxTier']) {
        if (r[k] !== undefined) config[k] = r[k];
      }
      store.set('flight-compass.saved', {
        config, index: r.index, score: r.score, lives: r.lives, streak: r.streak, bestStreak: r.bestStreak,
        hints: r.hints, results: r.results, longWay: r.hops.map(h => !!h.longWay), lastHeading: r.lastHeading,
      });
    }

    resume(saved) {
      this.loadDetailedLand();
      if (this.options.onRunStart) this.options.onRunStart();
      this.stopHomeFlight();
      this.feedback.unlock();
      const c = saved.config;
      const route = Core.makeRoute(DATA.cities, c.seed, c.difficulty, c.rounds || PRACTICE_LENGTH, c.style || 'chain', routeOptions(c));
      if (!route.legs[saved.index]) { store.set('flight-compass.saved', null); this.showHome(); return; }
      // Rebuild the flown hops for the end-of-run journey map.
      const hops = saved.results.map((res, i) => {
        const leg = route.legs[i];
        const from = Core.cityPoint(leg.from), to = Core.cityPoint(leg.to);
        const longWay = !!(saved.longWay && saved.longWay[i]);
        return { from, to, fromCity: leg.from, toCity: leg.to, path: Core.greatCirclePath(from, to, longWay, 120), hit: res.grade !== 'miss', longWay };
      });
      this.run = Object.assign({}, c, {
        route, index: saved.index, score: saved.score, lives: saved.lives, streak: saved.streak, bestStreak: saved.bestStreak,
        hints: saved.hints, results: saved.results, hops, phase: 'aim', over: false, lastHeading: saved.lastHeading,
      });
      this.beginRound();
    }

    get from() {
      return this.run.route.legs[this.run.index].from;
    }

    get to() {
      return this.run.route.legs[this.run.index].to;
    }

    beginRound() {
      const r = this.run;
      r.phase = 'aim';
      r.hintUsed = null;
      r.hintNotes = [];
      this.hideHint();
      const from = this.from, to = this.to;
      const fromPoint = Core.cityPoint(from);
      this.globe.showGlobe();
      this.globe.lines = [];
      this.globe.plane = null;
      this.globe.aim = null;
      this.globe.labels = null;
      // Your city is named by the label under the compass hub, so its marker has no label.
      this.globe.markers = [{ point: fromPoint, color: COLORS.origin }];
      this.dial.setEnabled(false);
      this.dial.setCity(from.n);
      const heading = r.lastHeading == null ? 0 : r.lastHeading;
      this.dial.set(heading);
      this.setHud();
      const startAiming = () => {
        if (!this.run || this.run !== r || r.phase !== 'aim') return;
        this.globe.setCenter(fromPoint);
        this.globe.setZoom(this.aimZoom);
        this.globe.aim = { heading: this.dial.heading };
        // Name the area around you, but never the target or anything in its country.
        this.globe.labels = {
          maxKm: 950,
          hideCountry: this.globe.countryAt(Core.cityPoint(to)),
          hideCc: to.cc,
          skipNames: new Set([from.n, to.n]),
          ring: { inner: this.dial.radius - 3, outer: this.dial.radius + 30 },
        };
        this.globe.invalidate();
        this.dial.setEnabled(true);
        this.dial.focus();
      };
      // Turn and zoom the globe to your city, so every move is easy to follow.
      const travel = Core.centralAngle(this.globe.center, fromPoint);
      if (this.settings.reduceMotion) {
        startAiming();
      } else {
        this.globe.panTo(fromPoint, 650 + 650 * Math.min(1, travel / Math.PI), this.aimZoom).then(startAiming);
      }

      this.panel.className = 'panel panel-aim';
      this.panel.innerHTML = `
        <p class="eyebrow">${esc(r.label)}<span class="eyebrow-route"> · from ${esc(cityName(from))} to ${esc(cityName(to))}</span></p>
        <div class="readout" aria-hidden="true"><span id="headingValue">${fmtDeg(heading)}</span><span id="headingWord">${Core.compassWord(heading)}</span></div>
        <div class="actions">
          <button class="btn btn-small" id="hintDir" ${r.hints.direction ? '' : 'disabled'}>Which way? <span class="count">${r.hints.direction}</span></button>
          <button class="btn btn-small" id="hintPeek" ${r.hints.peek ? '' : 'disabled'}>Peek <span class="count">${r.hints.peek}</span></button>
          <button class="btn btn-primary btn-lock" id="lockBtn">Lock heading</button>
        </div>
        <p class="keys">Drag around the dial, or focus it and use the arrow keys (Shift = 10°). Enter locks.</p>`;
      $('#lockBtn').addEventListener('click', () => this.lock());
      $('#hintDir').addEventListener('click', () => this.useHint('direction'));
      $('#hintPeek').addEventListener('click', () => this.useHint('peek'));
    }

    onHeading(heading) {
      if (!this.run || this.run.phase !== 'aim') return;
      this.run.lastHeading = heading;
      this.globe.aim = { heading };
      this.globe.invalidate();
      const v = $('#headingValue'), w = $('#headingWord');
      if (v) v.textContent = fmtDeg(heading);
      if (w) w.textContent = Core.compassWord(heading);
    }

    useHint(kind) {
      const r = this.run;
      if (!r || r.phase !== 'aim' || r.hints[kind] <= 0 || this.peeking || !this.dial.enabled) return;
      r.hints[kind]--;
      // The cheaper hint never overrides a costlier one already used this round.
      if (!r.hintUsed || Core.HINT_FACTOR[kind] < Core.HINT_FACTOR[r.hintUsed]) r.hintUsed = kind;
      this.feedback.play('tap');
      const from = Core.cityPoint(this.from), to = Core.cityPoint(this.to);
      const brg = Core.bearing(from, to);
      if (kind === 'direction') {
        const ns = Core.angleDiff(brg, 0) < 90 ? 'north' : 'south';
        const ew = brg < 180 ? 'east' : 'west';
        this.showHint(`${this.to.n} lies to the ${ns}-${ew} of you, the short way.`);
      } else {
        // Turn the globe so both cities are in view, then turn back. Aiming pauses meanwhile,
        // because the dial only lines up with the globe when your city is in the centre.
        const path = Core.greatCirclePath(from, to, false, 2);
        this.peeking = true;
        this.dial.setEnabled(false);
        this.globe.aim = null;
        this.globe.markers = [...this.globe.markers, { point: to, color: COLORS.target, ring: true, label: this.to.n }];
        this.globe.setCenter(path[1]);
        this.globe.setZoom(1);
        this.showHint(`Peek: ${this.to.n} is marked on the globe for 3 seconds.`);
        this._peekTimer = setTimeout(() => {
          this.peeking = false;
          if (!this.run || this.run.phase !== 'aim') return;
          this.globe.markers = this.globe.markers.filter(m => !m.ring);
          this.globe.aim = { heading: this.dial.heading };
          this.globe.setCenter(from);
          this.globe.setZoom(this.aimZoom);
          this.dial.setEnabled(true);
          this.dial.focus();
        }, 3000);
      }
      $('#hintDir').disabled = r.hints.direction <= 0;
      $('#hintPeek').disabled = r.hints.peek <= 0;
      $('#hintDir .count').textContent = r.hints.direction;
      $('#hintPeek .count').textContent = r.hints.peek;
    }

    /**
     * Shows a hint on a card over the map (so the layout never shifts), with a short
     * flash so it is clearly noticed. It stays until the heading is locked.
     */
    showHint(line) {
      const r = this.run;
      r.hintNotes = [...(r.hintNotes || []), line];
      const chip = $('#hintChip');
      chip.querySelector('.hint-body').innerHTML = r.hintNotes.map(n => `<span>${esc(n)}</span>`).join('');
      chip.querySelector('.hint-cost').textContent = `This city now scores ${Math.round(Core.HINT_FACTOR[r.hintUsed] * 100)}%`;
      chip.hidden = false;
      chip.classList.remove('flash');
      void chip.offsetWidth; // restart the flash animation
      chip.classList.add('flash');
    }

    hideHint() {
      const chip = $('#hintChip');
      chip.hidden = true;
      chip.classList.remove('flash');
    }

    async lock() {
      const r = this.run;
      if (!r || r.phase !== 'aim' || this.busy || this.peeking || !this.dial.enabled) return;
      this.busy = true;
      r.phase = 'flying';
      this.dial.setEnabled(false);
      this.feedback.play('lock');

      const fromCity = this.from, toCity = this.to;
      const from = Core.cityPoint(fromCity), to = Core.cityPoint(toCity);
      const heading = this.dial.heading;
      this.globe.labels = null;
      this.hideHint();
      const trueBearing = Core.bearing(from, to);
      const result = Core.scoreAim({ heading, trueBearing, streakBefore: r.streak, hint: r.hintUsed });
      const angle = Core.centralAngle(from, to);
      const flownAngle = result.longWay ? 2 * Math.PI - angle : angle;
      const truePath = Core.greatCirclePath(from, to, result.longWay, 120);

      // Freeze the player's aim as a fixed line on the globe, as long as the real trip.
      const aimLine = [];
      for (let i = 0; i <= 120; i++) aimLine.push(Core.destination(from, heading, (i / 120) * Math.min(flownAngle, 2 * Math.PI * 0.995)));
      this.globe.aim = null;
      this.globe.lines = [{ points: aimLine, color: COLORS.aim, width: 2.5, alpha: 0.9 }];

      this.panel.className = 'panel panel-flying';
      this.panel.innerHTML = `<div class="flying-row"><p class="mission">Flying to <strong>${esc(cityName(toCity))}</strong>…</p>
        <button class="btn btn-small" id="skipBtn">Skip</button></div>`;
      $('#skipBtn').addEventListener('click', () => { this.globe.stopAnimation(); this._flightResolve && this._flightResolve(); });

      if (!this.settings.reduceMotion) {
        this.feedback.play('takeoff');
        const duration = 1600 + 1600 * Math.min(1, flownAngle / Math.PI);
        const trail = { points: [truePath[0]], color: COLORS.truth, width: 3.5 };
        this.globe.lines.push(trail);
        await new Promise(resolve => {
          this._flightResolve = resolve;
          this.globe.flyAlong(truePath, {
            duration,
            onProgress: t => { trail.points = truePath.slice(0, Math.max(2, Math.ceil(t * truePath.length))); },
          }).then(resolve);
        });
        this._flightResolve = null;
      }

      // Update the run
      r.score += result.points;
      r.streak = result.streak;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
      if (!result.hit) r.lives--;
      r.results.push({ grade: result.grade.id, points: result.points });
      r.hops.push({ from, to, fromCity, toCity, path: truePath, hit: result.hit, longWay: result.longWay });
      r.index++;
      const finished = r.lives <= 0 || r.index >= r.route.targets.length;
      r.over = finished;
      if (finished) store.set('flight-compass.saved', null);
      else this.saveRun();

      // Show the whole story: your aim, the great circle, and the "flat map" rhumb line.
      this.globe.plane = null;
      this.globe.lines = [
        { points: Core.rhumbPath(from, to, 120), color: COLORS.rhumb, width: 2, dash: [6, 7], alpha: 0.95 },
        { points: aimLine, color: COLORS.aim, width: 2.5, alpha: 0.9 },
        { points: truePath, color: COLORS.truth, width: 3.5 },
      ];
      this.globe.markers = [
        { point: from, color: COLORS.origin, label: fromCity.n },
        { point: to, color: COLORS.target, ring: true, label: toCity.n },
      ];
      this.resultView = { truePath, aimLine, flownAngle };
      // A globe centred mid-route shows both ends of any route up to half way round the
      // planet; longer (long-way) flights open on the flat map instead.
      this.showResultView(flownAngle > 3.0 ? 'map' : 'globe');

      // Feedback sequence: touchdown, then the stamp lands with the grade, then a rising
      // streak note (one step higher per hit), then a fanfare on streak milestones.
      this.feedback.play('land');
      setTimeout(() => { this.feedback.play('stamp'); this.feedback.play(result.grade.id); }, 260);
      if (result.hit) setTimeout(() => this.feedback.streakNote(result.streak), 640);
      const milestone = result.hit && (result.streak === 3 || result.streak === 5 || (result.streak >= 10 && result.streak % 5 === 0));
      if (milestone) setTimeout(() => { this.feedback.play('streak'); this.celebrate(result); }, 900);
      this.setHud(result.points > 0); // pulse the points (and streak) on the boarding card
      this.showResult({ fromCity, toCity, from, to, heading, trueBearing, result, angle, finished });
      this.busy = false;
    }

    /** Streak milestone: a ribbon over the map and a burst of paper flecks. */
    celebrate(result) {
      const stage = $('#stage');
      const banner = document.createElement('div');
      banner.className = 'streak-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = `<span class="streak-count">${result.streak}</span>
        <span class="streak-text">in a row<strong>×${result.multiplier.toFixed(1)} points</strong></span>`;
      stage.append(banner);
      if (!this.settings.reduceMotion) {
        const burst = document.createElement('div');
        burst.className = 'flecks';
        burst.setAttribute('aria-hidden', 'true');
        const colors = ['#c98a12', '#2f7d4f', '#a8452c', '#4a3b2a', '#f6eedb'];
        for (let i = 0; i < 26; i++) {
          const f = document.createElement('i');
          const angle = (i / 26) * 2 * Math.PI + Math.random() * 0.3;
          const dist = 90 + Math.random() * 120;
          f.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          f.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
          f.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
          f.style.background = colors[i % colors.length];
          f.style.animationDelay = `${Math.random() * 80}ms`;
          burst.append(f);
        }
        stage.insertBefore(burst, banner); // flecks fly behind the ribbon
        setTimeout(() => burst.remove(), 1600);
      }
      setTimeout(() => banner.classList.add('leaving'), 2000);
      setTimeout(() => banner.remove(), 2400);
    }

    showResult({ fromCity, toCity, from, to, heading, trueBearing, result, angle, finished }) {
      const r = this.run;
      r.phase = 'result';
      const shortKm = angle * Core.EARTH_RADIUS_KM;
      const longKm = (2 * Math.PI - angle) * Core.EARTH_RADIUS_KM;
      // Show the direction and distance the plane actually flew.
      const km = result.longWay ? longKm : shortKm;
      const otherKm = result.longWay ? shortKm : longKm;
      const shownBearing = result.longWay ? Core.norm360(trueBearing + 180) : trueBearing;
      const rhumb = Core.rhumbBearing(from, to);
      const rhumbGap = Core.angleDiff(rhumb, trueBearing);
      const g = result.grade;
      const breakdown = result.hit
        ? `${result.base} × ${result.multiplier.toFixed(1)} streak${result.hintFactor < 1 ? ` × ${Math.round(result.hintFactor * 100)}% hint` : ''} = <strong>${result.points}</strong>`
        : `No points, and you lose a life. ${r.lives > 0 ? `${r.lives} left.` : ''}`;
      const flatMap = rhumbGap >= 3
        ? `On a flat map, a straight line from ${esc(fromCity.n)} points ${fmtDeg(rhumb)}, which is ${Math.round(rhumbGap)}° away from the true great-circle heading. That's why flights curve on flat maps.`
        : `Here the flat-map heading (${fmtDeg(rhumb)}) and the great-circle heading almost agree.`;

      // A slightly different tilt each round, like a hand-pressed rubber stamp.
      const tilt = ((r.index * 37) % 13) - 7;
      const stampSub = result.hit ? `+${result.points} points` : 'No points · lose a life';
      this.panel.className = `panel panel-result grade-${g.id}`;
      this.panel.innerHTML = `
        <div class="result-head">
          <div class="stamp stamp-${g.id}${this.settings.reduceMotion ? '' : ' slam'}" style="--tilt:${tilt}deg">
            <span class="stamp-title">${esc(g.label.replace('!', ''))}</span>
            <span class="stamp-sub">${stampSub} · ${result.error.toFixed(1)}° off</span>
          </div>
          <p class="breakdown">${breakdown}</p>
        </div>
        ${result.longWay ? '<p class="note">You aimed the long way round the planet. That counts too!</p>' : ''}
        <dl class="facts">
          <div><dt>You aimed</dt><dd class="c-aim">${fmtDeg(heading)}</dd></div>
          <div><dt>Great circle${result.longWay ? ' (long way)' : ''}</dt><dd class="c-truth">${fmtDeg(shownBearing)}</dd></div>
          <div><dt>Off by</dt><dd>${result.error.toFixed(1)}°</dd></div>
          <div><dt>Distance flown</dt><dd>${fmtKm(km)}</dd></div>
        </dl>
        <p class="learn">${flatMap} The ${result.longWay ? 'short' : 'long'} way to ${esc(toCity.n)} would be ${fmtKm(otherKm)}.</p>
        <p class="legend"><span class="key k-truth"></span>great circle <span class="key k-aim"></span>your aim <span class="key k-rhumb"></span>flat-map line</p>
        <div class="actions">
          <button class="btn btn-primary" id="nextBtn">${finished ? 'See results' : 'Next city'}</button>
          <button class="btn btn-small" id="viewBtn"></button>
        </div>`;
      const viewBtn = $('#viewBtn');
      const label = () => { viewBtn.textContent = this.globe.mode === 'map' ? 'Show on globe' : 'Show on flat map'; };
      label();
      viewBtn.addEventListener('click', () => { this.showResultView(this.globe.mode === 'map' ? 'globe' : 'map'); label(); });
      const next = $('#nextBtn');
      next.addEventListener('click', () => (finished ? this.showSummary() : this.nextRound()));
      next.focus();
    }

    /** Frames the finished hop: on the globe (centred mid-route) or on the flat map. */
    showResultView(mode) {
      const { truePath, aimLine, flownAngle } = this.resultView;
      const mid = truePath[Math.floor(truePath.length / 2)];
      if (mode === 'map') {
        this.globe.showMap([truePath, aimLine], mid);
      } else {
        this.globe.showGlobe();
        this.globe.setCenter(mid);
        this.globe.setZoom(flownAngle < Math.PI / 2 ? Math.min(2.2, 0.6 / Math.sin(Math.max(flownAngle / 2, 0.2))) : 0.95);
      }
    }

    nextRound() {
      this.beginRound();
    }

    /** Draws every hop of the run on the flat map: green on course, rust for misses. */
    showJourney() {
      const r = this.run;
      if (!r.hops.length) return;
      this.globe.aim = null;
      this.globe.plane = null;
      this.globe.lines = r.hops.map(h => ({ points: h.path, color: h.hit ? COLORS.truth : COLORS.miss, width: 3, dash: h.hit ? null : [7, 6] }));
      const first = r.hops[0], last = r.hops[r.hops.length - 1];
      // Chained runs join up; random-start runs are separate hops, so mark every start too.
      const stops = r.style === 'random'
        ? r.hops.flatMap(h => [h.from, h.to])
        : r.hops.slice(0, -1).map(h => h.to);
      this.globe.markers = [
        ...stops.map(point => ({ point, color: COLORS.origin, small: true })),
        { point: first.from, color: COLORS.origin, label: first.fromCity.n },
        { point: last.to, color: COLORS.target, ring: true, label: last.toCity.n },
      ];
      const all = r.hops.flatMap(h => h.path);
      // Centre the map on the mean longitude of the journey (as a vector average, so it wraps correctly).
      let sx = 0, sy = 0;
      for (const p of all) { sx += Math.cos(p.lon * Math.PI / 180); sy += Math.sin(p.lon * Math.PI / 180); }
      const lon = Math.atan2(sy, sx) * 180 / Math.PI;
      this.globe.showMap(r.hops.map(h => h.path), { lat: 0, lon });
    }

    showSummary() {
      const r = this.run;
      r.phase = 'summary';
      r.over = true;
      this.setHud(); // hides the boarding card
      this.dial.setEnabled(false);
      store.set('flight-compass.saved', null);
      store.set('flight-compass.flights', store.get('flight-compass.flights', 0) + 1);
      const bestKey = r.mode === 'practice' ? 'practice' : r.mode === 'daily' ? 'daily' : `class-${r.code}`;
      const bests = store.get('flight-compass.best', {});
      const previousBest = bests[bestKey] || 0;
      const isRecord = r.score > previousBest && r.score > 0;
      if (isRecord) { bests[bestKey] = r.score; store.set('flight-compass.best', bests); }
      if (r.mode === 'daily' && !r.practiceReplay) {
        store.set('flight-compass.daily', { date: todayKey(), score: r.score, results: r.results.map(x => x.grade) });
      }
      if (isRecord) this.feedback.play('record'); // Fun Quest's frame plays its own happy finish sound
      this.showJourney();

      const flown = r.results.length;
      const hits = r.results.filter(x => x.grade !== 'miss').length;
      const grid = r.results.map(x => GRADE_EMOJI[x.grade]).join('');
      const shareText = [
        `Flight Compass — ${r.label}`,
        `${r.score.toLocaleString()} points · ${hits}/${flown} on course · best streak ${r.bestStreak}`,
        grid,
        r.code ? `Fly the same route with code ${r.code}` : '',
      ].filter(Boolean).join('\n');

      this.panel.className = 'panel panel-summary';
      this.panel.innerHTML = `
        <p class="eyebrow">${esc(r.label)}</p>
        <p class="big-score">${r.score.toLocaleString()}<small>points</small></p>
        ${isRecord ? '<p class="record">New personal best!</p>' : previousBest ? `<p class="note">Your best: ${previousBest.toLocaleString()}</p>` : ''}
        <p class="grid" aria-label="Results by city">${grid}</p>
        <dl class="facts">
          <div><dt>Cities flown</dt><dd>${flown}</dd></div>
          <div><dt>On course</dt><dd>${hits}</dd></div>
          <div><dt>Best streak</dt><dd>${r.bestStreak}</dd></div>
        </dl>
        <div class="actions">
          <button class="btn" id="shareBtn">Copy result</button>
          ${r.mode === 'practice' ? '<button class="btn btn-primary" id="againBtn">Play again</button>' : ''}
          <button class="btn ${r.mode === 'practice' ? '' : 'btn-primary'}" id="homeBtn2">Home</button>
        </div>`;
      if (this.options.onSummary) this.options.onSummary({ score: r.score, flown, hits, bestStreak: r.bestStreak, grid, shareText, mode: r.mode, isRecord });
      $('#shareBtn').addEventListener('click', () => copyText(shareText).then(ok => this.toast(ok ? 'Result copied' : 'Copy failed: select and copy by hand')));
      $('#homeBtn2').addEventListener('click', () => this.showHome());
      const again = $('#againBtn');
      if (again) again.addEventListener('click', () => this.start(Object.assign({}, r, { seed: `practice-${Date.now()}-${Math.random()}` })));
    }
  }

  function copyText(text) {
    if (navigator.clipboard && root.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false);
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    area.remove();
    return Promise.resolve(ok);
  }

  export default App;
