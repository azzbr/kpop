import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { MemoryCard as MemoryCardType } from '../store';

const MemoryGame: React.FC = () => {
  const {
    memoryCards,
    memoryFlippedCards,
    memoryMatchedPairs,
    memoryGameStartTime,
    memoryScore,
    memoryDifficulty,
    memoryLeaderboard,
    setGameState,
    setMemoryCards,
    setMemoryFlippedCards,
    setMemoryMatchedPairs,
    setMemoryGameStartTime,
    setMemoryScore,
    setMemoryDifficulty,
    setMemoryLeaderboard
  } = useGameStore();

  const [gameStarted, setGameStarted] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showDifficultySelection, setShowDifficultySelection] = useState(true);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && memoryGameStartTime) {
      interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - memoryGameStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, memoryGameStartTime]);

  // Sample K-pop data for cards
  const kpopData = [
    { id: 1, type: 'idol' as const, name: 'Rumi', imageUrl: '/5of5.jpg' },
    { id: 2, type: 'idol' as const, name: 'Mira', imageUrl: '/1to4.jpg' },
    { id: 3, type: 'idol' as const, name: 'Zoey', imageUrl: '/allwrong.webp' },
    { id: 4, type: 'song' as const, name: 'Golden', imageUrl: '/vite.svg' },
    { id: 5, type: 'song' as const, name: 'Takedown', imageUrl: '/vite.svg' },
    { id: 6, type: 'album' as const, name: 'HUNTR/X Album', imageUrl: '/vite.svg' },
    { id: 7, type: 'idol' as const, name: 'Celine', imageUrl: '/vite.svg' },
    { id: 8, type: 'song' as const, name: 'Soda Pop', imageUrl: '/vite.svg' },
  ];

  const initializeGame = (difficulty: 'easy' | 'hard') => {
    setMemoryDifficulty(difficulty);
    const gridSize = difficulty === 'easy' ? 16 : 36; // 4x4 or 6x6
    const pairsNeeded = gridSize / 2;

    // Select random cards and create pairs
    const selectedCards = kpopData.slice(0, pairsNeeded);
    const cardPairs = [...selectedCards, ...selectedCards];

    // Shuffle the cards
    const shuffledCards = cardPairs.sort(() => Math.random() - 0.5);

    // Create memory cards
    const memoryCardsData: MemoryCardType[] = shuffledCards.map((card, index) => ({
      id: index,
      type: card.type,
      name: card.name,
      imageUrl: card.imageUrl,
      isFlipped: false,
      isMatched: false
    }));

    setMemoryCards(memoryCardsData);
    setMemoryFlippedCards([]);
    setMemoryMatchedPairs([]);
    setMemoryScore(0);
    setMemoryGameStartTime(Date.now());
    setGameStarted(true);
    setShowDifficultySelection(false);
  };

  const handleCardClick = (cardId: number) => {
    if (memoryFlippedCards.length >= 2) return;
    if (memoryFlippedCards.includes(cardId)) return;
    if (memoryCards[cardId]?.isMatched) return;

    const newFlippedCards = [...memoryFlippedCards, cardId];
    setMemoryFlippedCards(newFlippedCards);

    // Update card flip state
    const updatedCards = memoryCards.map(card =>
      card.id === cardId ? { ...card, isFlipped: true } : card
    );
    setMemoryCards(updatedCards);

    // Check for match when 2 cards are flipped
    if (newFlippedCards.length === 2) {
      const [firstCardId, secondCardId] = newFlippedCards;
      const firstCard = memoryCards[firstCardId];
      const secondCard = memoryCards[secondCardId];

      if (firstCard && secondCard && firstCard.name === secondCard.name) {
        // Match found!
        setTimeout(() => {
          const matchedCards = memoryCards.map(card =>
            card.id === firstCardId || card.id === secondCardId
              ? { ...card, isMatched: true }
              : card
          );
          setMemoryCards(matchedCards);
          setMemoryMatchedPairs([...memoryMatchedPairs, firstCardId, secondCardId]);
          setMemoryFlippedCards([]);
          setMemoryScore(memoryScore + 10);

          // Check if game is complete
          if (memoryMatchedPairs.length + 2 === memoryCards.length) {
            endGame();
          }
        }, 500);
      } else {
        // No match - flip cards back
        setTimeout(() => {
          const resetCards = memoryCards.map(card =>
            card.id === firstCardId || card.id === secondCardId
              ? { ...card, isFlipped: false }
              : card
          );
          setMemoryCards(resetCards);
          setMemoryFlippedCards([]);
        }, 1000);
      }
    }
  };

  const endGame = () => {
    const finalTime = Math.floor((Date.now() - (memoryGameStartTime || 0)) / 1000);
    const finalScore = memoryScore + Math.max(0, 300 - finalTime); // Bonus for speed

    // Add to leaderboard
    const newScore = {
      playerName: 'Player', // Could be from userName in store
      score: finalScore,
      time: finalTime,
      difficulty: memoryDifficulty,
      date: new Date().toISOString()
    };

    const updatedLeaderboard = [...memoryLeaderboard, newScore]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Keep top 10

    setMemoryLeaderboard(updatedLeaderboard);
    setGameStarted(false);
  };

  const resetGame = () => {
    setGameStarted(false);
    setShowDifficultySelection(true);
    setTimeElapsed(0);
  };

  if (showDifficultySelection) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-kid-pattern"
      >
        <div className="max-w-2xl mx-auto">
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-4xl md:text-6xl font-fredoka font-bold text-purple-600 mb-8 text-kid-glow"
          >
            🃏 K-pop Memory Game
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-700 mb-12"
          >
            Match K-pop idols, songs, and album covers! Choose your difficulty:
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => initializeGame('easy')}
              className="btn-kid bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-bold">Easy Mode</div>
                <div className="text-sm opacity-90">4x4 Grid</div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => initializeGame('hard')}
              className="btn-kid bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">💪</div>
                <div className="font-bold">Hard Mode</div>
                <div className="text-sm opacity-90">6x6 Grid</div>
              </div>
            </motion.button>
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={() => setGameState('game_mode')}
            className="btn-kid-secondary mt-8"
          >
            ← Back to Game Selection
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const gridCols = memoryDifficulty === 'easy' ? 'grid-cols-4' : 'grid-cols-6';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 bg-kid-pattern"
    >
      <div className="max-w-4xl mx-auto w-full">
        {/* Game Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-xl font-bold text-purple-600">
            Score: {memoryScore}
          </div>
          <div className="text-xl font-bold text-blue-600">
            Time: {timeElapsed}s
          </div>
          <div className="text-xl font-bold text-green-600">
            Matches: {memoryMatchedPairs.length / 2}/{memoryCards.length / 2}
          </div>
        </div>

        {/* Game Grid */}
        <div className={`grid ${gridCols} gap-4 max-w-2xl mx-auto mb-6`}>
          <AnimatePresence>
            {memoryCards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ scale: 0, rotateY: 180 }}
                animate={{
                  scale: 1,
                  rotateY: card.isFlipped || card.isMatched ? 0 : 180
                }}
                transition={{ duration: 0.3 }}
                className="aspect-square cursor-pointer"
                onClick={() => handleCardClick(card.id)}
              >
                <div className="w-full h-full relative preserve-3d">
                  {/* Card Back */}
                  <div className="absolute inset-0 w-full h-full backface-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl shadow-lg flex items-center justify-center">
                      <span className="text-3xl">🎵</span>
                    </div>
                  </div>

                  {/* Card Front */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                    <div className={`w-full h-full rounded-2xl shadow-lg p-2 flex flex-col items-center justify-center ${
                      card.isMatched ? 'bg-green-200 border-4 border-green-400' : 'bg-white border-2 border-purple-300'
                    }`}>
                      <div className="text-2xl mb-1">
                        {card.type === 'idol' ? '👤' : card.type === 'song' ? '🎵' : '💿'}
                      </div>
                      <div className="text-xs font-bold text-center text-gray-800">
                        {card.name}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Game Controls */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={resetGame}
            className="btn-kid-secondary"
          >
            🔄 New Game
          </button>
          <button
            onClick={() => setGameState('game_mode')}
            className="btn-kid-secondary"
          >
            ← Back to Games
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default MemoryGame;
