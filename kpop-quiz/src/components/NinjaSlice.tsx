import { useCallback, useRef, useState } from 'react';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../games/engine/useGameLoop';
import { playPop, playWrong, playUnlock } from '../utils/sounds';
import { BOMB_CHANCE, pickFruit, comboMult, bladeHits } from './games/ninjaSliceLogic';

// Ninja Slice: swipe to slice fruit, dodge bombs, 45 seconds. Saved as 'ninja_slice' (points).
// Logic ticks at a fixed 60 Hz (useGameLoop); drawing is in an 800×460 logical space.

const W = 800, H = 460;
const GRAVITY = 0.32;
const GAME_TIME = 45;
const MAX_LIVES = 3;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface SliceItem {
  x: number; y: number; vx: number; vy: number; radius: number;
  emoji: string; pts: number; isBomb: boolean; sliced: boolean; gone: boolean; sliceT: number;
}
interface TrailPt { x: number; y: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface FloatTxt { x: number; y: number; vy: number; life: number; text: string; color: string }

function freshState() {
  return {
    items: [] as SliceItem[],
    particles: [] as Particle[],
    floats: [] as FloatTxt[],
    trail: [] as TrailPt[],
    score: 0, combo: 0, comboTimer: 0, bestCombo: 0, sliced: 0,
    lives: MAX_LIVES, timeLeft: GAME_TIME, tickSec: 0,
    frame: 0, spawnTimer: 40, flashRed: 0, bgX: 0,
    // blade: where the finger is now, and where it was at the last tick
    down: false, pid: -1, mx: 0, my: 0, lx: 0, ly: 0,
    ended: false,
  };
}

export default function NinjaSlice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(canvasRef);
  const st = useRef(freshState());
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [over, setOver] = useState({ score: 0, title: '', sliced: 0, combo: 0 });

  const start = useCallback(() => {
    st.current = freshState();
    setRound(r => r + 1);
    setStatus('playing');
  }, []);

  const end = (title: string) => {
    const s = st.current;
    if (s.ended) return;
    s.ended = true;
    s.down = false;
    setOver({ score: s.score, title, sliced: s.sliced, combo: s.bestCombo });
    setStatus('over');
  };

  const spawnItem = () => {
    const s = st.current;
    const isBomb = Math.random() < BOMB_CHANCE;
    const f = pickFruit(Math.random());
    s.items.push({
      x: rnd(80, W - 80), y: H + 30, vx: rnd(-2.5, 2.5), vy: rnd(-14, -10),
      radius: isBomb ? 34 : 30,
      emoji: isBomb ? '💣' : f.emoji, pts: isBomb ? 0 : f.pts, isBomb,
      sliced: false, gone: false, sliceT: 0,
    });
  };

  const burst = (x: number, y: number, color: string, n = 12) => {
    const s = st.current;
    for (let i = 0; i < n; i++) s.particles.push({ x, y, vx: rnd(-6, 6), vy: rnd(-8, -1), life: rnd(18, 36), max: 36, color, size: rnd(3, 7) });
  };

  const checkSlice = () => {
    const s = st.current;
    if (!s.down) return;
    for (const item of s.items) {
      if (item.sliced || item.gone) continue;
      if (!bladeHits(s.lx, s.ly, s.mx, s.my, item.x, item.y, item.radius)) continue;
      item.sliced = true;
      if (item.isBomb) {
        s.lives--;
        s.combo = 0;
        s.flashRed = 22;
        playWrong();
        burst(item.x, item.y, '#ef4444', 16);
        s.floats.push({ x: item.x - 30, y: item.y, vy: -2.2, life: 50, text: '💣 Oops!', color: '#f87171' });
        if (s.lives <= 0) { end('Out of hearts!'); return; }
      } else {
        s.combo++;
        s.sliced++;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.comboTimer = 80;
        const cm = comboMult(s.combo);
        const earned = item.pts * cm;
        s.score += earned;
        playPop();
        if (cm > 1) playUnlock();
        const color = item.pts >= 20 ? '#fbbf24' : '#86efac';
        burst(item.x, item.y, color, 10);
        s.floats.push({ x: item.x - 16, y: item.y - 10, vy: -2, life: 45, text: cm > 1 ? `+${earned} x${cm}🔥` : `+${earned}`, color });
      }
    }
  };

  const update = () => {
    const s = st.current;
    if (s.ended) return;
    s.frame++;
    s.bgX = (s.bgX - 0.4) % 80;
    if (s.comboTimer > 0 && --s.comboTimer === 0) s.combo = 0;
    if (s.flashRed > 0) s.flashRed--;

    if (++s.tickSec >= 60) {
      s.tickSec = 0;
      s.timeLeft--;
      if (s.timeLeft <= 0) { end("Time's up!"); return; }
    }

    if (--s.spawnTimer <= 0) {
      spawnItem();
      if (s.timeLeft < 20) spawnItem();
      s.spawnTimer = Math.max(18, 48 - Math.floor((GAME_TIME - s.timeLeft) * 0.6));
    }

    for (const item of s.items) {
      if (item.gone) continue;
      if (item.sliced) { if (++item.sliceT > 30) item.gone = true; continue; }
      item.vy += GRAVITY;
      item.x += item.vx; item.y += item.vy;
      if (item.y > H + 60) item.gone = true;
    }
    s.items = s.items.filter(i => !i.gone);

    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.life--; }
    s.particles = s.particles.filter(p => p.life > 0);
    for (const f of s.floats) { f.x += 0.3; f.y += f.vy; f.life--; }
    s.floats = s.floats.filter(f => f.life > 0);

