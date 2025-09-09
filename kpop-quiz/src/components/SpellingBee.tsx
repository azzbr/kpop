import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';

interface SpellingWord {
  word: string;
  grade: number;
  hint?: string;
}

const spellingWords: SpellingWord[] = [
  // Grade 2 (Easy)
  { word: 'cat', grade: 2 },
  { word: 'dog', grade: 2 },
  { word: 'run', grade: 2 },
  { word: 'jump', grade: 2 },
  { word: 'blue', grade: 2 },
  { word: 'red', grade: 2 },
  { word: 'sun', grade: 2 },
  { word: 'moon', grade: 2 },
  { word: 'tree', grade: 2 },
  { word: 'bird', grade: 2 },
  { word: 'fish', grade: 2 },
  { word: 'book', grade: 2 },
  { word: 'pen', grade: 2 },
  { word: 'cup', grade: 2 },
  { word: 'hat', grade: 2 },

  // Grade 3 (Medium)
  { word: 'beautiful', grade: 3, hint: 'Very pretty' },
  { word: 'elephant', grade: 3, hint: 'Large animal with trunk' },
  { word: 'dinosaur', grade: 3, hint: 'Ancient reptile' },
  { word: 'chocolate', grade: 3, hint: 'Sweet treat' },
  { word: 'computer', grade: 3, hint: 'Electronic machine' },
  { word: 'garden', grade: 3, hint: 'Place with flowers' },
  { word: 'mountain', grade: 3, hint: 'Very tall hill' },
  { word: 'ocean', grade: 3, hint: 'Large body of water' },
  { word: 'picture', grade: 3, hint: 'Photo or drawing' },
  { word: 'teacher', grade: 3, hint: 'School instructor' },
  { word: 'window', grade: 3, hint: 'Glass in wall' },
  { word: 'yellow', grade: 3, hint: 'Color of sun' },
  { word: 'animal', grade: 3, hint: 'Living creature' },
  { word: 'friend', grade: 3, hint: 'Best pal' },
  { word: 'school', grade: 3, hint: 'Place of learning' },

  // Grade 4 (Hard)
  { word: 'pronunciation', grade: 4, hint: 'How to say a word' },
  { word: 'Mississippi', grade: 4, hint: 'Long river name' },
  { word: 'onomatopoeia', grade: 4, hint: 'Sound words like BANG' },
  { word: 'restaurant', grade: 4, hint: 'Place to eat' },
  { word: 'temperature', grade: 4, hint: 'How hot or cold' },
  { word: 'vegetable', grade: 4, hint: 'Healthy food' },
  { word: 'adventure', grade: 4, hint: 'Exciting journey' },
  { word: 'beautiful', grade: 4, hint: 'Very pretty' },
  { word: 'calendar', grade: 4, hint: 'Dates and months' },
  { word: 'delicious', grade: 4, hint: 'Tastes very good' },
  { word: 'exercise', grade: 4, hint: 'Physical activity' },
  { word: 'festival', grade: 4, hint: 'Celebration event' },
  { word: 'guitar', grade: 4, hint: 'String instrument' },
  { word: 'hospital', grade: 4, hint: 'Medical building' },
  { word: 'important', grade: 4, hint: 'Very necessary' },

  // Grade 5 (Expert)
  { word: 'conscientious', grade: 5, hint: 'Careful and thorough' },
  { word: 'bureaucracy', grade: 5, hint: 'Government system' },
  { word: 'sesquipedalian', grade: 5, hint: 'Using long words' },
  { word: 'extraordinary', grade: 5, hint: 'Very unusual' },
  { word: 'unbelievable', grade: 5, hint: 'Hard to believe' },
  { word: 'responsibility', grade: 5, hint: 'Being accountable' },
  { word: 'communication', grade: 5, hint: 'Sharing information' },
  { word: 'imagination', grade: 5, hint: 'Creative thinking' },
  { word: 'determination', grade: 5, hint: 'Strong willpower' },
  { word: 'appreciation', grade: 5, hint: 'Being grateful' },
  { word: 'organization', grade: 5, hint: 'Being structured' },
  { word: 'enthusiasm', grade: 5, hint: 'Great excitement' },
  { word: 'curiosity', grade: 5, hint: 'Wanting to learn' },
  { word: 'perseverance', grade: 5, hint: 'Never giving up' },
  { word: 'independence', grade: 5, hint: 'Being self-reliant' }
];

