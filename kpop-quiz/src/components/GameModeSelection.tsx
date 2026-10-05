import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { GameState } from '../store';
import PlayerLevelBadge from './PlayerLevelBadge';
import { playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { challengeFor, DAILY_REWARD } from '../utils/dailyChallenge';
import { localDateKey } from '../utils/dates';
import EventBanner from './events/EventBanner';

type Category = 'arcade' | 'puzzle' | 'quiz' | 'party' | 'create' | 'me' | 'teacher';

interface Tile {
  id: GameState;
  /** High-score key in the store, when it differs from `id`. */
  scoreKey?: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: Category;
  isNew?: boolean;
}

const CATEGORIES: { id: Category; title: string; subtitle: string }[] = [
  { id: 'arcade', title: '🕹️ Arcade', subtitle: 'Fast reflexes, big scores' },
  { id: 'puzzle', title: '🧩 Puzzles & Brain', subtitle: 'Think it through' },
  { id: 'quiz', title: '❓ Quiz', subtitle: 'How much do you know?' },
  { id: 'party', title: '🎉 Party', subtitle: '2+ players — pass the iPad!' },
  { id: 'create', title: '🎨 Create & Music', subtitle: 'Make something awesome' },
  { id: 'me', title: '🏆 My Stuff', subtitle: 'Streaks and trophies' },
  { id: 'teacher', title: "🍎 Mr. Jarvis's Classroom", subtitle: 'Teacher tools' },
];

const TILES: Tile[] = [
  // Arcade
  { id: 'paper_clash', title: 'Paper Clash', description: 'Grab land, cut trails, rule the map. Swipe to steer!', icon: '🗺️', color: 'from-sky-500 to-fuchsia-600', category: 'arcade', isNew: true },
  { id: 'snake_arena', title: 'Snake Arena', description: 'Eat, grow, boost — make the other snakes crash into you!', icon: '🐍', color: 'from-lime-500 to-emerald-600', category: 'arcade', isNew: true },
  { id: 'kpop_rush', title: 'Rush Runner', description: 'Jump, duck and dash through the city — grab power-ups!', icon: '🏃', color: 'from-fuchsia-500 to-purple-600', category: 'arcade' },
  { id: 'ninja_slice', title: 'Ninja Slice', description: 'Swipe to slice fruit. Dodge the bombs!', icon: '🥷', color: 'from-red-500 to-orange-500', category: 'arcade' },
  { id: 'rocket_launch', title: 'Rocket Launch', description: 'Pull back, let go, and hit 5 stars!', icon: '🚀', color: 'from-sky-500 to-indigo-600', category: 'arcade' },
  { id: 'tower_defense', title: 'Tower Defense', description: 'Answer questions to earn coins, build towers, stop the snails!', icon: '🏰', color: 'from-emerald-500 to-sky-600', category: 'arcade', isNew: true },
  { id: 'battle_arena', title: 'Battle Arena', description: 'Pick a hero and out-bonk a crafty bot!', icon: '⚔️', color: 'from-slate-500 to-blue-700', category: 'arcade' },

  // Puzzles
  { id: 'word_guess', title: 'Word Guess', description: 'Find the secret 5-letter word in 6 tries. New one every day!', icon: '🟩', color: 'from-green-500 to-emerald-600', category: 'puzzle', isNew: true },
  { id: 'game_2048', title: '2048', description: 'Swipe to slide and merge the numbers. Reach 2048!', icon: '🧮', color: 'from-amber-500 to-orange-600', category: 'puzzle', isNew: true },
  { id: 'block_blast', title: 'Block Blast', description: 'Drag blocks onto the board and clear whole rows and columns.', icon: '🧱', color: 'from-blue-500 to-violet-600', category: 'puzzle', isNew: true },
  { id: 'mini_sudoku', title: 'Mini Sudoku', description: '6×6 sudoku — a fresh puzzle every time.', icon: '🔢', color: 'from-emerald-500 to-teal-600', category: 'puzzle' },
  { id: 'zip_game', title: 'Zip', description: 'Connect the numbers and fill every square.', icon: '🔗', color: 'from-cyan-500 to-blue-600', category: 'puzzle' },
  { id: 'word_ladder', title: 'Word Ladder', description: 'Change one letter at a time to reach the goal word.', icon: '🪜', color: 'from-blue-500 to-sky-600', category: 'puzzle' },
  { id: 'crossword_mini', title: 'Crossword Mini', description: 'Quick crosswords with tricky clues.', icon: '📰', color: 'from-indigo-500 to-violet-600', category: 'puzzle' },
  { id: 'word_scramble', title: 'Word Scramble', description: 'Unscramble the words before time runs out.', icon: '🔤', color: 'from-amber-500 to-yellow-500', category: 'puzzle' },
  { id: 'pattern_memory', title: 'Pattern Memory', description: 'Repeat the colour pattern. How far can you go?', icon: '🧠', color: 'from-purple-500 to-fuchsia-600', category: 'puzzle' },
  { id: 'memory_speed', title: 'Speed Memory', description: 'Match every pair in 60 seconds. Chain combos!', icon: '🃏', color: 'from-orange-500 to-amber-500', category: 'puzzle' },
  { id: 'sparkle_match', title: 'Gem Match', description: 'Swap gems to match three or more.', icon: '💎', color: 'from-pink-500 to-rose-600', category: 'puzzle' },

  // Quiz
  { id: 'quiz_arena', title: 'Quiz Arena', description: '300+ questions — science, space, animals, geography, music & more. Classic or Lightning!', icon: '❓', color: 'from-violet-500 to-purple-700', category: 'quiz', isNew: true },
  { id: 'real_or_fake', title: 'Real or Fake?', description: 'Weird facts — swipe right if it\'s real, left if it\'s fake.', icon: '🤔', color: 'from-teal-500 to-cyan-600', category: 'quiz', isNew: true },
  { id: 'emoji_guess', title: 'Emoji Guess', description: '🦁👑 = ? Crack the emoji clues.', icon: '🕵️', color: 'from-yellow-500 to-orange-600', category: 'quiz', isNew: true },
  { id: 'quiz_maker', title: 'Quiz Maker', description: 'Write your own quiz — then host it for friends in Quiz Party!', icon: '🛠️', color: 'from-fuchsia-500 to-pink-600', category: 'quiz', isNew: true },
  { id: 'idol_personality_quiz', title: 'Which Arcade Hero Are You?', description: '10 quick questions: are you a Speedster, Puzzler, Party Star or Inventor?', icon: '🦸', color: 'from-pink-500 to-violet-600', category: 'quiz' },

  // Party
  { id: 'online_hub', title: 'Friends Arena — Online', description: 'Share a 4-letter code and play on different devices: Quiz Party (Kahoot-style, Gold Quest, Racing, Cash Climb), doodles, Monopoly Deal & 30 more.', icon: '🌐', color: 'from-emerald-500 to-cyan-600', category: 'party', isNew: true },
  { id: 'tug_of_war', title: 'Tug-of-War', description: 'Tap like crazy to pull the rope to your side. Best of 3!', icon: '🪢', color: 'from-amber-500 to-pink-600', category: 'party' },
  { id: 'heads_up', title: 'Heads Up', description: 'Hold the iPad on your forehead, friends act it out — tilt down if you get it!', icon: '🙆', color: 'from-sky-500 to-pink-500', category: 'party', isNew: true },
  { id: 'would_you_rather', title: 'Would You Rather', description: 'Silly choices — see what everyone else picked. Pass the iPad!', icon: '🤷', color: 'from-pink-500 to-orange-500', category: 'party', isNew: true },
  { id: 'truth_or_dare', title: 'Truth or Dare', description: 'Spin the wheel! Silly truths and funny dares for 2–8 players.', icon: '🎯', color: 'from-orange-500 to-red-600', category: 'party', isNew: true },
  { id: 'trivia_battle', title: 'Buzzer Battle', description: 'Two players race to tap the right answer — pick any quiz topic!', icon: '🛎️', color: 'from-rose-500 to-pink-600', category: 'party' },
  { id: 'reaction_duel', title: 'Reaction Duel', description: 'Tap your side first when it turns green — watch out for decoys!', icon: '👆', color: 'from-red-500 to-pink-500', category: 'party' },
  { id: 'talent_show', title: 'Talent Show', description: 'Take turns on stage, collect stars, and everyone wins an award!', icon: '🎭', color: 'from-purple-500 to-fuchsia-600', category: 'party' },
  { id: 'team_maker', title: 'Team Picker', description: 'Random fair teams for any game.', icon: '👥', color: 'from-indigo-500 to-purple-600', category: 'party' },

  // Create & music
  { id: 'beat_maker', title: 'Beat Maker', description: 'Build a beat on a 16-step drum machine — save up to 5!', icon: '🎛️', color: 'from-red-500 to-orange-500', category: 'create' },
  { id: 'guess_intro', title: 'Guess the Intro', description: 'Name the song from a quick clip — Easy, Medium or Hard.', icon: '🎧', color: 'from-violet-500 to-fuchsia-600', category: 'create' },
  { id: 'style_studio', title: 'Style Studio', description: 'Dress up, strut the runway and get scored by the judges.', icon: '👗', color: 'from-pink-500 to-fuchsia-500', category: 'create' },
  { id: 'idol_profile', title: 'Player Card', description: 'Build your own trading card: avatar, title, superpower and motto.', icon: '🎴', color: 'from-pink-500 to-purple-600', category: 'create' },
  { id: 'idol_diary', title: 'Adventure Diary', description: 'Choose your path in 8 adventures with 56 endings to find!', icon: '📖', color: 'from-amber-500 to-rose-500', category: 'create' },

  // Me
  { id: 'pet_pal', title: 'Pet Pal', description: 'Adopt a pet that grows every day you play. Feed it, decorate its room!', icon: '🐾', color: 'from-pink-500 to-amber-500', category: 'me', isNew: true },
  { id: 'quest_map', title: 'Quest Map', description: '30 quests to complete — claim coins along the trail.', icon: '🧭', color: 'from-teal-500 to-indigo-600', category: 'me', isNew: true },
  { id: 'locker', title: 'Locker', description: 'Spend coins on avatars, colours, trails and titles.', icon: '🎒', color: 'from-yellow-500 to-fuchsia-600', category: 'me', isNew: true },
  { id: 'achievement_showcase', title: 'Trophy Room', description: 'Your badges, best scores and daily streak.', icon: '🏆', color: 'from-yellow-500 to-amber-600', category: 'me' },

  // Teacher (hidden unless Jarvis mode is unlocked)
  { id: 'jarvis_hq', title: "Mr. Jarvis's Lounge", description: 'Pop Quiz, Roll Call, Boss Battle & more.', icon: '👨‍🏫', color: 'from-amber-500 to-red-600', category: 'teacher' },
  { id: 'freeze_dance', title: 'Freeze Dance', description: 'Dance, then freeze in a silly pose!', icon: '❄️', color: 'from-cyan-500 to-blue-600', category: 'teacher' },
  { id: 'chaotic_backstage', title: 'Chaotic Backstage', description: 'Each student fills a blank, then read it aloud.', icon: '📜', color: 'from-rose-500 to-fuchsia-600', category: 'teacher' },
];

const GameModeSelection: React.FC = () => {
  const { userName, setGameState, highScores, equipped, dailyDoneDate } = useGameStore();
  const daily = challengeFor();
  const dailyDone = dailyDoneDate === localDateKey();
  const [discoMode, setDiscoMode] = useState(false);
  const [discoTaps, setDiscoTaps] = useState(0);
  const teacherMode = typeof window !== 'undefined' && localStorage.getItem('jarvis_mode') === '1';
  const tiles = TILES.filter(t => t.category !== 'teacher' || teacherMode);

  const handleTitleClick = () => {
    const next = discoTaps + 1;
    setDiscoTaps(next);
    playClick();
    if (next >= 5) {
      setDiscoMode(true);
      setDiscoTaps(0);
      playWin();
    }
  };

  useEffect(() => {
    if (discoTaps > 0 && discoTaps < 5) {
      const t = setTimeout(() => setDiscoTaps(0), 2000);
      return () => clearTimeout(t);
    }
  }, [discoTaps]);

  useEffect(() => {
    if (!discoMode) return;
    const t = setTimeout(() => setDiscoMode(false), 6000);
    return () => clearTimeout(t);
  }, [discoMode]);

  const open = (id: GameState) => {
    playClick();
    setGameState(id);
  };

  let tileIndex = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="arcade-bg min-h-screen-d px-4 pt-6 text-white"
      style={discoMode ? { animation: 'discoSpin 0.8s linear infinite' } : {}}
    >
      {discoMode && <ConfettiBurst count={80} durationMs={4000} />}

      <div className="max-w-5xl mx-auto">
        <AnimatePresence>
          {discoMode && (
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white px-8 py-3 rounded-full font-fredoka text-2xl shadow-2xl"
            >
              🪩 DISCO MODE! 🪩
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-4">
          <h1
            className="text-3xl md:text-5xl font-fredoka text-white mb-1 cursor-pointer select-none drop-shadow-[0_0_12px_rgba(168,85,247,0.7)]"
            onClick={handleTitleClick}
          >
            Hey, {userName || 'Player'}! 🎮
          </h1>
          {equipped.title && <p className="font-fredoka text-lg text-yellow-300">{equipped.avatar} {equipped.title}</p>}
          <p className="text-lg md:text-xl font-nunito text-violet-200">Pick a game.</p>
        </div>

        <PlayerLevelBadge />

        <div className="max-w-xl mx-auto mt-4"><EventBanner /></div>

        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => open(daily.screen)}
          className={`w-full max-w-xl mx-auto mt-4 flex items-center gap-4 rounded-2xl p-4 text-left border-2 min-h-[72px] ${
            dailyDone ? 'bg-green-600/30 border-green-400' : 'bg-gradient-to-r from-amber-500/30 to-fuchsia-500/30 border-amber-300'
          }`}
        >
          <span className="text-4xl">{dailyDone ? '✅' : daily.icon}</span>
          <span className="flex-1">
            <span className="block font-fredoka text-sm uppercase tracking-wider text-amber-200">🎯 Daily challenge</span>
            <span className="block font-fredoka text-xl">{daily.label}</span>
            <span className="block font-nunito text-sm text-violet-200">
              {dailyDone ? 'Done for today — come back tomorrow!' : `Reward: +${DAILY_REWARD.coins} 🪙 · +${DAILY_REWARD.xp} XP`}
            </span>
          </span>
          {!dailyDone && <span className="font-fredoka text-lg">Go ▶</span>}
        </motion.button>

        <div className="flex justify-center my-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const playable = tiles.filter(t => t.category !== 'me');
              open(playable[Math.floor(Math.random() * playable.length)].id);
            }}
            className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white font-fredoka text-xl px-8 py-4 rounded-full shadow-xl min-h-[56px]"
          >
            🎲 Surprise Me!
          </motion.button>
        </div>

        {CATEGORIES.map(cat => {
          const catTiles = tiles.filter(t => t.category === cat.id);
          if (catTiles.length === 0) return null;
          return (
            <section key={cat.id} className="mb-8">
              <div className="flex items-baseline gap-3 mb-3 px-1">
                <h2 className="font-fredoka text-2xl text-white">{cat.title}</h2>
                <span className="font-nunito text-violet-300 text-base">{cat.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catTiles.map(tile => {
                  const delay = Math.min(tileIndex++ * 0.03, 0.3);
                  const best = highScores[tile.scoreKey ?? tile.id];
                  return (
                    <motion.button
                      key={tile.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, duration: 0.25 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => open(tile.id)}
                      className="relative w-full text-left rounded-2xl p-4 bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-sm shadow-lg flex items-center gap-4 min-h-[88px]"
                    >
                      <div className={`text-4xl w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${tile.color} flex items-center justify-center shadow-md`}>
                        {tile.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-fredoka text-xl text-white leading-tight">{tile.title}</h3>
                        <p className="font-nunito text-base text-violet-200 leading-snug">{tile.description}</p>
                        {best ? <p className="font-nunito text-sm text-yellow-300 mt-1">🏅 Best: {best.toLocaleString()}</p> : null}
                      </div>
                      {tile.isNew && (
                        <span className="absolute top-2 right-2 bg-yellow-400 text-stone-900 font-fredoka text-xs px-2 py-0.5 rounded-full">NEW</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <button onClick={() => setGameState('welcome')} className="btn-kid-secondary font-fredoka text-lg">
            ← Back to Welcome
          </button>
          <button onClick={() => open('parent_corner')} className="min-h-[48px] px-5 rounded-full bg-white/10 font-fredoka text-base text-violet-200">
            👪 Grown-ups
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default GameModeSelection;
