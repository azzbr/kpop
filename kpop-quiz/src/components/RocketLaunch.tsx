import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../games/engine/useGameLoop';
import { createRng } from '../games/engine/rng';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playCoin, playWrong, playPop } from '../utils/sounds';
import {
  W, H, GROUND_Y, LAUNCH_X, LAUNCH_Y, TARGETS_PER_ROUND, TRIES_PER_TARGET,
  MIN_ANGLE, MAX_ANGLE, MIN_POWER, MAX_POWER,
  clampAngle, clampPower, launchShot, stepShot, isOut, segmentHits, simulate,
  makeTargets, newRound, reduceRound,
} from './games/rocketLaunchLogic';
import type { RoundState, RoundAction, Shot } from './games/rocketLaunchLogic';

// Rocket Launch: pull back like a slingshot (or use the +/- buttons) and hit 5 stars.
// Rules live in games/rocketLaunchLogic.ts. Saved as 'rocket_launch' (100 per hit + 30 per spare try).

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Flight extends Shot { trail: { x: number; y: number }[] }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Fixed city skyline (lights chosen once so they don't flicker).
const BUILDINGS = [
  { x: 200, w: 55, h: 90 }, { x: 265, w: 40, h: 130 }, { x: 315, w: 65, h: 75 },
  { x: 390, w: 50, h: 110 }, { x: 450, w: 45, h: 155 }, { x: 505, w: 60, h: 90 },
  { x: 575, w: 45, h: 120 }, { x: 630, w: 55, h: 80 }, { x: 695, w: 50, h: 100 },
].map((b, bi) => {
  const lit: boolean[] = [];
  for (let wy = GROUND_Y - b.h + 10, i = 0; wy < GROUND_Y - 14; wy += 18) {
    for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14, i++) lit.push((i * 7 + bi * 3) % 5 === 0);
  }
  return { ...b, lit };
});