const SpellingBee: React.FC = () => {
  const { setGameState } = useGameStore();

  const [currentWord, setCurrentWord] = useState<SpellingWord | null>(null);
  const [userSpelling, setUserSpelling] = useState<string[]>([]);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [wordNumber, setWordNumber] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [gradeLevel, setGradeLevel] = useState<2 | 3 | 4 | 5>(2);
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  // Timer effect
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && !isCorrect) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
  }, [timeLeft, gameStarted, isCorrect]);

  const getWordsForGrade = (grade: number): SpellingWord[] => {
    return spellingWords.filter(word => word.grade === grade);
  };

  const getRandomWord = (grade: number): SpellingWord => {
    const words = getWordsForGrade(grade);
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
  };

  const startGame = (grade: 2 | 3 | 4 | 5) => {
    setGradeLevel(grade);
    setGameStarted(true);
    setScore(0);
    setWordNumber(1);
    setStreak(0);
    setTimeLeft(60);
    setCurrentWord(getRandomWord(grade));
    setUserSpelling([]);
    setCurrentLetterIndex(0);
    setIsCorrect(null);
    setShowHint(false);
  };

  const handleLetterClick = (letter: string) => {
    if (isCorrect !== null || !currentWord) return;

    const newSpelling = [...userSpelling, letter];
    setUserSpelling(newSpelling);
    setCurrentLetterIndex(currentLetterIndex + 1);

    // Check if word is complete
    if (newSpelling.length === currentWord.word.length) {
      const spelledWord = newSpelling.join('');
      const correct = spelledWord.toLowerCase() === currentWord.word.toLowerCase();

      setIsCorrect(correct);

      if (correct) {
        const timeBonus = Math.max(0, timeLeft * 2);
        const streakBonus = streak * 10;
        const points = 20 + timeBonus + streakBonus;

        setScore(prev => prev + points);
        setStreak(prev => prev + 1);

        setTimeout(() => {
          nextWord();
        }, 2500);
      } else {
        setStreak(0);
        setTimeout(() => {
          nextWord();
        }, 2500);
      }
    }
  };

  const handleDelete = () => {
    if (userSpelling.length > 0 && isCorrect === null) {
      const newSpelling = userSpelling.slice(0, -1);
      setUserSpelling(newSpelling);
      setCurrentLetterIndex(currentLetterIndex - 1);
    }
  };

  const handleTimeUp = () => {
    if (currentWord && isCorrect === null) {
      setIsCorrect(false);
      setStreak(0);
      setTimeout(() => {
        nextWord();
      }, 2500);
    }
  };

  const nextWord = () => {
    if (wordNumber >= 10) {
      // Game over
      setGameStarted(false);
    } else {
      setWordNumber(prev => prev + 1);
      setCurrentWord(getRandomWord(gradeLevel));
      setUserSpelling([]);
      setCurrentLetterIndex(0);
      setIsCorrect(null);
      setShowHint(false);
      setTimeLeft(60);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setCurrentWord(null);
    setUserSpelling([]);
    setCurrentLetterIndex(0);
    setIsCorrect(null);
    setScore(0);
    setWordNumber(1);
    setTimeLeft(60);
    setStreak(0);
    setShowHint(false);
  };

  const handleBackToMenu = () => {
    setGameState('game_mode');
  };

  // Generate letter buttons (A-Z)
  const letterButtons = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
    <motion.button
      key={letter}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => handleLetterClick(letter)}
      disabled={isCorrect !== null}
      className="w-12 h-12 bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {letter}
    </motion.button>
  ));

  if (!gameStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
      >
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
              🐝 Spelling Bee! 📝
            </h1>
            <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
              Master Spelling with Fun!
            </p>
          </motion.div>

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={handleBackToMenu}
              className="btn-kid-secondary font-fredoka text-lg"
            >
              ← Back to Games
            </button>
          </motion.div>

          {/* Game Over Screen */}
          {wordNumber > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-lg p-6 mb-6 text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-4">
                Spelling Bee Complete!
              </h2>
              <div className="text-2xl font-bold text-pink-500 mb-2">
                Final Score: {score} points
              </div>
              <div className="text-lg text-gray-600 mb-6">
                You spelled {wordNumber - 1} words correctly!
              </div>
              <div className="text-sm text-gray-500 mb-6">
                Longest Streak: {streak} words in a row!
              </div>
            </motion.div>
          )}

          {/* Grade Level Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-6 text-center">
              Choose Your Grade Level
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame(2)}
                className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟢</div>
                  <div className="text-xl mb-1">Grade 2</div>
                  <div className="text-sm opacity-80">Basic Words</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame(3)}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟡</div>
                  <div className="text-xl mb-1">Grade 3</div>
                  <div className="text-sm opacity-80">Longer Words</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame(4)}
                className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🔴</div>
                  <div className="text-xl mb-1">Grade 4</div>
                  <div className="text-sm opacity-80">Challenge Words</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame(5)}
                className="bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟣</div>
                  <div className="text-xl mb-1">Grade 5</div>
                  <div className="text-sm opacity-80">Expert Words</div>
                </div>
              </motion.button>
            </div>

            <div className="text-center text-gray-600">
              <p className="mb-2">🐝 <strong>How to Play:</strong></p>
              <ul className="text-sm space-y-1">
                <li>• Click letters to spell the word</li>
                <li>• Use the delete button to fix mistakes</li>
                <li>• Get hints if you need help</li>
                <li>• Spell 10 words as fast as you can!</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
    >
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
            🐝 Spelling Bee! 📝
          </h1>
        </motion.div>

        {/* Game Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex justify-between items-center mb-6 bg-white rounded-2xl p-4 shadow-lg"
        >
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-purple-600">{score}</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-blue-600">{wordNumber}/10</div>
            <div className="text-sm text-gray-600">Word</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-green-600">{streak}</div>
            <div className="text-sm text-gray-600">Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-red-600">{timeLeft}s</div>
            <div className="text-sm text-gray-600">Time</div>
          </div>
        </motion.div>

        {/* Word Display */}
        {currentWord && (
          <motion.div
            key={currentWord.word}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-lg p-8 mb-6"
          >
            <div className="text-center mb-8">
              <div className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
                Grade {currentWord.grade} • Word {wordNumber} of 10
              </div>

              {/* Spelling Progress */}
              <div className="flex justify-center items-center space-x-2 mb-6">
                {currentWord.word.split('').map((letter, index) => (
                  <motion.div
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className={`w-16 h-16 border-4 rounded-xl flex items-center justify-center text-2xl font-bold ${
                      index < userSpelling.length
                        ? userSpelling[index]?.toLowerCase() === letter.toLowerCase()
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {index < userSpelling.length ? userSpelling[index] : '_'}
                  </motion.div>
                ))}
              </div>

              {/* Hint Button */}
              {currentWord.hint && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowHint(!showHint)}
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-4 py-2 rounded-xl font-bold mb-4 transition-colors"
                >
                  💡 {showHint ? 'Hide' : 'Show'} Hint
                </motion.button>
              )}

              {/* Hint Display */}
              <AnimatePresence>
                {showHint && currentWord.hint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6"
                  >
                    <p className="text-yellow-800 font-medium">
                      💡 Hint: {currentWord.hint}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Feedback */}
            {isCorrect !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6"
              >
                <div className="text-6xl mb-4">
                  {isCorrect ? '🎉' : '😅'}
                </div>
                <div className={`text-2xl font-fredoka font-bold mb-2 ${
                  isCorrect ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isCorrect ? 'Perfect Spelling!' : 'Not quite right!'}
                </div>
                {!isCorrect && (
                  <div className="text-lg text-gray-600">
                    The correct spelling was: <span className="font-bold text-purple-600">{currentWord.word}</span>
                  </div>
                )}
                {isCorrect && streak > 1 && (
                  <div className="text-lg text-orange-600 font-bold">
                    🔥 {streak} words in a row! 🔥
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Letter Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-white rounded-3xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 mb-4">
            {letterButtons}
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDelete}
              disabled={userSpelling.length === 0 || isCorrect !== null}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⌫ Delete
            </motion.button>
          </div>
        </motion.div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="bg-gray-200 rounded-full h-4 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(wordNumber - 1) * 10}%` }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-4 rounded-full shadow-lg"
            ></motion.div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            Progress: {wordNumber - 1}/10 words completed
          </div>
        </div>

        {/* Quit Button */}
        <div className="text-center">
          <button
            onClick={resetGame}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600"
          >
            Quit Game
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SpellingBee;
