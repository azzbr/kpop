import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playHit, playPerfect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const RhythmGame: React.FC = () => {
  const {
    rhythmScore,
    rhythmCombo,
    rhythmAccuracy,
    rhythmCurrentSong,
    rhythmUnlockedSongs,
    rhythmGameActive,
    setGameState,
    setRhythmScore,
    setRhythmCombo,
    setRhythmAccuracy,
    setRhythmCurrentSong,
    setRhythmGameActive,
    playlist,
    setIsPlaying
  } = useGameStore();

  const [notes, setNotes] = useState<Array<{ id: number; position: number; timestamp: number; hit: boolean }>>([]);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSongSelection, setShowSongSelection] = useState(true);
  const [perfectHits, setPerfectHits] = useState(0);
  const [goodHits, setGoodHits] = useState(0);
  const [missedHits, setMissedHits] = useState(0);
  const [hitFx, setHitFx] = useState<{ id: number; label: string; color: string; x: number } | null>(null);
  const [gameEnded, setGameEnded] = useState(false);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const noteIdRef = useRef(0);
  const fxIdRef = useRef(0);
  const statsRef = useRef({ perfect: 0, good: 0, missed: 0 });

  // Generate rhythm notes for the selected song
  const generateNotes = () => {
    const songNotes = [];
    const noteCount = 20; // Number of notes per song

    for (let i = 0; i < noteCount; i++) {
      songNotes.push({
        id: noteIdRef.current++,
        position: Math.random() * 80 + 10, // Random position between 10% and 90%
        timestamp: i * 2000 + Math.random() * 1000, // Notes every 2 seconds with some variation
        hit: false
      });
    }

    return songNotes;
  };

  const startGame = (songIndex: number) => {
    setRhythmCurrentSong(playlist[songIndex]);
    setRhythmGameActive(true);
    setGameStartTime(Date.now());
    setCurrentTime(0);
    setRhythmScore(0);
    setRhythmCombo(0);
    setRhythmAccuracy(100);
    setPerfectHits(0);
    setGoodHits(0);
    setMissedHits(0);
    statsRef.current = { perfect: 0, good: 0, missed: 0 };
    setGameEnded(false);

    const gameNotes = generateNotes();
    setNotes(gameNotes);
    setShowSongSelection(false);

    // Start playing the selected song
    setIsPlaying(true);
  };

  // Game loop
  useEffect(() => {
    if (!rhythmGameActive || !gameStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameStartTime;
      setCurrentTime(elapsed);

      // Check for missed notes
      setNotes(prevNotes => {
        let missedThisTick = 0;
        const next = prevNotes.map(note => {
          if (!note.hit && elapsed > note.timestamp + 500) {
            missedThisTick++;
            return { ...note, hit: true };
          }
          return note;
        });
        if (missedThisTick > 0) {
          statsRef.current.missed += missedThisTick;
          setMissedHits(statsRef.current.missed);
          setRhythmCombo(0);
        }
        return next;
      });

      // End game after 45 seconds
      if (elapsed > 45000) {
        endGame();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [rhythmGameActive, gameStartTime]);

  const handleTap = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rhythmGameActive) return;

    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const tapX = ((event.clientX - rect.left) / rect.width) * 100;

    // Find the closest note to the tap
    let foundNote: { id: number; position: number; timestamp: number; hit: boolean } | null = null;
    let minDistance = Infinity;

    notes.forEach(note => {
      if (!note.hit) {
        const distance = Math.abs(note.position - tapX);
        if (distance < minDistance && distance < 15) { // 15% tolerance
          minDistance = distance;
          foundNote = note;
        }
      }
    });

    if (foundNote !== null && foundNote !== undefined) {
      const note = foundNote as { id: number; position: number; timestamp: number; hit: boolean };
      const timeDiff = Math.abs(currentTime - note.timestamp);

      const showFx = (label: string, color: string) => {
        setHitFx({ id: ++fxIdRef.current, label, color, x: note.position });
        setTimeout(() => setHitFx((fx) => (fx && fx.id === fxIdRef.current ? null : fx)), 600);
      };

      if (timeDiff < 150) {
        statsRef.current.perfect++;
        setPerfectHits(statsRef.current.perfect);
        setRhythmScore(useGameStore.getState().rhythmScore + 100);
        setRhythmCombo(useGameStore.getState().rhythmCombo + 1);
        playPerfect();
        showFx('PERFECT!', 'text-yellow-400');
      } else if (timeDiff < 300) {
        statsRef.current.good++;
        setGoodHits(statsRef.current.good);
        setRhythmScore(useGameStore.getState().rhythmScore + 50);
        setRhythmCombo(useGameStore.getState().rhythmCombo + 1);
        playHit();
        showFx('GOOD!', 'text-green-500');
      } else {
        setRhythmCombo(0);
        playWrong();
        showFx('OFF!', 'text-red-500');
      }

      setNotes(prevNotes =>
        prevNotes.map(n => (n.id === note.id ? { ...n, hit: true } : n))
      );
    }
  };

  const endGame = () => {
    setRhythmGameActive(false);
    setIsPlaying(false);
    const { perfect, good, missed } = statsRef.current;
    const totalHits = perfect + good + missed;
    if (totalHits > 0) {
      const accuracy = ((perfect + good) / totalHits) * 100;
      setRhythmAccuracy(accuracy);
    }
    setGameEnded(true);
    playWin();
  };

  const resetGame = () => {
    setRhythmGameActive(false);
    setIsPlaying(false);
    setShowSongSelection(true);
    setNotes([]);
    setGameStartTime(null);
    setCurrentTime(0);
    setGameEnded(false);
    setHitFx(null);
  };

  if (gameEnded) {
    const total = perfectHits + goodHits + missedHits;
    const hitRate = total > 0 ? Math.round(((perfectHits + goodHits) / total) * 100) : 0;
    const rating = hitRate >= 90 ? '🏆 K-POP SUPERSTAR!' : hitRate >= 70 ? '⭐ Awesome!' : hitRate >= 40 ? '👍 Nice rhythm!' : '🎵 Keep practicing!';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-screen px-4 bg-kid-pattern"
      >
        <ConfettiBurst />
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-2">🎉</div>
          <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-2">Song Complete!</h2>
          <div className="text-xl font-fredoka text-pink-500 mb-4">{rating}</div>
          <div className="space-y-2 mb-6 text-lg">
            <div className="text-purple-600 font-bold">Score: {rhythmScore}</div>
            <div className="text-green-600">✨ Perfect: {perfectHits}</div>
            <div className="text-blue-600">👍 Good: {goodHits}</div>
            <div className="text-gray-500">😅 Missed: {missedHits}</div>
            <div className="text-purple-500 font-bold">Accuracy: {hitRate}%</div>
          </div>
          <div className="flex gap-3">
            <button onClick={resetGame} className="btn-kid-primary flex-1">🔄 New Song</button>
            <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary flex-1">🏠 Home</button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (showSongSelection) {
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
            🎵 Rhythm Game
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-700 mb-12"
          >
            Tap to the beat! Choose a song to play:
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            {rhythmUnlockedSongs.map((songName) => {
              const songIndex = playlist.indexOf(songName);
              return (
                <motion.button
                  key={songName}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => startGame(songIndex)}
                  className="btn-kid bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 p-4"
                >
                  <div className="text-center">
                    <div className="text-lg mb-2">🎵</div>
                    <div className="font-bold text-sm">
                      {songName.replace('.flac', '').replace(/^\d+\.\s*/, '')}
                    </div>
                  </div>
                </motion.button>
              );
            })}
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
            Score: {rhythmScore}
          </div>
          <div className="text-xl font-bold text-blue-600">
            Combo: {rhythmCombo}x
          </div>
          <div className="text-xl font-bold text-green-600">
            Accuracy: {rhythmAccuracy.toFixed(1)}%
          </div>
        </div>

        {/* Current Song Display */}
        <div className="text-center mb-6">
          <div className="text-lg font-bold text-gray-800">
            Now Playing: {rhythmCurrentSong?.replace('.flac', '').replace(/^\d+\.\s*/, '')}
          </div>
          <div className="text-sm text-gray-600">
            Perfect: {perfectHits} | Good: {goodHits} | Missed: {missedHits}
          </div>
        </div>

        {/* Game Area */}
        <div
          ref={gameAreaRef}
          onClick={handleTap}
          className="relative w-full h-96 bg-gradient-to-b from-purple-200 to-pink-200 rounded-3xl border-4 border-purple-300 cursor-pointer overflow-hidden"
        >
          {/* Target Zone Indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-16 bg-green-400 bg-opacity-50 rounded-full border-2 border-green-600 flex items-center justify-center">
            <span className="text-white font-bold">TAP HERE</span>
          </div>

          {/* Falling Notes */}
          <AnimatePresence>
            {notes.map(note => {
              if (note.hit) return null;

              const progress = Math.max(0, (currentTime - note.timestamp + 2000) / 2000);
              const yPos = (1 - progress) * 100;

              if (yPos < -10) return null; // Note has passed

              return (
                <motion.div
                  key={note.id}
                  initial={{ y: '-10%', x: `${note.position}%` }}
                  animate={{ y: `${yPos}%` }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.05 }}
                  className="absolute w-8 h-8 bg-yellow-400 rounded-full border-2 border-yellow-600 shadow-lg"
                  style={{
                    left: `${note.position}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              );
            })}
          </AnimatePresence>

          {/* Per-hit feedback */}
          <AnimatePresence>
            {hitFx && (
              <motion.div
                key={hitFx.id}
                initial={{ scale: 0.4, opacity: 1, y: 0 }}
                animate={{ scale: 1.4, opacity: 0, y: -30 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className={`absolute font-fredoka font-extrabold text-3xl md:text-4xl ${hitFx.color} drop-shadow-lg pointer-events-none`}
                style={{ left: `${hitFx.x}%`, bottom: '20%', transform: 'translateX(-50%)' }}
              >
                {hitFx.label}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Combo counter */}
          {rhythmCombo >= 3 && (
            <motion.div
              key={rhythmCombo}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute top-4 right-4 text-2xl font-fredoka font-bold text-pink-500 drop-shadow"
            >
              🔥 {rhythmCombo}x
            </motion.div>
          )}
        </div>

        {/* Game Controls */}
        <div className="flex justify-center space-x-4 mt-6">
          <button
            onClick={resetGame}
            className="btn-kid-secondary"
          >
            🔄 New Song
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

export default RhythmGame;
