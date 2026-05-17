import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const ADJECTIVES = [
  'Golden', 'Electric', 'Midnight', 'Neon', 'Crystal', 'Shadow', 'Burning',
  'Frozen', 'Savage', 'Dreamy', 'Cosmic', 'Velvet', 'Diamond', 'Thunder',
  'Starlight', 'Wild', 'Infinite', 'Glitter', 'Blazing', 'Violet',
];

const NOUNS = [
  'Typhoon', 'Symphony', 'Eclipse', 'Rush', 'Wave', 'Storm', 'Heartbeat',
  'Universe', 'Flame', 'Destiny', 'Galaxy', 'Pulse', 'Kingdom', 'Wings',
  'Signal', 'Vibe', 'Dream', 'Chaos', 'Legend', 'Horizon',
];

const PHRASES = [
  'Run Forever!', 'Never Stop!', 'Feel the Night!', 'Shine On!', 'Break Free!',
  'Rise Up!', 'Feel the Beat!', 'Fly High!', "Don't Look Back!", 'Own the Stage!',
  'Turn It Up!', 'Chase the Stars!', 'Light the Way!', 'Move Together!', 'No Limits!',
];

const SUBTITLES = [
  '(Remix)', '(Dance Ver.)', '(Acoustic)', '(Feat. HUNTR/X)', '(Extended Mix)',
  '(Live Ver.)', '(Instrumental)', '', '', '', '', '',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface GeneratedTitle {
  main: string;
  subtitle: string;
  emoji: string;
}

const MUSIC_EMOJIS = ['🎵', '🎶', '🌟', '⚡', '🔥', '💫', '🎤', '🎸', '🎹', '🌈'];

function generateTitle(): GeneratedTitle {
  const style = Math.random();
  let main: string;
  if (style < 0.33) {
    main = `${pick(ADJECTIVES)} ${pick(NOUNS)}: ${pick(PHRASES)}`;
  } else if (style < 0.66) {
    main = `${pick(ADJECTIVES)} ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  } else {
    main = `${pick(NOUNS)} of ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  }
  return { main, subtitle: pick(SUBTITLES), emoji: pick(MUSIC_EMOJIS) };
}

const SongTitleGenerator: React.FC = () => {
  const { setGameState } = useGameStore();
  const [titles, setTitles] = useState<GeneratedTitle[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [savedTitles, setSavedTitles] = useState<GeneratedTitle[]>([]);
  const [copyMsg, setCopyMsg] = useState('');

  const generate = () => {
    playClick();
    setGenerating(true);
    setTimeout(() => {
      const newTitles = Array.from({ length: 5 }, generateTitle);
      setTitles(newTitles);
      setGenerating(false);
    }, 400);
  };

  const save = (title: GeneratedTitle) => {
    playPop();
    if (!savedTitles.find(t => t.main === title.main)) {
      setSavedTitles(prev => [title, ...prev].slice(0, 10));
      if (savedTitles.length === 0) {
        setShowConfetti(true);
        playWin();
        setTimeout(() => setShowConfetti(false), 2000);
      }
    }
  };

  const copyTitle = (title: GeneratedTitle) => {
    const text = title.subtitle ? `${title.main} ${title.subtitle}` : title.main;
    navigator.clipboard?.writeText(text).catch(() => {});
    playClick();
    setCopyMsg(text);
    setTimeout(() => setCopyMsg(''), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={40} durationMs={2000} />}

      <div className="max-w-2xl w-full mx-auto">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="btn-kid-secondary self-start mb-4"
        >
          ← Back
        </button>

        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center mb-8"
        >
          <div className="text-6xl mb-2">🎤</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-2">
            Song Title Generator
          </h1>
          <p className="text-lg font-nunito text-gray-600">
            Create your own K-pop banger title! 🎵✨
          </p>
        </motion.div>

        {/* Generate Button */}
        <motion.div className="flex justify-center mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={generate}
            disabled={generating}
            className="btn-kid text-xl px-10 py-4 font-fredoka"
          >
            {generating ? '🎶 Composing...' : '🎵 Generate Titles!'}
          </motion.button>
        </motion.div>

        {/* Generated Titles */}
        <AnimatePresence>
          {titles.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 mb-8"
            >
              <h2 className="text-xl font-fredoka font-bold text-pink-600 text-center mb-4">
                🌟 Your K-pop Bangers!
              </h2>
              {titles.map((title, i) => (
                <motion.div
                  key={`${title.main}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-lg border-2 border-purple-200"
                >
                  <span className="text-3xl">{title.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-fredoka font-bold text-lg text-gray-800">{title.main}</p>
                    {title.subtitle && (
                      <p className="text-sm font-nunito text-gray-500">{title.subtitle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => save(title)}
                    className="text-2xl hover:scale-125 transition-transform"
                    title="Save this title"
                  >
                    {savedTitles.find(t => t.main === title.main) ? '⭐' : '🤍'}
                  </button>
                  <button
                    onClick={() => copyTitle(title)}
                    className="text-2xl hover:scale-125 transition-transform"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Copy Notification */}
        <AnimatePresence>
          {copyMsg && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-6 py-3 rounded-full font-fredoka text-lg shadow-xl z-50"
            >
              📋 Copied: "{copyMsg}"
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved Titles */}
        <AnimatePresence>
          {savedTitles.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-yellow-50 rounded-3xl p-6 border-2 border-yellow-300"
            >
              <h2 className="text-xl font-fredoka font-bold text-yellow-700 mb-4">
                ⭐ Your Saved Hits ({savedTitles.length})
              </h2>
              <div className="space-y-2">
                {savedTitles.map((title, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 bg-white rounded-xl p-3 border border-yellow-200"
                  >
                    <span>{title.emoji}</span>
                    <span className="font-fredoka text-gray-800 flex-1">{title.main}</span>
                    {title.subtitle && (
                      <span className="text-xs font-nunito text-gray-400">{title.subtitle}</span>
                    )}
                    <button
                      onClick={() => setSavedTitles(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-lg"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {titles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🎼</div>
            <p className="text-xl font-fredoka text-gray-500">
              Hit the button to generate your K-pop masterpiece! 🌟
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default SongTitleGenerator;
