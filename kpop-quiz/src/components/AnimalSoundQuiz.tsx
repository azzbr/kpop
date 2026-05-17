import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playCorrect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Animal {
  id: string;
  name: string;
  emoji: string;
  funFact: string;
}

const ANIMALS: Animal[] = [
  { id: 'cat',      name: 'Cat',      emoji: '🐱', funFact: 'Cats sleep up to 16 hours a day!' },
  { id: 'dog',      name: 'Dog',      emoji: '🐶', funFact: 'Dogs can smell 100,000x better than humans!' },
  { id: 'cow',      name: 'Cow',      emoji: '🐄', funFact: 'Cows have best friends and get stressed when separated!' },
  { id: 'duck',     name: 'Duck',     emoji: '🦆', funFact: 'Duck quacks don\'t echo — nobody knows why!' },
  { id: 'elephant', name: 'Elephant', emoji: '🐘', funFact: 'Elephants are the only animals that can\'t jump!' },
  { id: 'frog',     name: 'Frog',     emoji: '🐸', funFact: 'Frogs drink water through their skin!' },
  { id: 'horse',    name: 'Horse',    emoji: '🐴', funFact: 'Horses can sleep standing up!' },
  { id: 'lion',     name: 'Lion',     emoji: '🦁', funFact: 'A lion\'s roar can be heard 8km away!' },
  { id: 'monkey',   name: 'Monkey',   emoji: '🐒', funFact: 'Monkeys can recognise themselves in a mirror!' },
  { id: 'pig',      name: 'Pig',      emoji: '🐷', funFact: 'Pigs are cleaner than dogs — they can\'t sweat!' },
  { id: 'sheep',    name: 'Sheep',    emoji: '🐑', funFact: 'Sheep can recognise up to 50 sheep faces!' },
  { id: 'bird',     name: 'Bird',     emoji: '🐦', funFact: 'Birds have hollow bones to help them fly!' },
];

const TOTAL_ROUNDS = 10;

