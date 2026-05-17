import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Idol {
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  role: string;
  vibe: string;
  description: string;
  traits: string[];
  power: string;
}

const IDOLS: Idol[] = [
  {
    name: 'Rumi',
    emoji: '⚡',
    color: 'from-yellow-400 to-orange-500',
    bgColor: 'bg-yellow-50',
    role: 'Main Dancer & Rapper',
    vibe: 'Bold · Energetic · Leader',
    description: 'You are bold, energetic, and always the life of the party! Like Rumi, you love taking charge and making every moment unforgettable.',
    traits: ['Energetic', 'Bold', 'Natural Leader', 'Loves Challenges'],
    power: 'Telekinesis',
  },
  {
    name: 'Mira',
    emoji: '🌸',
    color: 'from-pink-400 to-rose-500',
    bgColor: 'bg-pink-50',
    role: 'Main Vocalist',
    vibe: 'Sweet · Caring · Creative',
    description: 'You are warm-hearted, creative, and always there for your friends! Like Mira, your beautiful soul shines through in everything you do.',
    traits: ['Creative', 'Kind', 'Artistic', 'Loves Music'],
    power: 'Healing Voice',
  },
  {
    name: 'Zoey',
    emoji: '🌙',
    color: 'from-blue-400 to-indigo-500',
    bgColor: 'bg-blue-50',
    role: 'Main Rapper & Visual',
    vibe: 'Cool · Mysterious · Sharp',
    description: 'You are cool, sharp, and always ahead of the trend! Like Zoey, you have a unique style that leaves everyone in awe.',
    traits: ['Trendsetter', 'Witty', 'Independent', 'Loves Fashion'],
    power: 'Time Control',
  },
  {
    name: 'Celine',
    emoji: '🌟',
    color: 'from-purple-400 to-violet-500',
    bgColor: 'bg-purple-50',
    role: 'Lead Dancer & Face of the Group',
    vibe: 'Graceful · Dreamy · Magical',
    description: 'You are graceful, magical, and full of wonder! Like Celine, you bring sparkle and elegance to everything around you.',
    traits: ['Graceful', 'Imaginative', 'Empathetic', 'Loves Stars'],
    power: 'Star Magic',
  },
];

interface Question {
  text: string;
  emoji: string;
  answers: { text: string; scores: number[] }[]; // scores: [Rumi, Mira, Zoey, Celine]
}

