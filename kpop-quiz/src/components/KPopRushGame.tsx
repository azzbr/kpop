import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playPop, playCoin, playWrong, playWin, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

/* ====================================================================
   K-POP RUSH — endless runner
   Parallax city · day/night cycle · weather · funny power-ups
   ==================================================================== */

const W = 800;
const H = 400;
const GROUND_Y = 332;
const GRAVITY = 0.74;
const JUMP_V = -14.4;
const AIR_JUMP_V = -12.2;
const PLAYER_X = 96;

const CHARACTERS = ['🐻', '🐰', '🐱', '🦊', '🐯', '🐼', '🐨', '🐸'];
const BUDDIES = ['🐥', '🐧', '🐣', '🐹', '🐶', '🦄', '🐷', '🐢'];

type PowerKind = 'star' | 'magnet' | 'mic' | 'shield' | 'wings';
const POWER_INFO: Record<PowerKind, { emoji: string; label: string; color: string }> = {
  star:   { emoji: '⭐', label: 'STAR POWER!',    color: '#fbbf24' },
  magnet: { emoji: '🧲', label: 'COIN MAGNET!',   color: '#ef4444' },
  mic:    { emoji: '🎤', label: 'DOUBLE POINTS!', color: '#a855f7' },
  shield: { emoji: '🛡️', label: 'SHIELD UP!',     color: '#3b82f6' },
  wings:  { emoji: '🪽', label: 'TRIPLE JUMP!',   color: '#22d3ee' },
};

type Weather = 'clear' | 'rain' | 'snow' | 'sparkle';

