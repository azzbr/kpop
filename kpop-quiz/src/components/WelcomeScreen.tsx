import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import DailyChallenge from './DailyChallenge';
import { playUnlock, playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const KPOP_FACTS = [
  "🎵 The word 'K-pop' stands for Korean Popular music!",
  "⭐ BTS holds the record for the most sold album in South Korean history!",
  "💜 K-pop fans are called 'fandoms' and each has a unique official colour!",
  "🌍 K-pop is enjoyed by millions of fans in over 100 countries!",
  "🎤 Idols train for years — sometimes 5+ years — before debuting!",
  "💿 K-pop albums often include photocards, postcards, and posters!",
  "🕺 K-pop choreography is so precise that groups practice 8+ hours daily!",
  "🇰🇷 Seoul, South Korea is the K-pop capital of the world!",
  "🎧 Streaming parties by fans can push K-pop songs to #1 worldwide!",
  "✨ HUNTR/X is the coolest K-pop group in the universe — fact!",
];

const WelcomeScreen: React.FC = () => {
  const [inputName, setInputName] = useState('');
  const [pAnimationState, setPAnimationState] = useState<'idle' | 'discovering' | 'unlocked'>('idle');
  const [fAnimationState, setFAnimationState] = useState<'idle' | 'discovering' | 'unlocked'>('idle');

  // Easter egg 1: HUNTRX name
  const [huntrxMode, setHuntrxMode] = useState(false);
  // Easter egg 2: Q click — fact bubble
  const [factBubble, setFactBubble] = useState<string | null>(null);
  const [qClicks, setQClicks] = useState(0);
  // Easter egg 3: 🎵 tap 5× for DJ pulse
  const [noteClicks, setNoteClicks] = useState(0);
  const [djMode, setDjMode] = useState(false);
  // Easter egg 4: JARVIS teacher mode
  const [jarvisMode, setJarvisMode] = useState(false);
  const [jarvisSplash, setJarvisSplash] = useState(false);
  const [jarvisCountdown, setJarvisCountdown] = useState(3);

  const { setUserName, setGameState } = useGameStore();
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // Initialize AudioContext lazily to comply with browser autoplay policies
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playTransitionSound = () => {
    try {
      const ctx = getAudioContext();
      // Generic "Sparkle" / "Twinkle" oscillator sequence
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  // Easter egg 1: detect HUNTRX in name input
  const handleNameChange = (val: string) => {
    setInputName(val);
    const upper = val.toUpperCase().trim();
    if (upper === 'HUNTRX' && !huntrxMode) {
      setHuntrxMode(true);
      setJarvisMode(false);
      playWin();
    } else if (upper !== 'HUNTRX') {
      setHuntrxMode(false);
    }
    if (upper === 'JARVIS' && !jarvisMode) {
      setJarvisMode(true);
      localStorage.setItem('jarvis_mode', '1');
      playUnlock();
    } else if (upper !== 'JARVIS') {
      setJarvisMode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      setUserName(inputName.trim());
      if (huntrxMode) {
        setGameState('huntrx_splash');
      } else if (jarvisMode) {
        setJarvisSplash(true);
        setJarvisCountdown(3);
        playWin();
        const tick = (n: number) => {
          if (n <= 0) { setJarvisSplash(false); setGameState('game_mode'); return; }
          setJarvisCountdown(n);
          setTimeout(() => tick(n - 1), 1000);
        };
        setTimeout(() => tick(2), 1000);
      } else {
        setGameState('game_mode');
      }
    }
  };

  // Easter egg 2: click Q in Quest
  const handleQClick = () => {
    const next = qClicks + 1;
    setQClicks(next);
    playClick();
    const fact = KPOP_FACTS[Math.floor(Math.random() * KPOP_FACTS.length)];
    setFactBubble(fact);
    setTimeout(() => setFactBubble(null), 4000);
  };

  // Easter egg 3: tap 🎵 5 times
  const handleNoteClick = () => {
    const next = noteClicks + 1;
    setNoteClicks(next);
    playClick();
    if (next >= 5) {
      setDjMode(true);
      playUnlock();
      setTimeout(() => { setDjMode(false); setNoteClicks(0); }, 5000);
    }
  };

  const handlePClick = () => {
    if (pAnimationState === 'idle') {
      setPAnimationState('discovering');
      // Trigger sparkle effect, screen shake, etc.
      setTimeout(() => {
        setGameState('secret_menu');
        setPAnimationState('unlocked');
      }, 2000);
    }
  };

  const handleFClick = () => {
    if (fAnimationState === 'idle') {
      setFAnimationState('discovering');
      playTransitionSound();
      // Trigger living mural launch
      setTimeout(() => {
        setGameState('living_mural');
        setFAnimationState('unlocked');
      }, 1500); // Slightly faster for better feel
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={
        djMode
        ? { scale: [1, 1.02, 0.98, 1.02, 1], filter: ['hue-rotate(0deg)', 'hue-rotate(60deg)', 'hue-rotate(180deg)', 'hue-rotate(300deg)', 'hue-rotate(360deg)'] }
        : huntrxMode
        ? { scale: [1, 1.04, 1, 1.04, 1] }
        : fAnimationState === 'discovering'
        ? { scale: [1, 1.5, 20], opacity: [1, 0.8, 0] }
        : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: djMode ? 5 : fAnimationState === 'discovering' ? 1.5 : 0.5, repeat: djMode ? Infinity : 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-kid-pattern"
    >
      {huntrxMode && <ConfettiBurst count={50} durationMs={3000} />}

      {/* Jarvis teacher splash overlay */}
      <AnimatePresence>
        {jarvisSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)' }}
          >
            <ConfettiBurst count={80} durationMs={3000} />
            <motion.div
              initial={{ scale: 0.5, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-center p-8 rounded-3xl max-w-sm mx-4"
              style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '4px solid #f59e0b' }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8 }}
                className="text-7xl mb-4"
              >
                👨‍🏫
              </motion.div>
              <h2 className="font-fredoka font-bold text-yellow-400 text-3xl mb-2">
                MR. JARVIS<br />HAS ENTERED!
              </h2>
              <div className="bg-yellow-900/40 border border-yellow-500 rounded-2xl p-3 mb-4">
                <p className="font-fredoka text-yellow-200 text-sm leading-relaxed">
                  🍎 <span className="font-bold">OFFICIAL NOTICE:</span><br />
                  Class is now K-Pop. 📋<br />
                  Students will be graded on how much fun they have.<br />
                  Homework = Play more games. 🎮<br />
                  <span className="text-yellow-400 text-xs">(Attendance taken by confetti cannon)</span>
                </p>
              </div>
              <motion.div
                key={jarvisCountdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-fredoka font-bold text-white text-2xl"
              >
                {jarvisCountdown > 0 ? `Class starts in ${jarvisCountdown}... 🔔` : 'Let\'s GO! 🚀'}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fact bubble — easter egg 2 */}
      <AnimatePresence>
        {factBubble && (
          <motion.div
            key={factBubble}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-fredoka text-lg rounded-2xl px-6 py-3 shadow-2xl max-w-xs z-50 text-center"
          >
            {factBubble}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 200 }}
          className="mb-6"
        >
          <motion.span
            onClick={handleNoteClick}
            whileHover={{ scale: 1.15, rotate: [0, -8, 8, 0] }}
            whileTap={{ scale: 0.85 }}
            className="text-6xl md:text-8xl cursor-pointer select-none inline-block"
            title={noteClicks > 0 ? `${5 - noteClicks} more taps...` : '🎵'}
          >
            {djMode ? '🎧' : '🎵'}
          </motion.span>
          {noteClicks > 0 && noteClicks < 5 && (
            <div className="text-purple-400 text-sm font-fredoka mt-1">{5 - noteClicks} more…</div>
          )}
          {djMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-pink-500 font-fredoka font-bold text-xl mt-1">
              🎧 DJ MODE ACTIVATED! 🎧
            </motion.div>
          )}
        </motion.div>

        <motion.h1
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl md:text-6xl font-fredoka font-bold text-purple-600 mb-4 text-kid-glow"
        >
          <span>K-</span>
          <motion.span
            animate={pAnimationState === 'discovering' ? {
              scale: [1, 1.2, 1],
              rotate: [0, -5, 5, 0],
              color: ['#9333ea', '#ff00ff', '#00ffff', '#9333ea']
            } : {}}
            transition={{ duration: 0.3, repeat: 3 }}
            onClick={handlePClick}
            className={`cursor-pointer hover:scale-110 inline-block transition-transform duration-200 ${
              pAnimationState === 'discovering' ? 'animate-pulse' : ''
            }`}
            title="Click me for a surprise! ✨"
          >
            P
          </motion.span>
          <span>op </span>
          <motion.span
            animate={fAnimationState === 'discovering' ? {
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
              color: ['#9333ea', '#ff00ff', '#00ffff', '#9333ea']
            } : {}}
            transition={{ duration: 0.3, repeat: 3 }}
            onClick={handleFClick}
            className={`cursor-pointer hover:scale-110 inline-block transition-transform duration-200 ${
              fAnimationState === 'discovering' ? 'animate-pulse' : ''
            }`}
            title="Click me for a creative surprise! 🎨"
          >
            F
          </motion.span>
          <span>un </span>
          <motion.span
            onClick={handleQClick}
            whileHover={{ scale: 1.15, color: '#f59e0b' }}
            whileTap={{ scale: 0.85 }}
            className="cursor-pointer hover:text-yellow-500 inline-block transition-colors duration-200"
            title="Did you know? 💡"
          >
            Q
          </motion.span>
          <span>uest</span>
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-2xl md:text-3xl font-fredoka font-semibold text-pink-500 mb-8"
        >
          Adventure Quiz! 🌟
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-lg md:text-xl text-gray-700 mb-8 max-w-lg mx-auto leading-relaxed font-nunito"
        >
          Ready for an amazing K-pop adventure? Test your knowledge and become a K-pop superstar!
          Answer questions about your favorite artists and earn cool rewards! 🎉
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mb-8 max-w-lg mx-auto"
        >
          <DailyChallenge />
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="max-w-md mx-auto">
            <label
              htmlFor="player-name"
              className={`block text-lg font-bold mb-3 font-fredoka ${huntrxMode ? 'text-yellow-500' : jarvisMode ? 'text-amber-700' : 'text-purple-600'}`}
            >
              {huntrxMode ? '🌟 SUPERSTAR MODE UNLOCKED! 🌟' : jarvisMode ? '🍎 Good morning, Mr. Jarvis! 📋' : "What's your name, superstar? ✨"}
            </label>
            <input
              id="player-name"
              type="text"
              value={inputName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your awesome name..."
              className={`w-full px-6 py-4 bg-white border-3 rounded-full text-gray-800 placeholder-purple-400 focus:outline-none focus:ring-4 transition-all duration-300 text-lg font-nunito shadow-lg ${
                huntrxMode
                  ? 'border-yellow-400 focus:border-yellow-500 focus:ring-yellow-200 text-yellow-600 font-bold'
                  : jarvisMode
                  ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-200 text-amber-700 font-bold'
                  : 'border-purple-300 focus:border-pink-400 focus:ring-pink-200'
              }`}
              autoFocus
              required
            />
            <AnimatePresence>
              {huntrxMode && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-yellow-600 font-fredoka font-bold text-center mt-2">
                  ✨ You've unlocked the HUNTR/X secret! ✨
                </motion.p>
              )}
              {jarvisMode && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-amber-600 font-fredoka font-bold text-center mt-2">
                  🎓 Teacher Mode Detected! Students beware! 😂
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.1, rotate: [0, -2, 2, 0] }}
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!inputName.trim()}
            className={`font-fredoka text-xl font-bold px-10 py-4 rounded-full shadow-xl transition-all duration-300 ${
              !inputName.trim()
                ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
                : huntrxMode
                ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white ring-4 ring-yellow-300 hover:from-yellow-500 hover:to-orange-500'
                : jarvisMode
                ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white ring-4 ring-amber-300 hover:from-amber-600 hover:to-red-600'
                : 'btn-kid'
            }`}
          >
            {huntrxMode ? '⭐ Enter Superstar Mode!' : jarvisMode ? '🍎 Begin Class! 📋' : 'Start the Fun! 🚀'}
          </motion.button>
        </motion.form>

        {/* Secret Agent HQ Navigation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="mt-8"
        >
          <button
            onClick={() => setGameState('agent_hq')}
            className="flex items-center space-x-2 text-gray-400 hover:text-purple-600 transition-colors font-fredoka text-sm"
            title="Enter Agent Headquarters"
          >
            <span className="text-lg">🕵️‍♀️</span>
            <span>Secret HQ</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default WelcomeScreen;
