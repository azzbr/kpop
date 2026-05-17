import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const TRACKS = [
  { name: 'Kick', emoji: '🥁', color: 'bg-rose-400 border-rose-600', activeColor: 'bg-rose-500', freq: 60, type: 'kick' as const },
  { name: 'Snare', emoji: '🪘', color: 'bg-orange-400 border-orange-600', activeColor: 'bg-orange-500', freq: 200, type: 'snare' as const },
  { name: 'Hi-Hat', emoji: '🎩', color: 'bg-yellow-400 border-yellow-600', activeColor: 'bg-yellow-500', freq: 800, type: 'hihat' as const },
  { name: 'Clap', emoji: '👏', color: 'bg-green-400 border-green-600', activeColor: 'bg-green-500', freq: 1200, type: 'clap' as const },
  { name: 'Bass', emoji: '🎸', color: 'bg-blue-400 border-blue-600', activeColor: 'bg-blue-500', freq: 80, type: 'bass' as const },
  { name: 'Synth', emoji: '🎹', color: 'bg-purple-400 border-purple-600', activeColor: 'bg-purple-500', freq: 440, type: 'synth' as const },
];

const STEPS = 16;
const PRESETS: Record<string, boolean[][]> = {
  'K-Pop Beat': [
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean),
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0].map(Boolean),
    [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1].map(Boolean),
  ],
  'Hip-Hop': [
    [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0].map(Boolean),
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1].map(Boolean),
    [1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1].map(Boolean),
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    [1,0,1,0,0,0,1,0,1,0,1,0,0,0,0,0].map(Boolean),
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0].map(Boolean),
  ],
  'Empty': TRACKS.map(() => Array(STEPS).fill(false)),
};

type TrackType = 'kick' | 'snare' | 'hihat' | 'clap' | 'bass' | 'synth';

function playDrumSound(type: TrackType, ctx: AudioContext) {
  const now = ctx.currentTime + 0.01;
  if (type === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'snare') {
    const bufLen = ctx.sampleRate * 0.2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 2500; filter.Q.value = 0.5;
    source.buffer = buf;
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    source.start(now);
  } else if (type === 'hihat') {
    const bufLen = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.2));
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 7000;
    source.buffer = buf;
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    source.start(now);
  } else if (type === 'clap') {
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.012;
      const bufLen = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.3));
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.8;
      source.buffer = buf;
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      source.start(t);
    }
  } else if (type === 'bass') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'synth') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.connect(gain); gain.connect(ctx.destination);
    const notes = [440, 494, 523, 587];
    osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  }
}