export default function RocketLaunch() {
  const later = useSafeTimeout();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(canvasRef);

  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [rs, setRs] = useState<RoundState>(() => newRound([]));
  const rsRef = useRef(rs);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(55);
  const aimRef = useRef({ angle: 45, power: 55 });
  aimRef.current = { angle, power };

  const world = useRef({
    flight: null as Flight | null,
    particles: [] as Particle[],
    clouds: [{ x: 120, y: 60, s: 0.9 }, { x: 360, y: 40, s: 1.1 }, { x: 580, y: 80, s: 0.7 }, { x: 700, y: 50, s: 1.0 }],
    frame: 0,
    drag: null as null | { id: number; sx: number; sy: number; cx: number; cy: number },
  });

  const dispatch = useCallback((a: RoundAction) => {
    const prev = rsRef.current;
    const next = reduceRound(prev, a);
    if (next === prev) return prev;
    rsRef.current = next;
    setRs(next);
    if (next.phase === 'done' && prev.phase !== 'done') later(() => setStatus('over'), 900);
    return next;
  }, [later]);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) + round : Math.floor(Math.random() * 1e9);
    const r = newRound(makeTargets(createRng(seed)));
    rsRef.current = r;
    setRs(r);
    world.current.flight = null;
    world.current.particles = [];
    world.current.drag = null;
    setRound(n => n + 1);
    setStatus('playing');
  }, [round]);

  const launch = useCallback(() => {
    if (rsRef.current.phase !== 'aim') return;
    dispatch({ type: 'launch' });
    const { angle: a, power: p } = aimRef.current;
    world.current.flight = { ...launchShot(a, p), trail: [] };
    playPop();
  }, [dispatch]);

  const landed = useCallback((hit: boolean) => {
    const next = dispatch({ type: 'landed', hit });
    if (next.phase === 'result') later(() => dispatch({ type: 'next' }), 1000);
  }, [dispatch, later]);

  /* ---------- tick ---------- */
  const update = () => {
    const w = world.current;
    w.frame++;
    for (const c of w.clouds) { c.x -= 0.3; if (c.x < -120) c.x = W + 80; }
    for (const p of w.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life--; }
    w.particles = w.particles.filter(p => p.life > 0);

    const f = w.flight;
    const s = rsRef.current;
    if (!f || s.phase !== 'flight') return;
    const n = stepShot(f);
    const t = s.targets[s.index];
    f.trail.push({ x: f.x, y: f.y });
    if (f.trail.length > 24) f.trail.shift();
    if (t && segmentHits(f.x, f.y, n.x, n.y, t)) {
      w.flight = null;
      for (let i = 0; i < 24; i++) w.particles.push({ x: t.x, y: t.y, vx: rnd(-6, 6), vy: rnd(-8, 0), life: rnd(20, 40), max: 40, color: i % 2 ? '#fbbf24' : '#f472b6', size: rnd(3, 7) });
      playCoin();
      landed(true);
      return;
    }
    Object.assign(f, n);
    if (isOut(f)) {
      w.flight = null;
      for (let i = 0; i < 10; i++) w.particles.push({ x: Math.min(W - 10, Math.max(10, f.x)), y: Math.min(GROUND_Y, f.y), vx: rnd(-3, 3), vy: rnd(-5, -1), life: rnd(15, 30), max: 30, color: '#cbd5e1', size: rnd(2, 5) });
      playWrong();
      landed(false);
    }
  };

  /* ---------- draw ---------- */
  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const { w: cw, h: ch, dpr } = size.current;
    if (!ctx || !cw || !ch) return;
    ctx.setTransform((dpr * cw) / W, 0, 0, (dpr * ch) / H, 0, 0);
    const w = world.current;
    const s = rsRef.current;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(0.6, '#3b2a7a');
    sky.addColorStop(1, '#6d4bb8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 197 + 40) % W, (i * 89 + 15) % 200, 2, 2);

    for (const c of w.clouds) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 28 * c.s, c.y - 8 * c.s, 28 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 56 * c.s, c.y, 22 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of BUILDINGS) {
      ctx.fillStyle = '#1a1640';
      ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
      let i = 0;
      for (let wy = GROUND_Y - b.h + 10; wy < GROUND_Y - 14; wy += 18) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14, i++) {
          ctx.fillStyle = b.lit[i] ? 'rgba(255,220,80,0.9)' : 'rgba(80,70,140,0.6)';
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }

    ctx.fillStyle = '#2d5a1b';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#3a7a24';
    ctx.fillRect(0, GROUND_Y, W, 6);

    // targets still to come (the current one glows)
    s.targets.forEach((t, i) => {
      if (i < s.index || (i === s.index && s.phase === 'result' && s.last?.hit) || s.phase === 'done') return;
      const active = i === s.index;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.globalAlpha = active ? 1 : 0.35;
      if (active) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 22 + 8 * Math.sin(w.frame * 0.12); }
      ctx.font = `${t.radius * 2.2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', 0, 0);
      if (active) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(251,191,36,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, t.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });

    const { angle: a, power: p } = aimRef.current;
    // dotted aim path: only before the first shot at each target
    if (s.phase === 'aim' && s.shotsAtTarget === 0) {
      const path = simulate(a, p, null, 160).path;
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      path.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.restore();
    }

    // launcher + slingshot band
    const rad = (a * Math.PI) / 180;
    if (s.phase === 'aim') {
      const pull = 14 + (p / 100) * 46;
      ctx.strokeStyle = 'rgba(244,114,182,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(LAUNCH_X - 14, LAUNCH_Y + 10);
      ctx.lineTo(LAUNCH_X - Math.cos(rad) * pull, LAUNCH_Y + Math.sin(rad) * pull);
      ctx.lineTo(LAUNCH_X + 14, LAUNCH_Y + 10);
      ctx.stroke();
      ctx.save();
      ctx.translate(LAUNCH_X - Math.cos(rad) * pull * 0.6, LAUNCH_Y + Math.sin(rad) * pull * 0.6);
      ctx.rotate(-rad + Math.PI / 4);
      ctx.font = '34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(LAUNCH_X - 16, LAUNCH_Y + 10, 32, GROUND_Y - LAUNCH_Y - 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${a}° · ${p}`, LAUNCH_X, GROUND_Y + 30);

    // rocket in flight
    const f = w.flight;
    if (f) {
      f.trail.forEach((pt, i) => {
        ctx.globalAlpha = (i / f.trail.length) * 0.6;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (i / f.trail.length) * 8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.atan2(f.vy, f.vx) + Math.PI / 4);
      ctx.font = '34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);
      ctx.restore();
    }

    for (const pt of w.particles) {
      ctx.globalAlpha = pt.life / pt.max;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  };

  useGameLoop({
    tickHz: 60,
    running: status === 'playing',
    update,
    draw,
    onHidden: () => setStatus(st => (st === 'playing' ? 'paused' : st)),
  });

  /* ---------- slingshot drag (Pointer Events) ---------- */
  const toLogical = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'playing' || rsRef.current.phase !== 'aim') return;
    const { x, y } = toLogical(e);
    world.current.drag = { id: e.pointerId, sx: x, sy: y, cx: x, cy: y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = world.current.drag;
    if (!d || d.id !== e.pointerId) return;
    const { x, y } = toLogical(e);
    d.cx = x; d.cy = y;
    const lx = d.sx - x, ly = y - d.sy; // pull back = launch the other way (y up)
    const len = Math.hypot(lx, ly);
    if (len < 12) return;
    setAngle(clampAngle((Math.atan2(ly, lx) * 180) / Math.PI));
    setPower(clampPower(len * 0.6));
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = world.current.drag;
    if (!d || d.id !== e.pointerId) return;
    world.current.drag = null;
    if (e.type === 'pointerup' && Math.hypot(d.sx - d.cx, d.sy - d.cy) >= 24) launch();
  };

  // Debug hook for Playwright: ?debug&seed=1 → window.__game
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      start,
      aim: (a: number, p: number) => { setAngle(clampAngle(a)); setPower(clampPower(p)); aimRef.current = { angle: clampAngle(a), power: clampPower(p) }; },
      launch,
      get state() { return rsRef.current; },
      get status() { return status; },
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, launch, status]);

  const aiming = status === 'playing' && rs.phase === 'aim';
  const msg = rs.phase === 'result' && rs.last
    ? rs.last.hit
      ? { text: `🎯 HIT! +${rs.last.points}`, color: 'text-yellow-300' }
      : rs.last.outOfTries
        ? { text: '💫 Out of tries — next star!', color: 'text-sky-200' }
        : { text: `💨 So close! ${rs.triesLeft} ${rs.triesLeft === 1 ? 'try' : 'tries'} left`, color: 'text-sky-200' }
    : null;

  return (
    <GameShell
      gameId="rocket_launch"
      title="Rocket Launch"
      icon="🚀"
      xpScale={12}
      status={status}
      score={rs.score}
      round={round}
      overTitle={rs.hits === TARGETS_PER_ROUND ? 'Mission complete!' : 'Mission over — great flying!'}
      overStats={[
        { label: 'Stars hit', value: `⭐ ${rs.hits}/${TARGETS_PER_ROUND}` },
        { label: 'Spare-try bonus', value: `+${rs.score - rs.hits * 100}` },
      ]}
      startLabel="🚀 Launch!"
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-base text-violet-100 space-y-1">
          <li>👆 <b>Pull back</b> on the sky like a slingshot, then <b>let go</b> to launch.</li>
          <li>➕➖ Or use the buttons to set angle and power.</li>
          <li>⭐ Hit 5 stars. You get {TRIES_PER_TARGET} tries for each.</li>
          <li>🎯 The dotted line only shows on your first shot at each star!</li>
          <li>🏅 100 points a star + 30 for every try you didn't need.</li>
        </ul>
      }
    >
      <div className="absolute inset-0 game-surface flex flex-col items-center justify-center gap-3 p-3">
        <div className="flex flex-wrap justify-center gap-2 font-fredoka text-lg">
          <span className="rounded-full bg-black/35 px-4 py-1">🎯 Star {Math.min(rs.index + 1, TARGETS_PER_ROUND)}/{TARGETS_PER_ROUND}</span>
          <span className="rounded-full bg-black/35 px-4 py-1 text-yellow-300">⭐ {rs.score}</span>
          <span className="rounded-full bg-black/35 px-4 py-1" aria-label={`${rs.triesLeft} tries left`}>
            {'🚀'.repeat(Math.max(0, rs.triesLeft))}<span className="opacity-30">{'🚀'.repeat(Math.max(0, TRIES_PER_TARGET - rs.triesLeft))}</span>
          </span>
        </div>

        <div className="relative" style={{ width: `min(100%, calc((100dvh - 290px) * ${W / H}))` }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block w-full rounded-2xl border-2 border-fuchsia-400/40 shadow-2xl"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          <AnimatePresence>
            {msg && (
              <motion.div key={msg.text} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`absolute top-3 inset-x-0 text-center font-fredoka text-2xl md:text-3xl ${msg.color} pointer-events-none drop-shadow-lg`}>
                {msg.text}
              </motion.div>
            )}
            {aiming && rs.index === 0 && rs.shotsAtTarget === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute top-3 inset-x-0 text-center font-nunito text-lg text-white/90 pointer-events-none">
                👆 Pull back anywhere, then let go!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Stepper label="Angle" value={`${angle}°`} disabled={!aiming}
            onStep={d => setAngle(v => Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, v + d)))} />
          <Stepper label="Power" value={`${power}`} disabled={!aiming}
            onStep={d => setPower(v => Math.min(MAX_POWER, Math.max(MIN_POWER, v + d)))} />
          <button onClick={() => { playClick(); launch(); }} disabled={!aiming}
            className="min-h-[64px] px-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg active:scale-95 disabled:opacity-40">
            🚀 Launch
          </button>
        </div>
      </div>
    </GameShell>
  );
}

