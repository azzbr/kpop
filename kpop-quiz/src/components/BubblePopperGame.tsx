import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  type: 'regular' | 'rainbow' | 'mystery';
  isPopped: boolean;
  floatSpeed: number;
  emoji: string; // Store assigned emoji to prevent random re-rendering
}

interface PopParticle {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

const BubblePopperGame: React.FC = () => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'paused' | 'ended'>('ready');
  const [popParticles, setPopParticles] = useState<PopParticle[]>([]);

  // Timer ref to prevent multiple timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Bubble emojis for different types - using universally supported emojis
  const bubbleEmojis = {
    regular: ['💭', '💬', '💭', '💙', '💚', '💜', '🎈', '✨'],
    rainbow: ['🌈', '⭐', '✨', '⚡', '🔥'],
    mystery: ['🎁', '❓', '🎲', '🎪']
  };

  const particleEmojis = ['✨', '⭐', '💫', '🎆', '🌟', '🎇'];

  // Generate bubbles for current level
  const generateBubbles = useCallback((count: number) => {
    const newBubbles: Bubble[] = [];
    for (let i = 0; i < count; i++) {
      const types: Bubble['type'][] = ['regular', 'regular', 'regular'];
      if (level > 2) types.push('rainbow');
      if (level > 5) types.push('mystery');

      const type = types[Math.floor(Math.random() * types.length)];
      const emojiArray = bubbleEmojis[type];
      const emoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

      newBubbles.push({
        id: Date.now() + i,
        x: Math.random() * 280, // Keep within container
        y: Math.random() * 300,
        size: Math.random() * 20 + 30, // 30-50px
        type,
        isPopped: false,
        floatSpeed: Math.random() * 2 + 1, // 1-3 seconds
        emoji, // Assign emoji at creation time
      });
    }
    setBubbles(newBubbles);
  }, [level]);

