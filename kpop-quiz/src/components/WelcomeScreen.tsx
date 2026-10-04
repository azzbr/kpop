import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playUnlock, playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { SECRETS } from '../data/secrets';

const FUN_FACTS = [
  "🐙 An octopus has three hearts and blue blood!",
  "🍯 Honey never goes off — archaeologists found 3,000-year-old honey that was still edible!",
  "🦈 Sharks were around before trees existed!",
  "🍌 Bananas are berries, but strawberries aren't!",
  "🐌 Some snails can sleep for up to three years!",
  "⚡ A bolt of lightning is about five times hotter than the surface of the Sun!",
  "🦒 A giraffe's tongue can be around 50 cm long!",
  "🌕 You'd weigh about six times less on the Moon!",
  "🐝 Bees can recognise human faces!",
  "🧠 Your brain uses about 20% of your body's energy!",
]

const VISITS_KEY = 'funquest-welcome-visits';
type Letter = 'F' | 'Q' | 'A';
const LETTER_SECRET: Record<Letter, string> = { F: 'f_board', Q: 'q_fact', A: 'a_club' };

// Teacher mode unlocks on any spelling of the teacher's name (John Jarvis):
// "Jarvis", "Mr Jarvis", "Mr. Jarvis", "John Jarvis", "J-Jarvis", "Mr J", "John J"...
const isJarvisName = (raw: string) => {
  const letters = raw.toLowerCase().replace(/[^a-z]/g, '');
  return letters.includes('jarvis') || letters === 'mrj' || letters === 'johnj';
};
/** "HUNTRX", "HUNTR/X", "huntr x"… */
const isHuntrxName = (raw: string) => raw.toUpperCase().replace(/[^A-Z]/g, '') === 'HUNTRX';

