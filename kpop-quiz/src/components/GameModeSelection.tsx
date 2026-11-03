import React, { Suspense, lazy, useState, useEffect } from 'react';
// The live count loads separately (it brings the realtime client).
const OnlineCount = lazy(() => import('./ui/OnlineCount'));
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { GameState } from '../store';
import PlayerLevelBadge from './PlayerLevelBadge';
import { playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { challengeFor, DAILY_REWARD } from '../utils/dailyChallenge';
import { localDateKey } from '../utils/dates';
import EventBanner from './events/EventBanner';
import PinPad from './ui/PinPad';
import TeacherSplash from './TeacherSplash';
import { checkPin } from '../utils/pin';
import { offerInstall, useInstallState } from '../utils/appInstall';
import GameTile, { RecentCard } from './home/GameTile';
import type { HomeTile } from './home/GameTile';
import TodayStrip from './home/TodayStrip';
import WeeklyCard from './home/WeeklyCard';
import { pickSurpriseGame } from './home/homeLogic';
import { gameOfTheWeek } from '../utils/weeklyGame';

type Category = 'arcade' | 'puzzle' | 'quiz' | 'party' | 'create' | 'me' | 'teacher';

type Tile = HomeTile & { category: Category };

const CATEGORIES: { id: Category; title: string; subtitle: string }[] = [
  { id: 'arcade', title: '🕹️ Arcade', subtitle: 'Fast reflexes, big scores' },
  { id: 'puzzle', title: '🧩 Puzzles & Brain', subtitle: 'Think it through' },
  { id: 'quiz', title: '❓ Quiz', subtitle: 'How much do you know?' },
  { id: 'party', title: '🎉 Party', subtitle: '2+ players — pass the iPad!' },
  { id: 'create', title: '🎨 Create & Music', subtitle: 'Make something awesome' },
  { id: 'me', title: '🏆 My Stuff', subtitle: 'Streaks and trophies' },
  { id: 'teacher', title: '🍎 Classroom', subtitle: 'Teacher tools' },
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
  { id: 'mini_sudoku', title: 'Mini Sudoku', description: '6×6 sudoku with exactly one answer. Easy to Hard.', icon: '🔢', color: 'from-emerald-500 to-teal-600', category: 'puzzle' },
  { id: 'zip_game', title: 'Zip', description: 'Draw one path through every square, numbers in order. 4 sizes!', icon: '🔗', color: 'from-cyan-500 to-blue-600', category: 'puzzle' },
  { id: 'picture_puzzle', title: 'Picture Puzzles', description: 'Fill squares from the number clues — a picture appears!', icon: '🖼️', color: 'from-pink-500 to-amber-500', category: 'puzzle', isNew: true },
  { id: 'bridges', title: 'Bridges', description: 'Join the islands with bridges. Each number says how many.', icon: '🌉', color: 'from-sky-500 to-teal-600', category: 'puzzle', isNew: true },
  { id: 'light_up', title: 'Light Up', description: 'Place lamps to light every square — no lamp may see another.', icon: '💡', color: 'from-yellow-400 to-orange-600', category: 'puzzle', isNew: true },
  { id: 'untangle', title: 'Untangle', description: 'Drag the dots until no lines cross.', icon: '🕸️', color: 'from-violet-500 to-fuchsia-600', category: 'puzzle', isNew: true },
  { id: 'chess_academy', scoreKey: 'chess_puzzles', title: 'Chess Academy', description: 'Learn every piece, solve puzzles and beat friendly bots!', icon: '♟️', color: 'from-slate-500 to-indigo-700', category: 'puzzle', isNew: true },
  { id: 'word_ladder', title: 'Word Ladder', description: 'Change one letter at a time to climb to the goal word.', icon: '🪜', color: 'from-blue-500 to-sky-600', category: 'puzzle' },
  { id: 'crossword_mini', title: 'Crossword Mini', description: 'Mini crosswords — tap a square and type with the big keys.', icon: '📰', color: 'from-indigo-500 to-violet-600', category: 'puzzle' },
  { id: 'word_scramble', title: 'Word Scramble', description: 'Unscramble 10 jumbled words. Be fast for streak bonuses!', icon: '🔤', color: 'from-amber-500 to-yellow-500', category: 'puzzle' },
  { id: 'pattern_memory', title: 'Pattern Memory', description: 'Watch the pads light up and repeat the pattern.', icon: '🧠', color: 'from-purple-500 to-fuchsia-600', category: 'puzzle' },
  { id: 'memory_speed', title: 'Speed Memory', description: 'Find every pair before time runs out — 8, 12 or 18 pairs.', icon: '🃏', color: 'from-orange-500 to-amber-500', category: 'puzzle' },
  { id: 'sparkle_match', title: 'Gem Match', description: 'Swipe gems to match 3 or more. Make ⚡ power gems!', icon: '💎', color: 'from-pink-500 to-rose-600', category: 'puzzle' },

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

  // Teacher (shown in teacher mode: Grown-ups corner → Teacher setup, then 🍎 Teacher + PIN)
  { id: 'jarvis_hq', title: "Teacher's Lounge", description: 'Pop Quiz, Roll Call, Boss Battle & more.', icon: '👨‍🏫', color: 'from-amber-500 to-red-600', category: 'teacher' },
  { id: 'freeze_dance', title: 'Freeze Dance', description: 'Dance, then freeze in a silly pose!', icon: '❄️', color: 'from-cyan-500 to-blue-600', category: 'teacher' },
  { id: 'chaotic_backstage', title: 'Chaotic Backstage', description: 'Each student fills a blank, then read it aloud.', icon: '📜', color: 'from-rose-500 to-fuchsia-600', category: 'teacher' },
];

const GameModeSelection: React.FC = () => {
  const { userName, setGameState, highScores, equipped, dailyDoneDate } = useGameStore();
  const daily = challengeFor();
  const dailyDone = dailyDoneDate === localDateKey();
  const [discoMode, setDiscoMode] = useState(false);
  const [discoTaps, setDiscoTaps] = useState(0);
  const teacher = useGameStore(s => s.teacher);
  const teacherMode = useGameStore(s => s.teacherOn);
  const setTeacherOn = useGameStore(s => s.setTeacherOn);
  const [askPin, setAskPin] = useState(false);
  const [splash, setSplash] = useState(false);
  const tiles = TILES.filter(t => t.category !== 'teacher' || teacherMode);
  const favourites = useGameStore(s => s.favourites);
  const recent = useGameStore(s => s.recent);
  const toggleFavourite = useGameStore(s => s.toggleFavourite);
  const byId = new Map(tiles.map(t => [t.id, t] as const));
  const weeklyId = gameOfTheWeek(localDateKey());
  const weeklyTile = tiles.find(t => (t.scoreKey ?? t.id) === weeklyId);
  const recentTiles = recent.map(id => byId.get(id)).filter((t): t is Tile => !!t).slice(0, 4);
  const favTiles = favourites.map(id => byId.get(id)).filter((t): t is Tile => !!t);
  const install = useInstallState();

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
    // "Jump back in" lists games only (not My Stuff screens or the Grown-ups corner).
    const tile = TILES.find(t => t.id === id);
    if (tile && tile.category !== 'me') useGameStore.getState().noteOpened(id);
    setGameState(id);
  };

  const renderTile = (tile: Tile, delay = 0) => (
    <GameTile
      key={tile.id}
      tile={tile}
      best={highScores[tile.scoreKey ?? tile.id]}
      fav={favourites.includes(tile.id)}
      weekly={(tile.scoreKey ?? tile.id) === weeklyId}
      delay={delay}
      onOpen={() => open(tile.id)}
      onToggleFav={() => { playClick(); toggleFavourite(tile.id); }}
    />
  );

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
          <div className="min-h-[44px] pt-2"><Suspense fallback={null}><OnlineCount /></Suspense></div>
        </div>

        <PlayerLevelBadge />

        <TodayStrip onOpen={open} />

        <div className="max-w-xl mx-auto mt-4"><EventBanner /></div>

        {install.updateReady && (
          <button onClick={() => { playClick(); location.reload(); }}
            className="w-full max-w-xl mx-auto mt-4 flex items-center gap-3 rounded-2xl p-3 text-left bg-sky-500/25 border-2 border-sky-300 min-h-[56px]">
            <span className="text-3xl">✨</span>
            <span className="flex-1 font-fredoka text-lg">New things have arrived! Tap to update.</span>
          </button>
        )}

        <div className={`mx-auto mt-4 grid gap-3 ${weeklyTile ? 'max-w-4xl md:grid-cols-2' : 'max-w-xl'}`}>
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => open(daily.screen)}
          className={`w-full flex items-center gap-4 rounded-2xl p-4 text-left border-2 min-h-[72px] ${
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
        {weeklyTile && <WeeklyCard tile={weeklyTile} onOpen={() => open(weeklyTile.id)} />}
        </div>

        <div className="flex justify-center my-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Leans towards games she hasn't tried or mastered yet (home/homeLogic.ts).
              const playable = tiles.filter(t => t.category !== 'me').map(t => t.id);
              const pick = pickSurpriseGame(playable, highScores, recent);
              if (pick) open(pick);
            }}
            className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white font-fredoka text-xl px-8 py-4 rounded-full shadow-xl min-h-[56px]"
          >
            🎲 Surprise Me!
          </motion.button>
        </div>

        {recentTiles.length > 0 && (
          <section aria-label="Jump back in" className="mb-8">
            <h2 className="font-fredoka text-2xl text-white mb-3 px-1">▶ Jump back in</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {recentTiles.map(t => (
                <RecentCard key={t.id} tile={t} best={highScores[t.scoreKey ?? t.id]} onOpen={() => open(t.id)} />
              ))}
            </div>
          </section>
        )}

        {favTiles.length > 0 ? (
          <section aria-label="My favourites" className="mb-8">
            <h2 className="font-fredoka text-2xl text-white mb-3 px-1">⭐ My favourites</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favTiles.map(t => renderTile(t))}
            </div>
          </section>
        ) : (
          <p className="text-center font-nunito text-base text-violet-200 -mt-2 mb-6">Tap ☆ on a game to keep it at the top.</p>
        )}

        {CATEGORIES.map(cat => {
          const catTiles = tiles.filter(t => t.category === cat.id);
          if (catTiles.length === 0) return null;
          return (
            <section key={cat.id} aria-label={cat.title} className="mb-8">
              <div className="flex items-baseline gap-3 mb-3 px-1">
                <h2 className="font-fredoka text-2xl text-white">{cat.title}</h2>
                <span className="font-nunito text-violet-300 text-base">{cat.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catTiles.map(tile => renderTile(tile, Math.min(tileIndex++ * 0.03, 0.3)))}
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
          {offerInstall(install) && (
            <button onClick={() => open('parent_corner')} className="min-h-[48px] px-5 rounded-full bg-white/10 font-fredoka text-base text-violet-200">
              📲 Get the app
            </button>
          )}
          {teacher && (
            <button onClick={() => { playClick(); if (teacherMode) setTeacherOn(false); else setAskPin(true); }}
              className={`min-h-[48px] px-5 rounded-full font-fredoka text-base ${teacherMode ? 'bg-amber-400 text-stone-900' : 'bg-white/10 text-violet-200'}`}>
              {teacherMode ? '🍎 End lesson' : '🍎 Teacher'}
            </button>
          )}
        </div>
        <AnimatePresence>
          {askPin && teacher && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
              <div className="rounded-3xl bg-indigo-950 border-2 border-amber-400 p-6 w-full max-w-sm">
                <PinPad label={`🍎 ${teacher.name}, enter your PIN`} onSubmit={async (pin) => {
                  if (!(await checkPin(pin, teacher.pinHash))) return false;
                  setAskPin(false); setTeacherOn(true); setSplash(true);
                  return true;
                }} />
                <button onClick={() => { playClick(); setAskPin(false); }} className="mt-3 w-full min-h-[48px] rounded-full bg-white/10 font-fredoka text-lg">Cancel</button>
              </div>
            </motion.div>
          )}
          {splash && teacher && <TeacherSplash key="splash" name={teacher.name} onDone={() => setSplash(false)} />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default GameModeSelection;
