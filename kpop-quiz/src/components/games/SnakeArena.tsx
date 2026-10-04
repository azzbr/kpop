import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import { createRng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import { playCoin, playPop, playWrong } from '../../utils/sounds';
import { createWorld, step, leaderboard, lengthScore, radiusOf, TICK_HZ, WORLD_R, MIN_LEN } from './snakeArenaLogic';
import type { SnakeWorld, Snake } from './snakeArenaLogic';

const ROUND_SECONDS = 180;
const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

interface Float { x: number; y: number; text: string; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Hud { secondsLeft: number; len: number; board: { id: number; name: string; emoji: string; color: string; len: number; me: boolean }[] }

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

export default function SnakeArena() {
  const userName = useGameStore(s => s.userName);
  const equipped = useGameStore(s => s.equipped);
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud>({ secondsLeft: ROUND_SECONDS, len: 0, board: [] });
  const [over, setOver] = useState({ score: 0, title: '', kills: 0, seconds: 0 });
  const [boostHeld, setBoostHeld] = useState(false);

  const worldRef = useRef<SnakeWorld | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const holdRef = useRef(false); // ?debug only: tests step the game themselves
  const floats = useRef<Float[]>([]);
  const sparks = useRef<Spark[]>([]);
  const zoomRef = useRef(1);
  const lastEatSound = useRef(0);
  const steerPointer = useRef<number | null>(null);
  const keys = useRef({ left: false, right: false, space: false, button: false });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const size = useCanvasSize(canvasRef);
  const sprites = useRef(new Map<string, HTMLCanvasElement>());

  const updateHud = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const me = w.snakes[0];
    setHud({
      secondsLeft: Math.max(0, Math.ceil((ROUND_TICKS - w.tick) / TICK_HZ)),
      len: Math.floor(me.len),
      board: leaderboard(w).slice(0, 5).map(s => ({
        id: s.id, name: s.isHuman ? 'You' : s.name, emoji: s.emoji, color: s.color, len: Math.floor(s.len), me: s.isHuman,
      })),
    });
  }, []);

  const endRound = useCallback((title: string) => {
    const w = worldRef.current!;
    const me = w.snakes[0];
    setOver({ score: lengthScore(me), title, kills: me.kills, seconds: Math.round(w.tick / TICK_HZ) });
    setBoostHeld(false);
    keys.current = { left: false, right: false, space: false, button: false };
    setStatus('over');
  }, []);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    worldRef.current = createWorld({
      rng: createRng(seed),
      humanName: userName || 'You',
      humanEmoji: equipped?.avatar || '😎',
      humanColor: equipped?.color || '#3b82f6',
    });
    floats.current = [];
    sparks.current = [];
    zoomRef.current = 1;
    keys.current = { left: false, right: false, space: false, button: false };
    setBoostHeld(false);
    updateHud();
    setRound(r => r + 1);
    setStatus('playing');
  }, [userName, equipped, updateHud]);

  const applyKeys = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const me = w.snakes[0];
    const k = keys.current;
    me.input.turn = k.left === k.right ? 0 : k.left ? -1 : 1;
    me.input.boost = k.space || k.button;
  }, []);

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    applyKeys();
    step(w);
    const me = w.snakes[0];
    for (const e of w.events) {
      const s = w.snakes[e.snakeId - 1];
      if (e.type === 'eat' && e.snakeId === 1) {
        if (w.tick - lastEatSound.current > 5) { playPop(); lastEatSound.current = w.tick; }
      } else if (e.type === 'death') {
        burst(sparks.current, s.segs[0].x, s.segs[0].y, s.color, 34);
        if (e.byId === 1 && e.snakeId !== 1) {
          floats.current.push({ x: me.segs[0].x, y: me.segs[0].y - 30, text: `💥 ${s.emoji} ${s.name} bumped into you!`, life: 50 });
          playCoin();
        }
      }
    }
    if (w.tick % 6 === 0 || w.events.some(e => e.type === 'death')) updateHud();

    if (!me.alive) {
      playWrong();
      const by = me.killedBy ? w.snakes[me.killedBy - 1] : null;
      endRound(me.deathCause === 'wall' ? 'You bumped the wall!' : by ? `You bumped into ${by.emoji} ${by.name}!` : 'Bumped out!');
    } else if (w.tick >= ROUND_TICKS) {
      endRound("Time's up!");
    }
  }, [applyKeys, endRound, updateHud]);

  const foodSprite = useCallback((color: string) => {
    let c = sprites.current.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.22, color);
      grad.addColorStop(0.45, hexA(color, 0.45));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      sprites.current.set(color, c);
    }
    return c;
  }, []);

  const draw = useCallback((alpha: number) => {
    const canvas = canvasRef.current;
    const w = worldRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2a0f2e';
    ctx.fillRect(0, 0, cw, ch);
    if (!w) return;

    const a = statusRef.current === 'playing' ? alpha : 1;
    const me = w.snakes[0];
    const mh = me.segs[0];
    const camX = mh.px + (mh.x - mh.px) * a;
    const camY = mh.py + (mh.y - mh.py) * a;
    const r0 = radiusOf(me.len);
    const zoomTarget = (Math.min(cw, ch) / 720) * (1.15 - Math.min(0.45, (r0 - 10) * 0.03));
    zoomRef.current += (zoomTarget - zoomRef.current) * 0.05;
    const z = zoomRef.current;
    const sx = (x: number) => (x - camX) * z + cw / 2;
    const sy = (y: number) => (y - camY) * z + ch / 2;
    const viewR = Math.hypot(cw, ch) / 2 / z + 60; // world radius visible around the camera
    const visible = (x: number, y: number, pad = 0) => Math.abs(x - camX) < cw / 2 / z + pad && Math.abs(y - camY) < ch / 2 / z + pad;

    // World floor (outside the circle stays dark red = out of bounds)
    ctx.fillStyle = '#17143a';
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), WORLD_R * z, 0, Math.PI * 2);
    ctx.fill();

    // Hex-ish dot grid, so movement is easy to see
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), WORLD_R * z, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    const gs = 70;
    const gx0 = Math.floor((camX - cw / 2 / z) / gs) - 1;
    const gx1 = Math.ceil((camX + cw / 2 / z) / gs) + 1;
    const gy0 = Math.floor((camY - ch / 2 / z) / gs) - 1;
    const gy1 = Math.ceil((camY + ch / 2 / z) / gs) + 1;
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const ox = (gy & 1) * gs * 0.5;
        ctx.beginPath();
        ctx.arc(sx(gx * gs + ox), sy(gy * gs), Math.max(1.5, 3 * z), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Wall
    if (Math.hypot(camX, camY) + viewR > WORLD_R) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(4, 10 * z);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(sx(0), sy(0), WORLD_R * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Food
    const t = performance.now() / 300;
    for (const f of w.food) {
      if (!visible(f.x, f.y, 30)) continue;
      const pulse = 1 + 0.15 * Math.sin(t + f.id);
      const s = f.r * 3.4 * pulse * z;
      ctx.drawImage(foodSprite(f.color), sx(f.x) - s / 2, sy(f.y) - s / 2, s, s);
    }

    // Snakes: others first, the player on top
    const order = [...w.snakes.slice(1), me];
    for (const s of order) {
      if (!s.alive) continue;
      drawSnake(ctx, s, a, z, sx, sy, visible);
    }

    // Effects
    for (const p of sparks.current) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), 4 * z + 1, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93; p.life--;
    }
    sparks.current = sparks.current.filter(p => p.life > 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(18, 22 * z)}px "Fredoka One", Nunito, ${EMOJI_FONT}`;
    for (const f of floats.current) {
      ctx.globalAlpha = Math.min(1, f.life / 15);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const fy = sy(f.y) - (50 - f.life) * 1.2;
      ctx.strokeText(f.text, sx(f.x), fy);
      ctx.fillText(f.text, sx(f.x), fy);
      f.life--;
    }
    floats.current = floats.current.filter(f => f.life > 0);
    ctx.globalAlpha = 1;

    // Mini-map (bottom-left; the boost button lives bottom-right)
    const mr = Math.min(62, Math.min(cw, ch) * 0.12);
    const mcx = 12 + mr;
    const mcy = ch - 12 - mr;
    ctx.fillStyle = 'rgba(10,8,30,0.75)';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mcx, mcy, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const s of order) {
      if (!s.alive) continue;
      const h = s.segs[0];
      ctx.fillStyle = s.isHuman ? '#fff' : s.color;
      ctx.beginPath();
      ctx.arc(mcx + (h.x / WORLD_R) * mr, mcy + (h.y / WORLD_R) * mr, s.isHuman ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [foodSprite, size]);

  const pause = useCallback(() => {
    if (statusRef.current === 'playing') { setStatus('paused'); setBoostHeld(false); keys.current.button = false; }
  }, []);
  useGameLoop({ tickHz: TICK_HZ, update: () => { if (!holdRef.current) tick(); }, draw, running: status === 'playing', onHidden: pause });

  // Steering: the snake turns towards wherever the finger is, relative to the head (the screen centre).
  const steerTo = useCallback((clientX: number, clientY: number) => {
    const w = worldRef.current;
    const el = areaRef.current;
    if (!w || !el || statusRef.current !== 'playing') return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - rect.left - rect.width / 2;
    const dy = clientY - rect.top - rect.height / 2;
    if (dx * dx + dy * dy < 16) return;
    w.snakes[0].input.angle = Math.atan2(dy, dx);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (steerPointer.current !== null && e.pointerType !== 'mouse') return;
    steerPointer.current = e.pointerId;
    areaRef.current?.setPointerCapture?.(e.pointerId);
    steerTo(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // A mouse steers just by hovering; fingers steer while touching.
    if (e.pointerId === steerPointer.current || e.pointerType === 'mouse') steerTo(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId === steerPointer.current) steerPointer.current = null;
  };

  // Keyboard: ←/→ or A/D turn, Space boosts.
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = keys.current;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = down;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = down;
      else if (e.code === 'Space') k.space = down;
      else return;
      e.preventDefault();
      // After a key turn, keep going the new way instead of snapping back to the old finger angle.
      const w = worldRef.current;
      if (!down && w && !k.left && !k.right) w.snakes[0].input.angle = w.snakes[0].angle;
    };
    const kd = (e: KeyboardEvent) => set(e, true);
    const ku = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const boost = (on: boolean) => {
    keys.current.button = on;
    setBoostHeld(on);
  };

  // Debug hook for automated tests: ?debug&seed=42 exposes the world and a step function.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      start,
      hold: (on = true) => { holdRef.current = on; },
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); },
      steer: (angle: number) => { const w = worldRef.current; if (w) w.snakes[0].input.angle = angle; },
      boost: (on = true) => { keys.current.button = on; },
      length: () => (worldRef.current ? worldRef.current.snakes[0].len : 0),
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, tick]);

  const mins = Math.floor(hud.secondsLeft / 60);
  const secs = String(hud.secondsLeft % 60).padStart(2, '0');
  const canBoost = hud.len > MIN_LEN;

  return (
    <GameShell
      gameId="snake_arena"
      title="Snake Arena"
      icon="🐍"
      xpScale={5}
      status={status}
      score={over.score}
      round={round}
      overTitle={over.title}
      overStats={[
        { label: 'Knock-outs', value: String(over.kills) },
        { label: 'Survived', value: `${Math.floor(over.seconds / 60)}:${String(over.seconds % 60).padStart(2, '0')}` },
      ]}
      onStart={start}
      onPause={pause}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="text-left font-nunito text-base text-violet-100 space-y-3">
          <ul className="space-y-1">
            <li>👆 <b>Touch and drag</b> anywhere — your snake turns towards your finger (or use ← → keys).</li>
            <li>✨ Eat the glowing dots to grow longer.</li>
            <li>🚀 Hold <b>BOOST</b> (or Space) to zoom — it costs a little length.</li>
            <li>💥 Don't let your head touch another snake! Make them bump into <b>you</b>.</li>
            <li>⏱️ Get as long as you can in 3 minutes.</li>
          </ul>
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span className="text-4xl">{equipped?.avatar || '😎'}</span>
            <span className="flex-1">Your snake</span>
            <span className="w-16 h-6 rounded-full" style={{ background: equipped?.color || '#3b82f6' }} />
          </div>
        </div>
      }
    >
      <div
        ref={areaRef}
        className="absolute inset-0 game-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {(status === 'playing' || status === 'paused') && (
          <>
            <div className="absolute top-2 left-2 rounded-2xl bg-black/45 px-3 py-2 font-fredoka pointer-events-none">
              <div className="text-2xl">⏱️ {mins}:{secs}</div>
              <div className="text-xl text-sky-300">🐍 Length {hud.len}</div>
            </div>
            <div className="absolute top-2 right-2 rounded-2xl bg-black/45 px-3 py-2 font-nunito text-base min-w-[160px] pointer-events-none">
              {hud.board.map((b, i) => (
                <div key={b.id} className={`flex items-center gap-2 ${b.me ? 'font-bold text-yellow-300' : ''}`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: b.color }} />
                  <span className="flex-1 truncate">{i + 1}. {b.emoji} {b.name}</span>
                  <span className="tabular-nums">{b.len}</span>
                </div>
              ))}
            </div>

            <button
              className={`absolute bottom-4 right-4 w-24 h-24 rounded-full font-fredoka text-lg flex flex-col items-center justify-center border-4 select-none
                ${boostHeld && canBoost ? 'bg-orange-400 border-white scale-95' : 'bg-fuchsia-600/80 border-white/60'} ${canBoost ? '' : 'opacity-50'}`}
              style={{ marginBottom: 'env(safe-area-inset-bottom)', touchAction: 'none' }}
              onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); boost(true); }}
              onPointerMove={e => e.stopPropagation()}
              onPointerUp={e => { e.stopPropagation(); boost(false); }}
              onPointerCancel={e => { e.stopPropagation(); boost(false); }}
              onLostPointerCapture={() => boost(false)}
              onContextMenu={e => e.preventDefault()}
              aria-label="Boost"
            >
              <span className="text-3xl leading-none">🚀</span>
              BOOST
            </button>
          </>
        )}
      </div>
    </GameShell>
  );
}

function drawSnake(
  ctx: CanvasRenderingContext2D, s: Snake, a: number, z: number,
  sx: (x: number) => number, sy: (y: number) => number, visible: (x: number, y: number, pad?: number) => boolean,
) {
  const r = radiusOf(s.len);
  const segs = s.segs;
  // Skip snakes that are entirely off screen (check every few segments).
  let onScreen = false;
  for (let i = 0; i < segs.length; i += 5) if (visible(segs[i].x, segs[i].y, r + 20)) { onScreen = true; break; }
  if (!onScreen && !visible(segs[segs.length - 1].x, segs[segs.length - 1].y, r + 20)) return;

  ctx.beginPath();
  for (let i = segs.length - 1; i >= 0; i--) {
    const g = segs[i];
    const x = sx(g.px + (g.x - g.px) * a);
    const y = sy(g.py + (g.y - g.py) * a);
    if (i === segs.length - 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Outline, body, then stripes
  ctx.strokeStyle = shade(s.color, -0.45);
  ctx.lineWidth = r * 2 * z + 4;
  if (s.boosting) { ctx.shadowColor = s.color; ctx.shadowBlur = 22; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = r * 2 * z;
  ctx.stroke();
  ctx.strokeStyle = shade(s.color, 0.35);
  ctx.lineWidth = r * 0.9 * z;
  ctx.setLineDash([r * 0.8 * z, r * 1.4 * z]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Head with the emoji face
  const h = segs[0];
  const hx = sx(h.px + (h.x - h.px) * a);
  const hy = sy(h.py + (h.y - h.py) * a);
  const hr = r * 1.25 * z;
  ctx.fillStyle = s.color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s.isHuman ? 3 : 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${hr * 1.45}px ${EMOJI_FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(s.emoji, hx, hy + 1);
  if (!s.isHuman) {
    ctx.font = `600 ${Math.max(13, 15 * z)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(s.name, hx, hy - hr - 12);
  }
}

function burst(list: Spark[], x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * 6;
    list.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 20 + Math.random() * 15, color });
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexA(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(Math.max(0, Math.min(255, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
  return `rgb(${r},${g},${b})`;
}