interface Box { x: number; y: number; w: number; h: number; }
interface Obstacle extends Box { kind: 'cactus' | 'bigcactus' | 'bird'; smashed: boolean; }
interface Coin extends Box { collected: boolean; vy: number; }
interface PowerUp extends Box { kind: PowerKind; collected: boolean; bob: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface Cloud { x: number; y: number; scale: number; }
interface Building { x: number; w: number; h: number; hue: number; }
interface Mountain { x: number; w: number; h: number; }
interface Bush { x: number; emoji: string; }
interface Wx { x: number; y: number; vx: number; vy: number; size: number; }
interface FloatText { x: number; y: number; life: number; text: string; color: string; }

interface GameData {
  player: { y: number; vy: number; ducking: boolean; jumps: number; runFrame: number };
  buddy: { y: number };
  obstacles: Obstacle[];
  coins: Coin[];
  powerups: PowerUp[];
  particles: Particle[];
  floats: FloatText[];
  clouds: Cloud[];
  buildings: Building[];
  mountains: Mountain[];
  bushes: Bush[];
  weatherP: Wx[];
  score: number;
  distance: number;
  coinCount: number;
  combo: number;
  comboTimer: number;
  speed: number;
  frame: number;
  obstacleTimer: number;
  coinTimer: number;
  powerTimer: number;
  powers: { star: number; magnet: number; mic: number; wings: number };
  shield: boolean;
  timeOfDay: number;
  weather: Weather;
  weatherTimer: number;
  shake: number;
  groundX: number;
  running: boolean;
  charIdx: number;
}

const PHASES = [
  { top: [135, 206, 250], bot: [226, 247, 255], dark: 0.0 },  // day
  { top: [255, 148, 92],  bot: [255, 209, 148], dark: 0.22 }, // sunset
  { top: [18, 22, 62],    bot: [54, 47, 102],   dark: 0.88 }, // night
  { top: [255, 168, 150], bot: [206, 214, 255], dark: 0.26 }, // dawn
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const rndInt = (a: number, b: number) => Math.floor(rnd(a, b + 1));

function rgb(c: number[]) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function mixC(a: number[], b: number[], t: number) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

const KPopRushGame: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameData | null>(null);
  const controlsRef = useRef<{ start: () => void; jump: () => void; duckDown: () => void; duckUp: () => void } | null>(null);

  const [status, setStatus] = useState<'ready' | 'playing' | 'over'>('ready');
  const [charIdx, setCharIdx] = useState(0);
  const charIdxRef = useRef(0);
  const [hud, setHud] = useState({ score: 0, coins: 0, combo: 0 });
  const [over, setOver] = useState({ score: 0, coins: 0, high: 0, isHigh: false, xp: 0 });
  const [confetti, setConfetti] = useState(false);
  const [highScore, setHighScore] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('kpoprush_high') || '0'); } catch { return 0; }
  });

  useEffect(() => { charIdxRef.current = charIdx; }, [charIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    /* ---------- initial state ---------- */
    function freshGame(charIdx: number): GameData {
      const buildings: Building[] = [];
      for (let x = 0; x < W + 120; x += 78) {
        buildings.push({ x, w: rnd(56, 74), h: rnd(70, 180), hue: rnd(200, 280) });
      }
      const mountains: Mountain[] = [];
      for (let x = -60; x < W + 200; x += 210) {
        mountains.push({ x, w: rnd(230, 320), h: rnd(90, 160) });
      }
      const clouds: Cloud[] = [];
      for (let i = 0; i < 5; i++) {
        clouds.push({ x: rnd(0, W), y: rnd(30, 150), scale: rnd(0.6, 1.3) });
      }
      const bushes: Bush[] = [];
      for (let x = 0; x < W + 100; x += rnd(140, 260)) {
        bushes.push({ x, emoji: ['🌳', '🌴', '🌲', '🪴', '🎋'][rndInt(0, 4)] });
      }
      return {
        player: { y: GROUND_Y - 46, vy: 0, ducking: false, jumps: 0, runFrame: 0 },
        buddy: { y: GROUND_Y - 34 },
        obstacles: [], coins: [], powerups: [], particles: [], floats: [],
        clouds, buildings, mountains, bushes, weatherP: [],
        score: 0, distance: 0, coinCount: 0, combo: 0, comboTimer: 0,
        speed: 6, frame: 0,
        obstacleTimer: 70, coinTimer: 150, powerTimer: 520,
        powers: { star: 0, magnet: 0, mic: 0, wings: 0 },
        shield: false,
        timeOfDay: 0, weather: 'clear', weatherTimer: 700,
        shake: 0, groundX: 0, running: false, charIdx,
      };
    }

    gameRef.current = freshGame(0);

    /* ---------- helpers ---------- */
    function spawnParticles(x: number, y: number, n: number, color: string, spread = 4, up = false) {
      const g = gameRef.current!;
      for (let i = 0; i < n; i++) {
        g.particles.push({
          x, y,
          vx: rnd(-spread, spread),
          vy: up ? rnd(-spread, -1) : rnd(-spread, spread * 0.4),
          life: rndInt(18, 38), max: 38,
          color, size: rnd(2, 5),
        });
      }
    }

    function addFloat(x: number, y: number, text: string, color: string) {
      gameRef.current!.floats.push({ x, y, life: 50, text, color });
    }

    function playerBox(): Box {
      const g = gameRef.current!;
      return g.player.ducking
        ? { x: PLAYER_X, y: g.player.y + 22, w: 54, h: 24 }
        : { x: PLAYER_X + 4, y: g.player.y, w: 36, h: 46 };
    }

    function hit(a: Box, b: Box) {
      const m = 6;
      return a.x + m < b.x + b.w && a.x + a.w - m > b.x &&
             a.y + m < b.y + b.h && a.y + a.h - m > b.y;
    }

    /* ---------- controls ---------- */
    function start() {
      gameRef.current = freshGame(charIdxRef.current);
      gameRef.current.running = true;
      setStatus('playing');
      setHud({ score: 0, coins: 0, combo: 0 });
    }
    function jump() {
      const g = gameRef.current;
      if (!g || !g.running) return;
      const allowed = g.powers.wings > 0 ? 3 : 1;
      if (g.player.jumps < allowed) {
        g.player.vy = g.player.jumps === 0 ? JUMP_V : AIR_JUMP_V;
        g.player.jumps++;
        g.player.ducking = false;
        playPop();
        spawnParticles(PLAYER_X + 20, GROUND_Y, 8, '#ffffff', 3, false);
      }
    }
    function duckDown() {
      const g = gameRef.current;
      if (g && g.running) g.player.ducking = true;
    }
    function duckUp() {
      const g = gameRef.current;
      if (g) g.player.ducking = false;
    }
    controlsRef.current = { start, jump, duckDown, duckUp };

    /* ---------- spawning ---------- */
    function spawnObstacle() {
      const g = gameRef.current!;
      const roll = Math.random();
      const tier = Math.min(g.speed / 14, 1);
      if (roll < 0.22 + tier * 0.18) {
        g.obstacles.push({ kind: 'bird', x: W + 20, y: GROUND_Y - 96, w: 44, h: 30, smashed: false });
      } else if (roll < 0.4 + tier * 0.1) {
        g.obstacles.push({ kind: 'bigcactus', x: W + 20, y: GROUND_Y - 52, w: 62, h: 52, smashed: false });
      } else {
        g.obstacles.push({ kind: 'cactus', x: W + 20, y: GROUND_Y - 46, w: 32, h: 46, smashed: false });
      }
    }
    function spawnCoinArc() {
      const g = gameRef.current!;
      const n = rndInt(3, 6);
      const baseY = rnd(GROUND_Y - 150, GROUND_Y - 60);
      for (let i = 0; i < n; i++) {
        const arc = Math.sin((i / (n - 1)) * Math.PI) * 70;
        g.coins.push({ x: W + 20 + i * 38, y: baseY - arc, w: 26, h: 26, collected: false, vy: 0 });
      }
    }
    function spawnPower() {
      const g = gameRef.current!;
      const kinds: PowerKind[] = ['star', 'magnet', 'mic', 'shield', 'wings'];
      const kind = kinds[rndInt(0, kinds.length - 1)];
      g.powerups.push({ kind, x: W + 20, y: rnd(GROUND_Y - 150, GROUND_Y - 70), w: 38, h: 38, collected: false, bob: rnd(0, 6) });
    }

    function endGame() {
      const g = gameRef.current!;
      g.running = false;
      g.shake = 16;
      playWrong();
      const finalScore = Math.floor(g.score);
      const isHigh = finalScore > highScore;
      const newHigh = Math.max(finalScore, highScore);
      if (isHigh) {
        localStorage.setItem('kpoprush_high', String(finalScore));
        setHighScore(finalScore);
        setConfetti(true);
        setTimeout(() => setConfetti(false), 3000);
        playWin();
      }
      const xp = Math.floor(finalScore / 18) + g.coinCount * 2;
      addXP(xp);
      setOver({ score: finalScore, coins: g.coinCount, high: newHigh, isHigh, xp });
      setStatus('over');
    }

    /* ---------- update ---------- */
    function update() {
      const g = gameRef.current!;
      if (!g.running) return;
      g.frame++;
      g.timeOfDay = (g.timeOfDay + 0.00055) % 1;

      // speed ramp
      g.speed = Math.min(6 + g.distance / 900, 14.5);
      g.distance += g.speed;
      const mult = g.powers.mic > 0 ? 2 : 1;
      g.score += g.speed * 0.05 * mult;

      // player physics
      const p = g.player;
      p.vy += GRAVITY;
      if (p.ducking && p.y < GROUND_Y - 47) p.vy += GRAVITY * 0.8; // fast-fall
      p.y += p.vy;
      const floorY = GROUND_Y - 46;
      if (p.y >= floorY) { p.y = floorY; p.vy = 0; p.jumps = 0; }
      p.runFrame += g.speed * 0.12;

      // buddy follows with lag
      g.buddy.y += ((p.y + 10) - g.buddy.y) * 0.12;

      // active powers countdown
      (['star', 'magnet', 'mic', 'wings'] as const).forEach(k => {
        if (g.powers[k] > 0) g.powers[k]--;
      });
      if (g.comboTimer > 0) { g.comboTimer--; if (g.comboTimer === 0) g.combo = 0; }
      if (g.shake > 0) g.shake--;

      // scroll background
      g.groundX = (g.groundX - g.speed) % 40;
      g.mountains.forEach(m => { m.x -= g.speed * 0.15; });
      g.mountains.forEach(m => { if (m.x + m.w < -40) { m.x = W + rnd(0, 120); m.h = rnd(90, 160); m.w = rnd(230, 320); } });
      g.buildings.forEach(b => { b.x -= g.speed * 0.42; });
      g.buildings.forEach(b => {
        if (b.x + b.w < -20) { b.x += g.buildings.length * 78; b.h = rnd(70, 180); b.hue = rnd(200, 280); }
      });
      g.bushes.forEach(b => { b.x -= g.speed; });
      g.bushes.forEach(b => { if (b.x < -60) b.x += W + rnd(160, 320); });
      g.clouds.forEach(c => { c.x -= g.speed * 0.2 * c.scale; if (c.x < -90) { c.x = W + 60; c.y = rnd(30, 150); } });

      // weather
      if (--g.weatherTimer <= 0) {
        const opts: Weather[] = ['clear', 'clear', 'rain', 'snow', 'sparkle'];
        g.weather = opts[rndInt(0, opts.length - 1)];
        g.weatherTimer = rndInt(560, 900);
        g.weatherP = [];
      }
      const targetWx = g.weather === 'clear' ? 0 : g.weather === 'sparkle' ? 26 : 60;
      while (g.weatherP.length < targetWx) {
        g.weatherP.push({
          x: rnd(0, W), y: rnd(-H, 0),
          vx: g.weather === 'rain' ? -3 : g.weather === 'snow' ? rnd(-1, 0.4) : 0,
          vy: g.weather === 'rain' ? 13 : g.weather === 'snow' ? rnd(1, 2.4) : rnd(-0.4, 0.4),
          size: g.weather === 'rain' ? rnd(7, 13) : rnd(2, 5),
        });
      }
      g.weatherP.forEach(d => {
        d.x += d.vx - g.speed * (g.weather === 'rain' ? 0.5 : 0.25);
        d.y += d.vy;
        if (d.y > H || d.x < -20) { d.y = rnd(-40, 0); d.x = rnd(0, W + 40); }
      });

      // spawn timers
      if (--g.obstacleTimer <= 0) {
        spawnObstacle();
        const gap = Math.max(46, rndInt(62, 116) - Math.floor(g.speed));
        g.obstacleTimer = gap;
      }
      if (--g.coinTimer <= 0) { spawnCoinArc(); g.coinTimer = rndInt(150, 320); }
      if (--g.powerTimer <= 0) { spawnPower(); g.powerTimer = rndInt(560, 980); }

      // move obstacles
      g.obstacles.forEach(o => { o.x -= g.speed; });
      g.obstacles = g.obstacles.filter(o => o.x > -80);
      g.coins.forEach(c => { c.x -= g.speed; });
      g.coins = g.coins.filter(c => c.x > -50 && !c.collected);
      g.powerups.forEach(pw => { pw.x -= g.speed; pw.bob += 0.12; });
      g.powerups = g.powerups.filter(pw => pw.x > -60 && !pw.collected);

      // magnet pull
      if (g.powers.magnet > 0) {
        g.coins.forEach(c => {
          if (c.x < 420) {
            const dx = (PLAYER_X + 20) - c.x;
            const dy = (p.y + 20) - c.y;
            c.x += dx * 0.16;
            c.y += dy * 0.16;
          }
        });
      }

      const pb = playerBox();

      // obstacle collision
      for (const o of g.obstacles) {
        if (o.smashed) continue;
        if (hit(pb, o)) {
          if (g.powers.star > 0) {
            o.smashed = true;
            g.score += 25;
            spawnParticles(o.x + o.w / 2, o.y + o.h / 2, 16, '#fbbf24', 6);
            addFloat(o.x, o.y - 10, '+25', '#fbbf24');
            playCoin();
          } else if (g.shield) {
            g.shield = false;
            o.smashed = true;
            g.shake = 12;
            spawnParticles(o.x + o.w / 2, o.y + o.h / 2, 18, '#3b82f6', 6);
            addFloat(PLAYER_X, p.y - 14, 'SAVED!', '#3b82f6');
            playUnlock();
          } else {
            spawnParticles(PLAYER_X + 20, p.y + 20, 22, '#ef4444', 7);
            endGame();
            return;
          }
        }
      }

      // coin collection
      for (const c of g.coins) {
        if (!c.collected && hit(pb, c)) {
          c.collected = true;
          g.coinCount++;
          g.combo++;
          g.comboTimer = 90;
          const cm = 1 + Math.floor(g.combo / 5);
          g.score += 12 * cm * mult;
          spawnParticles(c.x + 13, c.y + 13, 8, '#fde047', 4, true);
          if (g.combo > 1 && g.combo % 5 === 0) addFloat(c.x, c.y - 12, `COMBO x${cm}!`, '#f97316');
          playCoin();
        }
      }

      // powerup collection
      for (const pw of g.powerups) {
        if (!pw.collected && hit(pb, pw)) {
          pw.collected = true;
          const info = POWER_INFO[pw.kind];
          if (pw.kind === 'shield') g.shield = true;
          else g.powers[pw.kind] = pw.kind === 'star' ? 380 : pw.kind === 'magnet' ? 440 : 500;
          addFloat(PLAYER_X, p.y - 20, info.label, info.color);
          spawnParticles(pw.x + 19, pw.y + 19, 20, info.color, 6);
          playUnlock();
        }
      }

      // particles & floats
      g.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.22; pt.life--; });
      g.particles = g.particles.filter(pt => pt.life > 0);
      g.floats.forEach(f => { f.y -= 1.1; f.life--; });
      g.floats = g.floats.filter(f => f.life > 0);
    }

    /* ---------- draw ---------- */
    function sky(t: number) {
      const seg = t * 4;
      const i = Math.floor(seg) % 4;
      const f = seg - Math.floor(seg);
      const a = PHASES[i], b = PHASES[(i + 1) % 4];
      return {
        top: mixC(a.top, b.top, f),
        bot: mixC(a.bot, b.bot, f),
        dark: lerp(a.dark, b.dark, f),
      };
    }

    function draw() {
      const g = gameRef.current!;
      const sk = sky(g.timeOfDay);

      ctx.save();
      if (g.shake > 0) ctx.translate(rnd(-g.shake, g.shake) * 0.5, rnd(-g.shake, g.shake) * 0.5);

      // sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, rgb(sk.top));
      grad.addColorStop(1, rgb(sk.bot));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // stars (night)
      if (sk.dark > 0.4) {
        ctx.fillStyle = `rgba(255,255,255,${(sk.dark - 0.4) * 1.5})`;
        for (let i = 0; i < 40; i++) {
          const sx = (i * 197 + 30) % W;
          const sy = (i * 113 + 20) % 200;
          const tw = 0.6 + 0.4 * Math.sin(g.frame * 0.05 + i);
          ctx.globalAlpha = (sk.dark - 0.4) * 1.5 * tw;
          ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // sun / moon
      const celY = 70 + Math.sin(g.timeOfDay * Math.PI * 2) * 40;
      const celX = 120 + ((g.timeOfDay * 1.4) % 1) * 560;
      if (sk.dark > 0.5) {
        ctx.font = '46px serif';
        ctx.fillText('🌙', celX, celY);
      } else {
        ctx.fillStyle = sk.dark > 0.15 ? '#ff8c42' : '#fff3b0';
        ctx.beginPath();
        ctx.arc(celX, celY, 28, 0, Math.PI * 2);
        ctx.fill();
      }

      // mountains (far parallax)
      g.mountains.forEach(m => {
        ctx.fillStyle = `rgba(${120 - sk.dark * 80},${140 - sk.dark * 90},${170 - sk.dark * 80},0.7)`;
        ctx.beginPath();
        ctx.moveTo(m.x, GROUND_Y);
        ctx.lineTo(m.x + m.w / 2, GROUND_Y - m.h);
        ctx.lineTo(m.x + m.w, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      });

      // clouds
      g.clouds.forEach(c => {
        ctx.fillStyle = sk.dark > 0.5 ? 'rgba(180,180,210,0.5)' : 'rgba(255,255,255,0.85)';
        const s = c.scale;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 18 * s, 0, Math.PI * 2);
        ctx.arc(c.x + 20 * s, c.y - 6 * s, 22 * s, 0, Math.PI * 2);
        ctx.arc(c.x + 42 * s, c.y, 18 * s, 0, Math.PI * 2);
        ctx.fill();
      });

      // city buildings (mid parallax)
      g.buildings.forEach(b => {
        const shade = 1 - sk.dark * 0.55;
        ctx.fillStyle = `hsl(${b.hue}, 30%, ${42 * shade + 8}%)`;
        ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
        // windows
        for (let wy = GROUND_Y - b.h + 10; wy < GROUND_Y - 12; wy += 18) {
          for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
            const litUp = sk.dark > 0.4 && ((wx + wy) % 3 === 0);
            ctx.fillStyle = litUp ? 'rgba(255,225,120,0.95)' : `rgba(40,40,70,${0.25 + sk.dark * 0.3})`;
            ctx.fillRect(wx, wy, 8, 10);
          }
        }
      });

      // ground
      ctx.fillStyle = sk.dark > 0.5 ? '#2a2a3e' : '#6ab04c';
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = sk.dark > 0.5 ? '#1f1f30' : '#5a9e3f';
      ctx.fillRect(0, GROUND_Y, W, 8);
      // ground dashes
      ctx.fillStyle = sk.dark > 0.5 ? '#3a3a52' : '#7cc55c';
      for (let x = g.groundX; x < W; x += 40) {
        ctx.fillRect(x, GROUND_Y + 16, 20, 5);
      }

      // bushes (foreground decor)
      g.bushes.forEach(b => {
        ctx.font = '34px serif';
        ctx.globalAlpha = 0.9;
        ctx.fillText(b.emoji, b.x, GROUND_Y + 6);
        ctx.globalAlpha = 1;
      });

      // coins
      g.coins.forEach(c => {
        if (c.collected) return;
        const spin = Math.abs(Math.sin(g.frame * 0.12 + c.x * 0.04));
        ctx.font = `${20 + spin * 8}px serif`;
        ctx.fillText('🪙', c.x + (1 - spin) * 6, c.y + 22);
      });

      // powerups
      g.powerups.forEach(pw => {
        if (pw.collected) return;
        const by = Math.sin(pw.bob) * 6;
        const info = POWER_INFO[pw.kind];
        ctx.save();
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.arc(pw.x + 19, pw.y + 19 + by, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.font = '30px serif';
        ctx.fillText(info.emoji, pw.x + 4, pw.y + 30 + by);
      });

      // obstacles
      g.obstacles.forEach(o => {
        if (o.smashed) return;
        if (o.kind === 'bird') {
          const flap = Math.sin(g.frame * 0.4) > 0 ? '🐦' : '🕊️';
          ctx.font = '40px serif';
          ctx.fillText(flap, o.x, o.y + 32);
        } else if (o.kind === 'bigcactus') {
          ctx.font = '52px serif';
          ctx.fillText('🌵', o.x, o.y + 48);
        } else {
          ctx.font = '44px serif';
          ctx.fillText('🌵', o.x, o.y + 42);
        }
      });

      // player + buddy
      const p = g.player;
      const starOn = g.powers.star > 0;

      // buddy (cosmetic, trails behind)
      ctx.save();
      if (starOn) ctx.filter = `hue-rotate(${g.frame * 8}deg)`;
      ctx.font = '26px serif';
      const buddyBob = Math.sin(p.runFrame) * 3;
      ctx.fillText(BUDDIES[g.charIdx % BUDDIES.length], PLAYER_X - 38, g.buddy.y + 24 + buddyBob);
      ctx.restore();

      // player
      ctx.save();
      const px = PLAYER_X + 20;
      const py = p.ducking ? p.y + 30 : p.y + 24;
      ctx.translate(px, py);
      if (starOn) {
        ctx.filter = `hue-rotate(${g.frame * 14}deg)`;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 22;
      }
      if (g.shield) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(59,130,246,0.8)';
        ctx.lineWidth = 3;
        ctx.arc(0, -4, 32, 0, Math.PI * 2);
        ctx.stroke();
      }
      const bob = p.y >= GROUND_Y - 47 ? Math.sin(p.runFrame) * 2 : 0;
      const tilt = p.vy < 0 ? -0.15 : p.vy > 6 ? 0.2 : 0;
      ctx.rotate(tilt);
      ctx.font = p.ducking ? '34px serif' : '42px serif';
      ctx.textAlign = 'center';
      ctx.fillText(CHARACTERS[g.charIdx], 0, 14 + bob);
      ctx.textAlign = 'left';
      ctx.restore();

      // jump dust when grounded running
      if (p.y >= GROUND_Y - 47 && g.frame % 8 === 0 && g.running) {
        spawnParticles(PLAYER_X + 4, GROUND_Y - 2, 2, sk.dark > 0.5 ? '#555' : '#cdeac0', 2);
      }

      // particles
      g.particles.forEach(pt => {
        ctx.globalAlpha = pt.life / pt.max;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;

      // float texts
      g.floats.forEach(f => {
        ctx.globalAlpha = Math.min(1, f.life / 25);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 20px Fredoka, sans-serif';
        ctx.fillText(f.text, f.x, f.y);
      });
      ctx.globalAlpha = 1;

      // weather overlay
      if (g.weather === 'rain') {
        ctx.strokeStyle = 'rgba(160,190,230,0.55)';
        ctx.lineWidth = 2;
        g.weatherP.forEach(d => {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 3, d.y + d.size);
          ctx.stroke();
        });
      } else if (g.weather === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        g.weatherP.forEach(d => {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (g.weather === 'sparkle') {
        g.weatherP.forEach((d, i) => {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.frame * 0.1 + i);
          ctx.font = `${d.size + 8}px serif`;
          ctx.fillText('✨', d.x, d.y);
        });
        ctx.globalAlpha = 1;
      }

      // night darkening tint
      if (sk.dark > 0.55) {
        ctx.fillStyle = `rgba(10,10,40,${(sk.dark - 0.55) * 0.5})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();

      /* ---- HUD (on canvas, not shaken) ---- */
      ctx.fillStyle = sk.dark > 0.5 ? '#fff' : '#1f2937';
      ctx.font = 'bold 26px Fredoka, sans-serif';
      ctx.fillText(`${Math.floor(g.score)}`, 16, 36);
      ctx.font = '14px Nunito, sans-serif';
      ctx.fillText('SCORE', 18, 52);

      ctx.textAlign = 'right';
      ctx.font = 'bold 18px Fredoka, sans-serif';
      ctx.fillText(`🏆 ${Math.max(highScore, Math.floor(g.score))}`, W - 16, 30);
      ctx.fillText(`🪙 ${g.coinCount}`, W - 16, 54);
      ctx.textAlign = 'left';

      if (g.combo >= 5) {
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 18px Fredoka, sans-serif';
        ctx.fillText(`🔥 COMBO x${1 + Math.floor(g.combo / 5)}`, 16, 78);
      }

      // active power timers
      let hx = 16;
      const hy = g.combo >= 5 ? 96 : 76;
      (['star', 'magnet', 'mic', 'wings'] as const).forEach(k => {
        if (g.powers[k] > 0) {
          const info = POWER_INFO[k];
          ctx.font = '20px serif';
          ctx.fillText(info.emoji, hx, hy);
          const maxT = k === 'star' ? 380 : k === 'magnet' ? 440 : 500;
          ctx.fillStyle = info.color;
          ctx.fillRect(hx, hy + 4, 24 * (g.powers[k] / maxT), 4);
          hx += 36;
        }
      });
      if (g.shield) {
        ctx.font = '20px serif';
        ctx.fillText('🛡️', hx, hy);
      }
    }

    /* ---------- loop ---------- */
    let hudTick = 0;
    function loop() {
      update();
      draw();
      const g = gameRef.current!;
      if (g.running && ++hudTick % 6 === 0) {
        setHud({ score: Math.floor(g.score), coins: g.coinCount, combo: g.combo });
      }
      raf = requestAnimationFrame(loop);
    }

    /* ---------- input ---------- */
    function onKeyDown(e: KeyboardEvent) {
      const g = gameRef.current;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!g || !g.running) start();
        else jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        duckDown();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') duckUp();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- pointer (mobile) ---------- */
  const handleJumpDown = () => {
    if (status === 'playing') controlsRef.current?.jump();
    else controlsRef.current?.start();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {confetti && <ConfettiBurst count={80} durationMs={3000} />}

      <div className="w-full max-w-3xl mx-auto">
        <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary mb-3">← Back</button>

        <div className="text-center mb-3">
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">
            🏃 K-Pop Rush
          </h1>
          <p className="font-nunito text-gray-500 text-sm">
            Jump 🆙 · Duck ⬇️ · Grab coins & power-ups · Survive the city!
          </p>
        </div>

        {/* Canvas + overlays */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl border-4 border-purple-300">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={() => { if (status === 'playing') controlsRef.current?.jump(); }}
            className="w-full block bg-sky-200 touch-none cursor-pointer"
            style={{ aspectRatio: '2 / 1' }}
          />

          {/* Ready overlay */}
          <AnimatePresence>
            {status === 'ready' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-purple-900/70 flex flex-col items-center justify-center text-center p-4"
              >
                <h2 className="text-2xl md:text-3xl font-fredoka font-bold text-white mb-1">Pick your runner!</h2>
                <div className="flex flex-wrap gap-2 justify-center my-3 max-w-md">
                  {CHARACTERS.map((c, i) => (
                    <button
                      key={c}
                      onClick={() => setCharIdx(i)}
                      className={`text-3xl w-14 h-14 rounded-2xl border-2 transition-all ${
                        charIdx === i ? 'bg-yellow-300 border-yellow-500 scale-110' : 'bg-white/80 border-white/40'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="font-nunito text-white/80 text-sm mb-3">
                  Runner {CHARACTERS[charIdx]} + buddy {BUDDIES[charIdx % BUDDIES.length]}
                </p>
                <button
                  onClick={handleJumpDown}
                  className="btn-kid text-xl px-8 py-3"
                >
                  ▶️ Start Running!
                </button>
                <p className="font-nunito text-white/60 text-xs mt-3">Press SPACE or tap to jump</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game over overlay */}
          <AnimatePresence>
            {status === 'over' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-purple-900/80 flex flex-col items-center justify-center text-center p-4"
              >
                <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="text-5xl mb-1">
                  {over.isHigh ? '🏆' : '💥'}
                </motion.div>
                <h2 className="text-2xl md:text-3xl font-fredoka font-bold text-white">
                  {over.isHigh ? 'NEW HIGH SCORE!' : 'Game Over!'}
                </h2>
                <div className="flex gap-4 my-3">
                  <div className="bg-white/15 rounded-xl px-4 py-2">
                    <p className="font-fredoka text-2xl font-bold text-yellow-300">{over.score}</p>
                    <p className="font-nunito text-white/70 text-xs">SCORE</p>
                  </div>
                  <div className="bg-white/15 rounded-xl px-4 py-2">
                    <p className="font-fredoka text-2xl font-bold text-yellow-300">🪙 {over.coins}</p>
                    <p className="font-nunito text-white/70 text-xs">COINS</p>
                  </div>
                  <div className="bg-white/15 rounded-xl px-4 py-2">
                    <p className="font-fredoka text-2xl font-bold text-green-300">+{over.xp}</p>
                    <p className="font-nunito text-white/70 text-xs">XP</p>
                  </div>
                </div>
                <p className="font-nunito text-white/80 text-sm mb-3">Best: {over.high}</p>
                <div className="flex gap-3">
                  <button onClick={handleJumpDown} className="btn-kid px-6 py-2">🔄 Run Again</button>
                  <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary px-6 py-2">🏠 Home</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live HUD chips */}
        {status === 'playing' && (
          <div className="flex justify-center gap-3 mt-3">
            <span className="bg-white rounded-full px-4 py-1 shadow font-fredoka text-purple-600">⭐ {hud.score}</span>
            <span className="bg-white rounded-full px-4 py-1 shadow font-fredoka text-yellow-600">🪙 {hud.coins}</span>
            {hud.combo >= 5 && (
              <span className="bg-orange-100 rounded-full px-4 py-1 shadow font-fredoka text-orange-600">
                🔥 x{1 + Math.floor(hud.combo / 5)}
              </span>
            )}
          </div>
        )}

        {/* Mobile controls */}
        <div className="flex gap-3 mt-4 md:hidden">
          <button
            onPointerDown={(e) => { e.preventDefault(); handleJumpDown(); }}
            className="flex-1 py-5 bg-gradient-to-b from-purple-400 to-purple-600 text-white rounded-2xl font-fredoka font-bold text-xl shadow-lg active:scale-95"
          >
            ⬆️ JUMP
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); controlsRef.current?.duckDown(); }}
            onPointerUp={(e) => { e.preventDefault(); controlsRef.current?.duckUp(); }}
            onPointerLeave={() => controlsRef.current?.duckUp()}
            className="flex-1 py-5 bg-gradient-to-b from-blue-400 to-blue-600 text-white rounded-2xl font-fredoka font-bold text-xl shadow-lg active:scale-95"
          >
            ⬇️ DUCK
          </button>
        </div>

        {/* Power-up legend */}
        <div className="mt-4 bg-white rounded-2xl p-4 shadow border-2 border-purple-100">
          <h3 className="font-fredoka font-bold text-purple-600 mb-2 text-center">✨ Power-Ups</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
            {(Object.keys(POWER_INFO) as PowerKind[]).map(k => (
              <div key={k} className="bg-purple-50 rounded-xl p-2">
                <div className="text-2xl">{POWER_INFO[k].emoji}</div>
                <div className="font-fredoka text-xs text-gray-600">{POWER_INFO[k].label}</div>
              </div>
            ))}
          </div>
          <p className="font-nunito text-gray-400 text-xs text-center mt-2">
            🌵 Jump over cactus · 🐦 Duck under birds · 🪙 Chain coins for combos!
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default KPopRushGame;
