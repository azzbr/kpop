import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import { useSwipeInput } from '../../games/engine/useSwipeInput';
import { createRng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import { playCoin, playPop, playWrong } from '../../utils/sounds';
import { createWorld, step, steer, percentOf, TICK_HZ } from './paperClashLogic';
import type { World, Dir, Difficulty, Player } from './paperClashLogic';

const ROUND_SECONDS = 180;
const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
const AVATARS = ['😎', '🤖', '👽', '🐯', '🐙', '🦖'];

interface Float { x: number; y: number; text: string; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Hud { secondsLeft: number; myPct: number; board: { name: string; emoji: string; color: string; pct: number; me: boolean }[] }

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

export default function PaperClash() {
  const userName = useGameStore(s => s.userName);
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [showPad, setShowPad] = useState(false);
  const [hud, setHud] = useState<Hud>({ secondsLeft: ROUND_SECONDS, myPct: 0, board: [] });
  const [over, setOver] = useState({ score: 0, title: '', kills: 0, seconds: 0 });

  const worldRef = useRef<World | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const floats = useRef<Float[]>([]);
  const sparks = useRef<Spark[]>([]);
  const peakPct = useRef(0);
  // ?debug only: stops the real-time loop from ticking so tests can step the game themselves.
  const holdRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const minimap = useMemo(() => document.createElement('canvas'), []);
  const size = useCanvasSize(canvasRef);

  const refreshMinimap = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    minimap.width = w.size;
    minimap.height = w.size;
    const ctx = minimap.getContext('2d')!;
    const img = ctx.createImageData(w.size, w.size);
    const rgb = w.players.map(p => hexToRgb(p.color));
    for (let i = 0; i < w.owner.length; i++) {
      const o = w.owner[i];
      const [r, g, b] = o ? rgb[o - 1] : [40, 36, 90];
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [minimap]);

  const updateHud = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const board = w.players
      .filter(p => p.alive || p.isHuman)
      .map(p => ({ name: p.isHuman ? 'You' : p.name, emoji: p.emoji, color: p.color, pct: percentOf(w, p.id), me: p.isHuman }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
    setHud({
      secondsLeft: Math.max(0, Math.ceil((ROUND_TICKS - w.tick) / TICK_HZ)),
      myPct: percentOf(w, 1),
      board,
    });
  }, []);

  const endRound = useCallback((title: string) => {
    const w = worldRef.current!;
    const me = w.players[0];
    // Score is the most land she held, so a late knock-out doesn't wipe out a great round.
    const pct = Math.max(peakPct.current, percentOf(w, 1));
    setOver({ score: Math.round(pct * 10), title, kills: me.kills, seconds: Math.round(w.tick / TICK_HZ) });
    setStatus('over');
  }, []);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    const w = createWorld({ rng: createRng(seed), difficulty, humanName: userName || 'You', humanEmoji: avatar });
    worldRef.current = w;
    floats.current = [];
    sparks.current = [];
    peakPct.current = percentOf(w, 1);
    refreshMinimap();
    updateHud();
    setRound(r => r + 1);
    setStatus('playing');
  }, [difficulty, avatar, userName, refreshMinimap, updateHud]);

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    step(w);
    const me = w.players[0];
    let changed = false;
    for (const e of w.events) {
      changed = true;
      if (e.type === 'claim' && e.playerId === 1) {
        const gain = ((e.cells ?? 0) / (w.size * w.size)) * 100;
        floats.current.push({ x: me.x, y: me.y, text: `+${gain.toFixed(1)}%`, life: 30 });
        burst(sparks.current, me.x, me.y, me.color, 24);
        playCoin();
      }
      if (e.type === 'death') {
        const victim = w.players[e.playerId - 1];
        burst(sparks.current, victim.x, victim.y, victim.color, 30);
        if (e.byId === 1 && e.playerId !== 1) {
          floats.current.push({ x: me.x, y: me.y - 1, text: `💥 Got ${victim.name}!`, life: 36 });
          playPop();
        }
      }
    }
    if (changed) refreshMinimap();
    peakPct.current = Math.max(peakPct.current, percentOf(w, 1));
    if (w.tick % 5 === 0 || changed) updateHud();

    if (!me.alive) {
      playWrong();
      const deathEvent = w.events.find(e => e.type === 'death' && e.playerId === 1);
      const by = deathEvent?.byId ? w.players[deathEvent.byId - 1] : null;
      endRound(
        me.deathCause === 'wall' ? 'You hit the wall!'
          : me.deathCause === 'own_trail' ? 'You crossed your own trail!'
          : by ? `Knocked out by ${by.emoji} ${by.name}!` : 'Knocked out!',
      );
    } else if (w.tick >= ROUND_TICKS || percentOf(w, 1) >= 99.5) {
      endRound("Time's up!");
    }
  }, [endRound, refreshMinimap, updateHud]);

  const draw = useCallback((alpha: number) => {
    const canvas = canvasRef.current;
    const w = worldRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14112e';
    ctx.fillRect(0, 0, cw, ch);
    if (!w) return;

    const me = w.players[0];
    const cs = Math.max(16, Math.min(cw, ch) / 26); // cell size in CSS px
    const lerp = (p: Player) => {
      const a = statusRef.current === 'playing' ? alpha : 1;
      return { x: p.prevX + (p.x - p.prevX) * a, y: p.prevY + (p.y - p.prevY) * a };
    };
    const focus = lerp(me);
    const camX = focus.x + 0.5 - cw / cs / 2;
    const camY = focus.y + 0.5 - ch / cs / 2;
    const sx = (x: number) => (x - camX) * cs;
    const sy = (y: number) => (y - camY) * cs;

    // Map floor + wall
    ctx.fillStyle = '#28245a';
    ctx.fillRect(sx(0), sy(0), w.size * cs, w.size * cs);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(sx(0) - 2, sy(0) - 2, w.size * cs + 4, w.size * cs + 4);

    const x0 = Math.max(0, Math.floor(camX));
    const y0 = Math.max(0, Math.floor(camY));
    const x1 = Math.min(w.size - 1, Math.ceil(camX + cw / cs));
    const y1 = Math.min(w.size - 1, Math.ceil(camY + ch / cs));

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(sx(x), sy(y0)); ctx.lineTo(sx(x), sy(y1 + 1)); }
    for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(sx(x0), sy(y)); ctx.lineTo(sx(x1 + 1), sy(y)); }
    ctx.stroke();

    // Land, then trails on top
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = y * w.size + x;
        const o = w.owner[c];
        if (o) {
          ctx.fillStyle = w.players[o - 1].color;
          ctx.fillRect(sx(x), sy(y), cs + 0.5, cs + 0.5);
        }
      }
    }
    ctx.globalAlpha = 0.6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = w.trail[y * w.size + x];
        if (t) {
          ctx.fillStyle = w.players[t - 1].color;
          const pad = cs * 0.18;
          ctx.fillRect(sx(x) + pad, sy(y) + pad, cs - pad * 2, cs - pad * 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Players
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of w.players) {
      if (!p.alive) continue;
      const pos = lerp(p);
      const px = sx(pos.x);
      const py = sy(pos.y);
      ctx.fillStyle = shade(p.color, -0.35);
      roundRect(ctx, px - cs * 0.15, py - cs * 0.15, cs * 1.3, cs * 1.3, cs * 0.3);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = p.isHuman ? 3 : 1.5;
      ctx.stroke();
      // Colour-emoji fonts first: some system fonts have black-and-white versions of faces like 😎.
      ctx.font = `${cs * 0.95}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(p.emoji, px + cs / 2, py + cs / 2 + 1);
      if (!p.isHuman) {
        ctx.font = `600 ${Math.max(11, cs * 0.5)}px Nunito, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(p.name, px + cs / 2, py - cs * 0.55);
      }
    }

    // Effects
    for (const s of sparks.current) {
      ctx.globalAlpha = Math.max(0, s.life / 30);
      ctx.fillStyle = s.color;
      ctx.fillRect(sx(s.x) - 3, sy(s.y) - 3, 6, 6);
      s.x += s.vx; s.y += s.vy; s.vx *= 0.94; s.vy *= 0.94; s.life--;
    }
    sparks.current = sparks.current.filter(s => s.life > 0);
    ctx.font = `bold ${Math.max(18, cs)}px Fredoka One, Nunito, sans-serif`;
    for (const f of floats.current) {
      ctx.globalAlpha = Math.min(1, f.life / 15);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const fy = sy(f.y) - (36 - f.life) * 1.2;
      ctx.strokeText(f.text, sx(f.x) + cs / 2, fy);
      ctx.fillText(f.text, sx(f.x) + cs / 2, fy);
      f.life--;
    }
    floats.current = floats.current.filter(f => f.life > 0);
    ctx.globalAlpha = 1;

    // Mini-map (bottom-right)
    const mm = Math.min(120, cw * 0.22);
    const mx = cw - mm - 10;
    const my = ch - mm - 10;
    ctx.globalAlpha = 0.85;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(minimap, mx, my, mm, mm);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mm, mm);
    for (const p of w.players) {
      if (!p.alive) continue;
      ctx.fillStyle = p.isHuman ? '#fff' : '#000';
      const r = p.isHuman ? 3 : 2;
      ctx.fillRect(mx + (p.x / w.size) * mm - r, my + (p.y / w.size) * mm - r, r * 2, r * 2);
    }
  }, [minimap, size]);

  const pause = useCallback(() => { if (statusRef.current === 'playing') setStatus('paused'); }, []);
  useGameLoop({ tickHz: TICK_HZ, update: () => { if (!holdRef.current) tick(); }, draw, running: status === 'playing', onHidden: pause });

  const turn = useCallback((d: Dir) => {
    const w = worldRef.current;
    if (w && statusRef.current === 'playing') steer(w.players[0], d);
  }, []);
  useSwipeInput(areaRef, turn);

  // Debug hook for automated tests: ?debug&seed=42 exposes the world and a step function.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      start,
      hold: (on = true) => { holdRef.current = on; },
      steer: (d: Dir) => turn(d),
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); },
      percent: () => (worldRef.current ? percentOf(worldRef.current, 1) : 0),
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, tick, turn]);

  const mins = Math.floor(hud.secondsLeft / 60);
  const secs = String(hud.secondsLeft % 60).padStart(2, '0');

  return (
    <GameShell
      gameId="paper_clash"
      title="Paper Clash"
      icon="🗺️"
      xpScale={6}
      status={status}
      score={over.score}
      round={round}
      formatScore={s => `${(s / 10).toFixed(1)}%`}
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
            <li>👆 <b>Swipe</b> to steer (or use the arrow keys).</li>
            <li>🧵 Leave your land to draw a trail, then get back home to claim everything inside.</li>
            <li>✂️ Cross someone's trail to knock them out — but don't let anyone touch <b>yours</b>!</li>
            <li>⏱️ Grab as much of the map as you can in 3 minutes.</li>
          </ul>
          <div>
            <div className="font-fredoka text-lg mb-1">Pick your player</div>
            <div className="flex gap-2 flex-wrap">
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)}
                  className={`w-12 h-12 rounded-xl text-3xl ${a === avatar ? 'bg-fuchsia-500 ring-2 ring-white' : 'bg-white/10'}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-fredoka text-lg mb-1">Bots</div>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`min-h-[48px] rounded-xl font-fredoka text-lg capitalize ${d === difficulty ? 'bg-fuchsia-500' : 'bg-white/10'}`}>{d}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 min-h-[44px]">
            <input type="checkbox" checked={showPad} onChange={e => setShowPad(e.target.checked)} className="w-6 h-6 accent-fuchsia-500" />
            Show arrow buttons too
          </label>
        </div>
      }
    >
      <div ref={areaRef} className="absolute inset-0 game-surface">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {status === 'playing' || status === 'paused' ? (
          <>
            <div className="absolute top-2 left-2 rounded-2xl bg-black/45 px-3 py-2 font-fredoka pointer-events-none">
              <div className="text-2xl">⏱️ {mins}:{secs}</div>
              <div className="text-xl text-sky-300">You: {hud.myPct.toFixed(1)}%</div>
            </div>
            <div className="absolute top-2 right-2 rounded-2xl bg-black/45 px-3 py-2 font-nunito text-base min-w-[150px] pointer-events-none">
              {hud.board.map((b, i) => (
                <div key={b.name + i} className={`flex items-center gap-2 ${b.me ? 'font-bold text-yellow-300' : ''}`}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: b.color }} />
                  <span className="flex-1 truncate">{i + 1}. {b.emoji} {b.name}</span>
                  <span>{b.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {showPad && status === 'playing' && (
          <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1 opacity-80" onPointerDown={e => e.stopPropagation()}>
            {([[null, 0, null], [3, null, 1], [null, 2, null]] as (Dir | null)[][]).flat().map((d, i) =>
              d === null ? <div key={i} className="w-16 h-16" /> : (
                <button key={i} onPointerDown={() => turn(d)}
                  className="w-16 h-16 rounded-2xl bg-white/20 text-3xl active:bg-white/40" aria-label={['Up', 'Right', 'Down', 'Left'][d]}>
                  {['⬆️', '➡️', '⬇️', '⬅️'][d]}
                </button>
              ))}
          </div>
        )}
      </div>
    </GameShell>
  );
}

function burst(list: Spark[], x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.1 + Math.random() * 0.35;
    list.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 20 + Math.random() * 15, color });
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(Math.max(0, Math.min(255, v + v * amt))));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
