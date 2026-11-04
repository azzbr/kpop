// 🏗️ Stack Lab (stack_lab): tap to drop pieces from a swinging crane and build the tallest tower
// that stands still. Rules and physics live in stackLabLogic.ts; this file draws and handles input.
import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import ConfettiBurst from '../ConfettiBurst';
import { useGameStore } from '../../store';
import { playClick, playCoin, playNote, playPop } from '../../utils/sounds';
import {
  createStackWorld, stepStack, dropPiece, rotatePiece, makeBody, hangingPos, secondsLeft, toCm,
  TICK_HZ, BASE_W, BASE_H, BASE_TOP, UNITS_PER_CM, MAX_HEARTS, PIECES,
} from './stackLabLogic';
import type { StackWorld, PieceKind, Hanging } from './stackLabLogic';

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

/** World units across the screen: the base (260) plus the crane's swing always fit. */
const VIEW_W = 560;
const MILESTONE_CM = 50;
const KIND_ICON: Record<PieceKind, string> = { cube: '🟧', plank: '➖', tall: '▮', jelly: '🍮', gem: '💎', hill: '⛰️' };

interface Hud { seconds: number; hearts: number; nowCm: number; bestCm: number; next: PieceKind; hanging: boolean; settling: boolean }
interface Float { text: string; y: number; life: number; color: string }