const BeatMaker: React.FC = () => {
  const { setGameState } = useGameStore();
  const [grid, setGrid] = useState<boolean[][]>(PRESETS['Empty'].map(r => [...r]));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(120);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const stepRef = useRef(0);

  const getCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const tick = useCallback(() => {
    const step = stepRef.current % STEPS;
    setCurrentStep(step);
    stepRef.current++;
    setStepCount(prev => prev + 1);
    const ctx = getCtx();
    TRACKS.forEach((track, ti) => {
      if (gridRef.current[ti]?.[step]) {
        playDrumSound(track.type, ctx);
      }
    });
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const interval = (60 / bpm / 4) * 1000;
      stepRef.current = 0;
      intervalRef.current = window.setInterval(tick, interval);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentStep(-1);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, bpm, tick]);

  useEffect(() => {
    if (stepCount === 32 && isPlaying) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
  }, [stepCount, isPlaying]);

  const toggleCell = (trackIdx: number, stepIdx: number) => {
    playClick();
    setGrid(prev => prev.map((row, ti) =>
      ti === trackIdx ? row.map((cell, si) => si === stepIdx ? !cell : cell) : row
    ));
  };

  const loadPreset = (name: string) => {
    playClick();
    setGrid(PRESETS[name].map(r => [...r]));
  };

  const clearGrid = () => {
    playClick();
    setGrid(TRACKS.map(() => Array(STEPS).fill(false)));
    setStepCount(0);
  };

  const randomize = () => {
    playClick();
    setGrid(TRACKS.map((_, ti) =>
      Array.from({ length: STEPS }, (_, si) => {
        if (ti === 0) return si % 4 === 0 && Math.random() > 0.3;
        if (ti === 1) return si % 8 === 4 && Math.random() > 0.2;
        if (ti === 2) return Math.random() > 0.55;
        return Math.random() > 0.75;
      })
    ));
  };

  const togglePlay = () => {
    playClick();
    setIsPlaying(p => !p);
    if (!isPlaying) setStepCount(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={50} durationMs={2000} />}

      <div className="max-w-3xl w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">
          ← Back
        </button>

        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center mb-6">
          <div className="text-5xl mb-2">🎛️</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-1">Beat Maker</h1>
          <p className="font-nunito text-gray-600">Build your own K-pop beat! Tap the grid to add sounds 🎵</p>
        </motion.div>

        {/* Controls */}
        <div className="bg-white rounded-3xl p-4 shadow-xl border-2 border-purple-200 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {/* Play/Stop */}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className={`px-6 py-3 rounded-full font-fredoka font-bold text-xl text-white shadow-lg transition-all duration-300 ${
                isPlaying ? 'bg-gradient-to-r from-red-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'
              }`}
            >
              {isPlaying ? '⏹ Stop' : '▶ Play'}
            </motion.button>

            {/* BPM */}
            <div className="flex items-center gap-3">
              <span className="font-fredoka font-bold text-gray-700">🥁 {bpm} BPM</span>
              <input
                type="range" min="60" max="200" value={bpm}
                onChange={e => setBpm(Number(e.target.value))}
                className="w-24 accent-purple-500"
              />
            </div>

            {/* Presets */}
            <div className="flex gap-2 flex-wrap">
              {Object.keys(PRESETS).filter(p => p !== 'Empty').map(preset => (
                <button
                  key={preset}
                  onClick={() => loadPreset(preset)}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 border-2 border-purple-300 rounded-full font-fredoka text-sm text-purple-700 transition-colors"
                >
                  {preset}
                </button>
              ))}
              <button onClick={randomize} className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 border-2 border-pink-300 rounded-full font-fredoka text-sm text-pink-700 transition-colors">
                🎲 Random
              </button>
              <button onClick={clearGrid} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-full font-fredoka text-sm text-gray-600 transition-colors">
                🗑 Clear
              </button>
            </div>
          </div>

          {/* Step indicator bar */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {Array.from({ length: STEPS }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 min-w-[14px] h-2 rounded-full transition-all duration-75 ${
                  currentStep === i ? 'bg-yellow-400 scale-y-150' : i % 4 === 0 ? 'bg-purple-200' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Grid */}
          <div className="space-y-2 overflow-x-auto">
            {TRACKS.map((track, ti) => (
              <div key={track.name} className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-20 flex-shrink-0">
                  <span className="text-xl">{track.emoji}</span>
                  <span className="font-fredoka text-xs font-bold text-gray-600">{track.name}</span>
                </div>
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: STEPS }).map((_, si) => (
                    <motion.button
                      key={si}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => toggleCell(ti, si)}
                      animate={currentStep === si && isPlaying && grid[ti][si]
                        ? { scale: [1, 1.3, 1] }
                        : {}
                      }
                      transition={{ duration: 0.1 }}
                      className={`flex-1 min-w-[14px] h-8 rounded-md border-2 transition-all duration-100 ${
                        grid[ti][si]
                          ? `${track.color} ${currentStep === si ? 'brightness-125 shadow-lg' : ''}`
                          : si % 4 === 0
                          ? 'bg-gray-100 border-gray-200 hover:bg-gray-200'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live beat tip */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="font-fredoka text-purple-600 text-lg animate-pulse">
                🎵 Your beat is playing! Tap cells to change it live!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip */}
        {!isPlaying && (
          <div className="text-center mt-4">
            <p className="font-nunito text-gray-500 text-sm">
              💡 Tip: Try a preset, then tweak it to make it yours! Start with Kick on beats 1, 5, 9, 13.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BeatMaker;
