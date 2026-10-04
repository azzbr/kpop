import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import { useSteerInput } from '../../games/engine/useSteerInput';
import { createRng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import { playCoin, playPop, playWrong } from '../../utils/sounds';
import { createWorld, step, steerAngle, steerDir, percentOf, arenaRadius, TICK_HZ } from './paperClashLogic';
import type { World, Dir, Difficulty, Player } from './paperClashLogic';
import { traceOutlines, smoothLoop } from './paperClashOutline';
import { drawPixelArt } from '../secret/pixelLogic';
import PaperClashClassic from './PaperClashClassic';
import StyleSwitch from './PaperClashStyleSwitch';

// Paper Clash: free steering, smooth land, paper.io 2 look. Rules: paperClashLogic.ts.
// "Classic squares" (the original grid game) stays available from the start card until the new
// one has been tried on a real iPad.

const ROUND_SECONDS = 180;
const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
const VIEW_CELLS = 64; // cells across the short side of the screen at the start
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

interface Float { x: number; y: number; text: string; t: number }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string }
interface Feed { text: string; t: number }
interface Hud { secondsLeft: number; myPct: number; board: { name: string; emoji: string; color: string; pct: number; me: boolean }[] }

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

export default function PaperClash() {
  const style = useGameStore(s => s.paperClash.style);
  return style === 'classic' ? <PaperClashClassic /> : <PaperClashNew />;
}

