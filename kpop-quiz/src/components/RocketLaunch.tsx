import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCoin, playWrong, playWin, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const W = 800, H = 420;
const GRAVITY = 0.22;
const LAUNCH_X = 80;
const GROUND_Y = 370;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Target { x: number; y: number; radius: number; hit: boolean; shake: number; }
interface Rocket { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; alive: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface Cloud { x: number; y: number; scale: number; }

const LEVEL_TARGETS: { x: number; y: number; radius: number }[] = [
  { x: 260, y: GROUND_Y - 60,  radius: 38 },
  { x: 380, y: GROUND_Y - 110, radius: 34 },
  { x: 510, y: GROUND_Y - 80,  radius: 30 },
  { x: 630, y: GROUND_Y - 140, radius: 28 },
  { x: 710, y: GROUND_Y - 60,  radius: 26 },
];

const STAGE_NAMES = ['Warm-Up', 'Easy', 'Medium', 'Hard', 'Expert'];

const RocketLaunch: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(55);
  const [stage, setStage] = useState(0);
  const [triesLeft, setTriesLeft] = useState(3);
  const [score, setScore] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [status, setStatus] = useState<'aim' | 'flight' | 'hit' | 'miss' | 'done'>('aim');
  const [hitMsg, setHitMsg] = useState('');
  const [confetti, setConfetti] = useState(false);

  const gameRef = useRef({
    targets: LEVEL_TARGETS.map((t, i) => ({ ...t, hit: i < 0, shake: 0 })) as Target[],
    rocket: null as Rocket | null,
    particles: [] as Particle[],
    clouds: [
      { x: 120, y: 60, scale: 0.9 },
      { x: 360, y: 40, scale: 1.1 },
      { x: 580, y: 80, scale: 0.7 },
      { x: 700, y: 50, scale: 1.0 },
    ] as Cloud[],
    frame: 0,
    stageHit: false,
  });

  const stageRef = useRef(stage);
  const triesRef = useRef(triesLeft);
  const scoreRef = useRef(score);
  const launchRef = useRef<{ angle: number; power: number }>({ angle: 45, power: 55 });
  const statusRef = useRef(status);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { triesRef.current = triesLeft; }, [triesLeft]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { launchRef.current = { angle, power }; }, [angle, power]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    function spawnParticles(x: number, y: number, color: string, n = 14) {
      const g = gameRef.current;
      for (let i = 0; i < n; i++) {
        g.particles.push({ x, y, vx: rnd(-6, 6), vy: rnd(-8, 0), life: rnd(20, 40), max: 40, color, size: rnd(3, 7) });
      }
    }

    function launch() {
      if (statusRef.current !== 'aim') return;
      const { angle: a, power: p } = launchRef.current;
      const rad = (a * Math.PI) / 180;
      const v = p * 0.19;
      gameRef.current.rocket = {
        x: LAUNCH_X, y: GROUND_Y - 50,
        vx: v * Math.cos(rad), vy: -v * Math.sin(rad),
        trail: [], alive: true,
      };
      gameRef.current.stageHit = false;
    }

    // expose launch globally for React buttons
    (window as unknown as Record<string, unknown>).__rocketLaunch = launch;

