// ❄️ Snow Catch (snow_catch) — the Winter Wonderland mini-game, opened from the event banner.
// Slide the basket (drag anywhere, or ← →) to catch falling snowflakes for 30 seconds; ✨ golden
// ones count 3. During the winter event each flake also pays +1 🪙, up to 30 coins a day.
// Rules: snowCatchLogic.ts. This file draws, handles input and pays the daily bonus.
import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import { useGameStore } from '../../store';
import { playCoin, playNote } from '../../utils/sounds';
import { localDateKey } from '../../utils/dates';
import { activeEvent } from '../../events/events';
import {
  createSnowWorld, stepSnow, setTarget, setKeyDir, secondsLeft, dailyBonus,
  TICK_HZ, FIELD_W, FIELD_H, BASKET_Y, BASKET_W, FLAKE_R, DAILY_BONUS_CAP,
} from './snowCatchLogic';
import type { SnowWorld } from './snowCatchLogic';

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');
/** Content key: today's winter bonus so far, { d: date, c: coins }. */
const BONUS_KEY = 'snow_catch_bonus';

function bonusToday(today: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(BONUS_KEY) ?? 'null') as { d?: string; c?: number } | null;
    return v && v.d === today && typeof v.c === 'number' ? v.c : 0;
  } catch { return 0; }
}

interface Float { text: string; x: number; y: number; life: number; color: string }
interface Hud { seconds: number; score: number }
/** Background snow (decoration only, not catchable). */
const BG = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.3) % 1, y: (i * 61.7) % 1, r: 1 + (i % 3), v: 0.0006 + (i % 5) * 0.0002 }));

