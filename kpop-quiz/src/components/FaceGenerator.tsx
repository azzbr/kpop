import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface FaceParts {
  head: number;
  eyes: number;
  nose: number;
  mouth: number;
}

const FaceGenerator: React.FC = () => {
  const { incrementFacesGenerated } = useGameStore();

  const [faceParts, setFaceParts] = useState<FaceParts>({
    head: 0,
    eyes: 0,
    nose: 0,
    mouth: 0,
  });

  const [isAnimating, setIsAnimating] = useState(false);

  // Face part options
  const heads = ['🟡', '🤖', '👑', '🐱', '💀', '👽']; // Head/Hair styles
  const eyes = ['😊', '😉', '😴', '😠', '😲', '😈']; // Eye expressions
  const noses = ['👃', '🐽', '💥', '💎', '❤️', '⭐']; // Nose shapes
  const mouths = ['😃', '😬', '😛', '😮', '😔', '🤤']; // Mouth expressions

  const facePartsLabels = {
    head: 'Heads & Hair',
    eyes: 'Eye Expressions',
    nose: 'Noses & Shapes',
    mouth: 'Mouth Styles',
  };

  const facePartsArrays = [heads, eyes, noses, mouths];

  const cyclePart = useCallback((part: keyof FaceParts, direction: 1 | -1) => {
    setIsAnimating(true);
    setFaceParts(prev => {
      const currentIndex = prev[part];
      const maxIndex = facePartsArrays[part === 'head' ? 0 : part === 'eyes' ? 1 : part === 'nose' ? 2 : 3].length;
      let newIndex = currentIndex + direction;

      if (newIndex < 0) newIndex = maxIndex - 1;
      if (newIndex >= maxIndex) newIndex = 0;

      return { ...prev, [part]: newIndex };
    });

    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  const randomizeFace = useCallback(() => {
    setIsAnimating(true);
    setFaceParts({
      head: Math.floor(Math.random() * heads.length),
      eyes: Math.floor(Math.random() * eyes.length),
      nose: Math.floor(Math.random() * noses.length),
      mouth: Math.floor(Math.random() * mouths.length),
    });

    incrementFacesGenerated();

    setTimeout(() => setIsAnimating(false), 500);
  }, [incrementFacesGenerated]);

  const resetFace = useCallback(() => {
    setFaceParts({ head: 0, eyes: 0, nose: 0, mouth: 0 });
  }, []);

  const getFaceCombination = () => {
    return {
      head: heads[faceParts.head],
      eyes: eyes[faceParts.eyes],
      nose: noses[faceParts.nose],
      mouth: mouths[faceParts.mouth],
    };
  };

  const face = getFaceCombination();

  // Generate funny names based on combinations
  const getCharacterName = () => {
    const adjectives = ['Clever', 'Silly', 'Mysterious', 'Sparkly', 'Wobbly', 'Cheerful'];
    const nouns = ['Blob', 'Squish', 'Zizzer', 'Phoom', 'Wizzle', 'Gloop'];
    return `${adjectives[faceParts.head]} ${nouns[faceParts.eyes]}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-4xl mb-2"
        >
          🎭
        </motion.div>
        <h3 className="text-2xl font-fredoka font-bold text-purple-600 mb-2">
          Face Factory Creator
        </h3>
        <p className="text-sm font-nunito text-gray-600">
          Mix and match to create hilarious characters! 🤪
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Character Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-4">
            <motion.div
              animate={isAnimating ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 0.3 }}
              className="text-8xl md:text-9xl relative"
              style={{ lineHeight: 1, textAlign: 'center' }}
            >
              <div className="relative inline-block">
                {/* Head background */}
                <div className="absolute inset-0 text-9xl opacity-20 transform scale-110">
                  {face.head}
                </div>
                {/* Face parts */}
                <div className="relative flex flex-col items-center space-y-1">
                  <div className="text-6xl transform scale-150">{face.eyes}</div>
                  <div className="text-4xl transform scale-125">{face.nose}</div>
                  <div className="text-5xl transform scale-140">{face.mouth}</div>
                </div>
              </div>
            </motion.div>

            {/* Character Name Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-fredoka shadow-lg"
            >
              {getCharacterName()}
            </motion.div>

            {/* Sparkle Effects */}
            <motion.div
              animate={{
                scale: [0, 1, 0],
                rotate: [0, 180, 360],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 1
              }}
              className="absolute -top-2 -right-2 text-2xl"
            >
              ✨
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={randomizeFace}
              className="px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-lg font-fredoka font-semibold shadow-lg"
            >
              🎲 Random
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetFace}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg font-fredoka font-semibold shadow-lg"
            >
              🔄 Reset
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={incrementFacesGenerated}
              className="px-4 py-2 bg-green-400 text-white rounded-lg font-fredoka font-semibold shadow-lg"
            >
              💾 Save
            </motion.button>
          </div>
        </motion.div>

        {/* Face Part Controls */}
        <div className="space-y-4">
          {Object.entries(faceParts).map(([part, index], partIndex) => {
            const partArray = facePartsArrays[partIndex];
            const label = facePartsLabels[part as keyof typeof facePartsLabels];

            return (
              <motion.div
                key={part}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: partIndex * 0.1 }}
                className="bg-white rounded-lg p-3 border-2 border-purple-200 shadow-sm"
              >
                <div className="text-sm font-fredoka font-bold text-purple-600 mb-2">
                  {label}
                </div>

                <div className="flex items-center justify-between">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => cyclePart(part as keyof FaceParts, -1)}
                    className="text-2xl hover:bg-purple-100 rounded-full p-2 transition-colors"
                  >
                    ◀️
                  </motion.button>

                  <motion.div
                    transition={{ duration: 0.2 }}
                    className="text-3xl px-4"
                    style={{ transform: isAnimating ? 'scale(1.1)' : 'scale(1)' }}
                  >
                    {partArray[index]}
                  </motion.div>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => cyclePart(part as keyof FaceParts, 1)}
                    className="text-2xl hover:bg-purple-100 rounded-full p-2 transition-colors"
                  >
                    ▶️
                  </motion.button>
                </div>

                {/* Progress dots */}
                <div className="flex justify-center gap-1 mt-2">
                  {partArray.map((_, dotIndex) => (
                    <motion.div
                      key={dotIndex}
                      animate={{
                        scale: dotIndex === index ? [1, 1.2, 1] : 1,
                        backgroundColor: dotIndex === index ? '#8b5cf6' : '#d1d5db'
                      }}
                      transition={{
                        duration: 0.3,
                        repeat: dotIndex === index ? 0 : 0
                      }}
                      className="w-2 h-2 rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center bg-pink-50 p-4 rounded-xl border-2 border-pink-200"
      >
        <p className="text-sm font-nunito text-pink-600">
          🎯 Mix and match face parts to create unique characters! Use the arrows to change each part,
          or click "Random" for surprise combinations! Save your favorites! ✨
        </p>
      </motion.div>
    </div>
  );
};

export default FaceGenerator;
