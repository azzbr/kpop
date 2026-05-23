import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playPop, playWrong, playWin, playUnlock, playClick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const W = 800, H = 460;
const GRAVITY = 0.32;
const GAME_TIME = 45;
const MAX_LIVES = 3;

const ITEMS = [
  { emoji: '🎤', pts: 10, prob: 0.24 },
  { emoji: '⭐', pts: 15, prob: 0.20 },
  { emoji: '💿', pts: 8,  prob: 0.22 },
  { emoji: '🎵', pts: 6,  prob: 0.16 },
  { emoji: '🎁', pts: 30, prob: 0.06 },
  { emoji: '🪩', pts: 20, prob: 0.08 },
  { emoji: '🎶', pts: 7,  prob: 0.14 },
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface SliceItem {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  emoji: string; pts: number;
  isBomb: boolean;
  sliced: boolean;
  gone: boolean;
  sliceT: number; // frames since sliced, for anim
}

interface TrailPt { x: number; y: number; t: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface FloatTxt { x: number; y: number; vy: number; life: number; text: string; color: string; }
interface SlashSeg { x1: number; y1: number; x2: number; y2: number; life: number; }

const NinjaSlice: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    items: [] as SliceItem[],
    particles: [] as Particle[],
    floats: [] as FloatTxt[],
    slashes: [] as SlashSeg[],
    trail: [] as TrailPt[],
    score: 0, combo: 0, comboTimer: 0,
    lives: MAX_LIVES, timeLeft: GAME_TIME,
    frame: 0, spawnTimer: 40,
    running: false, over: false,
    mouseDown: false, mx: 0, my: 0, prevMx: 0, prevMy: 0,
    idCounter: 0,
    flashRed: 0,
    bgX: 0,
  });
  const controlsRef = useRef<{ start: () => void } | null>(null);
  const [status, setStatus] = useState<'ready' | 'playing' | 'over'>('ready');
  const [overInfo, setOverInfo] = useState({ score: 0, isHigh: false, xp: 0 });
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let tickSec = 0;

    function spawnItem() {
      const s = stateRef.current;
      const isBomb = Math.random() < 0.16;
      let emoji = '💣', pts = 0;
      if (!isBomb) {
        let r = Math.random(), cum = 0;
        for (const it of ITEMS) { cum += it.prob; if (r < cum) { emoji = it.emoji; pts = it.pts; break; } }
        if (!emoji) { emoji = '🎤'; pts = 10; }
      }
      const spawnX = rnd(80, W - 80);
      s.items.push({
        id: s.idCounter++,
        x: spawnX, y: H + 30,
        vx: rnd(-2.5, 2.5),
        vy: rnd(-14, -10),
        radius: isBomb ? 34 : 30,
        emoji, pts, isBomb,
        sliced: false, gone: false, sliceT: 0,
      });
    }

    function spawnParticles(x: number, y: number, color: string, n = 12) {
      const s = stateRef.current;
      for (let i = 0; i < n; i++) {
        s.particles.push({
          x, y,
          vx: rnd(-6, 6), vy: rnd(-8, -1),
          life: rnd(18, 36), max: 36,
          color, size: rnd(3, 7),
        });
      }
    }

    function checkSlice() {
      const s = stateRef.current;
      if (!s.mouseDown) return;
      const px = s.mx, py = s.my;
      for (const item of s.items) {
        if (item.sliced || item.gone) continue;
        const dx = px - item.x, dy = py - item.y;
        if (dx * dx + dy * dy < item.radius * item.radius) {
          item.sliced = true;
          if (item.isBomb) {
            s.lives--;
            s.combo = 0;
            s.flashRed = 22;
            playWrong();
            spawnParticles(item.x, item.y, '#ef4444', 16);
            s.floats.push({ x: item.x - 20, y: item.y, vy: -2.2, life: 50, text: '💣 BOOM!', color: '#ef4444' });
            if (s.lives <= 0) { s.running = false; s.over = true; endGame(); }
          } else {
            s.combo++;
            s.comboTimer = 80;
            const cm = 1 + Math.floor(s.combo / 4);
            const earned = item.pts * cm;
            s.score += earned;
            playPop();
            if (cm > 1) playUnlock();
            const color = item.pts >= 20 ? '#fbbf24' : '#86efac';
            spawnParticles(item.x, item.y, color, 10);
            s.floats.push({ x: item.x - 16, y: item.y - 10, vy: -2, life: 45, text: cm > 1 ? `+${earned} x${cm}🔥` : `+${earned}`, color });
          }
          s.slashes.push({ x1: s.prevMx, y1: s.prevMy, x2: px, y2: py, life: 10 });
        }
      }
    }

    function endGame() {
      const s = stateRef.current;
      const finalScore = s.score;
      const prev = parseInt(localStorage.getItem('ninja_best') || '0');
      const isHigh = finalScore > prev;
      if (isHigh) { localStorage.setItem('ninja_best', String(finalScore)); }
      const xp = Math.floor(finalScore / 10) + s.lives * 5;
      addXP(xp);
      if (isHigh) { playWin(); setConfetti(true); setTimeout(() => setConfetti(false), 2500); }
      else playWrong();
      setOverInfo({ score: finalScore, isHigh, xp });
      setStatus('over');
    }

    function start() {
      const s = stateRef.current;
      s.items = []; s.particles = []; s.floats = []; s.slashes = []; s.trail = [];
      s.score = 0; s.combo = 0; s.comboTimer = 0;
      s.lives = MAX_LIVES; s.timeLeft = GAME_TIME;
      s.frame = 0; s.spawnTimer = 40;
      s.running = true; s.over = false; s.flashRed = 0; s.bgX = 0;
      tickSec = 0;
      setStatus('playing');
    }
    controlsRef.current = { start };

    function update() {
      const s = stateRef.current;
      if (!s.running) return;
      s.frame++;
      s.bgX = (s.bgX - 0.4) % 80;

      if (s.comboTimer > 0 && --s.comboTimer === 0) s.combo = 0;
      if (s.flashRed > 0) s.flashRed--;

      // second ticker
      tickSec++;
      if (tickSec >= 60) { tickSec = 0; s.timeLeft--; if (s.timeLeft <= 0) { s.running = false; s.over = true; endGame(); return; } }

      // spawn
      if (--s.spawnTimer <= 0) {
        spawnItem();
        const extra = s.timeLeft < 20 ? 1 : 0;
        for (let i = 0; i < extra; i++) spawnItem();
        s.spawnTimer = Math.max(18, 48 - Math.floor((GAME_TIME - s.timeLeft) * 0.6));
      }

      // physics
      for (const item of s.items) {
        if (item.gone) continue;
        if (item.sliced) { item.sliceT++; if (item.sliceT > 30) item.gone = true; continue; }
        item.vy += GRAVITY;
        item.x += item.vx; item.y += item.vy;
        // fell off
        if (item.y > H + 60) item.gone = true;
      }
      s.items = s.items.filter(i => !i.gone);

      // particles
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.life--; }
      s.particles = s.particles.filter(p => p.life > 0);

      for (const f of s.floats) { f.x += 0.3; f.y += f.vy; f.life--; }
      s.floats = s.floats.filter(f => f.life > 0);

      for (const sl of s.slashes) sl.life--;
      s.slashes = s.slashes.filter(sl => sl.life > 0);

      // trail
      s.trail.push({ x: s.mx, y: s.my, t: 12 });
      for (const t of s.trail) t.t--;
      s.trail = s.trail.filter(t => t.t > 0);

      checkSlice();
    }

    function draw() {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // BG: dark dojo with grid
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1a0a2e');
      bg.addColorStop(1, '#0d0020');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // grid lines (floor)
      ctx.strokeStyle = 'rgba(130,60,200,0.15)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = s.bgX; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

      // particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // slash segments
      for (const sl of s.slashes) {
        ctx.save();
        ctx.globalAlpha = sl.life / 10;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
        ctx.restore();
      }

      // mouse trail
      if (s.mouseDown && s.trail.length > 1) {
        ctx.save();
        for (let i = 1; i < s.trail.length; i++) {
          const a = s.trail[i - 1], b = s.trail[i];
          ctx.globalAlpha = (b.t / 12) * 0.7;
          ctx.strokeStyle = '#e879f9';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#e879f9';
          ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }

      // items
      for (const item of s.items) {
        if (item.gone) continue;
        ctx.save();
        ctx.translate(item.x, item.y);
        if (item.sliced) {
          ctx.globalAlpha = 1 - item.sliceT / 30;
          ctx.scale(1 + item.sliceT * 0.04, 1 + item.sliceT * 0.04);
        }
        // glow for valuable items
        if (!item.isBomb && item.pts >= 20) {
          ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20;
        } else if (item.isBomb) {
          const pulse = 0.6 + 0.4 * Math.sin(s.frame * 0.3);
          ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 18 * pulse;
        }
        ctx.font = `${item.radius * 1.8}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, 0, 0);
        ctx.restore();
      }

      // float texts
      for (const f of s.floats) {
        ctx.globalAlpha = Math.min(1, f.life / 20);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 22px Fredoka, sans-serif';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      // red flash overlay
      if (s.flashRed > 0) {
        ctx.fillStyle = `rgba(239,68,68,${s.flashRed / 22 * 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }

      // HUD
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 32px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ ${s.score}`, 16, 42);
      ctx.font = '18px Fredoka, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('SCORE', 18, 60);

      ctx.textAlign = 'center';
      ctx.fillStyle = s.timeLeft <= 10 ? '#f87171' : '#fff';
      ctx.font = `bold ${s.timeLeft <= 10 ? '42' : '34'}px Fredoka, sans-serif`;
      ctx.fillText(`⏱️ ${s.timeLeft}s`, W / 2, 42);

      // lives
      ctx.textAlign = 'right';
      ctx.font = '26px serif';
      ctx.fillText('❤️'.repeat(s.lives) + '🖤'.repeat(MAX_LIVES - s.lives), W - 14, 42);

      // combo
      if (s.combo >= 3) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 22px Fredoka, sans-serif';
        ctx.fillText(`🔥 COMBO x${1 + Math.floor(s.combo / 4)}!`, 16, 80);
      }

      ctx.textAlign = 'left';

      if (!s.running && !s.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO START!', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    function loop() {
      update(); draw();
      raf = requestAnimationFrame(loop);
    }

    // pointer events
    function getXY(e: MouseEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      if ('touches' in e) {
        const t = e.touches[0] || e.changedTouches[0];
        return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
      }
      return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
    }

    function onDown(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const s = stateRef.current;
      const { x, y } = getXY(e);
      s.prevMx = x; s.prevMy = y; s.mx = x; s.my = y;
      s.mouseDown = true;
      if (!s.running) start();
    }
    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const s = stateRef.current;
      const { x, y } = getXY(e);
      s.prevMx = s.mx; s.prevMy = s.my;
      s.mx = x; s.my = y;
    }
    function onUp() { stateRef.current.mouseDown = false; }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    loop();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #0d0020 100%)' }}
    >
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}

      <div className="w-full max-w-3xl mx-auto">
        <button onClick={() => { playClick(); setGameState('boys_zone'); }}
          className="mb-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-fredoka text-sm border border-white/20">
          ← Boys Zone
        </button>

        <div className="text-center mb-3">
          <h1 className="text-4xl font-fredoka font-bold text-white">⚔️ Ninja Slice</h1>
          <p className="font-nunito text-purple-300 text-sm">Swipe to slice · Dodge bombs 💣 · Chain combos!</p>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-500/40">
          <canvas
            ref={canvasRef}
            width={W} height={H}
            className="w-full block touch-none cursor-crosshair"
            style={{ aspectRatio: `${W}/${H}` }}
          />

          <AnimatePresence>
            {status === 'over' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/75 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-400 rounded-3xl p-8 text-center max-w-xs mx-4"
                >
                  <div className="text-5xl mb-2">{overInfo.isHigh ? '🏆' : '💥'}</div>
                  <h2 className="text-3xl font-fredoka font-bold text-white mb-1">
                    {overInfo.isHigh ? 'NEW BEST!' : 'Game Over!'}
                  </h2>
                  <p className="font-fredoka text-2xl text-yellow-300 mb-1">⭐ {overInfo.score}</p>
                  <p className="font-nunito text-purple-200 text-sm mb-4">+{overInfo.xp} XP earned!</p>
                  <button onClick={() => controlsRef.current?.start()} className="btn-kid mr-2">🔄 Again</button>
                  <button onClick={() => setGameState('boys_zone')} className="btn-kid-secondary">← Zone</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center font-nunito text-white/40 text-xs mt-3">
          Click/tap & drag to slice items · Avoid 💣 bombs!
        </p>
      </div>
    </motion.div>
  );
};

export default NinjaSlice;
