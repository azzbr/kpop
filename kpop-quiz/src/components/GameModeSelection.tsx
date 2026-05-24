import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { GameMode } from '../store';
import PlayerLevelBadge from './PlayerLevelBadge';
import { playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const GameModeSelection: React.FC = () => {
  const { userName, setGameState, setSelectedGameMode, addXP } = useGameStore();
  const [discoMode, setDiscoMode] = useState(false);
  const [discoTaps, setDiscoTaps] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleTitleClick = () => {
    const next = discoTaps + 1;
    setDiscoTaps(next);
    playClick();
    if (next >= 5) {
      setDiscoMode(true);
      setDiscoTaps(0);
      setShowConfetti(true);
      playWin();
      setTimeout(() => {
        setDiscoMode(false);
        setShowConfetti(false);
      }, 6000);
    }
  };

  useEffect(() => {
    if (discoTaps > 0 && discoTaps < 5) {
      const t = setTimeout(() => setDiscoTaps(0), 2000);
      return () => clearTimeout(t);
    }
  }, [discoTaps]);

  const gameModes = [
    {
      id: 'quiz' as GameMode,
      title: 'K-pop Quiz',
      description: 'Test your K-pop knowledge with multiple difficulty levels!',
      icon: '🧠',
      color: 'from-purple-400 to-pink-500',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300'
    },
    {
      id: 'memory' as GameMode,
      title: 'Memory Game',
      description: 'Match K-pop idols, songs, and album covers!',
      icon: '🃏',
      color: 'from-blue-400 to-cyan-500',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    {
      id: 'rhythm' as GameMode,
      title: 'Rhythm Game',
      description: 'Tap to the beat and unlock new songs!',
      icon: '🎵',
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      id: 'trivia' as GameMode,
      title: 'Trivia Cards',
      description: 'Collect and trade K-pop idol cards!',
      icon: '🎴',
      color: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300'
    },
    {
      id: 'instruments' as GameMode,
      title: 'Learn Instruments',
      description: 'Learn to play K-Pop songs on piano and recorder!',
      icon: '🎼',
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'teams' as GameMode,
      title: 'Team Maker',
      description: 'Create random teams for sports and games!',
      icon: '👥',
      color: 'from-indigo-400 to-purple-500',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-300'
    },
    {
      id: 'friends' as GameMode,
      title: 'Friends Trivia',
      description: 'Test your knowledge about your friends!',
      icon: '👫',
      color: 'from-pink-400 to-rose-500',
      bgColor: 'bg-pink-100',
      borderColor: 'border-pink-300'
    },
    {
      id: 'math' as GameMode,
      title: 'Math Challenge',
      description: 'Master math skills with fun challenges!',
      icon: '🧮',
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    {
      id: 'spelling' as GameMode,
      title: 'Spelling Bee',
      description: 'Master spelling with interactive letter fun!',
      icon: '🐝',
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'reading' as GameMode,
      title: 'Reading Comprehension',
      description: 'Read stories and answer comprehension questions!',
      icon: '📖',
      color: 'from-indigo-400 to-purple-500',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-300'
    },
    {
      id: 'science' as GameMode,
      title: 'Science Quiz',
      description: 'Learn amazing facts about animals, planets, and weather!',
      icon: '🔬',
      color: 'from-teal-400 to-green-500',
      bgColor: 'bg-teal-100',
      borderColor: 'border-teal-300'
    },
    {
      id: 'word_scramble' as GameMode,
      title: 'Word Scramble',
      description: 'Unscramble K-pop words before time runs out!',
      icon: '🔤',
      color: 'from-amber-400 to-yellow-500',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-300'
    },
    {
      id: 'lightning_quiz' as GameMode,
      title: 'Lightning Quiz ⚡',
      description: '8 seconds per question — can you handle the speed?',
      icon: '⚡',
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-400'
    },
    {
      id: 'animal_sound_quiz' as GameMode,
      title: 'Animal Sounds Quiz',
      description: 'Hear a funny animal sound and guess which animal made it!',
      icon: '🐾',
      color: 'from-green-500 to-teal-500',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      id: 'song_title_generator' as GameMode,
      title: 'Song Title Generator',
      description: 'Create your own K-pop banger title in seconds!',
      icon: '🎤',
      color: 'from-violet-400 to-purple-600',
      bgColor: 'bg-violet-100',
      borderColor: 'border-violet-300'
    },
    {
      id: 'idol_personality_quiz' as GameMode,
      title: 'Which Idol Are You?',
      description: 'Answer questions and discover your inner HUNTR/X idol!',
      icon: '🌟',
      color: 'from-pink-500 to-violet-500',
      bgColor: 'bg-pink-100',
      borderColor: 'border-pink-300'
    },
    {
      id: 'dance_battle' as GameMode,
      title: 'Dance Battle!',
      description: 'Watch the dance sequence and repeat it perfectly!',
      icon: '💃',
      color: 'from-rose-400 to-pink-600',
      bgColor: 'bg-rose-100',
      borderColor: 'border-rose-300'
    },
    {
      id: 'daily_spin_wheel' as GameMode,
      title: 'Daily Spin Wheel',
      description: 'Spin the wheel to win bonus XP and surprises!',
      icon: '🎡',
      color: 'from-yellow-400 to-amber-500',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'beat_maker' as GameMode,
      title: 'Beat Maker',
      description: 'Build your own K-pop beat with a 16-step drum machine!',
      icon: '🎛️',
      color: 'from-red-400 to-orange-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300'
    },
    {
      id: 'korean_word' as GameMode,
      title: 'Korean Word of the Day',
      description: 'Learn a new Korean word every day and test yourself!',
      icon: '🇰🇷',
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300'
    },
    {
      id: 'truth_or_dare' as GameMode,
      title: 'Truth or Dare!',
      description: 'K-pop themed truths and hilarious dares for 2–4 players!',
      icon: '🎯',
      color: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300'
    },
    {
      id: 'trivia_battle' as GameMode,
      title: 'Trivia Battle ⚔️',
      description: 'Two players race to answer — fastest correct tap wins!',
      icon: '⚔️',
      color: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-300'
    },
    {
      id: 'talent_show' as GameMode,
      title: 'Talent Show',
      description: 'Perform, get judged, and see who\'s the ultimate star!',
      icon: '🎭',
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300'
    },
    {
      id: 'zip_game' as GameMode,
      title: 'Zip — 30s Break',
      description: 'Connect the dots in order and fill the whole grid fast!',
      icon: '🔗',
      color: 'from-cyan-400 to-blue-500',
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-300'
    },
    {
      id: 'mini_sudoku' as GameMode,
      title: 'Mini Sudoku — 3min Break',
      description: 'The classic number puzzle, made mini for a quick brain break!',
      icon: '🔢',
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-300'
    },
    {
      id: 'crossword_mini' as GameMode,
      title: 'Crossword Mini',
      description: 'K-Pop themed mini crossword puzzle — fill in the answers!',
      icon: '📰',
      color: 'from-indigo-400 to-violet-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-300'
    },
    {
      id: 'word_ladder' as GameMode,
      title: 'Word Ladder',
      description: 'Change one letter at a time to climb from the start word to the end!',
      icon: '🔤',
      color: 'from-blue-400 to-sky-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300'
    },
    {
      id: 'memory_speed' as GameMode,
      title: 'Speed Memory!',
      description: 'Match all pairs in 60 seconds — chain combos to multiply your XP!',
      icon: '⚡',
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'reaction_duel' as GameMode,
      title: 'Reaction Duel',
      description: '2 players, 1 device — tap your side first when the signal flashes!',
      icon: '⚡',
      color: 'from-red-400 to-pink-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300'
    },
    {
      id: 'streak_calendar' as GameMode,
      title: 'Daily Streak',
      description: 'Track your daily play streak — how many days in a row can you play?',
      icon: '🔥',
      color: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300'
    },
    {
      id: 'achievement_showcase' as GameMode,
      title: 'Trophy Room',
      description: 'See all your achievements, level, themes, and stats in one place!',
      icon: '🏆',
      color: 'from-yellow-400 to-amber-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'pattern_memory' as GameMode,
      title: 'Pattern Memory',
      description: 'Simon Says style — watch the color pattern and repeat it. How far can you go?',
      icon: '🧠',
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300'
    },
    {
      id: 'boys_zone' as GameMode,
      title: '🔥 Boys Zone',
      description: 'Ninja Slice, Battle Arena & Rocket Launch — 3 action-packed challenges in one epic hub!',
      icon: '⚔️',
      color: 'from-blue-700 to-indigo-900',
      bgColor: 'bg-slate-900',
      borderColor: 'border-blue-500'
    },
    {
      id: 'girls_zone' as GameMode,
      title: '🌸 Girls Zone',
      description: 'Style Studio, Sparkle Match & Idol Diary — creative, sparkly, and story-filled fun!',
      icon: '✨',
      color: 'from-pink-500 to-fuchsia-500',
      bgColor: 'bg-pink-100',
      borderColor: 'border-pink-400'
    },
    {
      id: 'guess_intro' as GameMode,
      title: '🎧 Guess the Intro',
      description: 'Hear a 1.5-second snippet — name the HUNTR/X song!',
      icon: '🎧',
      color: 'from-violet-500 to-fuchsia-600',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-300'
    },
    {
      id: 'idol_profile' as GameMode,
      title: '🎙️ Idol Profile Card',
      description: 'Design your own debut card — stats, signature move, fan club!',
      icon: '🎙️',
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-300'
    },
    ...(typeof window !== 'undefined' && localStorage.getItem('jarvis_mode') === '1' ? [{
      id: 'jarvis_hq' as GameMode,
      title: "🍎 Mr. Jarvis's Lounge",
      description: 'Classroom mode — Pop Quiz, Roll Call, Gold Stars & the Cheer Cannon. For teachers!',
      icon: '👨‍🏫',
      color: 'from-amber-500 to-red-600',
      bgColor: 'bg-stone-800',
      borderColor: 'border-amber-500'
    }] : []),
  ];

  const handleGameModeSelect = (mode: GameMode) => {
    setSelectedGameMode(mode);
    if (mode === 'quiz') {
      setGameState('difficulty');
    } else if (mode === 'memory') {
      setGameState('memory_game');
    } else if (mode === 'rhythm') {
      setGameState('rhythm_game');
    } else if (mode === 'trivia') {
      setGameState('trivia_cards');
    } else if (mode === 'instruments') {
      setGameState('instruments_tutorial');
    } else if (mode === 'teams') {
      setGameState('team_maker');
    } else if (mode === 'friends') {
      setGameState('friends_trivia');
    } else if (mode === 'math') {
      setGameState('math_challenge');
    } else if (mode === 'spelling') {
      setGameState('spelling_bee');
    } else if (mode === 'reading') {
      setGameState('reading_comprehension');
    } else if (mode === 'science') {
      setGameState('science_quiz');
    } else if (mode === 'word_scramble') {
      setGameState('word_scramble');
    } else if (mode === 'lightning_quiz') {
      setGameState('lightning_quiz');
    } else if (mode === 'animal_sound_quiz') {
      setGameState('animal_sound_quiz');
    } else if (mode === 'song_title_generator') {
      setGameState('song_title_generator');
    } else if (mode === 'idol_personality_quiz') {
      setGameState('idol_personality_quiz');
    } else if (mode === 'dance_battle') {
      setGameState('dance_battle');
    } else if (mode === 'daily_spin_wheel') {
      setGameState('daily_spin_wheel');
    } else if (mode === 'beat_maker') {
      setGameState('beat_maker');
    } else if (mode === 'korean_word') {
      setGameState('korean_word');
    } else if (mode === 'truth_or_dare') {
      setGameState('truth_or_dare');
    } else if (mode === 'trivia_battle') {
      setGameState('trivia_battle');
    } else if (mode === 'talent_show') {
      setGameState('talent_show');
    } else if (mode === 'zip_game') {
      setGameState('zip_game');
    } else if (mode === 'mini_sudoku') {
      setGameState('mini_sudoku');
    } else if (mode === 'crossword_mini') {
      setGameState('crossword_mini');
    } else if (mode === 'word_ladder') {
      setGameState('word_ladder');
    } else if (mode === 'memory_speed') {
      setGameState('memory_speed');
    } else if (mode === 'reaction_duel') {
      setGameState('reaction_duel');
    } else if (mode === 'streak_calendar') {
      setGameState('streak_calendar');
    } else if (mode === 'achievement_showcase') {
      setGameState('achievement_showcase');
    } else if (mode === 'pattern_memory') {
      setGameState('pattern_memory');
    } else if (mode === 'boys_zone') {
      setGameState('boys_zone');
    } else if (mode === 'girls_zone') {
      setGameState('girls_zone');
    } else if (mode === 'jarvis_hq') {
      setGameState('jarvis_hq');
    } else if (mode === 'guess_intro') {
      setGameState('guess_intro');
    } else if (mode === 'idol_profile') {
      setGameState('idol_profile');
    }
    addXP(5);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-kid-pattern"
      style={discoMode ? { filter: 'hue-rotate(0deg)', animation: 'discoSpin 0.8s linear infinite' } : {}}
    >
      {showConfetti && <ConfettiBurst count={80} durationMs={4000} />}

      {/* Disco mode overlay */}
      <AnimatePresence>
        {discoMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: 'repeating-linear-gradient(45deg, rgba(255,0,255,0.04) 0px, transparent 4px, rgba(0,255,255,0.04) 8px, transparent 12px)' }}
          />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        {/* Disco mode banner */}
        <AnimatePresence>
          {discoMode && (
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white px-8 py-3 rounded-full font-fredoka text-2xl font-bold shadow-2xl"
            >
              🪩 DISCO MODE! 🪩
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-4"
        >
          <motion.h1
            className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow cursor-pointer select-none"
            animate={discoMode ? { color: ['#9333ea', '#ec4899', '#06b6d4', '#8b5cf6', '#9333ea'] } : {}}
            transition={discoMode ? { duration: 0.8, repeat: Infinity } : {}}
            onClick={handleTitleClick}
            title="Tap 5 times for a surprise! 🎉"
          >
            Welcome, {userName}! 🌟
          </motion.h1>
          {discoTaps > 0 && discoTaps < 5 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-nunito text-purple-400"
            >
              🎵 {5 - discoTaps} more taps for a surprise...
            </motion.p>
          )}
          <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
            Choose Your Adventure!
          </p>
        </motion.div>

        <PlayerLevelBadge />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed font-nunito"
        >
          What would you like to play today? Each game offers unique K-pop fun and challenges!
        </motion.p>

        {/* Random Fun Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 180 }}
          className="flex justify-center mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.08, rotate: [-1, 1, -1, 0] }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              playWin();
              const random = gameModes[Math.floor(Math.random() * gameModes.length)];
              handleGameModeSelect(random.id);
            }}
            className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white font-fredoka font-bold text-xl px-10 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              🎲
            </motion.span>
            Surprise Me! Play a Random Game!
            <motion.span
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              🎲
            </motion.span>
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {gameModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => handleGameModeSelect(mode.id)}
                className={`w-full p-6 ${mode.bgColor} ${mode.borderColor} border-3 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-left group`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`text-4xl md:text-5xl p-3 bg-gradient-to-r ${mode.color} rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl md:text-2xl font-fredoka font-bold mb-2 ${mode.id === 'boys_zone' || mode.id === 'jarvis_hq' ? 'text-white' : 'text-gray-800'}`}>
                      {mode.title}
                    </h3>
                    <p className={`text-sm md:text-base leading-relaxed font-nunito ${mode.id === 'boys_zone' ? 'text-blue-200' : mode.id === 'jarvis_hq' ? 'text-amber-100' : 'text-gray-600'}`}>
                      {mode.description}
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-12"
        >
          <button
            onClick={() => setGameState('welcome')}
            className="btn-kid-secondary font-fredoka text-lg"
          >
            ← Back to Welcome
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default GameModeSelection;
