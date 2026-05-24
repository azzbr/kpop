import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const SIGNATURE_MOVES = [
  'The Spinning Lightning Drop 🌀⚡', 'Sparkle Slide ✨', 'Cosmic Heart Shot 💖',
  'Triple Spin Snap 🌪️', 'Galaxy Wave 🌌', 'Petal Storm 🌸',
  'Mirror Flip Combo 🪞', 'Diamond Step ‍💎', 'Phoenix Leap 🔥',
  'Moonbeam Glide 🌙', 'Echo Pulse 🎵', 'Crystal Shimmer 💠',
];

const WEAKNESSES = [
  'Cheese sandwiches 🧀', 'Tickly socks 🧦', 'Loud blenders 🌀',
  'Brain freeze from ice cream 🍦', 'Surprise photos 📸', 'Slow elevators 🛗',
  'Spicy crisps 🌶️', 'Squeaky doors 🚪', 'Forgetting song lyrics 🎤',
  'Stairs at 6am 🥱', 'Wet socks 💧', 'Pop quizzes from Mr. Jarvis 📚',
];

const FAN_CLUB_NAMES = [
  'The Sparkle Squad ✨', 'Cosmic Stars 🌟', 'Petal Pals 🌸',
  'Thunder Crew ⚡', 'Galaxy Gang 🌌', 'Heartbeat Hive 💗',
  'Moonlight Mob 🌙', 'Diamond Dust 💎', 'Echo Army 🔊',
];

const STAGE_COLORS = [
  { from: 'from-pink-500', to: 'to-fuchsia-600', name: 'Pink Storm', accent: 'pink' },
  { from: 'from-purple-500', to: 'to-indigo-600', name: 'Royal Purple', accent: 'purple' },
  { from: 'from-cyan-400', to: 'to-blue-600', name: 'Ocean Wave', accent: 'cyan' },
  { from: 'from-yellow-400', to: 'to-orange-500', name: 'Sunset Gold', accent: 'amber' },
  { from: 'from-green-400', to: 'to-emerald-600', name: 'Forest Glow', accent: 'green' },
  { from: 'from-rose-500', to: 'to-red-600', name: 'Crimson Fire', accent: 'rose' },
];