/** A −/+ pair with hold-to-repeat. */
function Stepper({ label, value, disabled, onStep }: { label: string; value: string; disabled: boolean; onStep: (d: number) => void }) {
  const timer = useRef<number | null>(null);
  const stop = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  const press = (d: number) => {
    if (disabled) return;
    stop();
    onStep(d);
    const repeat = (wait: number) => { timer.current = window.setTimeout(() => { onStep(d); repeat(60); }, wait); };
    repeat(380);
  };
  const btn = 'min-w-[56px] min-h-[56px] rounded-2xl bg-white/15 font-fredoka text-3xl active:bg-white/30 disabled:opacity-40';
  return (
    <div className="flex items-center gap-2 rounded-3xl bg-black/30 p-1.5">
      <button className={btn} disabled={disabled} aria-label={`Less ${label.toLowerCase()}`}
        onPointerDown={e => { e.preventDefault(); press(-1); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>−</button>
      <div className="w-20 text-center">
        <div className="font-nunito text-base text-violet-200 leading-none">{label}</div>
        <div className="font-fredoka text-2xl tabular-nums">{value}</div>
      </div>
      <button className={btn} disabled={disabled} aria-label={`More ${label.toLowerCase()}`}
        onPointerDown={e => { e.preventDefault(); press(1); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>+</button>
    </div>
  );
}
