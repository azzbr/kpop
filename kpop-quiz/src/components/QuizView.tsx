import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';

const QuizView: React.FC = () => {
  const {
    questions,
    currentQuestionIndex,
    selectedAnswer,
    isAnswerCorrect,
    selectAnswer,
    nextQuestion,
    score,
  } = useGameStore();

  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1.5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Clean up all timers
  const cleanupTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Handle question progression
  const handleNextQuestion = () => {
    if (isProcessingRef.current) {
      console.log('Already processing, skipping...');
      return;
    }
    
    isProcessingRef.current = true;
    console.log(`Moving from question ${currentQuestionIndex + 1} to ${currentQuestionIndex + 2}`);
    
    cleanupTimers();
    setShowFeedback(false);
    
    // Use setTimeout to ensure state updates are processed
    setTimeout(() => {
      nextQuestion();
      isProcessingRef.current = false;
    }, 100);
  };

  // Handle answer selection and feedback timer
  useEffect(() => {
    if (selectedAnswer !== null && !isProcessingRef.current) {
      console.log(`Answer selected: ${selectedAnswer}, starting feedback timer`);
      
      // Clean up any existing timers first
      cleanupTimers();
      
      setShowFeedback(true);
      setTimeLeft(1.5);

      // Start countdown interval
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 0.1;
          if (newTime <= 0) {
            return 0;
          }
          return newTime;
        });
      }, 100);

      // Set main timer to advance question
      timerRef.current = setTimeout(() => {
        handleNextQuestion();
      }, 1500);
    }

    // Cleanup on unmount or when dependencies change
    return cleanupTimers;
  }, [selectedAnswer, currentQuestionIndex]);

  // Reset processing state when question changes
  useEffect(() => {
    isProcessingRef.current = false;
    setShowFeedback(false);
    setTimeLeft(1.5);
  }, [currentQuestionIndex]);

  const handleAnswerClick = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    selectAnswer(answerIndex);
  };

  const getAnswerButtonClass = (answerIndex: number) => {
    const baseClass = "w-full p-4 text-left rounded-2xl border-2 transition-all duration-300 font-medium shadow-lg";

    if (selectedAnswer === null) {
      return `${baseClass} bg-white border-purple-200 text-gray-700 hover:bg-purple-50 hover:border-pink-300 hover:shadow-xl cursor-pointer`;
    }

    if (answerIndex === selectedAnswer) {
      return `${baseClass} ${
        isAnswerCorrect
          ? 'bg-green-100 border-green-400 text-green-800 shadow-green-200'
          : 'bg-red-100 border-red-400 text-red-800 shadow-red-200'
      }`;
    }

    if (currentQuestion.answers[answerIndex].isCorrect) {
      return `${baseClass} bg-green-100 border-green-400 text-green-800 shadow-green-200`;
    }

    return `${baseClass} bg-gray-100 border-gray-300 text-gray-500 opacity-60`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
    >
      <div className="max-w-2xl mx-auto w-full">
        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg text-purple-600 font-fredoka font-bold">
              Question {currentQuestionIndex + 1} of {questions.length} 🎯
            </span>
            <span className="text-lg text-pink-500 font-fredoka font-bold">
              Score: {score}/{questions.length} ⭐
            </span>
          </div>
          <div className="w-full bg-white border-2 border-purple-200 rounded-full h-4 shadow-inner">
            <motion.div
              className="bg-gradient-to-r from-pink-400 to-purple-500 h-4 rounded-full shadow-lg"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Question */}
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="card-kid p-8 mb-8"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mb-6"
          >
            <span className="text-4xl">🤔</span>
          </motion.div>

          <h2 className="text-xl md:text-2xl font-fredoka font-bold text-purple-600 mb-6 leading-relaxed text-center">
            {currentQuestion.questionText}
          </h2>

          {/* Answer Options */}
          <div className="space-y-4">
            {currentQuestion.answers.map((answer, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                onClick={() => handleAnswerClick(index)}
                disabled={selectedAnswer !== null}
                className={getAnswerButtonClass(index)}
                whileHover={selectedAnswer === null ? { scale: 1.02, rotate: [0, -1, 1, 0] } : {}}
                whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center mr-4 text-white font-bold text-lg shadow-lg">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 font-nunito text-gray-700">{answer.answerText}</span>
                  {selectedAnswer !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-4"
                    >
                      {index === selectedAnswer && isAnswerCorrect && (
                        <span className="text-green-500 text-2xl">✅</span>
                      )}
                      {index === selectedAnswer && !isAnswerCorrect && (
                        <span className="text-red-500 text-2xl">❌</span>
                      )}
                      {currentQuestion.answers[index].isCorrect && index !== selectedAnswer && (
                        <span className="text-green-500 text-2xl">✅</span>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Feedback Timer */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="text-center"
            >
              <div className="inline-flex items-center space-x-4 bg-white px-6 py-3 rounded-full border-2 border-purple-200 shadow-lg">
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`text-xl font-fredoka font-bold ${
                    isAnswerCorrect ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {isAnswerCorrect ? 'Awesome! 🎉' : 'Keep trying! 💪'}
                </motion.span>
                <div className="w-20 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${isAnswerCorrect ? 'bg-green-400' : 'bg-red-400'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 1.5, ease: 'linear' }}
                  />
                </div>
                <span className="text-sm text-purple-600 font-nunito font-semibold">
                  Next question in {timeLeft.toFixed(1)}s ⏰
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default QuizView;