    function drawSky() {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1e3a5f');
      grad.addColorStop(0.6, '#2d6a8c');
      grad.addColorStop(1, '#4a9aba');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    function drawClouds() {
      const g = gameRef.current;
      g.clouds.forEach(c => {
        c.x -= 0.3;
        if (c.x < -120) c.x = W + 80;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 22 * c.scale, 0, Math.PI * 2);
        ctx.arc(c.x + 28 * c.scale, c.y - 8 * c.scale, 28 * c.scale, 0, Math.PI * 2);
        ctx.arc(c.x + 56 * c.scale, c.y, 22 * c.scale, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawCity() {
      const buildings = [
        { x: 200, w: 55, h: 90 }, { x: 265, w: 40, h: 130 }, { x: 315, w: 65, h: 75 },
        { x: 390, w: 50, h: 110 }, { x: 450, w: 45, h: 155 }, { x: 505, w: 60, h: 90 },
        { x: 575, w: 45, h: 120 }, { x: 630, w: 55, h: 80 }, { x: 695, w: 50, h: 100 },
      ];
      buildings.forEach(b => {
        ctx.fillStyle = '#1a2e48';
        ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
        // windows
        for (let wy = GROUND_Y - b.h + 10; wy < GROUND_Y - 14; wy += 18) {
          for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) {
            ctx.fillStyle = Math.random() > 0.7 ? 'rgba(255,220,80,0.9)' : 'rgba(40,70,100,0.6)';
            ctx.fillRect(wx, wy, 7, 9);
          }
        }
      });
    }

    function drawGround() {
      ctx.fillStyle = '#2d5a1b';
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = '#3a7a24';
      ctx.fillRect(0, GROUND_Y, W, 6);
    }

    function drawLauncher() {
      const { angle: a } = launchRef.current;
      const rad = (a * Math.PI) / 180;
      ctx.save();
      ctx.translate(LAUNCH_X, GROUND_Y - 20);
      // base
      ctx.fillStyle = '#666';
      ctx.fillRect(-14, -10, 28, 14);
      // barrel
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * 38, -Math.sin(rad) * 38);
      ctx.stroke();
      // angle indicator
      ctx.fillStyle = '#fff';
      ctx.font = '13px Fredoka, sans-serif';
      ctx.fillText(`${a}°`, -40, -28);
      ctx.restore();
    }

    function drawTargets() {
      const g = gameRef.current;
      const curStage = stageRef.current;
      g.targets.forEach((t, i) => {
        if (t.hit) return;
        const active = i === curStage;
        const shake = t.shake > 0 ? (Math.random() - 0.5) * 4 : 0;
        if (t.shake > 0) t.shake--;

        ctx.save();
        ctx.translate(t.x + shake, t.y + shake);
        if (active) {
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 22 + 8 * Math.sin(g.frame * 0.12);
        }
        ctx.font = `${t.radius * 2.2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', 0, 0);

        if (active) {
          ctx.strokeStyle = 'rgba(251,191,36,0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, t.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          // stage label
          ctx.font = 'bold 14px Fredoka, sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`${i + 1}/${LEVEL_TARGETS.length}`, 0, -t.radius - 14);
        }
        ctx.restore();
      });
    }

    function drawTrajectoryPreview() {
      if (statusRef.current !== 'aim') return;
      const { angle: a, power: p } = launchRef.current;
      const rad = (a * Math.PI) / 180;
      const v = p * 0.19;
      let px = LAUNCH_X, py = GROUND_Y - 50;
      let pvx = v * Math.cos(rad), pvy = -v * Math.sin(rad);
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let i = 0; i < 140; i++) {
        pvy += GRAVITY;
        px += pvx; py += pvy;
        ctx.lineTo(px, py);
        if (py > GROUND_Y || px > W + 50) break;
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawRocket() {
      const g = gameRef.current;
      const r = g.rocket;
      if (!r || !r.alive) return;

      // trail
      r.trail.forEach((pt, i) => {
        ctx.globalAlpha = (i / r.trail.length) * 0.5;
        ctx.fillStyle = '#f97316';
        const sz = (i / r.trail.length) * 8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, sz, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // rocket emoji
      const angle = Math.atan2(r.vy, r.vx) - Math.PI / 2;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(angle);
      ctx.font = '34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);
      ctx.restore();
    }

    function updateRocket() {
      const g = gameRef.current;
      const r = g.rocket;
      if (!r || !r.alive) return;

      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 24) r.trail.shift();

      r.vy += GRAVITY;
      r.x += r.vx; r.y += r.vy;

      // check hit current target
      const t = g.targets[stageRef.current];
      if (t && !t.hit) {
        const dx = r.x - t.x, dy = r.y - t.y;
        if (dx * dx + dy * dy < t.radius * t.radius) {
          t.hit = true;
          r.alive = false;
          g.stageHit = true;
          spawnParticles(t.x, t.y, '#fbbf24', 22);
          playCoin();
          const bonus = Math.max(0, triesRef.current - 1) * 30;
          const earned = 100 + bonus;
          const nextScore = scoreRef.current + earned;
          scoreRef.current = nextScore;
          setScore(nextScore);
          setHitMsg(`🎯 HIT! +${earned} pts${bonus > 0 ? ` (accuracy bonus!)` : ''}`);
          const nextStage = stageRef.current + 1;
          if (nextStage >= LEVEL_TARGETS.length) {
            setTimeout(() => {
              setStatus('done');
              const best = parseInt(localStorage.getItem('rocket_best') || '0');
              if (nextScore > best) localStorage.setItem('rocket_best', String(nextScore));
              addXP(Math.floor(nextScore / 12));
              playWin();
              setConfetti(true);
              setTimeout(() => setConfetti(false), 3000);
            }, 800);
          } else {
            setTimeout(() => {
              setStage(nextStage);
              stageRef.current = nextStage;
              setTriesLeft(3);
              triesRef.current = 3;
              setStatus('aim');
            }, 900);
          }
          setStatus('hit');
          return;
        }
      }

      // off screen
      if (r.y > GROUND_Y || r.x > W + 50 || r.x < -50) {
        r.alive = false;
        playWrong();
        const newTries = triesRef.current - 1;
        setTriesLeft(newTries);
        triesRef.current = newTries;
        if (newTries <= 0) {
          // skip to next with 0 pts
          const nextStage = stageRef.current + 1;
          if (nextStage >= LEVEL_TARGETS.length) {
            setTimeout(() => setStatus('done'), 500);
          } else {
            setTimeout(() => {
              setStage(nextStage);
              stageRef.current = nextStage;
              setTriesLeft(3);
              triesRef.current = 3;
              setStatus('aim');
            }, 600);
          }
          setHitMsg('❌ Out of tries! Moving on...');
        } else {
          setHitMsg(`💨 Missed! ${newTries} ${newTries === 1 ? 'try' : 'tries'} left`);
        }
        setStatus('miss');
        setTimeout(() => setStatus('aim'), 900);
      }
    }

    function draw() {
      const g = gameRef.current;
      g.frame++;
      updateRocket();

      drawSky();
      drawClouds();
      drawCity();
      drawGround();
      drawTargets();
      drawTrajectoryPreview();
      drawLauncher();
      drawRocket();

      // particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life--;
      }
      g.particles = g.particles.filter(p => p.life > 0);
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doLaunch = () => {
    if (launching || status !== 'aim') return;
    const fn = (window as unknown as Record<string, unknown>).__rocketLaunch;
    if (typeof fn === 'function') fn();
    setLaunching(true);
    setStatus('flight');
    playPop();
    setTimeout(() => setLaunching(false), 400);
  };

  const resetGame = () => {
    playClick();
    gameRef.current.targets = LEVEL_TARGETS.map(t => ({ ...t, hit: false, shake: 0 }));
    gameRef.current.rocket = null;
    gameRef.current.particles = [];
    setStage(0);
    stageRef.current = 0;
    setTriesLeft(3);
    triesRef.current = 3;
    setScore(0);
    scoreRef.current = 0;
    setStatus('aim');
    setHitMsg('');
    setConfetti(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}
    >
      {confetti && <ConfettiBurst count={80} durationMs={3000} />}
      <div className="w-full max-w-3xl mx-auto">
        <button onClick={() => { playClick(); setGameState('boys_zone'); }}
          className="mb-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-fredoka text-sm border border-white/20">
          ← Boys Zone
        </button>

        <div className="text-center mb-3">
          <h1 className="text-4xl font-fredoka font-bold text-white">🚀 Rocket Launch</h1>
          <p className="font-nunito text-emerald-300 text-sm">Aim right · Hit the ⭐ targets · Score big!</p>
        </div>

        {/* Stats bar */}
        <div className="flex justify-between bg-white/10 border border-white/20 rounded-2xl px-4 py-2 mb-3 backdrop-blur">
          <span className="font-fredoka font-bold text-white">🎯 Stage {stage + 1}/5 · {STAGE_NAMES[stage]}</span>
          <span className="font-fredoka text-yellow-300">⭐ {score}</span>
          <span className="font-fredoka text-red-300">❤️ {triesLeft} tries</span>
        </div>

        {/* Canvas */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/30 mb-4">
          <canvas
            ref={canvasRef}
            width={W} height={H}
            className="w-full block"
            style={{ aspectRatio: `${W}/${H}` }}
          />

          {/* Done overlay */}
          <AnimatePresence>
            {status === 'done' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/75 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-br from-emerald-900 to-teal-900 border-2 border-emerald-400 rounded-3xl p-8 text-center max-w-xs mx-4"
                >
                  <div className="text-5xl mb-2">🏆</div>
                  <h2 className="text-3xl font-fredoka font-bold text-white mb-1">Mission Complete!</h2>
                  <p className="font-fredoka text-2xl text-yellow-300 mb-1">⭐ {score} pts</p>
                  <p className="font-nunito text-emerald-200 text-sm mb-4">+{Math.floor(score / 12)} XP earned!</p>
                  <button onClick={resetGame} className="btn-kid mr-2">🔄 Play Again</button>
                  <button onClick={() => setGameState('boys_zone')} className="btn-kid-secondary">← Zone</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hit/miss message */}
        <AnimatePresence>
          {hitMsg && status !== 'aim' && (
            <motion.div
              key={hitMsg}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center font-fredoka font-bold text-xl mb-3 ${
                status === 'hit' ? 'text-yellow-300' : 'text-red-300'
              }`}
            >
              {hitMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-fredoka text-white">🎯 Angle</span>
                <span className="font-fredoka font-bold text-emerald-300 text-lg">{angle}°</span>
              </div>
              <input
                type="range" min="5" max="85" value={angle}
                onChange={e => { setAngle(parseInt(e.target.value)); }}
                disabled={status !== 'aim'}
                className="w-full accent-emerald-400"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-fredoka text-white">💥 Power</span>
                <span className="font-fredoka font-bold text-orange-300 text-lg">{power}%</span>
              </div>
              <input
                type="range" min="10" max="100" value={power}
                onChange={e => { setPower(parseInt(e.target.value)); }}
                disabled={status !== 'aim'}
                className="w-full accent-orange-400"
              />
            </div>
          </div>
          <button
            onClick={doLaunch}
            disabled={status !== 'aim' || launching}
            className={`w-full py-4 rounded-2xl font-fredoka font-bold text-xl text-white transition-all shadow-lg
              ${status === 'aim' && !launching
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-95'
                : 'bg-gray-600 opacity-50 cursor-not-allowed'
              }`}
          >
            🚀 LAUNCH!
          </button>
        </div>

        <p className="text-center font-nunito text-white/30 text-xs mt-3">
          💡 The dotted line shows your predicted trajectory. Aim carefully!
        </p>
      </div>
    </motion.div>
  );
};

export default RocketLaunch;
