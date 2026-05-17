import React, { useState } from 'react';
import { Tldraw, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useGameStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

// Mock avatars for 'Sleeping Ghosts'
const GHOSTS = [
  { id: 1, name: 'Bestie1', x: 200, y: 300, color: '#FF69B4', status: 'Sleeping... 💤' },
  { id: 2, name: 'CoolFriend', x: 800, y: 150, color: '#4B0082', status: 'Back at 4PM' },
];

interface StickerToolbarProps {
  onAddSticker: (emoji: string) => void;
  onBuryCapsule: () => void;
  onExit: () => void;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleDJ: () => void;
  onAddInvisibleInk: () => void;
  onToggleSpyMode: () => void;
  isSpyMode: boolean;
  inventory: string[];
}

const StickerToolbar: React.FC<StickerToolbarProps> = ({ 
  onAddSticker, 
  onBuryCapsule, 
  onExit, 
  onUploadPhoto,
  onToggleDJ,
  onAddInvisibleInk, 
  onToggleSpyMode,
  isSpyMode,
  inventory
}) => (
  <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-[1000]">
    <div className="flex gap-4 pointer-events-auto flex-wrap max-w-[70%]">
      {/* Sticker Pack */}
      <div className="bg-white/30 backdrop-blur-sm p-2 rounded-2xl border-2 border-white/50 shadow-xl flex gap-2 rotate-1 items-center">
        {/* Default Stickers */}
        {['⭐', '💖', '🌈', '🎨'].map((emoji, i) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.2, rotate: Math.random() * 10 - 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onAddSticker(emoji)}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-xl shadow-md border-2 border-purple-100 text-2xl md:text-3xl flex items-center justify-center transform transition-transform"
            style={{ rotate: `${(i * 5) - 10}deg` }}
          >
            {emoji}
          </motion.button>
        ))}

        {/* Unlocked Premium Stickers */}
        {inventory.includes('rare_star') && (
            <motion.button
                whileHover={{ scale: 1.2 }}
                onClick={() => onAddSticker('🌟')}
                className="w-12 h-12 bg-yellow-100 rounded-xl shadow-md border-2 border-yellow-400 text-2xl flex items-center justify-center"
                title="Rare Star (Unlocked!)"
            >
                🌟
            </motion.button>
        )}
        {inventory.includes('golden_heart') && (
            <motion.button
                whileHover={{ scale: 1.2 }}
                onClick={() => onAddSticker('💛')}
                className="w-12 h-12 bg-yellow-100 rounded-xl shadow-md border-2 border-yellow-400 text-2xl flex items-center justify-center"
                title="Golden Heart (Unlocked!)"
            >
                💛
            </motion.button>
        )}
        {inventory.includes('unicorn_magic') && (
            <motion.button
                whileHover={{ scale: 1.2 }}
                onClick={() => onAddSticker('🦄')}
                className="w-12 h-12 bg-pink-100 rounded-xl shadow-md border-2 border-pink-400 text-2xl flex items-center justify-center"
                title="Unicorn Magic (Unlocked!)"
            >
                🦄
            </motion.button>
        )}
        
        {/* Separator */}
        <div className="w-px h-8 bg-white/50 mx-1" />

        {/* Invisible Ink */}
        <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onAddInvisibleInk}
            className="w-12 h-12 bg-gray-200/80 rounded-xl shadow-inner border-2 border-dashed border-gray-400 text-2xl flex items-center justify-center opacity-70 hover:opacity-100"
            title="Invisible Ink (Ghost Text)"
        >
            👻
        </motion.button>
      </div>

      {/* DJ Station Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 10 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleDJ}
        className="w-14 h-14 bg-pink-400 rounded-full shadow-lg border-4 border-white text-3xl flex items-center justify-center z-10 -translate-y-2"
        title="DJ Station"
      >
        🎧
      </motion.button>
      
      {/* Spy Mode Toggle */}
      <motion.button
        animate={{ 
            scale: isSpyMode ? 1.1 : 1,
            backgroundColor: isSpyMode ? '#22c55e' : '#3b82f6',
            rotate: isSpyMode ? 180 : 0
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleSpyMode}
        className="w-14 h-14 rounded-full shadow-lg border-4 border-white text-3xl flex items-center justify-center z-10 -translate-y-1 transition-colors"
        title="Spy Mode (Night Vision)"
      >
        🕵️‍♀️
      </motion.button>

      {/* Photo Upload */}
      <div className="relative -rotate-2">
        <input 
            type="file" 
            accept="image/*" 
            onChange={onUploadPhoto} 
            className="hidden" 
            id="photo-upload"
        />
        <motion.label
            htmlFor="photo-upload"
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            className="cursor-pointer block w-14 h-14 bg-cyan-300 rounded-xl shadow-lg border-4 border-white flex items-center justify-center text-3xl"
            title="Add a Photo Sticker!"
        >
            📸
        </motion.label>
      </div>
    </div>

    <div className="flex gap-3 pointer-events-auto items-start">
       <motion.button
        whileHover={{ scale: 1.05, rotate: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBuryCapsule}
        className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg border-4 border-white font-bold font-fredoka flex items-center gap-2 -rotate-1 hover:rotate-0 transition-all"
        title="Bury a secret capsule!"
      >
        <span className="text-xl">🎁</span> Bury Helper
      </motion.button>
      
      <motion.button
        whileHover={{ scale: 1.05, rotate: 2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onExit}
        className="px-4 py-3 bg-red-500 text-white rounded-lg shadow-lg border-4 border-white font-bold font-fredoka rotate-2 hover:rotate-0 transition-all"
      >
        🚪 Exit
      </motion.button>
    </div>
  </div>
);

// Component to handle Tldraw interaction inside the context
const DJStation = ({ onClose }: { onClose: () => void }) => {
  const { isPlaying, setIsPlaying, nextTrack, prevTrack, currentTrack, playlist } = useGameStore();
  
  // Mock song title based on index if not available in store props (store has playlist strings)
  const currentSongName = playlist[currentTrack]?.replace('.flac', '') || "Unknown Track";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
        <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        className="bg-gray-900 p-6 rounded-3xl shadow-2xl text-white w-80 border-4 border-pink-500"
        onClick={(e) => e.stopPropagation()} // Prevent close on click inner
        >
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-fredoka font-bold text-xl text-pink-400">DJ Station 💿</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-xl mb-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xl ${isPlaying ? 'animate-spin' : ''}`}>🎵</div>
            <div className="overflow-hidden">
                <p className="text-sm text-gray-300 truncate w-48 font-nunito font-bold">{currentSongName}</p>
                <p className="text-xs text-green-400 mt-1">Now Playing</p>
            </div>
        </div>

        <div className="flex justify-center gap-6 items-center">
            <button onClick={prevTrack} className="hover:scale-110 transition-transform text-3xl">⏮️</button>
            <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-lg border-2 border-white"
            >
                <span className="text-2xl ml-1">{isPlaying ? '⏸️' : '▶️'}</span>
            </button>
            <button onClick={nextTrack} className="hover:scale-110 transition-transform text-3xl">⏭️</button>
        </div>
        </motion.div>
    </div>
  );
};

// Component to handle Tldraw interaction inside the context
const MuralLogic = ({ onExit, isSpyMode, toggleSpyMode }: { onExit: () => void, isSpyMode: boolean, toggleSpyMode: () => void }) => {
    const editor = useEditor();
    // Access global inventory
    const { inventory } = useGameStore(); 
    
    const [showDJ, setShowDJ] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { incrementDrawingsCreated, incrementTreasureFound } = useGameStore();
    
    const addSticker = (emoji: string) => {
        if (!editor) return;
        const center = editor.getViewportPageBounds().center;
        editor.createShape({
            type: 'text',
            x: center.x - 50 + Math.random() * 100,
            y: center.y - 50 + Math.random() * 100,
            props: {
                text: emoji,
                size: 'xl', // Proper size prop
            },
        });
        incrementDrawingsCreated(); // Gamification!
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editor || !e.target.files?.[0]) return;
        
        setIsUploading(true);
        
        // Simulate upload delay
        setTimeout(() => {
            alert('📸 Photo Uploaded Successfully! (Simulated)');
            addSticker('📸'); // Drop the sticker
            setIsUploading(false);
        }, 1500);
    };

    const addInvisibleInk = () => {
        if (!editor) return;
        const center = editor.getViewportPageBounds().center;
        editor.createShape({
            type: 'text',
            x: center.x,
            y: center.y,
            props: {
                text: 'SECRET MESSAGE 🤫',
                size: 'l',
                color: 'grey'
            },
            opacity: 0.1 // Very faint!
        });
        alert("Added Invisible Ink Message! Use Spy Mode 🕵️‍♀️ to read it clearly.");
    };

    const buryCapsule = () => {
        if (!editor) return;
        const selectedShapes = editor.getSelectedShapes();
        if (selectedShapes.length === 0) {
            alert('Select something to bury first!');
            return;
        }
        
        try {
            // Group the selected shapes
            editor.groupShapes(selectedShapes.map(s => s.id));
            const group = editor.getSelectedShapes()[0];
            
            if (!group) return;

            // Visual indicator: A giant wrapped gift functionality
            editor.createShape({
                type: 'text',
                x: group.x,
                y: group.y - 80,
                props: {
                    text: '🎁',
                    size: 'xl',
                    align: 'middle'
                },
            });

            // Add a label below
            const bounds = editor.getShapePageBounds(group);
            const offsetY = bounds ? bounds.h : 100;
            
            editor.createShape({
                type: 'text',
                x: group.x,
                y: group.y + offsetY + 10,
                props: {
                    text: 'Open at 4PM',
                    size: 's',
                    color: 'red',
                }
            });
            
            // Lock the group
            editor.updateShape({
                id: group.id,
                type: group.type,
                opacity: 0.2, // Make the content barely visible ("ghostly")
                isLocked: true,
            });

            alert("Secret Buried! 🎁 Check back at 4 PM.");
            incrementTreasureFound(); // Gamification!
        } catch (err) {
            console.error("Bury error:", err);
            alert("Could not bury this selection. Try selecting a single drawing.");
        }
    };

    return (
        <>
            <StickerToolbar 
                onAddSticker={addSticker} 
                onBuryCapsule={buryCapsule} 
                onExit={onExit} 
                onUploadPhoto={handlePhotoUpload}
                onToggleDJ={() => setShowDJ(!showDJ)}
                onAddInvisibleInk={addInvisibleInk}
                onToggleSpyMode={toggleSpyMode}
                isSpyMode={isSpyMode}
                inventory={inventory}
            />
            
            <AnimatePresence>
              {showDJ && <DJStation onClose={() => setShowDJ(false)} />}
            </AnimatePresence>

            {/* Upload Spinner Overlay */}
            <AnimatePresence>
                {isUploading && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[2000] flex flex-col items-center justify-center text-white"
                    >
                        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                        <h2 className="text-2xl font-fredoka font-bold">Uploading Evidence...</h2>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

const LivingMural: React.FC = () => {
  const { setGameState } = useGameStore();
  const [showGhosts] = useState(true);
  const [isSpyMode, setIsSpyMode] = useState(false);

  // Persistence Key
  const PERSISTENCE_KEY = 'kpop-fun-quest-mural-v2';

  return (
    <div className={`fixed inset-0 z-50 overscroll-none transition-all duration-500 ${
        isSpyMode ? 'bg-black' : 'bg-[#fffdf0]'
    }`}>
       {/* Ghost Layer - Hide in Spy Mode for cleaner view or invert? Let's Keep them but ghostly-er */}
       <AnimatePresence>
        {showGhosts && GHOSTS.map(ghost => (
            <motion.div
                key={ghost.id}
                initial={{ opacity: 0 }}
                animate={{ 
                    opacity: isSpyMode ? 0.8 : 0.4, 
                    filter: isSpyMode ? 'invert(1) hue-rotate(180deg)' : 'none',
                    y: [ghost.y, ghost.y - 20, ghost.y],
                }}
                transition={{ 
                    opacity: { duration: 1 },
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute pointer-events-none z-[100]"
                style={{ left: ghost.x, top: ghost.y }}
            >
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: ghost.color }}>
                        {ghost.name[0]}
                    </div>
                    <div className="bg-white/80 px-2 py-1 rounded-full text-xs mt-1 font-bold text-gray-600">
                        {ghost.status}
                    </div>
                </div>
            </motion.div>
        ))}
       </AnimatePresence>

      <motion.div 
        className="absolute inset-0 z-0"
        animate={{
            filter: isSpyMode 
                ? 'grayscale(100%) brightness(0.8) contrast(200%) sepia(100%) hue-rotate(50deg)' // Night vision green
                : 'none'
        }}
        transition={{ duration: 0.5 }}
      >
        <Tldraw 
            persistenceKey={PERSISTENCE_KEY}
            hideUi={true} // Hide default UI for "Sticker-Bombed" look
        >
            <MuralLogic 
                onExit={() => setGameState('welcome')} 
                isSpyMode={isSpyMode}
                toggleSpyMode={() => setIsSpyMode(!isSpyMode)}
            />
        </Tldraw>
      </motion.div>

      <div className="absolute bottom-4 left-4 z-[1000] text-sm text-gray-400 font-fredoka pointer-events-none select-none">
        The Living Mural - Infinite Clubhouse
      </div>
    </div>
  );
};

export default LivingMural;