  // Start game
  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setTimeLeft(30);
    setGameState('ready');
    generateBubbles(5);
    setTimeout(() => {
      setIsPlaying(true);
      setGameState('playing');
    }, 1000);
  }, [generateBubbles]);

  // Handle bubble popping - use functional update to avoid stale closures
  const handleBubblePop = useCallback((bubbleId: number) => {
    if (gameState !== 'playing') return;

    let poppedBubble: Bubble | undefined;

    setBubbles(prevBubbles => {
      const newBubbles = prevBubbles.map(bubble => {
        if (bubble.id === bubbleId) {
          poppedBubble = { ...bubble, isPopped: true };
          return poppedBubble;
        }
        return bubble;
      });
      return newBubbles;
    });

    // Calculate score using the popped bubble data
    if (poppedBubble) {
      let points = 10;
      if (poppedBubble.type === 'rainbow') points = 50;
      if (poppedBubble.type === 'mystery') {
        points = Math.random() > 0.5 ? 100 : 25;
      }
      setScore(prev => prev + points);
    }

    // Create pop particles
    if (poppedBubble) {
      const particles: PopParticle[] = [];
      for (let i = 0; i < 8; i++) {
        particles.push({
          id: Date.now() + i,
          x: poppedBubble.x + poppedBubble.size / 2,
          y: poppedBubble.y + poppedBubble.size / 2,
          emoji: particleEmojis[Math.floor(Math.random() * particleEmojis.length)],
        });
      }
      setPopParticles(prev => [...prev, ...particles]);

      // Remove particles after animation
      setTimeout(() => {
        setPopParticles(prev => prev.filter(p => !particles.find(particle => particle.id === p.id)));
      }, 800);
    }
  }, [gameState]);

  // Level completion detection - moved to useEffect to avoid stale closures
  useEffect(() => {
    if (bubbles.length > 0 && bubbles.every(b => b.isPopped)) {
      // All bubbles popped - level complete
      setLevel(prev => prev + 1);
      setTimeLeft(prev => prev + 10); // More bonus time
      setTimeout(() => generateBubbles(Math.min(5 + level + 1, 15)), 1000);
    }
  }, [bubbles, level, generateBubbles]);

  // Game timer - properly managed with useRef to prevent multiple timers
  useEffect(() => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only start a timer if game is playing and time remains
    if (gameState === 'playing' && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prevTime => {
          const newTime = prevTime - 1;
          if (newTime <= 0) {
            // Time's up - handle lives
            setLives(prevLives => {
              const newLives = prevLives - 1;
              if (newLives > 0) {
                // Clear old bubbles immediately to prevent race condition
                setBubbles([]); // ← Fix: Prevent clicking old bubbles
                // Continue with next life
                setTimeout(() => {
                  setTimeLeft(20); // Reset with less time
                  generateBubbles(Math.max(3, bubbles.length - 2)); // Fewer bubbles
                }, 100);
              } else {
                // Game over
                setGameState('ended');
                setIsPlaying(false);
              }
              return newLives;
            });
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState, timeLeft, generateBubbles, bubbles.length]);

  return (
    <div className="space-y-4">
      {/* Game Title */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-4xl mb-2"
        >
          🫧
        </motion.div>
        <h3 className="text-2xl font-fredoka font-bold text-blue-600 mb-2">
          Bubble Popper Paradise
        </h3>
        <p className="text-sm font-nunito text-gray-600">
          Pop the bubbles before time runs out! 🌈
        </p>
      </div>

      {/* Game Area */}
      <section className="game-area bg-gradient-to-b from-sky-200 to-blue-300 rounded-2xl relative overflow-hidden" style={{ height: '400px' }}>
        {/* Bubbles */}
        {bubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            className={`absolute text-4xl cursor-pointer select-none ${bubble.isPopped ? 'pointer-events-none' : ''}`}
            style={{
              left: bubble.x,
              top: bubble.y,
              fontSize: bubble.size,
            }}
            animate={{
              y: [bubble.y, bubble.y - 15, bubble.y],
              x: bubble.x + Math.sin(Date.now() * 0.001 + bubble.id) * 5,
              scale: bubble.isPopped ? 0 : 1,
            }}
            transition={{
              y: { duration: bubble.floatSpeed, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
              x: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: bubble.isPopped ? 0.3 : 0, ease: "backOut" }
            }}
            whileHover={{ scale: bubble.isPopped ? 0 : 1.2 }}
            whileTap={{ scale: bubble.isPopped ? 0 : 0.8 }}
            onClick={() => handleBubblePop(bubble.id)}
          >
            {!bubble.isPopped && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                {bubble.emoji}
              </motion.div>
            )}
          </motion.div>
        ))}

        {/* Pop Effect Particles */}
        <AnimatePresence>
          {popParticles.map((particle) => (
            <motion.div
              key={`particle-${particle.id}`}
              className="absolute text-2xl pointer-events-none"
              initial={{
                x: particle.x,
                y: particle.y,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: particle.x + (Math.random() - 0.5) * 100,
                y: particle.y - Math.random() * 100,
                scale: 1.5,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {particle.emoji}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Game State Overlays */}
        {gameState === 'ready' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="bg-white p-6 rounded-2xl text-center"
            >
              <div className="text-3xl mb-2">🫧</div>
              <p className="font-fredoka font-bold text-lg">Ready to Pop?</p>
              <p className="text-sm text-gray-600 mt-1">Get ready to start!</p>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'ended' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center"
          >
            <div className="bg-white p-6 rounded-2xl text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-fredoka font-bold text-lg">Game Over!</p>
              <p className="text-purple-600 font-semibold">Score: {score}</p>
              <p className="text-sm text-gray-600 mt-1">Great bubbles popping! 🫧</p>
            </div>
          </motion.div>
        )}
      </section>

      {/* Game UI */}
      <div className="bg-white rounded-xl p-4 mt-4 border-2 border-blue-200">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{score}</div>
            <div className="text-sm text-gray-600">Points</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{level}</div>
            <div className="text-sm text-gray-600">Level</div>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold text-green-600">{Math.max(0, timeLeft)}</div>
            <div className="text-sm text-gray-600">Time</div>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold text-red-600">{lives}</div>
            <div className="text-sm text-gray-600">Lives</div>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            disabled={isPlaying}
            className={`px-6 py-2 rounded-lg font-fredoka font-semibold ${
              isPlaying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {gameState === 'ready' ? '▶️ Start Game' : '🔄 Play Again'}
          </motion.button>

          {isPlaying && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsPlaying(!isPlaying);
                setGameState(isPlaying ? 'paused' : 'playing');
              }}
              className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-fredoka font-semibold hover:bg-yellow-600"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Resume'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center mt-4">
        <p className="text-sm font-nunito text-gray-600">
          🎯 Pop the bubbles! Rainbow bubbles are worth extra points!
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Regular: 10pts • Rainbow: 50pts • Mystery: Surprise! 🎁
        </p>
      </div>
    </div>
  );
};

export default BubblePopperGame;
