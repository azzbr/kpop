import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  key?: string;
}

const SoundBoard: React.FC = () => {
  const { incrementSoundEffectsPlayed } = useGameStore();
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [activeCategory, setActiveCategory] = useState<'funny' | 'animals' | 'instruments' | 'effects'>('funny');
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Sound categories
  const soundCategories = {
    funny: [
      { id: 'burp', name: 'Burp', emoji: '💨', key: 'Q' },
      { id: 'fart', name: 'Fart', emoji: '💨', key: 'W' },
      { id: 'sneeze', name: 'Sneeze', emoji: '🤧', key: 'E' },
      { id: 'giggle', name: 'Giggle', emoji: '🤭', key: 'R' },
      { id: 'pop', name: 'Pop!', emoji: '💥', key: 'T' },
      { id: 'boing', name: 'Boing!', emoji: '🏀', key: 'Y' },
    ],
    animals: [
      { id: 'cat', name: 'Cat Meow', emoji: '🐱', key: 'A' },
      { id: 'dog', name: 'Dog Bark', emoji: '🐶', key: 'S' },
      { id: 'bird', name: 'Bird Chirp', emoji: '🐦', key: 'D' },
      { id: 'cow', name: 'Cow Moo', emoji: '🐄', key: 'F' },
      { id: 'lion', name: 'Lion Roar', emoji: '🦁', key: 'G' },
      { id: 'elephant', name: 'Elephant', emoji: '🐘', key: 'H' },
    ],
    instruments: [
      { id: 'drum', name: 'Drum', emoji: '🥁', key: 'Z' },
      { id: 'piano', name: 'Piano', emoji: '🎹', key: 'X' },
      { id: 'trumpet', name: 'Trumpet', emoji: '🎺', key: 'C' },
      { id: 'violin', name: 'Violin', emoji: '🎻', key: 'V' },
      { id: 'guitar', name: 'Guitar', emoji: '🎸', key: 'B' },
      { id: 'xylophone', name: 'Xylophone', emoji: '🎵', key: 'N' },
    ],
    effects: [
      { id: 'laser', name: 'Laser', emoji: '⚡', key: '1' },
      { id: 'explosion', name: 'Explosion', emoji: '💥', key: '2' },
      { id: 'whoosh', name: 'Whoosh', emoji: '💨', key: '3' },
      { id: 'alarm', name: 'Alarm', emoji: '🚨', key: '4' },
      { id: 'twinkle', name: 'Twinkle', emoji: '✨', key: '5' },
      { id: 'coin', name: 'Coin Drop', emoji: '🪙', key: '6' },
    ],
  };

  const playSynthSound = (id: string) => {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Master volume
    gain.gain.value = volume;
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Helper for Noise
    const playNoise = (duration: number, type: 'white' | 'pink' = 'white') => {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = volume;
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start();
        return { noise, noiseGain };
    };

    switch (id) {
      // --- FUNNY ---
      case 'burp':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.linearRampToValueAtTime(60, t + 0.4);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start();
        osc.stop(t + 0.4);
        break;
      case 'fart':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.3);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start();
        osc.stop(t + 0.3);
        break;
      case 'sneeze':
        // Short oscillation then noise
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(500, t + 0.1);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.start(); 
        osc.stop(t + 0.1);
        setTimeout(() => {
            const { noiseGain } = playNoise(0.2);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        }, 100);
        break;
      case 'giggle':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.1);
        osc.frequency.linearRampToValueAtTime(400, t + 0.2);
        osc.frequency.linearRampToValueAtTime(600, t + 0.3);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start();
        osc.stop(t + 0.4);
        break;
      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start();
        osc.stop(t + 0.1);
        break;
      case 'boing':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.2);
        osc.frequency.linearRampToValueAtTime(200, t + 0.4);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start();
        osc.stop(t + 0.5);
        break;

      // --- ANIMALS ---
      case 'cat':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.3);
        osc.frequency.linearRampToValueAtTime(500, t + 0.6);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.start();
        osc.stop(t + 0.6);
        break;
      case 'dog':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start();
        osc.stop(t + 0.15);
        break;
      case 'bird':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.1);
        osc.frequency.linearRampToValueAtTime(800, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start();
        osc.stop(t + 0.3);
        break;
      case 'cow':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(80, t + 1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 1);
        osc.start();
        osc.stop(t + 1);
        break;
      case 'lion':
        playNoise(1.0).noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
        break;
      case 'elephant':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.3);
        osc.frequency.linearRampToValueAtTime(300, t + 0.8);
        gain.gain.linearRampToValueAtTime(0, t + 0.8);
        osc.start();
        osc.stop(t + 0.8);
        break;

      // --- INSTRUMENTS ---
      case 'piano':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t); // A4
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        osc.start();
        osc.stop(t + 1.0);
        break;
      case 'drum':
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start();
        osc.stop(t + 0.1);
        break;
      case 'trumpet':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, t); // C5
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.05);
        gain.gain.linearRampToValueAtTime(volume * 0.8, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start();
        osc.stop(t + 0.5);
        break;
      case 'violin':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(659.25, t); // E5
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 1.0);
        // Add vibrato? complex, stick to simple
        osc.start();
        osc.stop(t + 1.0);
        break;
      case 'guitar':
        osc.type = 'triangle'; // Pluck approx
        osc.frequency.setValueAtTime(329.63, t); // E4
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        osc.start();
        osc.stop(t + 1.5);
        break;
      case 'xylophone':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t); // A5
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start();
        osc.stop(t + 0.3);
        break;

      // --- EFFECTS ---
      case 'laser':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start();
        osc.stop(t + 0.2);
        break;
      case 'explosion':
        const { noiseGain } = playNoise(0.5);
        noiseGain.gain.setValueAtTime(volume, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        break;
      case 'whoosh':
        const w = playNoise(0.5, 'white');
        w.noiseGain.gain.setValueAtTime(0, t);
        w.noiseGain.gain.linearRampToValueAtTime(volume, t + 0.25);
        w.noiseGain.gain.linearRampToValueAtTime(0, t + 0.5);
        break;
      case 'alarm':
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.setValueAtTime(1000, t + 0.2);
        osc.frequency.setValueAtTime(800, t + 0.4);
        osc.frequency.setValueAtTime(1000, t + 0.6);
        gain.gain.linearRampToValueAtTime(0, t + 0.8);
        osc.start();
        osc.stop(t + 0.8);
        break;
      case 'twinkle':
        // Arpeggio
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = freq;
            o.connect(g);
            g.connect(ctx.destination);
            g.gain.setValueAtTime(volume * 0.2, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            o.start(now + i * 0.1);
            o.stop(now + i * 0.1 + 0.3);
        });
        break;
      case 'coin':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, t);
        osc.frequency.setValueAtTime(1500, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start();
        osc.stop(t + 0.3);
        break;
        
      default:
        // Default beep
        osc.frequency.setValueAtTime(440, t);
        osc.start();
        osc.stop(t + 0.1);
    }
  };

  const playSound = useCallback((soundEffect: SoundEffect) => {
    playSynthSound(soundEffect.id);
    setActiveSound(soundEffect.id);
    setTimeout(() => setActiveSound(null), 300);
    incrementSoundEffectsPlayed();
  }, [incrementSoundEffectsPlayed, volume]); // Volume used via ref in synthesis potentially or state, using getAudioContext

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
      </motion.div>
    </div>
  );
};

export default SoundBoard;
