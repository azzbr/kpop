import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const FriendsTrivia: React.FC = () => {
  const {
    setGameState,
    friendsList,
    friendsQuestions,
    currentFriendsQuestionIndex,
    friendsScore,
    friendsGameActive,
    addFriend,
    removeFriend,
    generateFriendsQuestions,
    startFriendsTrivia,
    answerFriendsQuestion,
    nextFriendsQuestion,
    resetFriendsTrivia
  } = useGameStore();

  const [newFriendName, setNewFriendName] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  const handleAddFriend = () => {
    if (newFriendName.trim()) {
      playClick();
      addFriend(newFriendName.trim());
      setNewFriendName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddFriend();
    }
  };

  const handleGenerateQuestions = () => {
    if (friendsList.length > 0) {
      generateFriendsQuestions();
    }
  };

  const handleStartGame = () => {
    if (friendsQuestions.length === 0) {
      handleGenerateQuestions();
    }
    setTimeout(() => {
      startFriendsTrivia();
    }, 500);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    setSelectedAnswer(answerIndex);
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) playCorrect(); else playWrong();
    answerFriendsQuestion(answerIndex);
    setTimeout(() => {
      setSelectedAnswer(null);
      setShowFeedback(null);
      nextFriendsQuestion();
    }, 1400);
  };

  const handleBackToMenu = () => {
    setGameState('game_mode');
  };

  const currentQuestion = friendsQuestions[currentFriendsQuestionIndex];

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
            👫 Friends Trivia! 🤝
          </h1>
          <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
            Test Your Knowledge About Friends
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

        {/* Game State: Setup */}
        {!friendsGameActive && (
          <div className="space-y-6">
            {/* Add Friends Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="bg-white rounded-3xl shadow-lg p-6"
            >
              <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-4">
                Add Your Friends
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter friend's name..."
                  className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-2xl focus:border-purple-500 focus:outline-none text-lg"
                />
                <button
                  onClick={handleAddFriend}
                  disabled={!newFriendName.trim()}
                  className="btn-kid-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ➕ Add
                </button>
              </div>

              {/* Friends List */}
              {friendsList.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    Your Friends ({friendsList.length}):
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {friendsList.map((friend, index) => (
                      <motion.div
                        key={index}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="bg-purple-100 px-3 py-1 rounded-full flex items-center gap-2"
                      >
                        <span className="text-purple-700">{friend}</span>
                        <button
                          onClick={() => removeFriend(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Game Button */}
              {friendsList.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <button
                    onClick={handleStartGame}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-2xl font-fredoka font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-600 w-full mb-4"
                  >
                    🎮 Start Friends Trivia!
                  </button>

                  <button
                    onClick={resetFriendsTrivia}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600 w-full"
                  >
                    🗑️ Clear All
                  </button>
                </motion.div>
              )}

              {/* Instructions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                className="mt-6 p-4 bg-purple-50 rounded-2xl"
              >
                <h3 className="text-lg font-semibold text-purple-700 mb-2">
                  How to Play:
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Add your friends' names above</li>
                  <li>• Questions will be automatically created</li>
                  <li>• Answer questions about your friends</li>
                  <li>• Get points for correct answers!</li>
                </ul>
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* Game State: Playing */}
        {friendsGameActive && currentQuestion && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            {/* Score Display */}
            <div className="text-center mb-6">
              <div className="text-2xl font-fredoka font-bold text-purple-600">
                Score: {friendsScore}
              </div>
              <div className="text-lg text-gray-600">
                Question {currentFriendsQuestionIndex + 1} of {friendsQuestions.length}
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-gradient-to-r from-purple-400 to-pink-500 rounded-2xl p-6 text-white mb-6">
              <div className="text-center">
                <div className="text-sm font-semibold mb-2 opacity-80">
                  About {currentQuestion.aboutFriend} • {currentQuestion.category}
                </div>
                <h2 className="text-2xl md:text-3xl font-fredoka font-bold mb-6">
                  {currentQuestion.question}
                </h2>
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.answers.map((answer, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrectIdx = index === currentQuestion.correctAnswer;
                const revealing = selectedAnswer !== null;
                let buttonClass = 'bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600';
                if (revealing && isCorrectIdx) {
                  buttonClass = 'bg-gradient-to-r from-green-400 to-emerald-500 ring-4 ring-green-300';
                } else if (revealing && isSelected && !isCorrectIdx) {
                  buttonClass = 'bg-gradient-to-r from-red-400 to-pink-500 ring-4 ring-red-300';
                } else if (revealing) {
                  buttonClass = 'bg-gradient-to-r from-gray-300 to-gray-400 opacity-60';
                }
                return (
                  <motion.button
                    key={index}
                    initial={{ scale: 1 }}
                    whileHover={selectedAnswer === null ? { scale: 1.05 } : {}}
                    whileTap={selectedAnswer === null ? { scale: 0.95 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={selectedAnswer !== null}
                    className={`${buttonClass} text-white p-4 rounded-2xl font-fredoka font-bold text-lg shadow-lg transition-all duration-300`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                        {revealing && isCorrectIdx ? '✓' : revealing && isSelected ? '✗' : String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 text-left">{answer}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback Banner */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  key={showFeedback}
                  initial={{ opacity: 0, scale: 0.6, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`mt-4 text-center text-3xl font-fredoka font-bold ${
                    showFeedback === 'correct' ? 'text-green-600' : 'text-pink-500'
                  }`}
                >
                  {showFeedback === 'correct' ? '🎉 Great guess! +10' : '😊 Good try!'}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${((currentFriendsQuestionIndex + 1) / friendsQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Game Completed */}
        {friendsGameActive && !currentQuestion && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onAnimationStart={() => playWin()}
            className="bg-white rounded-3xl shadow-lg p-6 text-center"
          >
            <ConfettiBurst />
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-4">
              Trivia Complete!
            </h2>
            <div className="text-2xl font-bold text-pink-500 mb-6">
              Final Score: {friendsScore} points
            </div>
            <div className="text-lg text-gray-600 mb-6">
              You answered {friendsQuestions.length} questions about your friends!
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setGameState('game_mode')}
                className="btn-kid-primary flex-1"
              >
                🏠 Back to Games
              </button>
              <button
                onClick={() => {
                  setGameState('friends_trivia');
                  startFriendsTrivia();
                }}
                className="btn-kid-secondary"
              >
                🔄 Play Again
              </button>
            </div>
          </motion.div>
        )}

        {/* Footer Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-lg text-gray-600 font-nunito">
            👫 Learn more about your friends through fun trivia! 👫
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default FriendsTrivia;