function buildRound(_exclude?: string): { answer: Animal; choices: Animal[] } {
  const pool = [...ANIMALS];
  const answer = pool[Math.floor(Math.random() * pool.length)];
  const distractors = pool.filter(a => a.id !== answer.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const choices = [...distractors, answer].sort(() => Math.random() - 0.5);
  return { answer, choices };
}

export default function AnimalSoundQuiz() {
  const { setGameState } = useGameStore();
  const audioRef = useRef<AudioContext | null>(null);

  const [round, setRound] = useState(0);
  const [{ answer, choices }, setRoundData] = useState(() => buildRound());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [played, setPlayed] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const getCtx = (): AudioContext => {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new AC();
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  };

  const playAnimalSound = useCallback((id: string) => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const v = 0.6;

    const osc = (type: OscillatorType, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g).connect(ctx.destination);
      return { o, g };
    };
    const noiseNode = (dur: number) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain();
      src.connect(g).connect(ctx.destination); src.start();
      return g;
    };

    setPlayed(true);

    switch (id) {
      case 'cat': {
        const { o, g } = osc('triangle', 620);
        o.frequency.linearRampToValueAtTime(820, t + 0.25);
        o.frequency.linearRampToValueAtTime(550, t + 0.6);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.15);
        g.gain.linearRampToValueAtTime(0, t + 0.7);
        o.start(); o.stop(t + 0.7); break;
      }
      case 'dog': {
        [0, 0.22].forEach(off => {
          const { o, g } = osc('sawtooth', 180);
          o.frequency.linearRampToValueAtTime(120, t + off + 0.15);
          g.gain.setValueAtTime(v, t + off); g.gain.exponentialRampToValueAtTime(0.01, t + off + 0.18);
          o.start(t + off); o.stop(t + off + 0.18);
        }); break;
      }
      case 'cow': {
        const { o, g } = osc('sawtooth', 110);
        o.frequency.linearRampToValueAtTime(85, t + 1.0);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 1.1);
        o.start(); o.stop(t + 1.1); break;
      }
      case 'duck': {
        const { o, g } = osc('square', 400);
        o.frequency.linearRampToValueAtTime(300, t + 0.1);
        o.frequency.linearRampToValueAtTime(400, t + 0.18);
        g.gain.setValueAtTime(v, t); g.gain.linearRampToValueAtTime(0, t + 0.22);
        o.start(); o.stop(t + 0.22); break;
      }
      case 'elephant': {
        const { o, g } = osc('sawtooth', 500);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.8);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.9);
        o.start(); o.stop(t + 0.9); break;
      }
      case 'frog': {
        [0, 0.18].forEach(off => {
          const { o, g } = osc('square', 200);
          o.frequency.linearRampToValueAtTime(150, t + off + 0.08);
          g.gain.setValueAtTime(v, t + off); g.gain.exponentialRampToValueAtTime(0.01, t + off + 0.12);
          o.start(t + off); o.stop(t + off + 0.12);
        }); break;
      }
      case 'horse': {
        const { o, g } = osc('sawtooth', 500);
        o.frequency.linearRampToValueAtTime(200, t + 0.5);
        o.frequency.linearRampToValueAtTime(350, t + 0.7);
        g.gain.setValueAtTime(v * 0.5, t); g.gain.linearRampToValueAtTime(0, t + 0.8);
        o.start(); o.stop(t + 0.8); break;
      }
      case 'lion': {
        const ng = noiseNode(1.2);
        ng.gain.setValueAtTime(v * 0.8, t); ng.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
        const { o, g } = osc('sawtooth', 80);
        o.frequency.linearRampToValueAtTime(50, t + 1.0);
        g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        o.start(); o.stop(t + 1.0); break;
      }
      case 'monkey': {
        [400, 600, 400, 700, 350].forEach((f, i) => {
          const { o, g } = osc('triangle', f);
          g.gain.setValueAtTime(v * 0.7, t + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.09);
          o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.09);
        }); break;
      }
      case 'pig': {
        const { o, g } = osc('triangle', 300);
        o.frequency.linearRampToValueAtTime(250, t + 0.15);
        o.frequency.linearRampToValueAtTime(340, t + 0.3);
        g.gain.setValueAtTime(v, t); g.gain.linearRampToValueAtTime(0, t + 0.35);
        o.start(); o.stop(t + 0.35); break;
      }
      case 'sheep': {
        const { o, g } = osc('triangle', 350);
        o.frequency.linearRampToValueAtTime(280, t + 0.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.6);
        o.start(); o.stop(t + 0.6); break;
      }
      case 'bird': {
        [800, 1100, 900, 1300, 950].forEach((f, i) => {
          const { o, g } = osc('sine', f);
          g.gain.setValueAtTime(v * 0.6, t + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.06);
          o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.06);
        }); break;
      }
    }
  }, []);

  const handlePick = (animal: Animal) => {
    if (picked) return;
    setPicked(animal.id);
    const correct = animal.id === answer.id;
    if (correct) {
      playCorrect();
      setScore(s => s + 100 + streak * 20);
      setStreak(s => s + 1);
    } else {
      playWrong();
      setStreak(0);
    }
    setTimeout(() => {
      const next = round + 1;
      if (next >= TOTAL_ROUNDS) {
        setGameOver(true);
        playWin();
        setConfetti(true);
      } else {
        setRound(next);
        setRoundData(buildRound());
        setPicked(null);
        setPlayed(false);
      }
    }, 1800);
  };

  if (gameOver) {
    const pct = Math.round((score / (TOTAL_ROUNDS * 100)) * 100);
    const rating = pct >= 90 ? '🦁 Animal Expert!' : pct >= 60 ? '🐾 Animal Friend!' : '🐣 Keep Learning!';
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-kid-pattern flex items-center justify-center p-4">
        {confetti && <ConfettiBurst count={60} durationMs={3500} />}
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-7xl mb-3">🐾</div>
          <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">Quiz Complete!</h2>
          <p className="text-xl font-fredoka text-pink-500 mb-4">{rating}</p>
          <div className="text-4xl font-fredoka font-bold text-purple-700 mb-4">{score} pts</div>
          <div className="flex gap-3">
            <button onClick={() => { setRound(0); setScore(0); setStreak(0); setRoundData(buildRound()); setPicked(null); setPlayed(false); setGameOver(false); setConfetti(false); }}
              className="btn-kid flex-1">🔄 Again!</button>
            <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary flex-1">🏠 Home</button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4">

      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center mb-4">
        <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary text-sm">← Back</button>
        <div className="text-center">
          <div className="font-fredoka font-bold text-purple-600 text-lg">🐾 Animal Sound Quiz</div>
          <div className="text-sm text-gray-500">{round + 1} / {TOTAL_ROUNDS}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-pink-600">{score} pts</div>
          {streak >= 2 && <div className="text-sm text-orange-500">🔥 {streak}x</div>}
        </div>
      </div>

      <div className="w-full max-w-lg bg-gray-200 rounded-full h-2 mb-6">
        <div className="bg-gradient-to-r from-green-400 to-teal-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(round / TOTAL_ROUNDS) * 100}%` }} />
      </div>

      {/* Sound card */}
      <AnimatePresence mode="wait">
        <motion.div key={round} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          exit={{ x: -80, opacity: 0 }} transition={{ duration: 0.25 }}
          className="w-full max-w-lg card-kid p-8 mb-6 text-center border-4 border-green-200">

          <p className="text-gray-500 font-nunito mb-4">What animal makes this sound?</p>

          {/* BIG play button */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.85 }}
            onClick={() => playAnimalSound(answer.id)}
            className={`w-28 h-28 rounded-full mx-auto flex flex-col items-center justify-center shadow-2xl text-white font-fredoka font-bold text-lg transition-all ${
              played
                ? 'bg-gradient-to-br from-green-400 to-teal-500'
                : 'bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse'
            }`}>
            <span className="text-4xl">{played ? '🔊' : '▶️'}</span>
            <span className="text-sm mt-1">{played ? 'Again' : 'Play!'}</span>
          </motion.button>

          {!played && (
            <p className="text-purple-400 font-fredoka mt-3 text-sm">Tap the button to hear the sound!</p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Choices */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3">
        {choices.map(animal => {
          const isCorrect = animal.id === answer.id;
          const isSelected = picked === animal.id;
          const revealed = !!picked;

          let cls = 'bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50';
          if (revealed && isCorrect) cls = 'bg-green-100 border-green-500 ring-2 ring-green-400';
          else if (revealed && isSelected) cls = 'bg-red-100 border-red-400';
          else if (revealed) cls = 'bg-gray-100 border-gray-200 opacity-60';

          return (
            <motion.button key={animal.id}
              whileHover={!revealed && played ? { scale: 1.04 } : {}}
              whileTap={!revealed && played ? { scale: 0.96 } : {}}
              onClick={() => played && handlePick(animal)}
              disabled={revealed || !played}
              className={`p-4 rounded-2xl transition-all duration-200 ${cls} ${!played ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="text-4xl mb-1">{animal.emoji}</div>
              <div className="font-fredoka font-bold text-gray-800">{animal.name}</div>
              {revealed && isCorrect && (
                <div className="text-xs text-green-600 mt-1 font-nunito">{animal.funFact}</div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {picked && (
          <motion.div key={picked}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mt-4 text-2xl font-fredoka font-bold ${
              picked === answer.id ? 'text-green-600' : 'text-pink-500'
            }`}>
            {picked === answer.id ? `✅ Correct! ${answer.emoji}` : `❌ It was ${answer.name}! ${answer.emoji}`}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