const QUESTIONS: Question[] = [
  {
    text: 'It\'s the first day at a new school. What do you do first?',
    emoji: '🏫',
    answers: [
      { text: 'Walk right up and introduce myself!', scores: [3, 0, 0, 1] },
      { text: 'Look for someone who seems kind and say hi.', scores: [0, 3, 0, 1] },
      { text: 'Observe everyone first and pick the coolest group.', scores: [0, 0, 3, 1] },
      { text: 'Smile and wait for someone to come to me.', scores: [0, 1, 0, 3] },
    ],
  },
  {
    text: 'Your favourite type of song is…',
    emoji: '🎵',
    answers: [
      { text: 'High-energy dance track that makes you jump!', scores: [3, 0, 1, 0] },
      { text: 'Emotional ballad that gives you chills.', scores: [0, 3, 0, 1] },
      { text: 'Swag rap with the hardest beat drop.', scores: [1, 0, 3, 0] },
      { text: 'Dreamy pop with magical vibes.', scores: [0, 1, 0, 3] },
    ],
  },
  {
    text: 'What\'s your go-to after-school activity?',
    emoji: '🎒',
    answers: [
      { text: 'Sports or dancing — got to move!', scores: [3, 0, 0, 1] },
      { text: 'Drawing, painting, or playing an instrument.', scores: [0, 3, 0, 1] },
      { text: 'Gaming or designing my next outfit.', scores: [0, 0, 3, 1] },
      { text: 'Reading a fantasy book or daydreaming.', scores: [0, 0, 1, 3] },
    ],
  },
  {
    text: 'A friend is upset. What do you do?',
    emoji: '🤝',
    answers: [
      { text: 'Tell them "Let\'s go do something fun RIGHT NOW!"', scores: [3, 0, 0, 0] },
      { text: 'Give them a big hug and listen carefully.', scores: [0, 3, 0, 1] },
      { text: 'Give them space and come back later with advice.', scores: [0, 0, 3, 0] },
      { text: 'Sit quietly with them so they know you care.', scores: [0, 1, 0, 3] },
    ],
  },
  {
    text: 'Your dream superpower is…',
    emoji: '✨',
    answers: [
      { text: 'Moving things with my mind!', scores: [3, 0, 0, 0] },
      { text: 'Healing anyone instantly.', scores: [0, 3, 0, 0] },
      { text: 'Stopping or rewinding time.', scores: [0, 0, 3, 0] },
      { text: 'Summoning stars and cosmic magic.', scores: [0, 0, 0, 3] },
    ],
  },
  {
    text: 'On stage you\'d be known for your…',
    emoji: '🎤',
    answers: [
      { text: 'Insane dance moves everyone tries to copy!', scores: [3, 1, 0, 0] },
      { text: 'Beautiful voice that makes people cry happy tears.', scores: [0, 3, 0, 1] },
      { text: 'Ice-cold rap delivery and killer fashion.', scores: [0, 0, 3, 0] },
      { text: 'Ethereal grace — every move looks like magic.', scores: [0, 0, 0, 3] },
    ],
  },
  {
    text: 'Pick your ideal group hangout!',
    emoji: '🌈',
    answers: [
      { text: 'Theme park — ride everything!', scores: [3, 1, 0, 0] },
      { text: 'Art studio + café afternoon.', scores: [0, 3, 0, 1] },
      { text: 'Rooftop movie night + snacks.', scores: [0, 0, 3, 1] },
      { text: 'Stargazing in a field at midnight.', scores: [0, 0, 0, 3] },
    ],
  },
  {
    text: 'Which word describes you best?',
    emoji: '💬',
    answers: [
      { text: '🔥 Fierce', scores: [3, 0, 1, 0] },
      { text: '💖 Warm', scores: [0, 3, 0, 1] },
      { text: '😎 Cool', scores: [0, 0, 3, 0] },
      { text: '🌙 Dreamy', scores: [0, 0, 0, 3] },
    ],
  },
];