const AVATAR_EMOJIS = ['🌟', '✨', '🦋', '🐰', '🦄', '🐱', '🌸', '🌙', '⚡', '💎', '🔥', '🎀'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Card {
  name: string;
  hometown: string;
  superpower: string;
  signature: string;
  weakness: string;
  fanClub: string;
  color: typeof STAGE_COLORS[0];
  avatar: string;
  vocal: number;
  dance: number;
  charm: number;
}

export default function IdolProfileCard() {
  const { setGameState, addXP } = useGameStore();
  const [name, setName] = useState('');
  const [hometown, setHometown] = useState('');
  const [superpower, setSuperpower] = useState('');
  const [card, setCard] = useState<Card | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    if (!name.trim() || !hometown.trim() || !superpower.trim()) return;
    playClick();
    setGenerating(true);
    setTimeout(() => {
      const c: Card = {
        name: name.trim(),
        hometown: hometown.trim(),
        superpower: superpower.trim(),
        signature: pick(SIGNATURE_MOVES),
        weakness: pick(WEAKNESSES),
        fanClub: pick(FAN_CLUB_NAMES),
        color: pick(STAGE_COLORS),
        avatar: pick(AVATAR_EMOJIS),
        vocal: 60 + Math.floor(Math.random() * 40),
        dance: 60 + Math.floor(Math.random() * 40),
        charm: 60 + Math.floor(Math.random() * 40),
      };
      setCard(c);
      setGenerating(false);
      setConfetti(true);
      playWin();
      addXP(15);
      setTimeout(() => setConfetti(false), 3000);
    }, 1400);
  };

  const reroll = () => {
    if (!card) return;
    playPop();
    setCard({
      ...card,
      signature: pick(SIGNATURE_MOVES),
      weakness: pick(WEAKNESSES),
      fanClub: pick(FAN_CLUB_NAMES),
      color: pick(STAGE_COLORS),
      avatar: pick(AVATAR_EMOJIS),
      vocal: 60 + Math.floor(Math.random() * 40),
      dance: 60 + Math.floor(Math.random() * 40),
      charm: 60 + Math.floor(Math.random() * 40),
    });
  };

  const reset = () => {
    setCard(null);
    setName('');
    setHometown('');
    setSuperpower('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {confetti && <ConfettiBurst count={100} durationMs={3000} />}

      <div className="w-full max-w-xl">
        <button
          onClick={() => setGameState('game_mode')}
          className="btn-kid-secondary mb-4 font-fredoka"
        >
          ← Back
        </button>

        <h1 className="text-kid-glow text-3xl md:text-4xl font-bold text-center text-purple-700 mb-2">
          🎙️ Idol Profile Card
        </h1>
        <p className="text-center font-nunito text-gray-600 mb-6">
          Design your own K-Pop debut card!
        </p>

        <AnimatePresence mode="wait">
          {!card && !generating && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card-kid bg-white space-y-4"
            >
              <div>
                <label className="font-fredoka text-purple-700 block mb-1">🌟 Stage name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Luna, Tiger, Spark..."
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none font-nunito text-lg"
                />
              </div>
              <div>
                <label className="font-fredoka text-purple-700 block mb-1">🏠 Hometown</label>
                <input
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  placeholder="Seoul, London, Mars..."
                  maxLength={30}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none font-nunito text-lg"
                />
              </div>
              <div>
                <label className="font-fredoka text-purple-700 block mb-1">⚡ Superpower</label>
                <input
                  type="text"
                  value={superpower}
                  onChange={(e) => setSuperpower(e.target.value)}
                  placeholder="Talks to cats, time freeze..."
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none font-nunito text-lg"
                />
              </div>
              <button
                onClick={generate}
                disabled={!name.trim() || !hometown.trim() || !superpower.trim()}
                className="btn-kid w-full font-fredoka disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✨ Generate My Debut Card!
              </button>
            </motion.div>
          )}

          {generating && (
            <motion.div
              key="gen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card-kid bg-gradient-to-br from-purple-500 to-pink-600 text-white text-center py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="text-7xl mb-3 inline-block"
              >
                ✨
              </motion.div>
              <p className="font-fredoka text-2xl">Generating your debut card...</p>
              <p className="font-nunito text-purple-100 mt-1">Calculating star power 🌟</p>
            </motion.div>
          )}

          {card && (
            <motion.div
              key="card"
              initial={{ scale: 0.7, rotate: -5, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className={`rounded-3xl shadow-2xl border-4 border-white overflow-hidden bg-gradient-to-br ${card.color.from} ${card.color.to} text-white p-6`}>
                <div className="flex justify-between items-start mb-2 text-xs font-nunito uppercase tracking-wider opacity-80">
                  <span>HUNTR/X · OFFICIAL DEBUT</span>
                  <span>★ ROOKIE ★</span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="text-6xl bg-white/30 rounded-2xl w-20 h-20 flex items-center justify-center shadow-lg">
                    {card.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-fredoka text-3xl font-bold leading-tight">{card.name}</div>
                    <div className="font-nunito text-sm opacity-90">📍 {card.hometown}</div>
                    <div className="font-nunito text-xs opacity-75 mt-1">Stage color: {card.color.name}</div>
                  </div>
                </div>

                <div className="bg-white/20 rounded-2xl p-3 mb-3 backdrop-blur-sm">
                  <div className="text-xs uppercase opacity-80 font-nunito">Superpower</div>
                  <div className="font-fredoka text-lg">⚡ {card.superpower}</div>
                </div>

                <div className="bg-white/20 rounded-2xl p-3 mb-3 backdrop-blur-sm">
                  <div className="text-xs uppercase opacity-80 font-nunito">Signature move</div>
                  <div className="font-fredoka text-lg">{card.signature}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Vocal', val: card.vocal, emoji: '🎤' },
                    { label: 'Dance', val: card.dance, emoji: '💃' },
                    { label: 'Charm', val: card.charm, emoji: '💖' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/20 rounded-xl p-2 text-center backdrop-blur-sm">
                      <div className="text-xl">{s.emoji}</div>
                      <div className="text-xs opacity-80 font-nunito">{s.label}</div>
                      <div className="font-fredoka text-xl">{s.val}</div>
                      <div className="h-1.5 bg-white/30 rounded-full overflow-hidden mt-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${s.val}%` }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                          className="h-full bg-white rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-black/30 rounded-2xl p-3 mb-2">
                  <div className="text-xs uppercase opacity-80 font-nunito">Fan club</div>
                  <div className="font-fredoka text-lg">{card.fanClub}</div>
                </div>

                <div className="bg-yellow-100 text-stone-900 rounded-2xl p-3 border-2 border-yellow-400">
                  <div className="text-xs uppercase opacity-70 font-nunito">Weakness</div>
                  <div className="font-fredoka text-base">{card.weakness}</div>
                </div>

                <div className="text-center mt-3 text-xs opacity-70 font-nunito">
                  ★ Debut card #{Math.floor(Math.random() * 9000 + 1000)} · HUNTR/X Records ★
                </div>
              </div>

              <div className="flex gap-2 mt-4 justify-center flex-wrap">
                <button onClick={reroll} className="btn-kid font-fredoka">🎲 Reroll Stats</button>
                <button onClick={reset} className="btn-kid-secondary font-fredoka">✏️ New Idol</button>
              </div>
              <p className="text-center font-nunito text-xs text-gray-500 mt-3">
                📸 Screenshot to share with friends!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
