import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface MathProblem {
  id: string;
  question: string;
  answer: number;
  options: number[];
  type: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'word_problem';
  difficulty: 'easy' | 'medium' | 'hard';
}

const MathChallenge: React.FC = () => {
  const { setGameState } = useGameStore();

  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [streak, setStreak] = useState(0);

  const handleTimeUp = () => {
    if (currentProblem && isCorrect === null) {
      setIsCorrect(false);
      setStreak(0);
      setTimeout(() => {
        nextQuestion();
      }, 2000);
    }
  };

  // Timer effect
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && !isCorrect) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
  }, [timeLeft, gameStarted, isCorrect, handleTimeUp]);

  const generateMathProblem = (diff: 'easy' | 'medium' | 'hard'): MathProblem => {
    const types: Array<'addition' | 'subtraction' | 'multiplication' | 'division' | 'word_problem'> =
      ['addition', 'subtraction', 'multiplication', 'division', 'word_problem'];

    const type = types[Math.floor(Math.random() * types.length)];
    let num1: number, num2: number, answer: number, question: string;

    switch (diff) {
      case 'easy': {
        switch (type) {
          case 'addition':
            num1 = Math.floor(Math.random() * 20) + 1;
            num2 = Math.floor(Math.random() * 20) + 1;
            answer = num1 + num2;
            question = `${num1} + ${num2} = ?`;
            break;
          case 'subtraction':
            num1 = Math.floor(Math.random() * 20) + 10;
            num2 = Math.floor(Math.random() * num1) + 1;
            answer = num1 - num2;
            question = `${num1} - ${num2} = ?`;
            break;
          case 'multiplication':
            num1 = Math.floor(Math.random() * 10) + 1;
            num2 = Math.floor(Math.random() * 10) + 1;
            answer = num1 * num2;
            question = `${num1} × ${num2} = ?`;
            break;
          case 'division':
            num2 = Math.floor(Math.random() * 10) + 1;
            answer = Math.floor(Math.random() * 10) + 1;
            num1 = num2 * answer;
            question = `${num1} ÷ ${num2} = ?`;
            break;
          case 'word_problem': {
            const count = Math.floor(Math.random() * 10) + 5;
            answer = count;
            question = `Sarah has ${count} apples. How many apples does she have?`;
            break;
          }
          default:
            answer = 0;
            question = '';
        }
        break;
      }

      case 'medium': {
        switch (type) {
          case 'addition':
            num1 = Math.floor(Math.random() * 50) + 10;
            num2 = Math.floor(Math.random() * 50) + 10;
            answer = num1 + num2;
            question = `${num1} + ${num2} = ?`;
            break;
          case 'subtraction':
            num1 = Math.floor(Math.random() * 50) + 20;
            num2 = Math.floor(Math.random() * num1) + 1;
            answer = num1 - num2;
            question = `${num1} - ${num2} = ?`;
            break;
          case 'multiplication':
            num1 = Math.floor(Math.random() * 12) + 1;
            num2 = Math.floor(Math.random() * 12) + 1;
            answer = num1 * num2;
            question = `${num1} × ${num2} = ?`;
            break;
          case 'division':
            num2 = Math.floor(Math.random() * 12) + 1;
            answer = Math.floor(Math.random() * 12) + 1;
            num1 = num2 * answer;
            question = `${num1} ÷ ${num2} = ?`;
            break;
          case 'word_problem': {
            const pencils = Math.floor(Math.random() * 20) + 10;
            const given = Math.floor(Math.random() * pencils) + 1;
            answer = pencils - given;
            question = `Tom has ${pencils} pencils. He gives ${given} to his friend. How many does he have left?`;
            break;
          }
          default:
            answer = 0;
            question = '';
        }
        break;
      }

      case 'hard': {
        switch (type) {
          case 'addition':
            num1 = Math.floor(Math.random() * 100) + 50;
            num2 = Math.floor(Math.random() * 100) + 50;
            answer = num1 + num2;
            question = `${num1} + ${num2} = ?`;
            break;
          case 'subtraction':
            num1 = Math.floor(Math.random() * 100) + 50;
            num2 = Math.floor(Math.random() * num1) + 1;
            answer = num1 - num2;
            question = `${num1} - ${num2} = ?`;
            break;
          case 'multiplication':
            num1 = Math.floor(Math.random() * 15) + 5;
            num2 = Math.floor(Math.random() * 15) + 5;
            answer = num1 * num2;
            question = `${num1} × ${num2} = ?`;
            break;
          case 'division':
            num2 = Math.floor(Math.random() * 15) + 5;
            answer = Math.floor(Math.random() * 15) + 5;
            num1 = num2 * answer;
            question = `${num1} ÷ ${num2} = ?`;
            break;
          case 'word_problem': {
            const total = Math.floor(Math.random() * 50) + 20;
            const groups = Math.floor(Math.random() * 5) + 2;
            const each = Math.floor(total / groups);
            answer = each;
            question = `There are ${total} candies to share equally among ${groups} friends. How many candies does each friend get?`;
            break;
          }
          default:
            answer = 0;
            question = '';
        }
        break;
      }

      default:
        answer = 0;
        question = '';
    }

    // Generate wrong answer options
    const options = [answer];
    while (options.length < 4) {
      let wrongAnswer: number;
      if (diff === 'easy') {
        wrongAnswer = answer + Math.floor(Math.random() * 10) - 5;
      } else if (diff === 'medium') {
        wrongAnswer = answer + Math.floor(Math.random() * 20) - 10;
      } else {
        wrongAnswer = answer + Math.floor(Math.random() * 30) - 15;
      }

      if (wrongAnswer !== answer && wrongAnswer > 0 && !options.includes(wrongAnswer)) {
        options.push(wrongAnswer);
      }
    }

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      id: Date.now().toString(),
      question,
      answer,
      options,
      type,
      difficulty: diff
    };
  };

  const startGame = (diff: 'easy' | 'medium' | 'hard') => {
    setDifficulty(diff);
    setGameStarted(true);
    setScore(0);
    setQuestionNumber(1);
    setStreak(0);
    setTimeLeft(30);
    setCurrentProblem(generateMathProblem(diff));
    setSelectedAnswer(null);
    setIsCorrect(null);
  };

  const handleAnswerSelect = (answer: number) => {
    if (isCorrect !== null) return;

    setSelectedAnswer(answer);
    const correct = answer === currentProblem!.answer;

    setIsCorrect(correct);

    if (correct) {
      const timeBonus = Math.max(0, timeLeft * 2);
      const streakBonus = streak * 5;
      const points = 10 + timeBonus + streakBonus;

      setScore(prev => prev + points);
      setStreak(prev => prev + 1);

      setTimeout(() => {
        nextQuestion();
      }, 2000);
    } else {
      setStreak(0);
      setTimeout(() => {
        nextQuestion();
      }, 2000);
    }
  };


  const nextQuestion = () => {
    if (questionNumber >= 10) {
      // Game over
      setGameStarted(false);
    } else {
      setQuestionNumber(prev => prev + 1);
      setCurrentProblem(generateMathProblem(difficulty));
      setSelectedAnswer(null);
      setIsCorrect(null);
      setTimeLeft(30);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setCurrentProblem(null);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setQuestionNumber(1);
    setTimeLeft(30);
    setStreak(0);
  };

  const handleBackToMenu = () => {
    setGameState('game_mode');
  };

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
              🧮 Math Challenge! ➗
            </h1>
            <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
              Master Math Skills with Fun!
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
          {questionNumber > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-lg p-6 mb-6 text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-4">
                Math Challenge Complete!
              </h2>
              <div className="text-2xl font-bold text-pink-500 mb-2">
                Final Score: {score} points
              </div>
              <div className="text-lg text-gray-600 mb-6">
                You completed {questionNumber - 1} math problems!
              </div>
              <div className="text-sm text-gray-500 mb-6">
                Longest Streak: {streak} correct answers in a row!
              </div>
            </motion.div>
          )}

          {/* Difficulty Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-6 text-center">
              Choose Your Difficulty Level
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame('easy')}
                className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟢</div>
                  <div className="text-xl mb-1">Easy</div>
                  <div className="text-sm opacity-80">Basic Addition & Subtraction</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame('medium')}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟡</div>
                  <div className="text-xl mb-1">Medium</div>
                  <div className="text-sm opacity-80">Multiplication & Word Problems</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame('hard')}
                className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🔴</div>
                  <div className="text-xl mb-1">Hard</div>
                  <div className="text-sm opacity-80">Advanced Operations</div>
                </div>
              </motion.button>
            </div>

            <div className="text-center text-gray-600">
              <p className="mb-2">🎯 <strong>How to Play:</strong></p>
              <ul className="text-sm space-y-1">
                <li>• Answer 10 math problems as fast as you can</li>
                <li>• Earn points for speed and accuracy</li>
                <li>• Build streaks for bonus points</li>
                <li>• Choose the right difficulty for your level</li>
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
            🧮 Math Challenge! ➗
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
            <div className="text-2xl font-fredoka font-bold text-blue-600">{questionNumber}/10</div>
            <div className="text-sm text-gray-600">Question</div>
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

        {/* Question Card */}
        {currentProblem && (
          <motion.div
            key={currentProblem.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-lg p-8 mb-6"
          >
            <div className="text-center mb-8">
              <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                {currentProblem.type.replace('_', ' ')} • {currentProblem.difficulty}
              </div>
              <h2 className="text-3xl md:text-4xl font-fredoka font-bold text-purple-600 mb-6">
                {currentProblem.question}
              </h2>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {currentProblem.options.map((option, index) => (
                <motion.button
                  key={index}
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isCorrect !== null}
                  className={`p-6 rounded-2xl font-fredoka font-bold text-xl shadow-lg transition-all duration-300 ${
                    selectedAnswer === option
                      ? isCorrect
                        ? 'bg-green-500 text-white shadow-green-300'
                        : 'bg-red-500 text-white shadow-red-300'
                      : isCorrect === false && option === currentProblem.answer
                      ? 'bg-green-500 text-white shadow-green-300'
                      : 'bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 text-white'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div>{option}</div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Feedback */}
            {isCorrect !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="text-6xl mb-4">
                  {isCorrect ? '🎉' : '😅'}
                </div>
                <div className={`text-2xl font-fredoka font-bold mb-2 ${
                  isCorrect ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isCorrect ? 'Correct!' : 'Not quite!'}
                </div>
                {!isCorrect && (
                  <div className="text-lg text-gray-600">
                    The answer was: <span className="font-bold text-purple-600">{currentProblem.answer}</span>
                  </div>
                )}
                {isCorrect && streak > 1 && (
                  <div className="text-lg text-orange-600 font-bold">
                    🔥 {streak} in a row! 🔥
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="bg-gray-200 rounded-full h-4 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(questionNumber - 1) * 10}%` }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-4 rounded-full shadow-lg"
            ></motion.div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            Progress: {questionNumber - 1}/10 questions completed
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

export default MathChallenge;