const IdolPersonalityQuiz: React.FC = () => {
  const { setGameState } = useGameStore();
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultIdol, setResultIdol] = useState<Idol | null>(null);

  const handleAnswer = (answerIdx: number) => {
    if (selectedIdx !== null) return;
    playCorrect();
    setSelectedIdx(answerIdx);
    const addition = QUESTIONS[currentQ].answers[answerIdx].scores;
    const newScores = scores.map((s, i) => s + addition[i]);
    setScores(newScores);

    setTimeout(() => {
      if (currentQ + 1 < QUESTIONS.length) {
        setCurrentQ(prev => prev + 1);
        setSelectedIdx(null);
      } else {
        const maxIdx = newScores.indexOf(Math.max(...newScores));
        setResultIdol(IDOLS[maxIdx]);
        setPhase('result');
        setShowConfetti(true);
        playWin();
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }, 700);
  };

  const restart = () => {
    playClick();
    setPhase('intro');
    setCurrentQ(0);
    setScores([0, 0, 0, 0]);
    setSelectedIdx(null);
    setResultIdol(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={80} durationMs={3000} />}

      <div className="max-w-xl w-full mx-auto">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="btn-kid-secondary mb-4"
        >
          ← Back
        </button>

        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-4"
              >
                🌟
              </motion.div>
              <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-3">
                Which HUNTR/X Idol Are You?
              </h1>
              <p className="text-lg font-nunito text-gray-600 mb-6 leading-relaxed">
                Answer {QUESTIONS.length} quick questions and discover your inner K-pop idol from the legendary group HUNTR/X! ✨
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {IDOLS.map((idol, i) => (
                  <motion.div
                    key={idol.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`${idol.bgColor} rounded-2xl p-4 border-2 border-white shadow-md`}
                  >
                    <div className="text-4xl mb-1">{idol.emoji}</div>
                    <p className="font-fredoka font-bold text-gray-800">{idol.name}</p>
                    <p className="text-xs font-nunito text-gray-500">{idol.role}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { playClick(); setPhase('quiz'); }}
                className="btn-kid text-xl px-10 py-4 font-fredoka"
              >
                Find My Idol! 🎤
              </motion.button>
            </motion.div>
          )}

          {phase === 'quiz' && (
            <motion.div
              key={`q-${currentQ}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm font-nunito text-gray-500 mb-2">
                  <span>Question {currentQ + 1} of {QUESTIONS.length}</span>
                  <span>{Math.round(((currentQ) / QUESTIONS.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <motion.div
                    className="h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500"
                    initial={{ width: `${(currentQ / QUESTIONS.length) * 100}%` }}
                    animate={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-6">
                <div className="text-5xl text-center mb-4">{QUESTIONS[currentQ].emoji}</div>
                <h2 className="text-2xl font-fredoka font-bold text-gray-800 text-center mb-6 leading-snug">
                  {QUESTIONS[currentQ].text}
                </h2>

                <div className="space-y-3">
                  {QUESTIONS[currentQ].answers.map((answer, i) => (
                    <motion.button
                      key={i}
                      whileHover={selectedIdx === null ? { scale: 1.02, x: 4 } : {}}
                      whileTap={selectedIdx === null ? { scale: 0.98 } : {}}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedIdx !== null}
                      className={`w-full text-left p-4 rounded-2xl border-2 font-nunito text-base transition-all duration-300 ${
                        selectedIdx === i
                          ? 'bg-purple-500 border-purple-600 text-white scale-105'
                          : selectedIdx !== null
                          ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-60'
                          : 'bg-purple-50 border-purple-200 text-gray-700 hover:bg-purple-100 hover:border-purple-400'
                      }`}
                    >
                      <span className="font-bold text-lg mr-2">{['A', 'B', 'C', 'D'][i]}.</span>
                      {answer.text}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'result' && resultIdol && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-8xl mb-4"
              >
                {resultIdol.emoji}
              </motion.div>

              <h2 className="text-2xl font-fredoka text-gray-600 mb-1">You are…</h2>
              <h1 className="text-5xl font-fredoka font-bold text-purple-600 text-kid-glow mb-2">
                {resultIdol.name}!
              </h1>
              <p className="text-lg font-nunito text-pink-500 font-semibold mb-2">
                {resultIdol.role}
              </p>
              <p className="text-sm font-nunito text-gray-500 mb-6 italic">
                {resultIdol.vibe}
              </p>

              <motion.div
                className={`${resultIdol.bgColor} rounded-3xl p-6 mb-6 border-2 border-white shadow-xl`}
              >
                <p className="font-nunito text-gray-700 text-lg leading-relaxed mb-4">
                  {resultIdol.description}
                </p>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {resultIdol.traits.map(trait => (
                    <span key={trait} className="bg-white px-3 py-1 rounded-full text-sm font-fredoka font-bold text-purple-600 shadow">
                      ✨ {trait}
                    </span>
                  ))}
                </div>
                <p className="font-fredoka text-gray-600">
                  ⚡ Special Power: <strong>{resultIdol.power}</strong>
                </p>
              </motion.div>

              {/* Score breakdown */}
              <div className="bg-white rounded-2xl p-4 mb-6 border-2 border-gray-200 shadow-md">
                <h3 className="font-fredoka font-bold text-gray-700 mb-3 text-lg">Your HUNTR/X Match</h3>
                {IDOLS.map((idol, i) => {
                  const total = scores.reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((scores[i] / total) * 100);
                  return (
                    <div key={idol.name} className="flex items-center gap-2 mb-2">
                      <span className="text-xl w-8">{idol.emoji}</span>
                      <span className="font-fredoka text-gray-700 w-16 text-left text-sm">{idol.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <motion.div
                          className={`h-4 rounded-full bg-gradient-to-r ${idol.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        />
                      </div>
                      <span className="text-sm font-fredoka text-gray-500 w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={restart}
                  className="btn-kid-secondary font-fredoka text-lg"
                >
                  🔄 Try Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); setGameState('game_mode'); }}
                  className="btn-kid font-fredoka text-lg"
                >
                  🏠 Game Menu
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default IdolPersonalityQuiz;
