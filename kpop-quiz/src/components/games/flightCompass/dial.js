// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Flight Compass — compass dial overlay. Point at a direction with finger/mouse, or use the keyboard.
import Core from './core.js';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DEAD_ZONE_PX = 14;

  const el = (name, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  class Dial {
    /**
     * @param {HTMLElement} host  element covering the globe stage
     * @param {{onChange(heading), onStep(kind), onLock()}} handlers
     */
    constructor(host, handlers) {
      this.host = host;
      this.handlers = handlers;
      this.heading = 0;
      this.enabled = false;
      this.lastStep = null;
      this.dragging = false;

      this.svg = el('svg', { class: 'dial', 'aria-hidden': 'true' });
      this.ring = el('g', { class: 'dial-ring' });
      this.pointer = el('g', { class: 'dial-pointer' });
      this.svg.append(this.ring, this.pointer);

      // The focusable control is an HTML element so screen readers get a proper slider.
      this.control = document.createElement('div');
      this.control.className = 'dial-control';
      this.control.tabIndex = 0;
      this.control.setAttribute('role', 'slider');
      this.control.setAttribute('aria-label', 'Compass heading');
      this.control.setAttribute('aria-valuemin', '0');
      this.control.setAttribute('aria-valuemax', '359');

      host.append(this.svg, this.control);
      this._build();
      this._bind();
      this.setEnabled(false);
      this._observer = new ResizeObserver(() => this._build());
      this._observer.observe(host);
    }

    get radius() {
      const r = this.host.getBoundingClientRect();
      // Leave room at the right for the zoom buttons (16px margin + 40px button + gap)
      // beyond the 26px degree ring, so they never cover the compass on narrow phones.
      const roomForZoom = r.width / 2 - 26 - 66;
      return Math.max(70, Math.min(190, 0.34 * Math.min(r.width, r.height), roomForZoom));
    }

    _build() {
      const rect = this.host.getBoundingClientRect();
      const w = rect.width, h = rect.height, r = this.radius;
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);
      this.cx = w / 2;
      this.cy = h / 2;
      this.ring.replaceChildren();
      this.ring.setAttribute('transform', `translate(${this.cx} ${this.cy})`);
      this.pointer.setAttribute('transform', `translate(${this.cx} ${this.cy})`);

      const band = 26; // width of the degree bezel outside the rose
      const polar = (deg, rad) => {
        const a = (deg * Math.PI) / 180;
        return [Math.sin(a) * rad, -Math.cos(a) * rad];
      };

      // Bezel: a parchment band with degree ticks, numbers every 30 degrees.
      this.ring.append(el('circle', { r: r + band / 2, class: 'dial-bezel', 'stroke-width': band }));
      this.ring.append(el('circle', { r, class: 'dial-edge' }));
      this.ring.append(el('circle', { r: r + band, class: 'dial-edge outer' }));
      for (let deg = 0; deg < 360; deg += 5) {
        const len = deg % 30 === 0 ? 9 : deg % 10 === 0 ? 6 : 3.5;
        const [x1, y1] = polar(deg, r);
        const [x2, y2] = polar(deg, r + len);
        this.ring.append(el('line', { x1, y1, x2, y2, class: deg % 30 === 0 ? 'tick major' : 'tick' }));
      }
      const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      for (let deg = 0; deg < 360; deg += 30) {
        const [x, y] = polar(deg, r + 17.5);
        const isCardinal = cardinals[deg] !== undefined;
        const t = el('text', { x, y, class: isCardinal ? (deg === 0 ? 'cardinal north' : 'cardinal') : 'degree' });
        t.textContent = isCardinal ? cardinals[deg] : String(deg);
        this.ring.append(t);
      }

      // Compass card: hairlines only, so the map shows through and the needle stands out.
      // Long lines for N/E/S/W, shorter for the diagonals, a dotted ring between.
      const rose = el('g', { class: 'dial-rose' });
      const hairline = (deg, from, to, cls) => {
        const [x1, y1] = polar(deg, from);
        const [x2, y2] = polar(deg, to);
        rose.append(el('line', { x1, y1, x2, y2, class: cls }));
      };
      for (const deg of [0, 90, 180, 270]) hairline(deg, r * 0.1, r * 0.9, 'rose-line major');
      for (const deg of [45, 135, 225, 315]) hairline(deg, r * 0.12, r * 0.62, 'rose-line');
      for (let deg = 22.5; deg < 360; deg += 45) hairline(deg, r * 0.3, r * 0.48, 'rose-line minor');
      rose.append(el('circle', { r: r * 0.5, class: 'rose-ring' }));
      this.ring.append(rose);

      // Needle: red north half to the rim, cream south half, dark hub with a brass dot.
      const nw = Math.max(7, r * 0.05); // needle half-width
      this.pointer.replaceChildren(
        el('path', { d: `M0 ${-(r - 3)} L${nw} 0 L${-nw} 0 Z`, class: 'dial-needle' }),
        el('path', { d: `M${nw} 0 L0 ${r * 0.42} L${-nw} 0 Z`, class: 'dial-tail' }),
        el('circle', { r: nw + 2.5, class: 'dial-hub' }),
        el('circle', { r: 3, class: 'dial-hub-dot' }),
      );

      // Your city's name, in a dark label just under the hub.
      this.cityTag = el('g', { class: 'dial-city', transform: 'translate(0 38)' });
      this.cityTagBg = el('rect', { class: 'dial-city-bg', rx: 7 });
      this.cityTagText = el('text', { class: 'dial-city-text', x: 0, y: 1 });
      this.cityTag.append(this.cityTagBg, this.cityTagText);
      this.pointer.append(this.cityTag);
      this.setCity(this.cityName || '');
      this._renderHeading();
    }

    _bind() {
      const toHeading = e => {
        const rect = this.host.getBoundingClientRect();
        const dx = e.clientX - rect.left - this.cx;
        const dy = e.clientY - rect.top - this.cy;
        return { dist: Math.hypot(dx, dy), heading: Core.norm360((Math.atan2(dx, -dy) * 180) / Math.PI) };
      };
      this.host.addEventListener('pointerdown', e => {
        if (!this.enabled || e.button > 0) return;
        if (e.target.closest && e.target.closest('button, a, input, .no-dial')) return;
        const { dist, heading } = toHeading(e);
        if (dist > this.radius + 60) return;
        this.dragging = true;
        this.host.setPointerCapture(e.pointerId);
        if (dist > DEAD_ZONE_PX) this.set(heading, true);
        e.preventDefault();
      });
      this.host.addEventListener('pointermove', e => {
        if (!this.dragging) return;
        const { dist, heading } = toHeading(e);
        if (dist > DEAD_ZONE_PX) this.set(heading, true);
      });
      const end = () => { this.dragging = false; };
      this.host.addEventListener('pointerup', end);
      this.host.addEventListener('pointercancel', end);

      // Show the focus ring only for keyboard users.
      this.host.addEventListener('pointerdown', () => this.host.classList.remove('keyboard'));
      this.control.addEventListener('keydown', e => {
        this.host.classList.add('keyboard');
        if (!this.enabled) return;
        const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
        if (e.key in steps) {
          this.set(Math.round(this.heading) + steps[e.key] * (e.shiftKey ? 10 : 1), true);
        } else if (e.key === 'Home') {
          this.set(0, true);
        } else if (e.key === 'Enter' || e.key === ' ') {
          this.handlers.onLock && this.handlers.onLock();
        } else {
          return;
        }
        e.preventDefault();
      });
    }

    set(heading, fromUser = false) {
      this.heading = Core.norm360(heading);
      this._renderHeading();
      if (!fromUser) { this.lastStep = Math.round(this.heading / 5) % 72; return; }
      this.handlers.onChange && this.handlers.onChange(this.heading);
      const step = Math.round(this.heading / 5) % 72;
      if (step !== this.lastStep) {
        this.lastStep = step;
        if (step % 18 === 0) this.handlers.onStep && this.handlers.onStep('major');
        else if (step % 2 === 0) this.handlers.onStep && this.handlers.onStep('minor');
      }
    }

    /** Shows the name of the city you're standing in under the hub. */
    setCity(name) {
      this.cityName = name;
      if (!this.cityTagText) return;
      this.cityTagText.textContent = name ? name.toUpperCase() : '';
      this.cityTag.style.display = name ? '' : 'none';
      if (!name) return;
      // Size the label to its text (needs layout, so measure after the text is set).
      let width = name.length * 10;
      try { width = this.cityTagText.getComputedTextLength(); } catch (_) { /* not laid out yet */ }
      if (!width) width = name.length * 10;
      const padX = 13, h = 28;
      this.cityTagBg.setAttribute('x', -(width / 2 + padX));
      this.cityTagBg.setAttribute('y', -h / 2);
      this.cityTagBg.setAttribute('width', width + padX * 2);
      this.cityTagBg.setAttribute('height', h);
    }

    _renderHeading() {
      for (const part of this.pointer.querySelectorAll('.dial-needle, .dial-tail')) part.setAttribute('transform', `rotate(${this.heading})`);
      const rounded = Math.round(this.heading) % 360;
      this.control.setAttribute('aria-valuenow', String(rounded));
      this.control.setAttribute('aria-valuetext', `${rounded} degrees, ${Core.compassWord(this.heading)}`);
    }

    setEnabled(on) {
      this.enabled = on;
      this.svg.classList.toggle('is-hidden', !on);
      this.control.hidden = !on;
      this.host.classList.toggle('is-aiming', on);
      // The label could not be measured while hidden; measure it now that it's visible.
      if (on && this.cityName) requestAnimationFrame(() => this.setCity(this.cityName));
    }

    destroy() {
      this._observer.disconnect();
      this.svg.remove();
      this.control.remove();
    }

    focus() {
      this.control.focus({ preventScroll: true });
    }
  }

  export default Dial;
