import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playPop, playCoin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Prize {
  label: string;
  emoji: string;
  color: string;
  message: string;
  type: 'xp' | 'fun' | 'badge' | 'fact';
  value?: number;
}

const PRIZES: Prize[] = [
  { label: '50 XP!', emoji: '⭐', color: '#f59e0b', message: 'You earned 50 bonus XP! Keep shining!', type: 'xp', value: 50 },
  { label: 'Fun Fact!', emoji: '🧠', color: '#6366f1', message: 'Did you know? BTS holds the world record for most Twitter engagements! 🤯', type: 'fact' },
  { label: '100 XP!', emoji: '🌟', color: '#8b5cf6', message: 'Amazing! 100 bonus XP is yours! You\'re unstoppable!', type: 'xp', value: 100 },
  { label: 'K-pop Joke!', emoji: '😂', color: '#10b981', message: 'Why did the K-pop idol bring a ladder? Because they wanted to reach the high notes! 🎤', type: 'fun' },
  { label: '25 XP!', emoji: '💫', color: '#ec4899', message: 'Nice spin! 25 XP added to your total!', type: 'xp', value: 25 },
  { label: 'Fun Fact!', emoji: '🎵', color: '#f97316', message: 'Blackpink\'s "How You Like That" set 9 world records in 24 hours! 🔥', type: 'fact' },
  { label: '75 XP!', emoji: '🏆', color: '#3b82f6', message: 'Jackpot! 75 XP — you\'re climbing the ranks fast!', type: 'xp', value: 75 },
  { label: 'Dance Challenge!', emoji: '💃', color: '#ef4444', message: 'Your challenge: Do 10 jumping jacks right now! Dance it out! 🕺', type: 'fun' },
];

const SEGMENT_ANGLE = 360 / PRIZES.length;

const DailySpinWheel: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [canSpin, setCanSpin] = useState(true);
  const [spinsToday, setSpinsToday] = useState(0);
  const MAX_SPINS = 3;

  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('spinWheel');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        setSpinsToday(data.count);
        if (data.count >= MAX_SPINS) setCanSpin(false);
      }
    }
  }, []);

  const drawWheel = (rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    PRIZES.forEach((prize, i) => {
      const startAngle = ((i * SEGMENT_ANGLE - 90 + rot) * Math.PI) / 180;
      const endAngle = (((i + 1) * SEGMENT_ANGLE - 90 + rot) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((i + 0.5) * SEGMENT_ANGLE - 90 + rot) * Math.PI / 180);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Fredoka One, sans-serif';
      ctx.fillText(prize.emoji + ' ' + prize.label, r - 10, 6);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  useEffect(() => {
    drawWheel(rotation);
  }, [rotation]);

  const spin = () => {
    if (spinning || !canSpin) return;
    playClick();
    setResult(null);
    setSpinning(true);

    const extraSpins = 5 + Math.random() * 5;
    const targetAngle = extraSpins * 360 + Math.random() * 360;
    const duration = 4000;
    const start = performance.now();
    const startRot = rotation;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentRot = startRot + targetAngle * eased;
      setRotation(currentRot);
      drawWheel(currentRot);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        const normalized = ((currentRot % 360) + 360) % 360;
        const prizeIdx = Math.floor(((360 - normalized + SEGMENT_ANGLE / 2) % 360) / SEGMENT_ANGLE) % PRIZES.length;
        const prize = PRIZES[prizeIdx];
        setResult(prize);

        if (prize.type === 'xp' && prize.value) {
          addXP(prize.value);
          playCoin();
        } else {
          playPop();
        }

        if (prize.type === 'xp' && (prize.value ?? 0) >= 75) {
          setShowConfetti(true);
          playWin();
          setTimeout(() => setShowConfetti(false), 2500);
        }

        const today = new Date().toDateString();
        const newCount = spinsToday + 1;
        setSpinsToday(newCount);
        localStorage.setItem('spinWheel', JSON.stringify({ date: today, count: newCount }));
        if (newCount >= MAX_SPINS) setCanSpin(false);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={60} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="btn-kid-secondary mb-4"
        >
          ← Back
        </button>

        <div className="text-center mb-6">
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-2">
            Daily Spin Wheel 🎡
          </h1>
          <p className="font-nunito text-gray-600">
            Spin to win XP and discover surprises! ({MAX_SPINS - spinsToday} spins left today)
          </p>
        </div>

        {/* Wheel + pointer */}
        <div className="relative flex justify-center mb-6">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="rounded-full shadow-2xl border-4 border-white"
              style={{ display: 'block' }}
            />
            {/* Pointer */}
            <div className="absolute top-1/2 left-full -translate-y-1/2 -translate-x-2 z-10">
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '14px solid transparent',
                  borderBottom: '14px solid transparent',
                  borderRight: '28px solid #7c3aed',
                  filter: 'drop-shadow(2px 0 4px rgba(0,0,0,0.3))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Spin Button */}
        <div className="flex justify-center mb-6">
          <motion.button
            whileHover={canSpin && !spinning ? { scale: 1.05 } : {}}
            whileTap={canSpin && !spinning ? { scale: 0.95 } : {}}
            onClick={spin}
            disabled={spinning || !canSpin}
            className={`font-fredoka text-xl px-12 py-4 rounded-full shadow-lg transition-all duration-300 ${
              spinning || !canSpin
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-xl btn-kid'
            }`}
          >
            {spinning ? '🌀 Spinning...' : canSpin ? '🎡 SPIN!' : '✅ Come Back Tomorrow!'}
          </motion.button>
        </div>

        {/* Spin count */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: MAX_SPINS }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full border-2 ${
                i < spinsToday ? 'bg-purple-400 border-purple-600' : 'bg-gray-200 border-gray-300'
              } flex items-center justify-center text-sm`}
            >
              {i < spinsToday ? '✓' : ''}
            </div>
          ))}
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 text-center"
              style={{ borderColor: result.color }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
                className="text-6xl mb-3"
              >
                {result.emoji}
              </motion.div>
              <h2 className="text-3xl font-fredoka font-bold mb-2" style={{ color: result.color }}>
                {result.label}
              </h2>
              <p className="font-nunito text-gray-700 text-lg leading-relaxed">{result.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default DailySpinWheel;