    if (s.down) s.trail.push({ x: s.mx, y: s.my, t: 12 });
    for (const t of s.trail) t.t--;
    s.trail = s.trail.filter(t => t.t > 0);

    checkSlice();
    s.lx = s.mx; s.ly = s.my;
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { w: cw, h: ch, dpr } = size.current;
    if (!ctx || !cw || !ch) return;
    ctx.setTransform((dpr * cw) / W, 0, 0, (dpr * ch) / H, 0, 0);
    const s = st.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e');
    bg.addColorStop(1, '#0d0020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(130,60,200,0.15)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = s.bgX; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    for (const p of s.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // blade trail
    if (s.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = '#e879f9';
      ctx.shadowBlur = 10;
      for (let i = 1; i < s.trail.length; i++) {
        const a = s.trail[i - 1], b = s.trail[i];
        ctx.globalAlpha = (b.t / 12) * 0.9;
        ctx.strokeStyle = i > s.trail.length - 4 ? '#ffffff' : '#e879f9';
        ctx.lineWidth = 2 + (i / s.trail.length) * 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }

    for (const item of s.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.sliced) {
        ctx.globalAlpha = 1 - item.sliceT / 30;
        ctx.scale(1 + item.sliceT * 0.04, 1 + item.sliceT * 0.04);
      }
      if (!item.isBomb && item.pts >= 20) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20; }
      else if (item.isBomb) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 18 * (0.6 + 0.4 * Math.sin(s.frame * 0.3)); }
      ctx.font = `${item.radius * 1.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, 0, 0);
      ctx.restore();
    }

    for (const f of s.floats) {
      ctx.globalAlpha = Math.min(1, f.life / 20);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (s.flashRed > 0) {
      ctx.fillStyle = `rgba(239,68,68,${(s.flashRed / 22) * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⭐ ${s.score}`, 16, 42);
    ctx.textAlign = 'center';
    ctx.fillStyle = s.timeLeft <= 10 ? '#f87171' : '#fff';
    ctx.font = `bold ${s.timeLeft <= 10 ? 40 : 34}px Fredoka, sans-serif`;
    ctx.fillText(`⏱️ ${s.timeLeft}s`, W / 2, 42);
    ctx.textAlign = 'right';
    ctx.font = '28px serif';
    ctx.fillText('❤️'.repeat(Math.max(0, s.lives)) + '🤍'.repeat(MAX_LIVES - Math.max(0, s.lives)), W - 14, 42);
    if (s.combo >= 3) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fb923c';
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.fillText(`🔥 COMBO x${comboMult(s.combo)}!`, 16, 78);
    }
    ctx.textAlign = 'left';
  };

  useGameLoop({
    tickHz: 60,
    running: status === 'playing',
    update,
    draw,
    onHidden: () => setStatus(v => (v === 'playing' ? 'paused' : v)),
  });

  /* ---------- blade input (Pointer Events: one path for finger, pen and mouse) ---------- */
  const toLogical = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'playing') return;
    const s = st.current;
    if (s.down && s.pid !== e.pointerId) return; // one blade at a time
    const { x, y } = toLogical(e);
    s.down = true; s.pid = e.pointerId;
    s.mx = s.lx = x; s.my = s.ly = y;
    s.trail = [];
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (!s.down || e.pointerId !== s.pid) return;
    const { x, y } = toLogical(e);
    s.mx = x; s.my = y;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerId === s.pid) s.down = false;
  };

  return (
    <GameShell
      gameId="ninja_slice"
      title="Ninja Slice"
      icon="🥷"
      xpScale={10}
      status={status}
      score={over.score}
      round={round}
      overTitle={over.title}
      overStats={[
        { label: 'Fruit sliced', value: `🍉 ${over.sliced}` },
        { label: 'Best combo', value: `🔥 ${over.combo}` },
      ]}
      startLabel="🥷 Start slicing!"
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-base text-violet-100 space-y-1">
          <li>👆 <b>Swipe</b> across the fruit to slice it.</li>
          <li>🍍 🥥 Golden fruit are worth the most!</li>
          <li>🔥 Slice fruit quickly in a row for a combo.</li>
          <li>💣 Don't touch the bombs — you have 3 hearts.</li>
          <li>⏱️ You have {GAME_TIME} seconds.</li>
        </ul>
      }
    >
      <div className="absolute inset-0 game-surface flex items-center justify-center p-3">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block rounded-2xl border-2 border-fuchsia-400/40 shadow-2xl touch-none"
          style={{ width: `min(100%, calc((100dvh - 110px) * ${W / H}))`, aspectRatio: `${W} / ${H}` }}
        />
      </div>
    </GameShell>
  );
}