function PaperClashNew() {
  const userName = useGameStore(s => s.userName);
  const equipped = useGameStore(s => s.equipped);
  const pixelArt = useGameStore(s => s.pixelArt);
  const setGameState = useGameStore(s => s.setGameState);
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showPad, setShowPad] = useState(false);
  const [hud, setHud] = useState<Hud>({ secondsLeft: ROUND_SECONDS, myPct: 0, board: [] });
  const [over, setOver] = useState({ score: 0, title: '', kills: 0, seconds: 0 });

  const worldRef = useRef<World | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const floats = useRef<Float[]>([]);
  const sparks = useRef<Spark[]>([]);
  const feed = useRef<Feed[]>([]);
  const trailFx = useRef<{ x: number; y: number; t: number }[]>([]);
  const shake = useRef(0);
  const zoom = useRef(1);
  const peakPct = useRef(0);
  const holdRef = useRef(false);
  const lastFrame = useRef(performance.now());
  // Cached smooth land shapes, rebuilt only for players whose land changed.
  const shapes = useRef(new Map<number, Path2D>());
  const dirtyShapes = useRef(new Set<number>());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const size = useCanvasSize(canvasRef);
  const minimap = useMemo(() => document.createElement('canvas'), []);

  // Pixel Studio art worn as the player's token.
  const skinArt = pixelArt.find(a => a.id === equipped.skin) ?? null;
  const skin = useMemo(() => {
    if (!skinArt) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawPixelArt(ctx, skinArt, 0, 0, 64);
    return c;
  }, [skinArt]);

  const rebuildShapes = useCallback(() => {
    const w = worldRef.current;
    if (!w || !dirtyShapes.current.size) return;
    const ids = [...dirtyShapes.current];
    dirtyShapes.current.clear();
    const loops = traceOutlines(w.owner, w.size, ids);
    for (const id of ids) {
      const path = new Path2D();
      for (const loop of loops.get(id) ?? []) {
        const s = smoothLoop(loop);
        path.moveTo(s[0], s[1]);
        for (let i = 2; i < s.length; i += 2) path.lineTo(s[i], s[i + 1]);
        path.closePath();
      }
      shapes.current.set(id, path);
    }
  }, []);

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
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = w.arena[i] ? 255 : 0;
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
    setHud({ secondsLeft: Math.max(0, Math.ceil((ROUND_TICKS - w.tick) / TICK_HZ)), myPct: percentOf(w, 1), board });
  }, []);

  const endRound = useCallback((title: string) => {
    const w = worldRef.current!;
    const pct = Math.max(peakPct.current, percentOf(w, 1));
    setOver({ score: Math.round(pct * 10), title, kills: w.players[0].kills, seconds: Math.round(w.tick / TICK_HZ) });
    setStatus('over');
  }, []);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    const w = createWorld({ rng: createRng(seed), difficulty, humanName: userName || 'You', humanEmoji: equipped.avatar, humanColor: equipped.color });
    worldRef.current = w;
    floats.current = []; sparks.current = []; feed.current = []; trailFx.current = [];
    shapes.current.clear();
    dirtyShapes.current = new Set(w.players.map(p => p.id));
    rebuildShapes();
    zoom.current = 1;
    peakPct.current = percentOf(w, 1);
    if (skin && equipped.skin) useGameStore.getState().findSecret('pixel_skin');
    refreshMinimap();
    updateHud();
    setRound(r => r + 1);
    setStatus('playing');
  }, [difficulty, equipped, userName, refreshMinimap, updateHud, rebuildShapes, skin]);

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing') return;
    step(w);
    const me = w.players[0];
    const now = performance.now();
    let changed = false;
    for (const e of w.events) {
      changed = true;
      for (const id of e.touched ?? []) dirtyShapes.current.add(id);
      if (e.type === 'claim' && e.playerId === 1) {
        const gain = ((e.cells ?? 0) / w.arenaCells) * 100;
        floats.current.push({ x: me.x, y: me.y, text: `+${gain.toFixed(1)}%`, t: now });
        burst(sparks.current, me.x, me.y, me.color, 28, now);
        playCoin();
      }
      if (e.type === 'death') {
        const victim = w.players[e.playerId - 1];
        burst(sparks.current, victim.x, victim.y, victim.color, 34, now);
        const by = e.byId ? w.players[e.byId - 1] : null;
        if (e.playerId !== 1) {
          feed.current.unshift({ text: by && by !== victim ? `${by.isHuman ? 'You' : by.name} knocked out ${victim.name}!` : `${victim.name} is out!`, t: now });
          feed.current = feed.current.slice(0, 3);
        }
        if (e.byId === 1 && e.playerId !== 1) {
          floats.current.push({ x: me.x, y: me.y - 3, text: `💥 Got ${victim.name}!`, t: now });
          shake.current = 1;
          playPop();
        }
      }
    }
    if (changed) refreshMinimap();
    if (equipped.trail && me.alive && w.tick % 3 === 0) trailFx.current.push({ x: me.prevX, y: me.prevY, t: now });
    peakPct.current = Math.max(peakPct.current, percentOf(w, 1));
    if (w.tick % 10 === 0 || changed) updateHud();

    if (!me.alive) {
      playWrong();
      shake.current = 1.4;
      const deathEvent = w.events.find(e => e.type === 'death' && e.playerId === 1);
      const by = deathEvent?.byId ? w.players[deathEvent.byId - 1] : null;
      endRound(
        me.deathCause === 'wall' ? 'You left the arena!'
          : me.deathCause === 'own_trail' ? 'You crossed your own trail!'
          : by ? `Knocked out by ${by.emoji} ${by.name}!` : 'Knocked out!',
      );
    } else if (w.tick >= ROUND_TICKS || percentOf(w, 1) >= 99.5) {
      endRound("Time's up!");
    }
  }, [endRound, refreshMinimap, updateHud, equipped.trail]);

  const draw = useCallback((alpha: number) => {
    const canvas = canvasRef.current;
    const w = worldRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame.current) / 1000);
    lastFrame.current = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14112e';
    ctx.fillRect(0, 0, cw, ch);
    if (!w) return;
    rebuildShapes();

    const me = w.players[0];
    const playing = statusRef.current === 'playing';
    const a = playing ? alpha : 1;
    const lerp = (p: Player) => ({ x: p.prevX + (p.x - p.prevX) * a, y: p.prevY + (p.y - p.prevY) * a });

    // Camera: follows the player, zooms out smoothly as their land grows, shakes on knock-outs.
    const targetZoom = 1 + Math.min(0.7, percentOf(w, 1) / 35);
    zoom.current += (targetZoom - zoom.current) * Math.min(1, dt * 2);
    const cs = Math.min(cw, ch) / (VIEW_CELLS * zoom.current);
    const focus = lerp(me);
    shake.current = Math.max(0, shake.current - dt * 2.5);
    const sh = shake.current * 6;
    const ox = cw / 2 - focus.x * cs + (Math.random() - 0.5) * sh;
    const oy = ch / 2 - focus.y * cs + (Math.random() - 0.5) * sh;
    const world = () => ctx.setTransform(dpr * cs, 0, 0, dpr * cs, dpr * ox, dpr * oy);
    world();

    // Arena floor with a soft dotted grid, and its edge.
    const c = w.size / 2, R = arenaRadius(w.size);
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2766';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    const vx0 = Math.max(0, Math.floor(-ox / cs / 10) * 10), vy0 = Math.max(0, Math.floor(-oy / cs / 10) * 10);
    const vx1 = Math.min(w.size, (-ox + cw) / cs), vy1 = Math.min(w.size, (-oy + ch) / cs);
    for (let y = vy0; y <= vy1; y += 10) for (let x = vx0; x <= vx1; x += 10) ctx.fillRect(x - 0.25, y - 0.25, 0.5, 0.5);
    ctx.restore();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(c, c, R + 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Land: a darker "3D edge" a little lower, then the land itself (paper.io 2 style).
    const depth = 7 / cs;
    for (const p of w.players) {
      const path = shapes.current.get(p.id);
      if (!path || !w.counts[p.id]) continue;
      ctx.save();
      ctx.translate(0, depth);
      ctx.fillStyle = shade(p.color, -0.38);
      ctx.fill(path);
      ctx.restore();
      ctx.fillStyle = p.color;
      ctx.fill(path);
      ctx.strokeStyle = shade(p.color, 0.25);
      ctx.lineWidth = 0.35;
      ctx.stroke(path);
    }

    // Trails: thick, round, a lighter tint of the player's colour.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of w.players) {
      if (!p.alive || p.trailPath.length < 2) continue;
      const tp = p.trailPath;
      const head = lerp(p);
      ctx.beginPath();
      ctx.moveTo(tp[0], tp[1]);
      for (let i = 2; i < tp.length - 2; i += 2) ctx.lineTo(tp[i], tp[i + 1]);
      ctx.lineTo(head.x, head.y);
      ctx.strokeStyle = shade(p.color, 0.35);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Locker trail emoji behind the player.
    if (equipped.trail) {
      ctx.font = `2.4px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of trailFx.current) {
        const age = (now - t.t) / 1200;
        ctx.globalAlpha = Math.max(0, 1 - age) * 0.9;
        ctx.fillText(equipped.trail, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      trailFx.current = trailFx.current.filter(t => now - t.t < 1200);
    }

    // Players: round tokens with a direction arrow.
    for (const p of w.players) {
      if (!p.alive) continue;
      const pos = lerp(p);
      const r = 2.3;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(p.heading);
      ctx.beginPath();
      ctx.moveTo(r + 1.6, 0);
      ctx.lineTo(r + 0.2, -1.1);
      ctx.lineTo(r + 0.2, 1.1);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + 0.35, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = shade(p.color, -0.3);
      ctx.fill();
      ctx.lineWidth = p.isHuman ? 0.45 : 0.25;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (p.isHuman && skin) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r - 0.2, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skin, pos.x - r, pos.y - r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.font = `3px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(p.emoji, pos.x, pos.y + 0.15);
      }
      ctx.font = `700 1.7px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(p.isHuman ? (p.name || 'You') : p.name, pos.x, pos.y - r - 1.4);
    }

    // Effects (time-based, so 120 Hz iPads look the same as 60 Hz).
    for (const s of sparks.current) {
      const age = (now - s.t) / 1000;
      if (age > s.life) continue;
      ctx.globalAlpha = Math.max(0, 1 - age / s.life);
      ctx.fillStyle = s.color;
      const k = 1 - Math.exp(-age * 3);
      ctx.fillRect(s.x + s.vx * k - 0.4, s.y + s.vy * k - 0.4, 0.8, 0.8);
    }
    sparks.current = sparks.current.filter(s => (now - s.t) / 1000 < s.life);
    ctx.font = `2.6px "Fredoka One", Nunito, sans-serif`;
    ctx.textAlign = 'center';
    for (const f of floats.current) {
      const age = (now - f.t) / 1000;
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.6 - age) / 0.5));
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.fillStyle = '#fde047';
      const fy = f.y - 4 - age * 3;
      ctx.strokeText(f.text, f.x, fy);
      ctx.fillText(f.text, f.x, fy);
    }
    floats.current = floats.current.filter(f => now - f.t < 1600);
    ctx.globalAlpha = 1;

    // Round minimap (bottom-right).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mm = Math.min(130, cw * 0.24);
    const mx = cw - mm - 12, my = ch - mm - 12;
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx + mm / 2, my + mm / 2, mm / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,17,46,0.75)';
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(minimap, mx, my, mm, mm);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + mm / 2, my + mm / 2, mm / 2, 0, Math.PI * 2);
    ctx.stroke();
    for (const p of w.players) {
      if (!p.alive) continue;
      ctx.fillStyle = p.isHuman ? '#fff' : '#000';
      const r = p.isHuman ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(mx + (p.x / w.size) * mm, my + (p.y / w.size) * mm, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [size, equipped.trail, skin, rebuildShapes, minimap]);

  const pause = useCallback(() => { if (statusRef.current === 'playing') setStatus('paused'); }, []);
  useGameLoop({ tickHz: TICK_HZ, update: () => { if (!holdRef.current) tick(); }, draw, running: status === 'playing', onHidden: pause });

  const aim = useCallback((angle: number) => {
    const w = worldRef.current;
    if (w && statusRef.current === 'playing') steerAngle(w.players[0], angle);
  }, []);
  const turn = useCallback((d: Dir) => {
    const w = worldRef.current;
    if (w && statusRef.current === 'playing') steerDir(w.players[0], d);
  }, []);
  const touch = useSteerInput(areaRef, aim, turn);

  // Joystick ring under the finger (drawn in the DOM so it costs nothing on the canvas).
  const ringRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = touch.current, ring = ringRef.current, knob = knobRef.current;
      if (!ring || !knob) return;
      ring.style.opacity = t.active && statusRef.current === 'playing' ? '1' : '0';
      ring.style.transform = `translate(${t.ox - 44}px, ${t.oy - 44}px)`;
      knob.style.transform = `translate(${t.x - 18}px, ${t.y - 18}px)`;
      knob.style.opacity = ring.style.opacity;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [touch]);

  // Debug hook for automated tests: ?debug&seed=42 exposes the world and a step function.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      start,
      hold: (on = true) => { holdRef.current = on; },
      steerAngle: (rad: number) => aim(rad),
      steerDir: (d: Dir) => turn(d),
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); },
      percent: () => (worldRef.current ? percentOf(worldRef.current, 1) : 0),
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, tick, aim, turn]);

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
          <HowToPlay color={equipped.color} />
          <ul className="space-y-1">
            <li>👆 <b>Drag anywhere</b> to steer — your player follows your finger.</li>
            <li>🧵 Leave your land to draw a trail, then come home to claim everything inside.</li>
            <li>✂️ Cross someone's trail to knock them out — don't let anyone touch <b>yours</b>!</li>
          </ul>
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-2">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-3xl border-2 border-white overflow-hidden" style={{ background: equipped.color }}>
              {skin ? <img src={skin.toDataURL()} alt="" className="w-full h-full" style={{ imageRendering: 'pixelated' }} /> : equipped.avatar}
            </span>
            <span className="flex-1">Your look {equipped.trail && `· trail ${equipped.trail}`}</span>
            <button onClick={() => setGameState('locker')} className="min-h-[44px] px-3 rounded-xl bg-white/15 font-fredoka">🎒 Locker</button>
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
          <StyleSwitch />
        </div>
      }
    >
      <div ref={areaRef} className="absolute inset-0 game-surface" style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} className="w-full h-full block" />

        <div ref={ringRef} className="absolute left-0 top-0 w-[88px] h-[88px] rounded-full border-4 border-white/40 bg-white/10 pointer-events-none opacity-0" />
        <div ref={knobRef} className="absolute left-0 top-0 w-9 h-9 rounded-full bg-white/60 pointer-events-none opacity-0" />

        {status === 'playing' || status === 'paused' ? (
          <>
            <div className="absolute top-2 left-2 rounded-2xl bg-black/45 px-3 py-2 font-fredoka pointer-events-none">
              <div className="text-2xl">⏱️ {mins}:{secs}</div>
              <div className="text-xl text-sky-300">You: {hud.myPct.toFixed(1)}%</div>
            </div>
            <div className="absolute top-2 right-2 rounded-2xl bg-black/45 px-3 py-2 font-nunito text-base min-w-[170px] pointer-events-none">
              {hud.board.map((b, i) => (
                <div key={b.name + i} className={`${b.me ? 'font-bold text-yellow-300' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate">{i + 1}. {b.emoji} {b.name}</span>
                    <span>{b.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 mb-1"><div className="h-full rounded-full" style={{ width: `${Math.min(100, b.pct * 2)}%`, background: b.color }} /></div>
                </div>
              ))}
            </div>
            <FeedList feed={feed} />
          </>
        ) : null}

        {showPad && status === 'playing' && (
          <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1 opacity-80">
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

/** Kill feed under the timer: re-renders a few times a second from the ref. */
function FeedList({ feed }: { feed: React.MutableRefObject<Feed[]> }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force(n => n + 1), 400);
    return () => window.clearInterval(id);
  }, []);
  const now = performance.now();
  const items = feed.current.filter(f => now - f.t < 3500);
  return (
    <div className="absolute top-24 left-2 flex flex-col gap-1 pointer-events-none">
      {items.map(f => (
        <div key={f.t} className="rounded-full bg-black/45 px-3 py-1 font-nunito text-base">💥 {f.text}</div>
      ))}
    </div>
  );
}

