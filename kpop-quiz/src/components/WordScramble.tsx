import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playCorrect, playWrong, playWin, playClick, playTick, playTimeOut } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface WordItem {
  word: string;
  hint: string;
  emoji: string;
}

const WORDS: WordItem[] = [
  { word: 'KPOP', hint: 'Korean pop music genre', emoji: '🎵' },
  { word: 'IDOL', hint: 'A famous K-pop performer', emoji: '⭐' },
  { word: 'DEBUT', hint: 'First time performing publicly', emoji: '🌟' },
  { word: 'FANDOM', hint: 'Group of super fans', emoji: '💜' },
  { word: 'COMEBACK', hint: 'When a group releases new music', emoji: '🎤' },
  { word: 'MELODY', hint: 'A musical tune', emoji: '🎶' },
  { word: 'RHYTHM', hint: 'The beat of music', emoji: '🥁' },
  { word: 'STAGE', hint: 'Where performers perform', emoji: '🎭' },
  { word: 'CONCERT', hint: 'Live music show', emoji: '🎸' },
  { word: 'LYRICS', hint: 'Words of a song', emoji: '📝' },
  { word: 'DANCE', hint: 'Move to the music', emoji: '💃' },
  { word: 'SINGER', hint: 'Person who sings', emoji: '🎙️' },
  { word: 'ALBUM', hint: 'Collection of songs', emoji: '💿' },
  { word: 'GOLDEN', hint: 'HUNTR/X hit song', emoji: '🏆' },
  { word: 'HUNTER', hint: 'What HUNTR/X members are', emoji: '🔎' },
  { word: 'MAGIC', hint: 'Something amazing and unreal', emoji: '✨' },
  { word: 'POWER', hint: 'Strength and energy', emoji: '💪' },
  { word: 'SPARK', hint: 'A tiny flash of light', emoji: '⚡' },
  { word: 'SHINE', hint: 'To glow brightly', emoji: '☀️' },
  { word: 'HEART', hint: 'Symbol of love', emoji: '❤️' },
  { word: 'BRAVE', hint: 'Courageous and fearless', emoji: '🦁' },
  { word: 'CHEER', hint: 'Shout of support', emoji: '🎉' },
  { word: 'DREAM', hint: 'What you hope for', emoji: '🌙' },
  { word: 'SQUAD', hint: 'A team of friends', emoji: '👯' },
];

const TIME_PER_WORD = 15;

function scramble(word: string): string[] {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Ensure it's actually scrambled
  if (arr.join('') === word && arr.length > 1) {
    [arr[0], arr[arr.length - 1]] = [arr[arr.length - 1], arr[0]];
  }
  return arr;
}

