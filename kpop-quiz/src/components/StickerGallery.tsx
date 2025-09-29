import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Sticker {
  id: string;
  emoji: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'faces' | 'dance' | 'accessories' | 'effects' | 'nature' | 'food';
  unlocked: boolean;
  wiggleEffect?: boolean;
  sparkleEffect?: boolean;
}

interface StickerGalleryProps {
  onStickerSelect?: (sticker: Sticker) => void;
}

const StickerGallery: React.FC<StickerGalleryProps> = ({ onStickerSelect }) => {
  const [activeCategory, setActiveCategory] = useState<Sticker['category']>('faces');

  // Comprehensive sticker collection
  const stickerCollections: Record<Sticker['category'], Sticker[]> = {
    faces: [
      { id: 'face-happy', emoji: '😊', name: 'Happy Face', rarity: 'common', category: 'faces', unlocked: true },
      { id: 'face-laugh', emoji: '😂', name: 'Laughing', rarity: 'common', category: 'faces', unlocked: true },
      { id: 'face-cool', emoji: '😎', name: 'Cool Dude', rarity: 'rare', category: 'faces', unlocked: true },
      { id: 'face-love', emoji: '🥰', name: 'Love Eyes', rarity: 'common', category: 'faces', unlocked: true },
      { id: 'face-wink', emoji: '😉', name: 'Winky', rarity: 'common', category: 'faces', unlocked: true },
      { id: 'face-shy', emoji: '🥺', name: 'Shy Pout', rarity: 'rare', category: 'faces', unlocked: true },
      { id: 'face-sunglasses', emoji: '😎', name: 'Cool Shades', rarity: 'epic', category: 'faces', unlocked: true },
      { id: 'face-party', emoji: '🥳', name: 'Party Time', rarity: 'legendary', category: 'faces', unlocked: true },
    ],
    dance: [
      { id: 'dance-heart-hands', emoji: '💃', name: 'Heart Hands', rarity: 'common', category: 'dance', unlocked: true, wiggleEffect: true },
      { id: 'dance-dancer', emoji: '🕺', name: 'Dancing Dude', rarity: 'common', category: 'dance', unlocked: true, wiggleEffect: true },
      { id: 'dance-confetti', emoji: '🎉', name: 'Confetti Dance', rarity: 'epic', category: 'dance', unlocked: true, sparkleEffect: true },
      { id: 'dance-twirl', emoji: '💫', name: 'Twirl Spin', rarity: 'rare', category: 'dance', unlocked: true },
      { id: 'dance-stars', emoji: '✨', name: 'Shine Bright', rarity: 'rare', category: 'dance', unlocked: true, sparkleEffect: true },
      { id: 'dance-hearts', emoji: '💖', name: 'Heart Burst', rarity: 'epic', category: 'dance', unlocked: true, wiggleEffect: true },
      { id: 'dance-rainbow', emoji: '🌈', name: 'Rainbow Dance', rarity: 'legendary', category: 'dance', unlocked: true, sparkleEffect: true },
    ],
    effects: [
      { id: 'effect-sparkle', emoji: '✨', name: 'Sparkle Dust', rarity: 'common', category: 'effects', unlocked: true, sparkleEffect: true },
      { id: 'effect-stars', emoji: '⭐', name: 'Star Burst', rarity: 'common', category: 'effects', unlocked: true, wiggleEffect: true },
      { id: 'effect-rainbow', emoji: '🌈', name: 'Rainbow', rarity: 'rare', category: 'effects', unlocked: true },
      { id: 'effect-lightning', emoji: '⚡', name: 'Lightning', rarity: 'rare', category: 'effects', unlocked: true, wiggleEffect: true },
      { id: 'effect-fire', emoji: '🔥', name: 'Fire Effect', rarity: 'epic', category: 'effects', unlocked: true, wiggleEffect: true },
      { id: 'effect-magic', emoji: '✨🪄', name: 'Magic Wand', rarity: 'legendary', category: 'effects', unlocked: true, sparkleEffect: true },
    ],
    accessories: [
      { id: 'acc-crown', emoji: '👑', name: 'Crown', rarity: 'epic', category: 'accessories', unlocked: true },
      { id: 'acc-sunglasses', emoji: '🕶️', name: 'Cool Shades', rarity: 'common', category: 'accessories', unlocked: true },
      { id: 'acc-hat', emoji: '🎩', name: 'Magic Hat', rarity: 'rare', category: 'accessories', unlocked: true },
      { id: 'acc-flowers', emoji: '🌸', name: 'Flower Crown', rarity: 'common', category: 'accessories', unlocked: true },
      { id: 'acc-glasses', emoji: '🤓', name: 'Smart Glasses', rarity: 'rare', category: 'accessories', unlocked: true },
      { id: 'acc-earrings', emoji: '💎', name: 'Diamonds', rarity: 'epic', category: 'accessories', unlocked: true, sparkleEffect: true },
    ],
    nature: [
      { id: 'nature-butterflies', emoji: '🦋', name: 'Butterflies', rarity: 'common', category: 'nature', unlocked: true, wiggleEffect: true },
      { id: 'nature-flowers', emoji: '🌻', name: 'Sunflower', rarity: 'common', category: 'nature', unlocked: true },
      { id: 'nature-unicorn', emoji: '🦄', name: 'Unicorn', rarity: 'legendary', category: 'nature', unlocked: true, sparkleEffect: true },
      { id: 'nature-rainbow', emoji: '🌧️🌈', name: 'Rain Cloud', rarity: 'epic', category: 'nature', unlocked: true },
      { id: 'nature-stars', emoji: '🌟', name: 'Shooting Star', rarity: 'rare', category: 'nature', unlocked: true },
    ],
    food: [
      { id: 'food-cake', emoji: '🎂', name: 'Birthday Cake', rarity: 'epic', category: 'food', unlocked: true },
      { id: 'food-cookie', emoji: '🍪', name: 'Cookie', rarity: 'common', category: 'food', unlocked: true },
      { id: 'food-pizza', emoji: '🍕', name: 'Pizza', rarity: 'common', category: 'food', unlocked: true },
      { id: 'food-donut', emoji: '🍩', name: 'Donut', rarity: 'rare', category: 'food', unlocked: true },
      { id: 'food-icecream', emoji: '🍦', name: 'Ice Cream', rarity: 'rare', category: 'food', unlocked: true, wiggleEffect: true },
      { id: 'food-rainbow-cake', emoji: '🎂🌈', name: 'Rainbow Cake', rarity: 'legendary', category: 'food', unlocked: true, sparkleEffect: true },
    ],
  };

  const categories = [
    { id: 'faces', label: '😊 Faces', color: 'from-yellow-400 to-orange-500' },
    { id: 'dance', label: '💃 Dance', color: 'from-pink-400 to-purple-500' },
    { id: 'effects', label: '✨ Effects', color: 'from-blue-400 to-cyan-500' },
    { id: 'accessories', label: '👑 Accessories', color: 'from-purple-400 to-pink-500' },
    { id: 'nature', label: '🌸 Nature', color: 'from-green-400 to-blue-500' },
    { id: 'food', label: '🍪 Food', color: 'from-orange-400 to-red-500' },
  ];

  const getRarityColor = (rarity: Sticker['rarity']) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50';
      case 'rare': return 'border-blue-400 bg-blue-50';
      case 'epic': return 'border-purple-400 bg-purple-50';
      case 'legendary': return 'border-yellow-400 bg-yellow-50';
    }
  };

  const getRarityBadge = (rarity: Sticker['rarity']) => {
    switch (rarity) {
      case 'common': return '⚪';
      case 'rare': return '🔵';
      case 'epic': return '🟣';
      case 'legendary': return '🟡';
    }
  };

  const handleStickerClick = (sticker: Sticker) => {
    if (!sticker.unlocked) return;
    onStickerSelect?.(sticker);
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {categories.map((category) => (
          <motion.button
            key={category.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(category.id as Sticker['category'])}
            className={`px-4 py-2 rounded-full text-sm font-fredoka font-semibold transition-all duration-300 ${
              activeCategory === category.id
                ? `bg-gradient-to-r ${category.color} text-white shadow-lg transform scale-105`
                : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {category.label}
          </motion.button>
        ))}
      </motion.div>

      {/* Sticker Grid */}
      <motion.div
        key={activeCategory}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white p-4 rounded-xl border-2 border-purple-200 shadow-lg"
      >
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {stickerCollections[activeCategory].map((sticker, index) => (
            <motion.button
              key={sticker.id}
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ scale: sticker.unlocked ? 1.1 : 1, rotate: sticker.unlocked ? [0, -5, 5, 0] : 0 }}
              whileTap={{ scale: sticker.unlocked ? 0.9 : 1 }}
              onClick={() => handleStickerClick(sticker)}
              disabled={!sticker.unlocked}
              className={`relative p-3 rounded-lg border-2 transition-all duration-300 ${
                sticker.unlocked
                  ? `${getRarityColor(sticker.rarity)} hover:shadow-lg cursor-pointer`
                  : 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
              }`}
              title={sticker.unlocked ? `${sticker.name} (${sticker.rarity})` : '🔒 Collect more stickers to unlock!'}
            >
              {/* Rarity Badge */}
              <div className="absolute -top-1 -right-1 text-xs">
                {getRarityBadge(sticker.rarity)}
              </div>

              {/* Sticker Emoji with Effects */}
              <motion.div
                className="text-2xl md:text-3xl text-center"
                animate={
                  sticker.wiggleEffect
                    ? { rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }
                    : sticker.sparkleEffect
                    ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }
                    : {}
                }
                transition={{
                  duration: sticker.wiggleEffect ? 1.5 : sticker.sparkleEffect ? 1 : 0,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {sticker.emoji}
              </motion.div>

              {/* Locked Overlay */}
              {!sticker.unlocked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-gray-800 bg-opacity-70 rounded-lg flex items-center justify-center"
                >
                  <span className="text-white text-xs font-bold">🔒</span>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <p className="text-sm font-nunito text-purple-600">
          🎯 Click stickers to add them to your artwork! ✨ Collect all rarities to unlock new sticker packs!
        </p>
      </motion.div>
    </div>
  );
};

export default StickerGallery;