/** A tiny looping demo on the start card: a trail leaves home, curves round and fills in. */
function HowToPlay({ color }: { color: string }) {
  const loop = 'M60 70 C 110 70, 150 40, 150 20 C 150 0, 100 -5, 70 20 C 62 30, 60 50, 60 60';
  return (
    <svg viewBox="0 -15 200 100" className="w-full h-28 rounded-2xl bg-indigo-950/60" aria-hidden>
      <circle cx="55" cy="62" r="18" fill={color} />
      <motion.path d={`${loop} Z`} fill={color} initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9, 0.9, 0] }}
        transition={{ duration: 3.2, times: [0, 0.6, 0.68, 0.92, 1], repeat: Infinity }} />
      <motion.path d={loop} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={4} strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 3.2, times: [0, 0.6, 0.92, 1], repeat: Infinity, ease: 'easeInOut' }} />
      <text x="100" y="80" textAnchor="middle" fill="#ddd6fe" fontSize="10" fontFamily="Nunito, sans-serif">Go out, loop round, come home = new land!</text>
    </svg>
  );
}

function burst(list: Spark[], x: number, y: number, color: string, n: number, t: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * 6;
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t, life: 0.5 + Math.random() * 0.5, color });
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(Math.max(0, Math.min(255, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
  return `rgb(${r},${g},${b})`;
}