export default function WordScramble() {
  const { setGameState } = useGameStore();

  const [pool] = useState(() => [...WORDS].sort(() => Math.random() - 0.5));
  const [wordIndex, setWordIndex] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]); // indices into scrambled
  const [timeLeft, setTimeLeft] = useState(TIME_PER_WORD);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [totalWords] = useState(10);

  const currentItem = pool[wordIndex];

  const loadWord = useCallback((idx: number) => {
    setScrambled(scramble(pool[idx].word));
    setSelected([]);
    setTimeLeft(TIME_PER_WORD);
    setFeedback(null);
  }, [pool]);

  useEffect(() => { loadWord(0); }, [loadWord]);

  // Timer
  useEffect(() => {
    if (feedback || gameOver) return;
    if (timeLeft <= 0) {
      playTimeOut();
      setFeedback('timeout');
      setStreak(0);
      setTimeout(() => advance(false), 1500);
      return;
    }
    if (timeLeft <= 4) playTick();
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, feedback, gameOver]);

  const guessedWord = selected.map(i => scrambled[i]).join('');

  // Auto-check when all letters selected
  useEffect(() => {
    if (selected.length !== currentItem?.word.length || feedback) return;
    if (guessedWord === currentItem.word) {
      playCorrect();
      const bonus = Math.max(0, timeLeft - 5);
      const pts = 100 + streak * 20 + bonus * 5;
      setScore(s => s + pts);
      setStreak(s => s + 1);
      setFeedback('correct');
      setTimeout(() => advance(true), 1200);
    } else {
      playWrong();
      setStreak(0);
      setFeedback('wrong');
      setTimeout(() => setSelected([]), 600);
      setTimeout(() => setFeedback(null), 600);
    }
  }, [selected]);

  function advance(wasCorrect: boolean) {
    const next = wordIndex + 1;
    if (next >= totalWords) {
      if (wasCorrect || score > 0) { setConfetti(true); playWin(); }
      setGameOver(true);
    } else {
      setWordIndex(next);
      loadWord(next);
    }
  }

  const handleLetterClick = (idx: number) => {
    if (feedback === 'correct' || feedback === 'timeout') return;
    if (selected.includes(idx)) return;
    playClick();
    setSelected(prev => [...prev, idx]);
  };

  const handleRemove = (pos: number) => {
    if (feedback === 'correct' || feedback === 'timeout') return;
    playClick();
    setSelected(prev => prev.filter((_, i) => i !== pos));
  };

  const timerColor = timeLeft > 8 ? 'text-green-600' : timeLeft > 4 ? 'text-orange-500' : 'text-red-500';

  if (gameOver) {
    const pct = Math.round((score / (totalWords * 100)) * 100);
    const rating =
      pct >= 90 ? '🏆 Word Wizard!'
      : pct >= 60 ? '⭐ K-Pop Scholar!'
      : '🎵 Keep Rocking!';
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-kid-pattern flex items-center justify-center p-4">
        {confetti && <ConfettiBurst count={60} durationMs={3500} />}
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-3">🎊</div>
          <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-2">Game Over!</h2>
          <div className="text-xl font-fredoka text-pink-500 mb-4">{rating}</div>
          <div className="text-4xl font-fredoka font-bold text-purple-700 mb-2">{score} pts</div>
          <div className="text-gray-500 mb-6">out of {totalWords} words</div>
          <div className="flex gap-3">
            <button onClick={() => { setGameState('word_scramble' as any); window.location.reload(); }}
              className="btn-kid flex-1">🔄 Play Again</button>
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
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary text-sm">← Back</button>
        <div className="text-center">
          <div className="text-lg font-fredoka font-bold text-purple-600">Word Scramble 🔤</div>
          <div className="text-sm text-gray-500">{wordIndex + 1} / {totalWords}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-pink-600">{score} pts</div>
          {streak >= 2 && <div className="text-sm text-orange-500">🔥 {streak}x streak</div>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg bg-gray-200 rounded-full h-2 mb-6">
        <div className="bg-gradient-to-r from-purple-400 to-pink-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${((wordIndex) / totalWords) * 100}%` }} />
      </div>

      <div className="w-full max-w-lg">
        {/* Word card */}
        <motion.div key={wordIndex} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className={`card-kid p-6 mb-6 text-center border-4 ${
            feedback === 'correct' ? 'border-green-400 bg-green-50'
            : feedback === 'timeout' ? 'border-red-400 bg-red-50'
            : 'border-purple-200'
          }`}>
          <div className="text-5xl mb-2">{currentItem.emoji}</div>
          <p className="text-gray-600 font-nunito text-lg mb-1">Unscramble this K-pop word!</p>
          <p className="text-purple-500 font-fredoka text-base">Hint: {currentItem.hint}</p>

          {/* Timer */}
          <div className={`text-4xl font-fredoka font-bold mt-3 ${timerColor}`}>⏱ {timeLeft}s</div>

          {/* Feedback */}
          <AnimatePresence>
            {feedback && (
              <motion.div key={feedback} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`text-2xl font-fredoka font-bold mt-2 ${
                  feedback === 'correct' ? 'text-green-600' : 'text-red-500'
                }`}>
                {feedback === 'correct' ? `✅ ${currentItem.word}! +${100 + streak * 20}` : feedback === 'timeout' ? '⏰ Time\'s up!' : '❌ Try again!'}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Answer slots */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {Array.from({ length: currentItem.word.length }).map((_, pos) => {
            const letter = selected[pos] !== undefined ? scrambled[selected[pos]] : '';
            return (
              <motion.button key={pos} whileTap={{ scale: 0.9 }}
                onClick={() => letter && handleRemove(pos)}
                className={`w-12 h-12 rounded-xl border-3 text-xl font-fredoka font-bold flex items-center justify-center transition-all ${
                  letter
                    ? 'bg-purple-500 text-white border-purple-600 cursor-pointer hover:bg-red-400'
                    : 'bg-white border-dashed border-purple-300 text-transparent'
                }`}>
                {letter}
              </motion.button>
            );
          })}
        </div>

        {/* Scrambled letters */}
        <div className="flex justify-center gap-2 flex-wrap mb-4">
          {scrambled.map((letter, idx) => {
            const used = selected.includes(idx);
            return (
              <motion.button key={idx} whileHover={!used ? { scale: 1.15 } : {}} whileTap={!used ? { scale: 0.9 } : {}}
                onClick={() => !used && handleLetterClick(idx)}
                className={`w-12 h-12 rounded-xl border-3 text-xl font-fredoka font-bold transition-all ${
                  used
                    ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-yellow-400 text-gray-800 border-yellow-500 cursor-pointer hover:bg-yellow-300 shadow-md'
                }`}>
                {letter}
              </motion.button>
            );
          })}
        </div>

        {/* Clear button */}
        <div className="text-center">
          <button onClick={() => { playClick(); setSelected([]); }}
            className="text-sm text-purple-500 hover:text-purple-700 underline">
            Clear ✕
          </button>
        </div>
      </div>
    </motion.div>
  );
}