export default function SnowCatch() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud>({ seconds: 30, score: 0 });
  const [over, setOver] = useState({ score: 0, caught: 0, golden: 0, bonus: 0, capped: false });
  const winter = activeEvent(localDateKey())?.id === 'winter';

  const worldRef = useRef<SnowWorld | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const holdRef = useRef(false);
  const floats = useRef<Float[]>([]);
  const keys = useRef({ left: false, right: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(canvasRef);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    worldRef.current = createSnowWorld(seed);
    floats.current = [];
    setHud({ seconds: 30, score: 0 });
    setRound(r => r + 1);
    setStatus('playing');
  }, []);

  const finish = useCallback((w: SnowWorld) => {
    let bonus = 0;
    let capped = false;
    if (activeEvent(localDateKey())?.id === 'winter') {
      const today = localDateKey();
      const already = bonusToday(today);
      bonus = dailyBonus(w.caught, already);
      capped = already + bonus >= DAILY_BONUS_CAP;
      if (bonus > 0) {
        const s = useGameStore.getState();
        s.setUserCurrency(s.userCurrency + bonus);
        try { localStorage.setItem(BONUS_KEY, JSON.stringify({ d: today, c: already + bonus })); } catch { /* private mode */ }
      }
    }
    setOver({ score: w.score, caught: w.caught, golden: w.golden, bonus, capped });
    setStatus('over');
  }, []);

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    if (w.target === null) setKeyDir(w, keys.current.left === keys.current.right ? 0 : keys.current.left ? -1 : 1);
    stepSnow(w);
    for (const e of w.events) {
      if (e.type === 'catch') {
        if (e.kind === 'gold') playCoin(); else playNote(1046.5 + (w.caught % 5) * 110, 0.08, 'triangle', 0.06);
        floats.current.push({ text: `+${e.points}`, x: e.x, y: BASKET_Y - 20, life: 30, color: e.kind === 'gold' ? '#fde047' : '#e0f2fe' });
      }
    }
    if (w.tick % 5 === 0 || w.events.length) setHud({ seconds: secondsLeft(w), score: w.score });
    if (w.status === 'over') finish(w);
  }, [finish]);

  useGameLoop({
    tickHz: TICK_HZ,
    update: () => { if (!holdRef.current) tick(); },
    draw: alpha => draw(alpha),
    running: status === 'playing',
    onHidden: () => { if (statusRef.current === 'playing') setStatus('paused'); },
  });

  // A world from the start, so the start card has the basket and the sky behind it.
  useEffect(() => { if (!worldRef.current) worldRef.current = createSnowWorld(1); }, []);

  // Keys: ← → or A / D slide the basket.
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.current.left = on; e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.current.right = on; e.preventDefault(); }
      else return;
      const w = worldRef.current;
      if (w && on) setTarget(w, null);
    };
    const kd = (e: KeyboardEvent) => { if (statusRef.current === 'playing') set(e, true); };
    const ku = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  /** Screen → world: the field is scaled to fit and centred (same maths as draw). */
  const layout = () => {
    const { w: cw, h: ch } = size.current;
    const z = Math.min(cw / FIELD_W, ch / FIELD_H);
    return { z, ox: (cw - FIELD_W * z) / 2, oy: (ch - FIELD_H * z) * 0.35 };
  };

  const pointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    if (e.type === 'pointermove' && e.pointerType === 'mouse' && e.buttons === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { z, ox } = layout();
    setTarget(w, (e.clientX - rect.left - ox) / z);
  };
  const release = () => { const w = worldRef.current; if (w) setTarget(w, null); };

  // ?debug: tests drive the world themselves.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      hold: (on = true) => { holdRef.current = on; },
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); },
      /** Puts the finger at world x (0–400), or lifts it with null. */
      moveTo: (x: number | null) => { const w = worldRef.current; if (w) setTarget(w, x); },
      /** Plays on until the end, chasing the lowest flake each tick. */
      autoplay: () => {
        const w = worldRef.current;
        while (w && statusRef.current === 'playing' && w.status === 'playing') {
          const next = w.flakes.filter(f => f.y < BASKET_Y).sort((a, b) => b.y - a.y)[0];
          setTarget(w, next ? next.x : null);
          tick();
        }
      },
      caught: () => worldRef.current?.caught ?? 0,
      score: () => worldRef.current?.score ?? 0,
    };
    (window as unknown as { __snow: typeof api }).__snow = api;
    return () => { delete (window as unknown as { __snow?: unknown }).__snow; };
  }, [tick]);

  function draw(alpha: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#0c1445');
    sky.addColorStop(0.7, '#1e3a8a');
    sky.addColorStop(1, '#3b82f6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);
    const w = worldRef.current;
    if (!w || cw === 0) return;
    const a = statusRef.current === 'playing' ? alpha : 1;
    const { z, ox, oy } = layout();
    const sx = (x: number) => ox + x * z;
    const sy = (y: number) => oy + y * z;
    const t = performance.now();

    // Moon and soft background snow (decoration).
    ctx.fillStyle = 'rgba(254,249,195,0.9)';
    // (below the score box at the top right)
    ctx.beginPath(); ctx.arc(cw - 70, 180, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const b of BG) {
      const y = ((b.y + t * b.v * (statusRef.current === 'playing' ? 1 : 0.3)) % 1) * ch;
      ctx.beginPath(); ctx.arc(b.x * cw, y, b.r, 0, Math.PI * 2); ctx.fill();
    }

    // Snowy ground and pine trees at the sides.
    const groundY = sy(BASKET_Y + 58);
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(0, groundY + 10);
    for (let x = 0; x <= cw; x += 40) ctx.quadraticCurveTo(x + 20, groundY - 8, x + 40, groundY + 10);
    ctx.lineTo(cw, ch); ctx.lineTo(0, ch); ctx.closePath(); ctx.fill();
    const tree = (x: number, s: number) => {
      ctx.fillStyle = '#065f46';
      for (let i = 0; i < 3; i++) {
        const ty = groundY - s * (0.5 + i * 0.32);
        ctx.beginPath(); ctx.moveTo(x, ty - s * 0.42); ctx.lineTo(x - s * (0.38 - i * 0.06), ty + s * 0.1); ctx.lineTo(x + s * (0.38 - i * 0.06), ty + s * 0.1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x - s * 0.18, ty - s * 0.05, s * 0.36, s * 0.05);
        ctx.fillStyle = '#065f46';
      }
    };
    const treeS = 90 * z;
    if (ox > treeS * 0.5) { tree(ox * 0.5, Math.min(treeS, ox * 1.2)); tree(cw - ox * 0.5, Math.min(treeS, ox * 1.2)); }

    // Flakes.
    for (const f of w.flakes) {
      const x = sx(f.px + (f.x - f.px) * a);
      const y = sy(f.py + (f.y - f.py) * a);
      const fade = Math.min(1, (f.y + FLAKE_R + 10) / 50);
      drawFlake(ctx, x, y, FLAKE_R * z * (f.kind === 'gold' ? 1.15 : 1), f.id * 0.7 + w.tick * f.spin, f.kind === 'gold', Math.max(0, fade));
    }

    // The basket.
    const bx = sx(w.prevBasketX + (w.basketX - w.prevBasketX) * a);
    const by = sy(BASKET_Y);
    const bw = BASKET_W * z;
    const bh = 46 * z;
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by); ctx.lineTo(bx + bw / 2, by); ctx.lineTo(bx + bw * 0.4, by + bh); ctx.lineTo(bx - bw * 0.4, by + bh); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(2, 3 * z);
    for (let i = 1; i < 4; i++) {
      const yy = by + (bh * i) / 4;
      const half = bw / 2 - (bw * 0.1 * i) / 4;
      ctx.beginPath(); ctx.moveTo(bx - half, yy); ctx.lineTo(bx + half, yy); ctx.stroke();
    }
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.roundRect(bx - bw / 2 - 4 * z, by - 6 * z, bw + 8 * z, 10 * z, 5 * z); ctx.fill();
    // A red scarf bow on the basket.
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(bx, by + bh * 0.45, 6 * z, 0, Math.PI * 2); ctx.fill();

    // Floating +1 / +3.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.max(16, 22 * z)}px Fredoka, Nunito, sans-serif`;
    floats.current = floats.current.filter(f => f.life > 0);
    for (const f of floats.current) {
      if (statusRef.current === 'playing') { f.life -= 1; f.y -= 1.2; }
      ctx.globalAlpha = Math.min(1, f.life / 12);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx(f.x), sy(f.y));
      ctx.globalAlpha = 1;
    }
  }

  const playing = status === 'playing' || status === 'paused';

  return (
    <GameShell
      gameId="snow_catch"
      title="Snow Catch"
      icon="❄️"
      xpScale={1.25}
      status={status}
      score={over.score}
      round={round}
      overTitle={over.score >= 40 ? 'What a snowstorm! ❄️' : 'Lovely catching! ⛄'}
      overStats={[
        { label: 'Snowflakes caught', value: String(over.caught) },
        { label: '✨ Golden ones', value: String(over.golden) },
      ]}
      overExtra={winter ? (
        <p className="font-fredoka text-lg text-sky-200 mb-2" data-testid="snow-bonus">
          {over.bonus > 0 ? `❄️ Winter bonus: +${over.bonus} 🪙` : '❄️ You got all of today’s winter bonus — come back tomorrow!'}
          {over.bonus > 0 && over.capped ? ' (that’s all for today!)' : ''}
        </p>
      ) : null}
      startLabel="▶ Let it snow!"
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-lg text-sky-100 space-y-1">
          <li>❄️ Snowflakes drift down from the sky.</li>
          <li>👉 <b>Drag anywhere</b> — the basket follows your finger (or use ← →).</li>
          <li>✨ Golden flakes count <b>3</b>!</li>
          <li>⏱️ 30 seconds of snow</li>
          {winter && <li>🪙 Winter bonus: +1 coin a flake, up to {DAILY_BONUS_CAP} a day</li>}
        </ul>
      }
    >
      <div
        className="absolute inset-0 game-surface"
        style={{ touchAction: 'none' }}
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); pointer(e); }}
        onPointerMove={pointer}
        onPointerUp={release}
        onPointerCancel={release}
        data-testid="snow-area"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {playing && (
          <div className="absolute top-2 inset-x-2 flex justify-between pointer-events-none">
            <div className="rounded-2xl bg-black/40 px-3 py-2 font-fredoka text-2xl tabular-nums">⏱️ {hud.seconds}</div>
            <div className="rounded-2xl bg-black/40 px-3 py-2 font-fredoka text-2xl tabular-nums" data-testid="snow-score">❄️ {hud.score}</div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

/** A six-armed snowflake (golden ones glow). */
function drawFlake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, gold: boolean, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (gold) {
    ctx.shadowColor = 'rgba(253,224,71,0.9)';
    ctx.shadowBlur = r;
  }
  ctx.strokeStyle = gold ? '#facc15' : '#ffffff';
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.25, -r * 0.8);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.25, -r * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = gold ? '#fef08a' : '#e0f2fe';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
