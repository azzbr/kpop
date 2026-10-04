import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playWin, playWrong } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const COLORS = [
  { id: 0, name: 'Pink', bg: 'bg-pink-400', active: 'bg-pink-200', border: 'border-pink-600', freq: 330 },
  { id: 1, name: 'Blue', bg: 'bg-blue-400', active: 'bg-blue-200', border: 'border-blue-600', freq: 415 },
  { id: 2, name: 'Yellow', bg: 'bg-yellow-400', active: 'bg-yellow-200', border: 'border-yellow-600', freq: 523 },
  { id: 3, name: 'Green', bg: 'bg-green-400', active: 'bg-green-200', border: 'border-green-600', freq: 659 },
];

type Phase = 'idle' | 'showing' | 'input' | 'win' | 'lose';

const PatternMemory: React.FC = () => {
  const { setGameState } = useGameStore();
  const later = useSafeTimeout();
  const [phase, setPhase] = useState<Phase>('idle');
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState<number>(() => useGameStore.getState().highScores.pattern_memory ?? 0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioCtx = useRef<AudioContext | null>(null);
  // Refs, not state: taps can arrive faster than React re-renders, and each one must be
  // checked against the step the player is actually on.
  const seqRef = useRef<number[]>([]);
  const idxRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  // Bumped on unmount/restart so an in-flight sequence playback stops.
  const runRef = useRef(0);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const wait = (ms: number) => new Promise<void>(r => later(r, ms));

  useEffect(() => () => { runRef.current++; audioCtx.current?.close(); }, []);

  const playTone = useCallback((freq: number, duration = 300) => {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  }, []);

  const flash = async (colorId: number, duration: number) => {
    playTone(COLORS[colorId].freq, duration);
    setLit(colorId);
    await wait(duration);
    setLit(null);
  };

  const showSequence = async (seq: number[]) => {
    const run = runRef.current;
    go('showing');
    await wait(500);
    for (const id of seq) {
      if (runRef.current !== run) return;
      await flash(id, 400);
      await wait(200);
    }
    if (runRef.current !== run) return;
    idxRef.current = 0;
    setProgress(0);
    go('input');
  };

  const finish = (phaseName: 'win' | 'lose', reached: number) => {
    const res = useGameStore.getState().finishRound('pattern_memory', reached, 0.25);
    setXpEarned(res.xp);
    if (res.isBest) {
      setBest(reached);
      setShowConfetti(true);
      later(() => setShowConfetti(false), 2500);
    }
    go(phaseName);
  };

  const startGame = () => {
    playClick();
    runRef.current++;
    seqRef.current = [Math.floor(Math.random() * 4)];
    setRound(1);
    showSequence(seqRef.current);
  };

  const handlePress = (colorId: number) => {
    if (phaseRef.current !== 'input') return;
    flash(colorId, 200);
    const seq = seqRef.current;
    if (colorId !== seq[idxRef.current]) {
      playWrong();
      finish('lose', seq.length - 1);
      return;
    }
    idxRef.current++;
    setProgress(idxRef.current);
    if (idxRef.current < seq.length) return;

    // Round complete
    phaseRef.current = 'showing';
    playTone(880, 150);
    if (seq.length >= 20) {
      playWin();
      finish('win', 20);
      return;
    }
    seqRef.current = [...seq, Math.floor(Math.random() * 4)];
    setRound(seqRef.current.length);
    const run = runRef.current;
    later(() => { if (runRef.current === run) showSequence(seqRef.current); }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={50} durationMs={2000} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-1">🧠</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Pattern Memory</h1>
          <p className="font-nunito text-gray-500 text-sm">Watch the pattern — repeat it!</p>
        </div>

        {/* Stats bar */}
        <div className="flex justify-between bg-white rounded-2xl px-4 py-2 shadow border-2 border-purple-200 mb-6">
          <span className="font-fredoka font-bold text-purple-600">Round {round}</span>
          <span className="font-fredoka text-gray-500">Best: {best}</span>
        </div>

        {/* Status */}
        <div className="text-center mb-4 h-8">
          {phase === 'idle' && <p className="font-nunito text-gray-600">Press Start to play!</p>}
          {phase === 'showing' && <p className="font-nunito text-blue-600 font-bold">👀 Watch carefully...</p>}
          {phase === 'input' && <p className="font-nunito text-green-600 font-bold">🎮 Your turn! ({progress}/{round})</p>}
        </div>

        {/* 2×2 Button Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {COLORS.map(color => (
            <motion.button
              key={color.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => handlePress(color.id)}
              disabled={phase !== 'input'}
              className={`aspect-square rounded-3xl border-4 ${color.border} transition-all duration-100 shadow-lg ${
                lit === color.id ? color.active + ' scale-95 shadow-inner' : color.bg
              } ${phase !== 'input' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}`}
            />
          ))}
        </div>

        {/* Idle / Start */}
        {phase === 'idle' && (
          <div className="text-center">
            <button onClick={startGame} className="btn-kid text-xl px-8 py-3">▶️ Start</button>
          </div>
        )}

        {/* Lose screen */}
        <AnimatePresence>
          {phase === 'lose' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-red-300 text-center"
            >
              <div className="text-6xl mb-2">😬</div>
              <h2 className="text-3xl font-fredoka font-bold text-red-500 mb-1">Oops!</h2>
              <p className="font-nunito text-gray-600 mb-1">You made it to round {round}!</p>
              {xpEarned > 0 && <p className="font-nunito text-purple-600 mb-3">+{xpEarned} XP earned!</p>}
              <button onClick={startGame} className="btn-kid mr-2">🔄 Try Again</button>
              <button onClick={() => { go('idle'); setRound(0); }} className="btn-kid-secondary">🏠 Menu</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win screen */}
        <AnimatePresence>
          {phase === 'win' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-yellow-400 text-center"
            >
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">Master!</h2>
              <p className="font-nunito text-gray-600 mb-1">You completed 20 rounds! +{xpEarned} XP!</p>
              <button onClick={startGame} className="btn-kid mr-2">🔄 Play Again</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PatternMemory;
