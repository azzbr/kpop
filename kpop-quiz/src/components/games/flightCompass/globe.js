// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Flight Compass — world view on a <canvas> with d3-geo.
// Two modes: an orthographic 'globe' (used while aiming and flying) and a flat
// Mercator 'map' (used to show whole routes, where great circles visibly curve).
import * as d3geo from 'd3-geo';
import * as d3array from 'd3-array';
import * as topojson from 'topojson-client';
import Core from './core.js';

  const d3 = { ...d3array, ...d3geo };

  // "Chart room" palette: parchment land, sea-green water, sepia ink, ochre accents.
  const COLORS = {
    page: '#e9dfc6',
    sea: '#a8d4d8',
    seaDeep: '#7db3bb',
    trailA: '#1f7a8c',   // teal
    trailB: '#d9482b',   // vermilion, dashed over the teal so the trail alternates colours
    waterline: 'rgba(59, 47, 34, 0.12)',
    land: '#fbf3e0',
    landEdge: '#4a3b2a',
    border: 'rgba(74, 59, 42, 0.45)',
    graticule: 'rgba(74, 59, 42, 0.13)',
    rim: '#3b2f22',
    shadow: 'rgba(59, 47, 34, 0.18)',
    aim: '#c4362b',
    aimBack: 'rgba(196, 54, 43, 0.5)',
    truth: '#2f7d4f',
    miss: '#a8452c',
    rhumb: '#7b5ea7',
    origin: '#3b2f22',
    target: '#2f7d4f',
    label: '#2b2118',
    labelHalo: 'rgba(250, 245, 232, 0.92)',
    plane: '#3b2f22',
  };

  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const MAP_LAT_LIMIT = 78;

  // ---------- Fun Quest: speed (the picture stays the same) ----------
  // While aiming, the globe sits at zoom 7 and shows ~700 km, but every frame still projected
  // and stroked the whole hemisphere (60,000 coast points, 19,000 border points). Three tricks:
  //  1. pieces of land / border lines whose bounding circle on the sphere is off screen are skipped
  //     (whole pieces only, so what is drawn is unchanged);
  //  2. solid layers (sea, land, graticule, rim) are clipped to the screen plus a margin, so the
  //     canvas gets screen-sized paths (dashed borders and routes are never clipped: their dash
  //     pattern would shift);
  //  3. while the view stands still (dragging the dial), the map is drawn once into a hidden
  //     canvas and copied; only the aim line, markers and plane are drawn on top each frame.
  const RAD = Math.PI / 180;
  const SCREEN_MARGIN = 16;   // px beyond the canvas edge; wider than any stroke on the base map
  const toUnit = ([lon, lat]) => {
    const l = lon * RAD, p = lat * RAD, c = Math.cos(p);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
  };
  const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

  /** The circle on the sphere holding every point: {c: unit vector, r: radians}; r = π means "always draw". */
  function capOf(points) {
    const vs = points.map(toUnit);
    let x = 0, y = 0, z = 0;
    for (const v of vs) { x += v[0]; y += v[1]; z += v[2]; }
    const n = Math.hypot(x, y, z);
    if (n < 1e-9) return { c: [1, 0, 0], r: Math.PI };
    const c = [x / n, y / n, z / n];
    let r = 0;
    for (const v of vs) r = Math.max(r, angleBetween(c, v));
    // Past a hemisphere the shape is no longer inside its circle's hull: never skip it.
    return { c, r: r > Math.PI / 2 ? Math.PI : r };
  }

  /** Polygons of any GeoJSON (in their original order), each with the circle around its outer ring. */
  function polygonParts(geo) {
    const out = [];
    const add = g => {
      if (!g) return;
      if (g.type === 'FeatureCollection') g.features.forEach(add);
      else if (g.type === 'Feature') add(g.geometry);
      else if (g.type === 'GeometryCollection') g.geometries.forEach(add);
      else if (g.type === 'Polygon') out.push(g.coordinates);
      else if (g.type === 'MultiPolygon') out.push(...g.coordinates);
    };
    add(geo);
    return out.map(coords => ({ coords, cap: capOf(coords[0]) }));
  }

  /** Lines of any GeoJSON (in their original order), each with its circle. */
  function lineParts(geo) {
    const out = [];
    const add = g => {
      if (!g) return;
      if (g.type === 'FeatureCollection') g.features.forEach(add);
      else if (g.type === 'Feature') add(g.geometry);
      else if (g.type === 'GeometryCollection') g.geometries.forEach(add);
      else if (g.type === 'LineString') out.push(g.coordinates);
      else if (g.type === 'MultiLineString') out.push(...g.coordinates);
    };
    add(geo);
    return out.map(coords => ({ coords, cap: capOf(coords) }));
  }

  // Canvas state the base map leaves behind, copied onto the screen when the map comes from the cache
  // (the plane, for one, is stroked with whatever lineJoin the map left).
  const CTX_STATE = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'miterLimit', 'font',
    'textAlign', 'textBaseline', 'globalAlpha', 'lineDashOffset', 'letterSpacing'];

  class Globe {
    constructor(canvas, data) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.d3 = d3;
      this.ortho = this.d3.geoOrthographic().clipAngle(90).precision(0.4);
      this.mercator = this.d3.geoMercator().precision(0.4);
      this.mode = 'globe';
      this.projection = this.ortho;
      this.path = this.d3.geoPath(this.projection, this.ctx);
      this.graticule = this.d3.geoGraticule10();

      const topo = topojson;
      this.land110 = topo.feature(data.land110, data.land110.objects.land);
      this.borders = topo.mesh(data.countries110, data.countries110.objects.countries, (a, b) => a !== b);
      this.land50 = null;
      this.borders50 = null;
      this.places = data.places || [];
      const hiddenIds = data.hiddenCountryIds || new Set();
      this.countries = this._countryLabels(topo.feature(data.countries110, data.countries110.objects.countries))
        .filter(c => !hiddenIds.has(String(c.feature.id)));
      this.labels = null;     // while aiming: {maxKm, hideCountry, hideCc, skipNames, ring}; null = no area labels

      this.center = { lat: 20, lon: 0 };
      this.zoom = 1;          // globe: 1 = whole globe fits; larger = closer
      this.minZoom = 0.8;
      this.maxZoom = 14;
      this.mapFit = null;     // GeoJSON the flat map is fitted to
      this.aim = null;        // {heading} -> great circle from the centre
      this.lines = [];        // [{points, color, width, dash, alpha}]
      this.markers = [];      // [{point, color, label, ring, small}]
      this.plane = null;      // {point, heading}
      this.dpr = 1;
      this.width = 0;
      this.height = 0;
      this._frame = 0;
      this._anim = null;

      // Fun Quest: speed — pieces with their bounding circles, and the hidden map canvas.
      this._parts = new Map([[this.land110, polygonParts(this.land110)], [this.borders, lineParts(this.borders)]]);
      this._dataVersion = 0;
      this._baseCanvas = null;
      this._baseView = null;   // the view the hidden canvas holds
      this._lastView = null;   // the view of the previous frame

      this.resize();
      this._observer = new ResizeObserver(() => this.resize());
      this._observer.observe(canvas);
    }

    useDetailedLand(topology, borders) {
      this.land50 = topojson.feature(topology, topology.objects.land);
      if (borders) this.borders50 = borders;
      this._parts.set(this.land50, polygonParts(this.land50));
      if (borders) this._parts.set(this.borders50, lineParts(this.borders50));
      this._dataVersion++;
      this.invalidate();
    }

    /** One label point per country: the centroid of its largest piece (so France sits in Europe). */
    _countryLabels(collection) {
      const { d3 } = this;
      const out = [];
      for (const f of collection.features) {
        const name = f.properties && f.properties.name;
        if (!name || !f.geometry) continue;
        let main = f.geometry;
        if (main.type === 'MultiPolygon') {
          let best = null, bestArea = -1;
          for (const coords of main.coordinates) {
            const poly = { type: 'Polygon', coordinates: coords };
            const a = d3.geoArea(poly);
            if (a > bestArea) { bestArea = a; best = poly; }
          }
          main = best;
        }
        const c = d3.geoCentroid(main);
        out.push({ name, feature: f, point: { lon: c[0], lat: c[1] }, area: d3.geoArea(main) });
      }
      out.sort((a, b) => b.area - a.area); // bigger countries claim label space first
      return out;
    }

    /** Country feature containing a point, or null (open sea). */
    countryAt(point) {
      const p = [point.lon, point.lat];
      const hit = this.countries.find(c => this.d3.geoContains(c.feature, p));
      return hit ? hit.feature : null;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
      this.invalidate();
    }

    /** Globe radius in CSS pixels at the current zoom. */
    get radius() {
      return 0.44 * Math.min(this.width, this.height) * this.zoom;
    }

    get centerPx() {
      return { x: this.width / 2, y: this.height / 2 };
    }

    setCenter(point) {
      this.center = { lat: point.lat, lon: point.lon };
      this.invalidate();
    }

    setZoom(z) {
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
      this.invalidate();
    }

    /** Switches to the orthographic globe. */
    showGlobe() {
      this.mode = 'globe';
      this.projection = this.ortho;
      this.path = this.d3.geoPath(this.projection, this.ctx);
      this.invalidate();
    }

    /**
     * Switches to a flat Mercator map fitted around the given lines of points,
     * centred on the longitude of `centerPoint` so the route is not split.
     */
    showMap(pointLists, centerPoint) {
      this.mode = 'map';
      this.projection = this.mercator;
      this.path = this.d3.geoPath(this.projection, this.ctx);
      this.mapCenterLon = centerPoint.lon;
      this.mapFit = {
        type: 'MultiLineString',
        coordinates: pointLists.map(pts => pts.map(p => [p.lon, Math.max(-MAP_LAT_LIMIT, Math.min(MAP_LAT_LIMIT, p.lat))])),
      };
      this.invalidate();
    }

    /** Screen position of a geographic point, or null when it is not visible. */
    project(point) {
      this._configure();
      if (this.mode === 'globe') {
        const rotated = this.d3.geoRotation(this.projection.rotate())([point.lon, point.lat]);
        if (Math.cos(rotated[1] * Math.PI / 180) * Math.cos(rotated[0] * Math.PI / 180) < 0) return null;
      } else {
        if (Math.abs(point.lat) > 85) return null;
        const p = this.projection([point.lon, point.lat]);
        const [x0, y0, x1, y1] = this.mapBounds;
        return p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 ? { x: p[0], y: p[1] } : null;
      }
      const p = this.projection([point.lon, point.lat]);
      return p ? { x: p[0], y: p[1] } : null;
    }

    invalidate() {
      if (this._frame) return;
      this._frame = requestAnimationFrame(() => {
        this._frame = 0;
        this.draw();
      });
    }

    _configure() {
      if (this.mode === 'globe') {
        const { x, y } = this.centerPx;
        this.ortho.rotate([-this.center.lon, -this.center.lat]).translate([x, y]).scale(this.radius);
        return;
      }
      const pad = Math.min(48, Math.min(this.width, this.height) * 0.1);
      this.mercator.rotate([-this.mapCenterLon, 0]).clipExtent(null);
      this.mercator.fitExtent([[pad, pad], [this.width - pad, this.height - pad]], this.mapFit);
      // Never zoom out past the whole world, nor in closer than a regional view.
      const worldScale = Math.min(this.width / (2 * Math.PI), this.height / 4.2);
      const s = this.mercator.scale();
      if (s < worldScale) {
        // Route spans more than one world view: show the whole world, equator centred.
        this.mercator.scale(worldScale).translate([this.width / 2, this.height / 2]);
      } else if (s > worldScale * 6) {
        const c = this.mercator.invert([this.width / 2, this.height / 2]);
        this.mercator.scale(worldScale * 6).translate([this.width / 2, this.height / 2]);
        const off = this.mercator(c);
        const t = this.mercator.translate();
        this.mercator.translate([t[0] + this.width / 2 - off[0], t[1] + this.height / 2 - off[1]]);
      }
      // Clip to the drawable world (Mercator runs to infinity at the poles) and the canvas.
      const s2 = this.mercator.scale(), t = this.mercator.translate();
      const yTop = this.mercator([this.mapCenterLon, 85])[1];
      const yBottom = this.mercator([this.mapCenterLon, -85])[1];
      this.mapBounds = [
        Math.max(0, t[0] - Math.PI * s2), Math.max(0, yTop),
        Math.min(this.width, t[0] + Math.PI * s2), Math.min(this.height, yBottom),
      ];
      const [x0, y0, x1, y1] = this.mapBounds;
      this.mercator.clipExtent([[x0, y0], [x1, y1]]);
    }

    draw() {
      const { ctx } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      this._configure();
      this._drawBaseCached();
      for (const line of this.lines) this._drawLine(line);
      if (this.aim && this.mode === 'globe') this._drawAim();
      for (const m of this.markers) this._drawMarker(m);
      if (this.plane) this._drawPlane();
    }

    /** The map under the lines: sea, land, borders, area labels. */
    _drawBase() {
      if (this.mode === 'globe') this._drawGlobeBase();
      else this._drawMapBase();
      if (this.labels && this.mode === 'globe' && this.zoom >= 1.8) this._drawAreaLabels();
    }

    // ---------- Fun Quest: speed ----------
    /** Everything the base map depends on. Objects (labels, mapFit) are compared by identity. */
    _view() {
      const key = [this.mode, this.center.lat, this.center.lon, this.zoom, this.width, this.height, this.dpr,
        this.mode === 'map' ? this.mapCenterLon : '', this._dataVersion].join('|');
      return { key, labels: this.labels, mapFit: this.mapFit };
    }

    /**
     * Draws the base map. A view that stays the same from one frame to the next is drawn once into
     * a hidden canvas and copied after that; a moving view (flights, turns, the home spin) is drawn
     * straight onto the screen as before, so it costs nothing extra.
     */
    _drawBaseCached() {
      const view = this._view();
      const same = v => !!v && v.key === view.key && v.labels === view.labels && v.mapFit === view.mapFit;
      const canvas = this.canvas;
      if (this._baseCanvas && same(this._baseView)) {
        this._blitBase();
      } else if (same(this._lastView)) {
        if (!this._baseCanvas) this._baseCanvas = document.createElement('canvas');
        const base = this._baseCanvas;
        if (base.width !== canvas.width || base.height !== canvas.height) { base.width = canvas.width; base.height = canvas.height; }
        const bctx = base.getContext('2d');
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, base.width, base.height);
        bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        const screen = this.ctx;
        this.ctx = bctx;
        this.path.context(bctx);
        try { this._drawBase(); } finally { this.ctx = screen; this.path.context(screen); }
        this._baseView = view;
        this._blitBase();
      } else {
        this._drawBase();
      }
      this._lastView = view;
    }

    _blitBase() {
      const { ctx } = this;
      const bctx = this._baseCanvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this._baseCanvas, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const k of CTX_STATE) if (k in bctx) ctx[k] = bctx[k];
      ctx.setLineDash(bctx.getLineDash());
    }

    /** Pieces of `geo` (land or border lines) that can reach the screen; the whole thing when zoomed out. */
    _cull(geo, kind) {
      const parts = this._parts.get(geo);
      if (!parts || this.mode !== 'globe') return geo;
      const r = this.radius;
      const reach = Math.hypot(this.width, this.height) / 2 + SCREEN_MARGIN;
      if (reach >= r) return geo;                       // the whole globe (or most of it) is on screen
      const visible = Math.asin(reach / r);             // farthest angle from the centre that is on screen
      const c = toUnit([this.center.lon, this.center.lat]);
      const kept = parts.filter(p => p.cap.r >= Math.PI || angleBetween(c, p.cap.c) <= p.cap.r + visible).map(p => p.coords);
      return kind === 'lines' ? { type: 'MultiLineString', coordinates: kept } : { type: 'MultiPolygon', coordinates: kept };
    }

    /** Solid layers are clipped to the screen (plus a margin) on the globe; off for dashed lines. */
    _screenClip(on) {
      if (this.mode !== 'globe') return;
      const m = SCREEN_MARGIN;
      this.ortho.clipExtent(on ? [[-m, -m], [this.width + m, this.height + m]] : null);
    }

    _land() {
      const detailed = this.mode === 'globe' ? this.zoom >= 2.2 : this.mercator.scale() > 400;
      return this.land50 && detailed ? this.land50 : this.land110;
    }

    _drawGlobeBase() {
      const { ctx } = this;
      const r = this.radius;
      const { x: cx, y: cy } = this.centerPx;

      // Soft offset shadow under the globe, like a printed plate.
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.04, cy + r * 0.06, r, r, 0, 0, 2 * Math.PI);
      ctx.fill();

      this._screenClip(true);   // Fun Quest: speed — off again below, before anything dashed
      const sea = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
      sea.addColorStop(0, COLORS.sea);
      sea.addColorStop(1, COLORS.seaDeep);
      ctx.fillStyle = sea;
      ctx.beginPath();
      this.path({ type: 'Sphere' });
      ctx.fill();

      this._drawLandLayers(this.zoom >= 1.4);

      ctx.strokeStyle = COLORS.rim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.path({ type: 'Sphere' });
      ctx.stroke();
      this._screenClip(false);
    }

    _drawMapBase() {
      const { ctx } = this;
      const [x0, y0, x1, y1] = this.mapBounds;
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(x0 + 4, y0 + 5, x1 - x0, y1 - y0);
      ctx.fillStyle = COLORS.sea;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      this._drawLandLayers(true);
      ctx.strokeStyle = COLORS.rim;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }

    _drawLandLayers(withBorders) {
      const { ctx } = this;
      const land = this._cull(this._land(), 'polygons');   // Fun Quest: speed

      ctx.strokeStyle = COLORS.graticule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      this.path(this.graticule);
      ctx.stroke();

      // Water-lining: a pale band hugging every coast, as on old sea charts.
      ctx.beginPath();
      this.path(land);
      ctx.strokeStyle = COLORS.waterline;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = COLORS.land;
      ctx.fill();
      ctx.strokeStyle = COLORS.landEdge;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (withBorders) {
        const detailed = this.borders50 && (this.mode === 'globe' ? this.zoom >= 2.2 : this.mercator.scale() > 400);
        ctx.save();
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = detailed ? 1.1 : 0.9;
        ctx.setLineDash(detailed ? [5, 3, 1.2, 3] : [1.5, 3]);
        this._screenClip(false);   // Fun Quest: speed — dashes would shift if the lines were cut
        ctx.beginPath();
        this.path(this._cull(detailed ? this.borders50 : this.borders, 'lines'));
        ctx.stroke();
        this._screenClip(true);
        ctx.restore();
      }
    }

    /**
     * Names for the area around the centre while aiming: countries in spaced capitals,
     * cities with a dot. Only places within `maxKm` are named, and the target's country
     * and cities are never named, so labels can't give the answer away.
     */
    _drawAreaLabels() {
      const { ctx } = this;
      const opt = this.labels;
      const maxAngle = opt.maxKm / Core.EARTH_RADIUS_KM;
      const boxes = [];
      const centre = this.centerPx;
      // Keep the middle of the dial clear for the hub and your city's name.
      boxes.push({ x0: centre.x - 80, y0: centre.y - 16, x1: centre.x + 80, y1: centre.y + 56 });
      // Labels may sit inside or outside the compass, but never under its degree ring.
      const ring = opt.ring;
      const onRing = b => {
        if (!ring) return false;
        const nx = Math.max(b.x0, Math.min(centre.x, b.x1)) - centre.x;
        const ny = Math.max(b.y0, Math.min(centre.y, b.y1)) - centre.y;
        const near = Math.hypot(nx, ny);
        const far = Math.max(
          Math.hypot(b.x0 - centre.x, b.y0 - centre.y), Math.hypot(b.x1 - centre.x, b.y0 - centre.y),
          Math.hypot(b.x0 - centre.x, b.y1 - centre.y), Math.hypot(b.x1 - centre.x, b.y1 - centre.y));
        return far >= ring.inner && near <= ring.outer;
      };
      const free = b => !onRing(b) && !boxes.some(o => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
      const inView = b => b.x0 > 4 && b.y0 > 4 && b.x1 < this.width - 4 && b.y1 < this.height - 4;
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';

      // Countries
      ctx.textAlign = 'center';
      let countryCount = 0;
      for (const c of this.countries) {
        if (countryCount >= 10) break;
        if (Core.centralAngle(this.center, c.point) > maxAngle * 1.25) continue;
        if (opt.hideCountry && c.feature === opt.hideCountry) continue;
        const p = this.project(c.point);
        if (!p) continue;
        const size = Math.max(10, Math.min(15, 9 + Math.sqrt(c.area) * 6 * Math.sqrt(this.zoom)));
        ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.22)}px`;
        const text = c.name.toUpperCase();
        const w = ctx.measureText(text).width;
        const box = { x0: p.x - w / 2 - 4, y0: p.y - size / 2 - 3, x1: p.x + w / 2 + 4, y1: p.y + size / 2 + 3 };
        if (!inView(box) || !free(box)) continue;
        boxes.push(box);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(246, 238, 219, 0.75)';
        ctx.fillStyle = 'rgba(74, 59, 42, 0.62)';
        ctx.strokeText(text, p.x, p.y);
        ctx.fillText(text, p.x, p.y);
        countryCount++;
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      // Cities (most important first)
      ctx.textAlign = 'left';
      let cityCount = 0;
      for (const place of this.places) {
        if (cityCount >= 16) break;
        if (opt.hideCc && place.cc === opt.hideCc) continue;
        if (opt.skipNames && opt.skipNames.has(place.n)) continue;
        const pt = { lat: place.la, lon: place.lo };
        if (Core.centralAngle(this.center, pt) > maxAngle) continue;
        const p = this.project(pt);
        if (!p) continue;
        ctx.font = `${place.cap ? 700 : 400} ${place.cap ? 13 : 12}px Georgia, "Times New Roman", serif`;
        const w = ctx.measureText(place.n).width;
        const dot = { x0: p.x - 4, y0: p.y - 4, x1: p.x + 4, y1: p.y + 4 };
        if (!free(dot)) continue;
        // Try the name to the right, left, above and below its dot; use the first that fits.
        const options = [
          { tx: p.x + 7, ty: p.y, box: { x0: p.x - 4, y0: p.y - 9, x1: p.x + 10 + w, y1: p.y + 9 } },
          { tx: p.x - 7 - w, ty: p.y, box: { x0: p.x - 10 - w, y0: p.y - 9, x1: p.x + 4, y1: p.y + 9 } },
          { tx: p.x - w / 2, ty: p.y - 13, box: { x0: p.x - w / 2 - 3, y0: p.y - 22, x1: p.x + w / 2 + 3, y1: p.y + 4 } },
          { tx: p.x - w / 2, ty: p.y + 13, box: { x0: p.x - w / 2 - 3, y0: p.y - 4, x1: p.x + w / 2 + 3, y1: p.y + 22 } },
        ];
        const spot = options.find(o => inView(o.box) && free(o.box));
        if (!spot) continue;
        boxes.push(spot.box);
        ctx.fillStyle = COLORS.landEdge;
        ctx.beginPath();
        if (place.cap) ctx.rect(p.x - 3, p.y - 3, 6, 6);
        else ctx.arc(p.x, p.y, 2.6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = COLORS.labelHalo;
        ctx.fillStyle = COLORS.label;
        ctx.strokeText(place.n, spot.tx, spot.ty);
        ctx.fillText(place.n, spot.tx, spot.ty);
        cityCount++;
      }
      ctx.restore();
    }

    _drawLine({ points, color, width = 3, dash = null, alpha = 1 }) {
      const { ctx } = this;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      this.path({ type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) });
      ctx.stroke();
      ctx.restore();
    }

    _drawAim() {
      const { heading } = this.aim;
      const steps = 48;
      const ahead = [], behind = [];
      for (let i = 0; i <= steps; i++) {
        const d = (i / steps) * (Math.PI * 0.98);
        ahead.push(Core.destination(this.center, heading, d));
        behind.push(Core.destination(this.center, heading + 180, d));
      }
      this._drawLine({ points: behind, color: COLORS.aimBack, width: 2, dash: [2, 7] });
      this._drawLine({ points: ahead, color: COLORS.aim, width: 3.5 });
    }

    _drawMarker({ point, color, label, ring, small }) {
      const p = this.project(point);
      if (!p) return;
      const { ctx } = this;
      ctx.save();
      if (ring) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.strokeStyle = COLORS.labelHalo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, small ? 3.5 : 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      if (label) {
        ctx.font = '700 13px Georgia, "Times New Roman", serif';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.labelHalo;
        ctx.fillStyle = COLORS.label;
        const x = Math.min(p.x + 13, this.width - ctx.measureText(label).width - 6);
        const lx = x < p.x ? p.x - 13 - ctx.measureText(label).width : x;
        ctx.strokeText(label, lx, p.y);
        ctx.fillText(label, lx, p.y);
      }
      ctx.restore();
    }

    /** A small aircraft silhouette pointing along the local heading (north is up). */
    _drawPlane() {
      const p = this.project(this.plane.point);
      if (!p) return;
      const { ctx } = this;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (this.plane.badge) {
        // A round paper badge with an ink ring and a hard shadow, the plane inside it.
        ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
        ctx.beginPath();
        ctx.arc(2, 3, 19, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fbf6ea';
        ctx.strokeStyle = COLORS.plane;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.scale(0.82, 0.82);
      }
      ctx.rotate((this.plane.heading * Math.PI) / 180);
      ctx.fillStyle = COLORS.plane;
      ctx.strokeStyle = COLORS.labelHalo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -16);            // nose
      ctx.lineTo(2.2, -10);
      ctx.lineTo(2.2, -3);
      ctx.lineTo(14, 4);             // right wing
      ctx.lineTo(14, 7);
      ctx.lineTo(2.2, 3);
      ctx.lineTo(1.6, 11);
      ctx.lineTo(5.5, 14.5);         // right tailplane
      ctx.lineTo(5.5, 16.5);
      ctx.lineTo(0, 15);
      ctx.lineTo(-5.5, 16.5);
      ctx.lineTo(-5.5, 14.5);        // left tailplane
      ctx.lineTo(-1.6, 11);
      ctx.lineTo(-2.2, 3);
      ctx.lineTo(-14, 7);
      ctx.lineTo(-14, 4);            // left wing
      ctx.lineTo(-2.2, -3);
      ctx.lineTo(-2.2, -10);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    /** Stops every animation and the resize observer (Fun Quest: when the screen closes). */
    destroy() {
      this.stopAnimation();
      if (this._frame) cancelAnimationFrame(this._frame);
      this._frame = 0;
      this._observer.disconnect();
      if (this._baseCanvas) { this._baseCanvas.width = 0; this._baseCanvas.height = 0; this._baseCanvas = null; }
    }

    stopAnimation() {
      if (this._anim) cancelAnimationFrame(this._anim.raf);
      this._anim = null;
    }

    /**
     * Flies the camera along a list of points. The plane stays centred and turns with the
     * route; the camera pulls out mid-flight on long trips. Resolves when it lands.
     */
    flyAlong(points, { duration, onProgress } = {}) {
      this.stopAnimation();
      this.showGlobe();
      const startZoom = this.zoom;
      const span = Core.centralAngle(points[0], points[points.length - 1]);
      // From a close aiming zoom, pull well out on long trips so the route is readable.
      const pullOut = Math.min(0.8, 0.2 + span / 4) * (startZoom > 1.5 ? 1 : 0.55);
      return new Promise(resolve => {
        const t0 = performance.now();
        const step = now => {
          // rAF timestamps can be slightly earlier than t0, so clamp to 0..1.
          const raw = Math.max(0, Math.min(1, (now - t0) / duration));
          const t = easeInOutCubic(raw);
          const f = t * (points.length - 1);
          const i = Math.min(points.length - 2, Math.floor(f));
          const a = points[i], b = points[i + 1];
          const here = this.d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(f - i);
          const point = { lon: here[0], lat: here[1] };
          const heading = raw < 1 ? Core.bearing(point, b) : this.plane ? this.plane.heading : 0;
          this.center = point;
          this.zoom = startZoom * (1 - pullOut * Math.sin(Math.PI * t));
          this.plane = { point, heading };
          if (onProgress) onProgress(t, point);
          this.draw();
          if (raw < 1) {
            this._anim.raf = requestAnimationFrame(step);
          } else {
            this._anim = null;
            this.zoom = startZoom;
            resolve();
          }
        };
        this._anim = { raf: requestAnimationFrame(step) };
      });
    }

    /**
     * Turns the globe along the great circle to a new centre while easing to a new zoom
     * (geometric, so zooming feels even). Long moves pull out a little in the middle.
     */
    panTo(point, duration = 900, endZoom = this.zoom) {
      this.stopAnimation();
      this.showGlobe();
      const from = this.center;
      const interp = this.d3.geoInterpolate([from.lon, from.lat], [point.lon, point.lat]);
      const z0 = Math.log(this.zoom), z1 = Math.log(endZoom);
      const bump = Math.min(0.6, Core.centralAngle(from, point) * 0.4);
      return new Promise(resolve => {
        const t0 = performance.now();
        const step = now => {
          const raw = Math.max(0, Math.min(1, (now - t0) / duration));
          const t = easeInOutCubic(raw);
          const p = interp(t);
          this.center = { lon: p[0], lat: p[1] };
          this.zoom = Math.exp(z0 + (z1 - z0) * t) * (1 - bump * Math.sin(Math.PI * t));
          this.draw();
          if (raw < 1) {
            this._anim.raf = requestAnimationFrame(step);
          } else {
            this._anim = null;
            this.zoom = endZoom;
            resolve();
          }
        };
        this._anim = { raf: requestAnimationFrame(step) };
      });
    }

    /** Slowly turns the globe (home screen). Returns a stop function. */
    idleSpin(degreesPerSecond = 6) {
      this.showGlobe();
      let last = performance.now();
      let raf = 0;
      const tick = now => {
        const dt = Math.max(0, (now - last) / 1000);
        last = now;
        this.center = { lat: this.center.lat * 0.98 + 18 * 0.02, lon: Core.norm360(this.center.lon + degreesPerSecond * dt + 180) - 180 };
        this.draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
  }

  Globe.COLORS = COLORS;
  export default Globe;
