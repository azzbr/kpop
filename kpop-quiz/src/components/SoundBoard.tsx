import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  soundUrl: string;
  key?: string;
}

const SoundBoard: React.FC = () => {
  const { incrementSoundEffectsPlayed } = useGameStore();
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [activeCategory, setActiveCategory] = useState<'funny' | 'animals' | 'instruments' | 'effects'>('funny');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Initialize AudioContext on user interaction - now returns context immediately
  const initAudio = useCallback(() => {
    let ctx = audioContext;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
    }
    return ctx;
  }, [audioContext]);

  // Sound categories and their sound effects
  const soundCategories = {
    funny: [
      { id: 'burp', name: 'Burp', emoji: '💨', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'Q' },
      { id: 'fart', name: 'Fart', emoji: '💨', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'W' },
      { id: 'sneeze', name: 'Sneeze', emoji: '🤧', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'E' },
      { id: 'giggle', name: 'Giggle', emoji: '🤭', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'R' },
      { id: 'pop', name: 'Pop!', emoji: '💥', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'T' },
      { id: 'boing', name: 'Boing!', emoji: '🏀', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'Y' },
    ],
    animals: [
      { id: 'cat', name: 'Cat Meow', emoji: '🐱', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'A' },
      { id: 'dog', name: 'Dog Bark', emoji: '🐶', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'S' },
      { id: 'bird', name: 'Bird Chirp', emoji: '🐦', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'D' },
      { id: 'cow', name: 'Cow Moo', emoji: '🐄', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'F' },
      { id: 'lion', name: 'Lion Roar', emoji: '🦁', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'G' },
      { id: 'elephant', name: 'Elephant', emoji: '🐘', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'H' },
    ],
    instruments: [
      { id: 'drum', name: 'Drum', emoji: '🥁', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'Z' },
      { id: 'piano', name: 'Piano', emoji: '🎹', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'X' },
      { id: 'trumpet', name: 'Trumpet', emoji: '🎺', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'C' },
      { id: 'violin', name: 'Violin', emoji: '🎻', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'V' },
      { id: 'guitar', name: 'Guitar', emoji: '🎸', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'B' },
      { id: 'xylophone', name: 'Xylophone', emoji: '🎵', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: 'N' },
    ],
    effects: [
      { id: 'laser', name: 'Laser', emoji: '⚡', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '1' },
      { id: 'explosion', name: 'Explosion', emoji: '💥', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '2' },
      { id: 'whoosh', name: 'Whoosh', emoji: '💨', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '3' },
      { id: 'alarm', name: 'Alarm', emoji: '🚨', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '4' },
      { id: 'twinkle', name: 'Twinkle', emoji: '✨', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '5' },
      { id: 'coin', name: 'Coin Drop', emoji: '🪙', soundUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', key: '6' },
    ],
  };

  // Play sound function - now manually decodes base64 data URIs
  const playSound = useCallback(async (soundEffect: SoundEffect) => {
    try {
      const localAudioContext = initAudio(); // Get context instance immediately
      if (!localAudioContext) return;

      // Manual base64 decoding for data URIs
      // 1. Get the base64 part of the data URI
      const base64 = soundEffect.soundUrl.split(',')[1];
      // 2. Decode from base64 to a binary string
      const binary = atob(base64);
      // 3. Create a byte array
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      // 4. Get the ArrayBuffer
      const arrayBuffer = bytes.buffer;

      const audioBuffer = await localAudioContext.decodeAudioData(arrayBuffer);

      const source = localAudioContext.createBufferSource();
      const gainNode = localAudioContext.createGain();

      source.buffer = audioBuffer;
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(localAudioContext.destination);

      source.start(0);

      // Visual feedback
      setActiveSound(soundEffect.id);
      setTimeout(() => setActiveSound(null), 300);

      incrementSoundEffectsPlayed();
    } catch (error) {
      console.error('Error playing sound:', soundEffect.name, error);
      // Fall back to visual feedback only
      setActiveSound(soundEffect.id);
      setTimeout(() => setActiveSound(null), 300);
    }
  }, [volume, initAudio, incrementSoundEffectsPlayed]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase();
      const allSounds = Object.values(soundCategories).flat();
      const sound = allSounds.find(s => s.key === key);
      if (sound) {
        event.preventDefault();
        playSound(sound);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [playSound]);

  const currentSounds = soundCategories[activeCategory];
  const categoryNames = {
    funny: 'Funny Sounds',
    animals: 'Animal Noises',
    instruments: 'Instruments',
    effects: 'Sound Effects'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-4xl mb-2"
        >
          🎵
        </motion.div>
        <h3 className="text-2xl font-fredoka font-bold text-blue-600 mb-2">
          Sound Effects Board
        </h3>
        <p className="text-sm font-nunito text-gray-600">
          Click the buttons or use your keyboard! 🎹
        </p>
      </div>

      {/* Volume Control */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-4 rounded-xl border-2 border-blue-200 mx-auto max-w-xs"
      >
        <div className="text-center mb-2">
          <span className="text-sm font-nunito text-blue-600">🔊 Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">🔇</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-sm">🔊</span>
        </div>
      </motion.div>

      {/* Category Tabs */}
      <div className="flex justify-center gap-2 flex-wrap">
        {Object.entries(categoryNames).map(([category, name], index) => (
          <motion.button
            key={category}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(category as typeof activeCategory)}
            className={`px-4 py-2 rounded-lg font-fredoka font-semibold text-sm transition-all duration-300 ${
              activeCategory === category
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {name}
          </motion.button>
        ))}
      </div>

      {/* Sound Buttons Grid */}
      <motion.div
        key={activeCategory}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
      >
        {currentSounds.map((sound, index) => (
          <motion.button
            key={sound.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05, rotate: activeSound === sound.id ? 5 : 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => playSound(sound)}
            className={`p-6 rounded-xl font-fredoka font-bold text-lg transition-all duration-300 relative overflow-hidden ${
              activeSound === sound.id
                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-2xl transform scale-105'
                : 'bg-gradient-to-br from-white to-gray-100 text-gray-800 shadow-md hover:shadow-lg border-2 border-gray-200'
            }`}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 text-4xl">🎵</div>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="text-4xl mb-2">{sound.emoji}</div>
              <div className={`text-sm transition-all duration-200 ${
                activeSound === sound.id ? 'text-white' : 'text-gray-600'
              }`}>
                {sound.name}
              </div>
              {sound.key && (
                <div className={`text-xs mt-1 px-2 py-1 rounded transition-all duration-200 ${
                  activeSound === sound.id
                    ? 'bg-white bg-opacity-30 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  [{sound.key}]
                </div>
              )}

              {/* Ripple effect */}
              {activeSound === sound.id && (
                <motion.div
                  className="absolute inset-0 bg-white rounded-xl opacity-50"
                  initial={{ scale: 0 }}
                  animate={{ scale: 2 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              )}
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center bg-blue-50 p-4 rounded-xl border-2 border-blue-200"
      >
        <p className="text-sm font-nunito text-blue-600">
          💡 **Tip:** Try the keyboard shortcuts! Each button shows its [key] above.
          Adjust volume with the slider and have fun making music! 🎶
        </p>

        {!audioContext && (
          <p className="text-xs text-blue-500 mt-2">
            🔊 Click any sound button to enable audio!
          </p>
        )}

        {audioContext && (
          <p className="text-xs text-orange-500 mt-2">
            🎵 Ready for sound! Current sounds are demo placeholders.
          </p>
        )}
      </motion.div>

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center"
      >
        <p className="text-xs font-nunito text-gray-500">
          Sound effects are simulated for demo. In production, we'd add real audio files! 🎵
        </p>
      </motion.div>
    </div>
  );
};

export default SoundBoard;
