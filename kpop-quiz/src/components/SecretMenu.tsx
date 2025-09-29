import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import DrawingCanvas from './DrawingCanvas';
import StickerGallery from './StickerGallery';
import BubblePopperGame from './BubblePopperGame';

const SecretMenu: React.FC = () => {
  const { setGameState } = useGameStore();
  const [activeTab, setActiveTab] = useState<'creative' | 'games' | 'fun' | 'behind'>('creative');
  const [placedStickers, setPlacedStickers] = useState<Array<{
    id: string;
    sticker: any;
    x: number;
    y: number;
    scale: number;
  }>>([]);

  const handleStickerSelect = (sticker: any) => {
    // Add sticker to placed stickers in center of screen initially
    const newSticker = {
      id: `placed-${Date.now()}`,
      sticker,
      x: Math.random() * 200 + 100, // Random position
      y: Math.random() * 150 + 100,
      scale: 1,
    };
    setPlacedStickers(prev => [...prev, newSticker]);
  };

  const removePlacedSticker = (stickerId: string) => {
    setPlacedStickers(prev => prev.filter(s => s.id !== stickerId));
  };

  const updatePlacedSticker = (stickerId: string, updates: Partial<{x: number, y: number, scale: number}>) => {
    setPlacedStickers(prev => prev.map(s =>
      s.id === stickerId ? { ...s, ...updates } : s
    ));
  };

  const tabs = [
    { id: 'creative', label: '🎨 Creative Corner', color: 'bg-pink-100 border-pink-300' },
    { id: 'games', label: '🎮 Game Paradise', color: 'bg-purple-100 border-purple-300' },
    { id: 'fun', label: '🌟 Fun Zone', color: 'bg-blue-100 border-blue-300' },
    { id: 'behind', label: '🔍 Behind Scenes', color: 'bg-green-100 border-green-300' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 relative overflow-hidden"
    >
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
              rotate: Math.random() * 360,
            }}
            animate={{
              y: -100,
              rotate: 360,
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 5,
            }}
          >
            {['🎈', '⭐', '✨', '🌈', '🎵'][Math.floor(Math.random() * 5)]}
          </motion.div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto relative z-10 bg-white rounded-3xl shadow-2xl p-8 border-4 border-yellow-400">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-fredoka font-bold text-purple-600 mb-4 text-kid-glow">
            🎉 Secret Fun Zone! 🌈
          </h1>
          <p className="text-xl font-fredoka text-gray-700">
            You found the magical secret place! 🎊
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-full border-3 font-fredoka font-semibold text-lg transition-all duration-300 ${
                activeTab === tab.id
                  ? `${tab.color} text-gray-800 shadow-lg transform scale-105`
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-[400px] flex flex-col items-center justify-center"
          >
            {activeTab === 'creative' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-6"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="text-4xl mb-2"
                  >
                    🎨
                  </motion.div>
                  <h3 className="text-2xl font-fredoka font-bold text-pink-600 mb-2">
                    Creative Corner
                  </h3>
                  <p className="text-sm font-nunito text-gray-600">
                    Draw, decorate, and create amazing artwork! 🎨✨🖼️
                  </p>
                </div>

                {/* Drawing Canvas */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative"
                >
                  <DrawingCanvas />

                  {/* Placed Stickers Overlay */}
                  {placedStickers.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none">
                      {placedStickers.map((placedSticker, index) => (
                        <motion.div
                          key={placedSticker.id}
                          initial={{
                            x: placedSticker.x,
                            y: placedSticker.y,
                            scale: 0.5,
                            rotate: -180
                          }}
                          animate={{
                            x: placedSticker.x,
                            y: placedSticker.y,
                            scale: placedSticker.scale,
                            rotate: 0
                          }}
                          exit={{ scale: 0, opacity: 0 }}
                          drag
                          dragMomentum={false}
                          dragConstraints={{ left: 0, right: 400, top: 0, bottom: 300 }}
                          onDragEnd={(event, info) => {
                            updatePlacedSticker(placedSticker.id, {
                              x: placedSticker.x + info.offset.x,
                              y: placedSticker.y + info.offset.y,
                            });
                          }}
                          onDoubleClick={() => removePlacedSticker(placedSticker.id)}
                          className="absolute pointer-events-auto cursor-move select-none"
                          whileHover={{ scale: placedSticker.scale * 1.1 }}
                          whileTap={{ scale: placedSticker.scale * 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{
                            zIndex: 10 + index,
                          }}
                          title={`Double-click to remove • ${placedSticker.sticker.name}`}
                        >
                          <motion.div
                            className="text-3xl md:text-4xl drop-shadow-lg"
                            animate={
                              placedSticker.sticker.wiggleEffect
                                ? { rotate: [0, -3, 3, 0], scale: [1, 1.05, 1] }
                                : placedSticker.sticker.sparkleEffect
                                ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }
                                : {}
                            }
                            transition={{
                              duration: placedSticker.sticker.wiggleEffect ? 1.5 : placedSticker.sticker.sparkleEffect ? 1 : 0,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          >
                            {placedSticker.sticker.emoji}
                          </motion.div>

                          {/* Remove hint */}
                          <motion.div
                            className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Double-click to remove
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Placed Stickers Counter */}
                  {placedStickers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-fredoka"
                    >
                      🖼️ {placedStickers.length}
                    </motion.div>
                  )}
                </motion.div>

                {/* Sticker Gallery */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="border-t-4 border-pink-200 pt-6"
                >
                  <div className="text-center mb-4">
                    <h4 className="text-xl font-fredoka font-bold text-pink-600">
                      🖼️ Sticker Collection
                    </h4>
                    <p className="text-xs font-nunito text-gray-600">
                      Decorate your drawings with magical stickers!
                    </p>
                  </div>
                  <StickerGallery onStickerSelect={handleStickerSelect} />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'games' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <BubblePopperGame />
              </motion.div>
            )}

            {activeTab === 'fun' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="text-6xl mb-4"
                >
                  🎤
                </motion.div>
                <h3 className="text-2xl font-fredoka font-bold text-blue-600 mb-4">
                  Dance Party Zone Starting Soon!
                </h3>
                <p className="text-lg font-nunito text-gray-600">
                  Make characters dance and create musical magic!
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl"
                  >
                    💃
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-4xl"
                  >
                    🎵
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="text-4xl"
                  >
                    🕺
                  </motion.div>
                </div>
              </div>
            )}

            {activeTab === 'behind' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="text-6xl mb-4"
                >
                  🧙‍♂️
                </motion.div>
                <h3 className="text-2xl font-fredoka font-bold text-green-600 mb-4">
                  App Magic & Mystery Tours!
                </h3>
                <p className="text-lg font-nunito text-gray-600">
                  Discover the secrets behind how this app was created!
                </p>
                <div className="mt-6 grid grid-cols-2 gap-6">
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <div className="text-2xl mb-2">🎯</div>
                    <p className="font-fredoka text-green-700">Developer Cameos</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <div className="text-2xl mb-2">📊</div>
                    <p className="font-fredoka text-green-700">Your Stats</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-8 text-center"
        >
          <button
            onClick={() => setGameState('welcome')}
            className="btn-kid-secondary font-fredoka text-lg"
          >
            ← Back to Main Menu
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SecretMenu;