const WelcomeScreen: React.FC = () => {
  const [inputName, setInputName] = useState(() => useGameStore.getState().userName);
  const [opening, setOpening] = useState<Letter | null>(null);
  const [factBubble, setFactBubble] = useState<string | null>(null);
  const [noteClicks, setNoteClicks] = useState(0);
  const [djMode, setDjMode] = useState(false);
  const [jarvisSplash, setJarvisSplash] = useState(false);
  const [jarvisCountdown, setJarvisCountdown] = useState(3);
  const [secretToast, setSecretToast] = useState<string | null>(null);
  const [hint, setHint] = useState<Letter | null>(null);

  const { setUserName, setGameState, findSecret, openSecret } = useGameStore();
  const later = useSafeTimeout();
  const factTimer = useRef<number | undefined>(undefined);
  const djTimer = useRef<number | undefined>(undefined);

  // The name box shows the mode live; the mode only switches on when the name is submitted.
  const huntrxMode = isHuntrxName(inputName);
  const jarvisMode = !huntrxMode && isJarvisName(inputName);

  const found = (id: string) => {
    if (!findSecret(id)) return;
    const n = useGameStore.getState().secretsFound.length;
    setSecretToast(`🔓 Secret found! (${n}/${SECRETS.length})`);
    later(() => setSecretToast(null), 2200);
  };

  // After a few visits, a little ✨ hints at a letter secret not found yet.
  useEffect(() => {
    let visits = 0;
    try { visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1; localStorage.setItem(VISITS_KEY, String(visits)); } catch { /* storage blocked */ }
    if (visits < 3) return;
    const id = window.setInterval(() => {
      const left = (Object.keys(LETTER_SECRET) as Letter[]).filter(l => !useGameStore.getState().secretsFound.includes(LETTER_SECRET[l]));
      if (!left.length) return;
      setHint(left[Math.floor(Math.random() * left.length)]);
      window.setTimeout(() => setHint(null), 2500);
    }, 20000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => { window.clearTimeout(factTimer.current); window.clearTimeout(djTimer.current); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = inputName.trim();
    if (!name) return;
    setUserName(name);
    try {
      if (jarvisMode) localStorage.setItem('jarvis_mode', '1');
      else localStorage.removeItem('jarvis_mode');
    } catch { /* storage blocked */ }
    if (huntrxMode) {
      found('huntrx');
      setGameState('huntrx_splash');
    } else if (jarvisMode) {
      setJarvisSplash(true);
      setJarvisCountdown(3);
      playWin();
      const tick = (n: number) => {
        if (n <= 0) { setJarvisSplash(false); setGameState('game_mode'); return; }
        setJarvisCountdown(n);
        later(() => tick(n - 1), 1000);
      };
      later(() => tick(2), 1000);
    } else {
      setGameState('game_mode');
    }
  };

  const tapQ = () => {
    playClick();
    found('q_fact');
    setFactBubble(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    window.clearTimeout(factTimer.current);
    factTimer.current = window.setTimeout(() => setFactBubble(null), 4000);
  };

  const tapJoystick = () => {
    if (djMode) return;
    playClick();
    const next = noteClicks + 1;
    setNoteClicks(next);
    if (next >= 5) {
      setDjMode(true);
      playUnlock();
      found('dj_mode');
      window.clearTimeout(djTimer.current);
      djTimer.current = window.setTimeout(() => { setDjMode(false); setNoteClicks(0); }, 5000);
    }
  };

  const openLetter = (l: 'F' | 'A') => {
    if (opening) return;
    setOpening(l);
    playUnlock();
    found(LETTER_SECRET[l]);
    later(() => {
      if (l === 'A') setGameState('secret_menu');
      else openSecret('sticker_board', 'welcome');
    }, 600);
  };

  const letterBtn = (l: Letter, onTap: () => void, label: string) => (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onTap}
      whileTap={{ scale: 0.85 }}
      animate={opening === l ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0], color: ['#ffffff', '#ff00ff', '#00ffff', '#ffffff'] } : {}}
      transition={{ duration: 0.5 }}
      className="relative inline-flex items-center justify-center min-w-[48px] min-h-[48px] select-none align-baseline"
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      {l}
      <AnimatePresence>
        {hint === l && (
          <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: [1, 1.4, 1] }} exit={{ opacity: 0 }}
            transition={{ duration: 1.2, repeat: 1 }} className="absolute -top-2 -right-3 text-2xl pointer-events-none" aria-hidden>✨</motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={
        djMode
        ? { scale: [1, 1.02, 0.98, 1.02, 1], filter: ['hue-rotate(0deg)', 'hue-rotate(60deg)', 'hue-rotate(180deg)', 'hue-rotate(300deg)', 'hue-rotate(360deg)'] }
        : huntrxMode
        ? { scale: [1, 1.04, 1, 1.04, 1] }
        : opening === 'F'
        ? { scale: [1, 1.4, 12], opacity: [1, 0.8, 0] }
        : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: djMode ? 5 : opening === 'F' ? 0.6 : 0.5, repeat: djMode ? Infinity : 0 }}
      className="flex flex-col items-center justify-center min-h-screen-d px-4 text-center arcade-bg text-white"
    >
      {huntrxMode && <ConfettiBurst count={50} durationMs={3000} />}

      <AnimatePresence>
        {secretToast && (
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} role="status"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-yellow-300 text-violet-900 font-fredoka text-xl px-6 py-3 shadow-xl">
            {secretToast}
          </motion.div>
        )}
      </AnimatePresence>

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
                  Class is now Fun Quest. 📋<br />
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
          <motion.button
            type="button"
            onClick={tapJoystick}
            whileTap={{ scale: 0.85 }}
            aria-label="Joystick"
            className="text-6xl md:text-8xl select-none inline-block min-w-[48px] min-h-[48px]"
            style={{ touchAction: 'manipulation' }}
          >
            {djMode ? '🎧' : '🕹️'}
          </motion.button>
          {noteClicks > 0 && noteClicks < 5 && (
            <div className="text-violet-300 text-sm font-fredoka mt-1">{5 - noteClicks} more…</div>
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
          className="text-5xl md:text-7xl font-fredoka font-bold text-white mb-4 drop-shadow-[0_0_18px_rgba(217,70,239,0.8)] select-none"
        >
          {letterBtn('F', () => openLetter('F'), 'F')}
          <span>un </span>
          {letterBtn('Q', tapQ, 'Q')}
          <span>uest </span>
          {letterBtn('A', () => openLetter('A'), 'A')}
          <span>rcade</span>
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-2xl md:text-3xl font-fredoka font-semibold text-fuchsia-300 mb-6"
        >
          Games, puzzles &amp; party chaos 🕹️
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-lg md:text-xl text-violet-200 mb-8 max-w-lg mx-auto leading-relaxed font-nunito"
        >
          Arcade battles, brain-busting puzzles and silly party games. Beat your high scores and level up! 🏆
        </motion.p>

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
              className={`block text-lg font-bold mb-3 font-fredoka ${huntrxMode ? 'text-yellow-300' : jarvisMode ? 'text-amber-300' : 'text-violet-100'}`}
            >
              {huntrxMode ? '🌟 SUPERSTAR MODE UNLOCKED! 🌟' : jarvisMode ? '🍎 Good morning, Mr. Jarvis! 📋' : "What's your player name? 🎮"}
            </label>
            <input
              id="player-name"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Enter your awesome name..."
              className={`w-full px-6 py-4 bg-white border-3 rounded-full text-gray-800 placeholder-purple-400 focus:outline-none focus:ring-4 transition-all duration-300 text-lg font-nunito shadow-lg ${
                huntrxMode
                  ? 'border-yellow-400 focus:border-yellow-500 focus:ring-yellow-200 text-yellow-600 font-bold'
                  : jarvisMode
                  ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-200 text-amber-700 font-bold'
                  : 'border-purple-300 focus:border-pink-400 focus:ring-pink-200'
              }`}
              required
            />
            <AnimatePresence>
              {huntrxMode && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-yellow-600 font-fredoka font-bold text-center mt-2">
                  ✨ Tap the button to unlock the HUNTR/X secret! ✨
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
            {huntrxMode ? '⭐ Enter Superstar Mode!' : jarvisMode ? '🍎 Begin Class! 📋' : 'Let\'s Play! 🚀'}
          </motion.button>
        </motion.form>

        {/* Secret Agent HQ Navigation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="mt-8"
        >
          <button
            onClick={() => { playClick(); found('agent_hq'); openSecret('agent_hq', 'welcome'); }}
            className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full bg-white/10 text-violet-200 font-fredoka text-lg"
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