export default function StackLab() {
  const record = useGameStore(s => s.highScores.stack_lab ?? 0);
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud>({ seconds: 90, hearts: MAX_HEARTS, nowCm: 0, bestCm: 0, next: 'cube', hanging: true, settling: false });
  const [over, setOver] = useState({ score: 0, title: '', placed: 0, tumbles: 0 });
  const [party, setParty] = useState(0);

  const worldRef = useRef<StackWorld | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const holdRef = useRef(false);
  const camTop = useRef<number | null>(null);
  const floats = useRef<Float[]>([]);
  const milestone = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(canvasRef);

  const updateHud = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    setHud({
      seconds: secondsLeft(w), hearts: w.hearts, nowCm: w.currentCm, bestCm: w.bestCm,
      next: w.next.kind, hanging: !!w.hanging, settling: w.status === 'settling',
    });
  }, []);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    worldRef.current = createStackWorld(seed);
    camTop.current = null;
    floats.current = [];
    milestone.current = 0;
    updateHud();
    setRound(r => r + 1);
    setStatus('playing');
  }, [updateHud]);

  const float = (text: string, color = '#fde047') => {
    const w = worldRef.current;
    floats.current.push({ text, y: w ? Math.min(BASE_TOP, w.topY) - 40 : -60, life: 70, color });
  };

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    stepStack(w);
    for (const e of w.events) {
      if (e.type === 'land') playPop();
      else if (e.type === 'heart') {
        playNote(196, 0.25, 'sine', 0.12);
        float(e.hearts > 0 ? `Whoops! A tumble — ${e.hearts} ❤️ left` : 'Whoops! The tower tumbled!', '#fda4af');
      } else if (e.type === 'best') {
        const m = Math.floor(e.cm / MILESTONE_CM) * MILESTONE_CM;
        if (m > milestone.current) {
          milestone.current = m;
          playCoin();
          float(`🎉 ${m} cm tall!`);
          setParty(p => p + 1);
        } else {
          playNote(784, 0.12, 'triangle', 0.08);
        }
      } else if (e.type === 'timeUp') {
        playNote(523, 0.3, 'triangle', 0.1);
      }
    }
    if (w.tick % 6 === 0 || w.events.length) updateHud();
    if (w.status === 'over') {
      setOver({
        score: w.bestCm,
        title: w.overReason === 'hearts' ? 'The tower tumbled! 🧱' : "Time's up! 🏁",
        placed: w.pieces.length,
        tumbles: MAX_HEARTS - w.hearts,
      });
      setStatus('over');
    }
  }, [updateHud]);

  useGameLoop({
    tickHz: TICK_HZ,
    update: () => { if (!holdRef.current) tick(); },
    draw: alpha => draw(alpha),
    running: status === 'playing',
    onHidden: () => { if (statusRef.current === 'playing') setStatus('paused'); },
  });

  const drop = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    if (dropPiece(w)) { playClick(); updateHud(); }
  }, [updateHud]);

  const turn = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    if (rotatePiece(w)) playClick();
  }, []);

  // A world from the start, so the start card has the table and crane behind it.
  useEffect(() => { if (!worldRef.current) worldRef.current = createStackWorld(1); }, []);

  // Keyboard: Space / Enter / ↓ drops, R / ↑ turns.
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (statusRef.current !== 'playing') return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') { e.preventDefault(); drop(); }
      else if (e.code === 'KeyR' || e.code === 'ArrowUp') { e.preventDefault(); turn(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [drop, turn]);

  // ?debug: tests drive the world themselves.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      hold: (on = true) => { holdRef.current = on; },
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); },
      drop,
      turn,
      /** Puts the crane at world x (0 = the middle of the base) and drops. */
      dropAt: (x: number) => { const w = worldRef.current; if (w && w.hanging) { w.crane.x = x; drop(); } },
      bestCm: () => worldRef.current?.bestCm ?? 0,
    };
    (window as unknown as { __stack: typeof api }).__stack = api;
    return () => { delete (window as unknown as { __stack?: unknown }).__stack; };
  }, [tick, drop, turn]);

  function draw(alpha: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(1, '#4c1d95');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);
    const w = worldRef.current;
    if (!w || cw === 0) return;

    const a = statusRef.current === 'playing' ? alpha : 1;
    const z = Math.min(cw / VIEW_W, ch / 640);
    const viewH = ch / z;
    const craneY = w.crane.py + (w.crane.y - w.crane.py) * a;
    const craneX = w.crane.px + (w.crane.x - w.crane.px) * a;
    // Camera: the crane rail just under the timer and height boxes (about 125 px of screen); while
    // the tower is short, the base sits near the bottom, above the Turn button (about 130 px).
    const want = Math.min(craneY - 40 - 125 / z, BASE_TOP + BASE_H + 130 / z - viewH);
    camTop.current = camTop.current === null ? want : camTop.current + (want - camTop.current) * 0.08;
    const top = camTop.current;
    const sx = (x: number) => cw / 2 + x * z;
    const sy = (y: number) => (y - top) * z;

    // Height ruler on the left: a mark every 10 cm, a number every 50.
    ctx.font = `700 ${Math.max(11, 13 * z)}px Nunito, sans-serif`;
    ctx.textBaseline = 'middle';
    const cmTop = Math.ceil(toCm(top));
    const cmBottom = Math.max(0, Math.floor(toCm(top + viewH)));
    for (let cm = Math.floor(cmBottom / 10) * 10; cm <= cmTop + 10; cm += 10) {
      const y = sy(BASE_TOP - cm * UNITS_PER_CM);
      const big = cm % 50 === 0;
      ctx.strokeStyle = big ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(big ? 26 : 14, y); ctx.stroke();
      if (big && cm > 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'left'; ctx.fillText(`${cm} cm`, 30, y); }
    }
    // Lines for the best this round and her record.
    const line = (cm: number, label: string, color: string) => {
      if (cm <= 0) return;
      const y = sy(BASE_TOP - cm * UNITS_PER_CM);
      if (y < -10 || y > ch + 10) return;
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(cw, y); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(label, cw - 8, y - 12);
    };
    line(record, `⭐ Record ${record} cm`, 'rgba(250,204,21,0.8)');
    if (w.bestCm !== record) line(w.bestCm, `📏 ${w.bestCm} cm`, 'rgba(134,239,172,0.9)');

    // The lab table (base) on its stand.
    const bx = sx(-BASE_W / 2), by = sy(BASE_TOP), bw = BASE_W * z, bh = BASE_H * z;
    ctx.fillStyle = '#334155';
    ctx.fillRect(sx(-30), by + bh, 60 * z, ch);
    roundRect(ctx, bx, by, bw, bh, 8 * z);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.fillStyle = '#facc15';
    for (let i = 0; i < 8; i++) {
      ctx.save();
      roundRect(ctx, bx, by, bw, bh, 8 * z);
      ctx.clip();
      ctx.beginPath();
      const x0 = bx + i * (bw / 7) - bh;
      ctx.moveTo(x0, by + bh); ctx.lineTo(x0 + bh * 0.6, by + bh); ctx.lineTo(x0 + bh * 1.6, by); ctx.lineTo(x0 + bh, by);
      ctx.fill();
      ctx.restore();
    }

    // Pieces.
    for (const p of w.pieces) {
      const b = p.body;
      const x = p.prev.x + (b.position.x - p.prev.x) * a;
      const y = p.prev.y + (b.position.y - p.prev.y) * a;
      const ang = p.prev.angle + (b.angle - p.prev.angle) * a;
      const local = b.vertices.map(v => rotate(v.x - b.position.x, v.y - b.position.y, -b.angle));
      drawPiece(ctx, p.kind, p.color, p.face, local, sx(x), sy(y), ang, z, b.speed > 3);
    }

    // The crane: rail, trolley, rope and the hanging piece (with a dotted guide down to the tower).
    const railY = sy(craneY - 40);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, railY - 6 * z, cw, 12 * z);
    ctx.fillStyle = '#78350f';
    for (let x = 0; x < cw; x += 40) ctx.fillRect(x, railY - 2 * z, 18, 4 * z);
    const tx = sx(craneX);
    roundRect(ctx, tx - 26 * z, railY - 14 * z, 52 * z, 24 * z, 6 * z);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    const h = w.hanging;
    const hp = hangingPos(w);
    const hy = sy(craneY + (hp.y - w.crane.y));
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath(); ctx.moveTo(tx, railY + 10 * z); ctx.lineTo(tx, h ? hy - pieceHalfHeight(h) * z : railY + 34 * z); ctx.stroke();
    // Hook
    ctx.beginPath(); ctx.arc(tx, (h ? hy - pieceHalfHeight(h) * z : railY + 40 * z) - 4 * z, 6 * z, 0, Math.PI); ctx.stroke();
    if (h) {
      ctx.save();
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, hy + pieceHalfHeight(h) * z + 6); ctx.lineTo(tx, sy(Math.min(BASE_TOP, w.topY))); ctx.stroke();
      ctx.restore();
      const local = hangingShape(h);
      drawPiece(ctx, h.kind, h.color, h.face, local, tx, hy, h.angle, z, false);
    }

    // Floating messages.
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.max(18, 24 * z)}px Fredoka, Nunito, sans-serif`;
    floats.current = floats.current.filter(f => f.life > 0);
    for (const f of floats.current) {
      if (statusRef.current === 'playing') { f.life -= 1; f.y -= 0.6; }
      ctx.globalAlpha = Math.min(1, f.life / 25);
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, cw / 2, sy(f.y));
      ctx.fillText(f.text, cw / 2, sy(f.y));
      ctx.globalAlpha = 1;
    }
  }

  const playing = status === 'playing' || status === 'paused';

  return (
    <GameShell
      gameId="stack_lab"
      title="Stack Lab"
      icon="🏗️"
      xpScale={2}
      status={status}
      score={over.score}
      round={round}
      formatScore={n => `${n} cm`}
      overTitle={over.title}
      overStats={[
        { label: 'Pieces standing', value: String(over.placed) },
        { label: 'Tumbles', value: String(over.tumbles) },
      ]}
      startLabel="▶ Start building"
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-lg text-violet-100 space-y-1">
          <li>🏗️ The crane swings a piece over the table.</li>
          <li>👆 <b>Tap anywhere</b> to drop it (or press Space).</li>
          <li>🔄 <b>Turn</b> spins the piece before you drop it.</li>
          <li>📏 Your height only counts when the tower <b>stands still</b>.</li>
          <li>❤️ 3 tumbles and the round ends · ⏱️ 90 seconds</li>
        </ul>
      }
    >
      {party > 0 && <ConfettiBurst key={party} count={50} durationMs={1800} />}
      <div
        className="absolute inset-0 game-surface"
        onPointerDown={e => { if (e.button === 0 || e.pointerType !== 'mouse') drop(); }}
        data-testid="stack-area"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {playing && (
          <>
            <div className="absolute top-2 left-2 rounded-2xl bg-black/45 px-3 py-2 font-fredoka pointer-events-none">
              <div className="text-2xl tabular-nums">⏱️ {Math.floor(hud.seconds / 60)}:{String(hud.seconds % 60).padStart(2, '0')}</div>
              <div className="text-xl" aria-label={`${hud.hearts} hearts left`}>{'❤️'.repeat(hud.hearts)}{'🤍'.repeat(MAX_HEARTS - hud.hearts)}</div>
            </div>
            <div className="absolute top-2 right-2 rounded-2xl bg-black/45 px-3 py-2 font-fredoka text-right pointer-events-none">
              <div className="text-2xl" data-testid="stack-best">📏 {hud.bestCm} cm</div>
              <div className="text-base text-violet-200">Next: {KIND_ICON[hud.next]} {PIECES[hud.next].name}</div>
            </div>
            {hud.settling && (
              <div className="absolute inset-x-0 top-24 flex justify-center pointer-events-none">
                <div className="rounded-2xl bg-black/60 px-5 py-3 font-fredoka text-2xl">⏱️ Time's up! Checking the tower…</div>
              </div>
            )}
            <button
              className="absolute bottom-4 left-4 min-w-[96px] min-h-[96px] rounded-full bg-sky-500/90 border-4 border-white/70 font-fredoka text-lg flex flex-col items-center justify-center disabled:opacity-40"
              style={{ marginBottom: 'env(safe-area-inset-bottom)', touchAction: 'none' }}
              onPointerDown={e => { e.stopPropagation(); turn(); }}
              onClick={e => { if (e.detail === 0) turn(); }}
              disabled={!hud.hanging || hud.settling}
              aria-label="Turn the piece"
            >
              <span className="text-3xl leading-none">🔄</span>Turn
            </button>
            {round === 1 && hud.bestCm === 0 && hud.hanging && !hud.settling && (
              <div className="absolute top-28 inset-x-0 flex justify-center pointer-events-none">
                <div className="rounded-full bg-black/50 px-4 py-2 font-nunito text-lg">👆 Tap anywhere to drop</div>
              </div>
            )}
          </>
        )}
      </div>
    </GameShell>
  );
}

function rotate(x: number, y: number, ang: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** The piece's outline at angle 0, centred on its middle (the same shape matter-js uses). */
const shapeCache = new Map<PieceKind, { x: number; y: number }[]>();
function hangingShape(h: Hanging) {
  let s = shapeCache.get(h.kind);
  if (!s) {
    const b = makeBody(h.kind, 0, 0);
    s = b.vertices.map(v => ({ x: v.x - b.position.x, y: v.y - b.position.y }));
    shapeCache.set(h.kind, s);
  }
  return s;
}

function pieceHalfHeight(h: Hanging) {
  const p = PIECES[h.kind];
  const turned = Math.round(h.angle / (Math.PI / 2)) % 2 === 1;
  return (turned ? p.w : p.h) / 2;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(Math.max(0, Math.min(255, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

/** A piece with a rounded outline, a shine and a cute face; `scared` when it's falling fast. */
function drawPiece(
  ctx: CanvasRenderingContext2D, kind: PieceKind, color: string, face: number,
  local: { x: number; y: number }[], x: number, y: number, ang: number, z: number, scared: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(z, z);
  ctx.beginPath();
  local.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = kind === 'jelly' ? 14 : 7;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.stroke();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = shade(color, -0.45);
  ctx.stroke();
  // Shine
  const p = PIECES[kind];
  ctx.fillStyle = kind === 'jelly' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-p.w * 0.22, -p.h * 0.25, Math.max(4, p.w * 0.14), Math.max(3, p.h * 0.1), -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'gem') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < local.length; i += 2) { ctx.moveTo(0, 0); ctx.lineTo(local[i].x * 0.6, local[i].y * 0.6); }
    ctx.stroke();
  }
  // Face (stays upright-ish: drawn in the piece's frame, so it tumbles with it — that's the fun).
  const s = Math.min(p.w, p.h) / 64;
  const ey = kind === 'hill' ? 4 : -4 * s;
  ctx.fillStyle = '#1f2937';
  const eye = (ex: number) => {
    if (face === 2 && ex > 0 && !scared) { ctx.fillRect(ex - 5 * s, ey - 1, 10 * s, 3 * s); return; }
    ctx.beginPath(); ctx.arc(ex, ey, (scared ? 6 : 4.5) * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + 1.5 * s, ey - 1.5 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f2937';
  };
  eye(-11 * s); eye(11 * s);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (scared || face === 3) ctx.arc(0, ey + 13 * s, 4.5 * s, 0, Math.PI * 2);
  else if (face === 1) { ctx.arc(0, ey + 9 * s, 7 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); ctx.fillStyle = '#7f1d1d'; ctx.fill(); }
  else ctx.arc(0, ey + 7 * s, 7 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Rosy cheeks
  ctx.fillStyle = 'rgba(244,114,182,0.45)';
  ctx.beginPath(); ctx.arc(-18 * s, ey + 8 * s, 4 * s, 0, Math.PI * 2); ctx.arc(18 * s, ey + 8 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
