import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

const PatternMaker: React.FC = () => {
  const { incrementPatternsCreated } = useGameStore();

  // Grid settings
  const GRID_SIZE = 8;
  const CELL_SIZE = 40;

  // Pattern state
  const [grid, setGrid] = useState<boolean[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false))
  );
  const [selectedColor, setSelectedColor] = useState('#FF6B9D');
  const [patternName, setPatternName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPatterns, setSavedPatterns] = useState<Array<{
    id: string;
    name: string;
    grid: boolean[][];
    color: string;
  }>>([]);

  // Pattern colors
  const patternColors = [
    '#FF6B9D', // Pink
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#82E0AA', // Light Green
    '#F8C471', // Orange
    '#85C1E9', // Light Blue
    '#F1948A', // Light Red
    '#AED6F1', // Pale Blue
  ];

  // Handle cell click/touch
  const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => [...row]);
      newGrid[rowIndex][colIndex] = !newGrid[rowIndex][colIndex];
      return newGrid;
    });
  }, []);

  // Handle mouse down for painting
  const handleMouseDown = useCallback((rowIndex: number, colIndex: number) => {
    setIsDrawing(true);
    handleCellClick(rowIndex, colIndex);
  }, [handleCellClick]);

  // Handle mouse enter for painting (only if mouse down)
  const handleMouseEnter = useCallback((rowIndex: number, colIndex: number) => {
    if (isDrawing) {
      handleCellClick(rowIndex, colIndex);
    }
  }, [isDrawing, handleCellClick]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Clear pattern
  const clearPattern = useCallback(() => {
    setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false)));
  }, []);

  // Save pattern
  const savePattern = useCallback(() => {
    if (!patternName.trim()) {
      alert('Please give your pattern a name!');
      return;
    }

    const hasFilledCells = grid.some(row => row.some(cell => cell));
    if (!hasFilledCells) {
      alert('Please create a pattern first!');
      return;
    }

    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: patternName.trim(),
      grid: grid.map(row => [...row]),
      color: selectedColor,
    };

    setSavedPatterns(prev => [...prev, newPattern]);
    incrementPatternsCreated();

    // Clear for next pattern
    setPatternName('');
    clearPattern();

    alert('Pattern saved successfully! 🎨');
  }, [patternName, grid, selectedColor, clearPattern, incrementPatternsCreated]);



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
          🎨
        </motion.div>
        <h3 className="text-2xl font-fredoka font-bold text-pink-600 mb-2">
          Pattern Maker Studio
        </h3>
        <p className="text-sm font-nunito text-gray-600 mb-4">
          Create repeating designs and save as reusable stickers! ✨
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Pattern Creator */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Grid Pattern Creator */}
          <div className="bg-white p-6 rounded-2xl border-4 border-pink-200 shadow-lg">
            <h4 className="text-lg font-fredoka font-bold text-pink-600 mb-4 text-center">
              Design Your Pattern
            </h4>

            {/* Pattern Grid */}
            <div
              className="grid gap-1 p-4 mx-auto bg-gray-50 rounded-lg border-2 border-gray-200 select-none"
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                width: GRID_SIZE * CELL_SIZE + 32,
              }}
              onMouseLeave={handleMouseUp}
              onMouseUp={handleMouseUp}
            >
              {grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <motion.div
                    key={`${rowIndex}-${colIndex}`}
                    className={`border rounded cursor-pointer transition-all duration-75 ${
                      cell ? 'bg-current' : 'bg-white border-gray-300 hover:bg-gray-100'
                    }`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      color: selectedColor,
                    }}
                    onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                    onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  />
                ))
              )}
            </div>

            {/* Color Selector */}
            <div className="mt-4">
              <h5 className="text-sm font-fredoka font-bold text-pink-600 mb-2">Choose Pattern Color</h5>
              <div className="grid grid-cols-6 gap-2">
                {patternColors.map((color) => (
                  <motion.button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-4 transition-all ${
                      selectedColor === color ? 'border-purple-500 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Color Picker */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-10 h-8 rounded-full border-2 border-gray-300 cursor-pointer"
              />
              <span className="text-sm font-nunito text-pink-600">🎨 Custom Color</span>
            </div>
          </div>

          {/* Pattern Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-4 rounded-xl border-2 border-pink-200"
          >
            <h4 className="text-lg font-fredoka font-bold text-pink-600 mb-3 text-center">
              Pattern Preview
            </h4>
            <div className="flex justify-center space-x-4">
              {/* Small preview */}
              <div className="text-center">
                <div
                  className="grid gap-1 p-2 bg-white border-2 border-gray-200 rounded"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 5px)`,
                    width: GRID_SIZE * 5 + 16,
                  }}
                >
                  {grid.map((row, y) =>
                    row.map((cell, x) => (
                      <div
                        key={`${y}-${x}`}
                        className="w-1 h-1 border border-gray-100"
                        style={{
                          backgroundColor: cell ? selectedColor : 'transparent',
                        }}
                      />
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">Small</p>
              </div>

              {/* Large preview */}
              <div className="text-center">
                <div
                  className="grid gap-1 p-2 bg-white border-2 border-gray-200 rounded"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 20px)`,
                    width: GRID_SIZE * 20 + 16,
                  }}
                >
                  {grid.map((row, y) =>
                    row.map((cell, x) => (
                      <div
                        key={`${y}-${x}`}
                        className="w-4 h-4 border border-gray-100"
                        style={{
                          backgroundColor: cell ? selectedColor : 'transparent',
                        }}
                      />
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">Large</p>
              </div>
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col space-y-3"
          >
            <div className="bg-white p-4 rounded-xl border-2 border-pink-200">
              <h4 className="text-sm font-fredoka font-bold text-pink-600 mb-2">Save Your Pattern</h4>
              <input
                type="text"
                placeholder="Give your pattern a name..."
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-400 focus:outline-none font-nunito"
              />
              <div className="flex gap-2 mt-3">
                <motion.button
                  onClick={savePattern}
                  className="flex-1 bg-gradient-to-r from-pink-400 to-rose-500 text-white py-2 rounded-lg font-fredoka font-semibold shadow-md"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  💾 Save Pattern
                </motion.button>
                <motion.button
                  onClick={clearPattern}
                  className="px-4 py-2 bg-gray-400 text-white rounded-lg font-fredoka font-semibold shadow-md"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  🗑️ Clear
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column - Saved Patterns */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Saved Patterns Header */}
          <div className="text-center">
            <h4 className="text-lg font-fredoka font-bold text-pink-600 mb-2">
              💾 Saved Patterns
            </h4>
            <p className="text-sm text-gray-600 font-nunito">
              Your reusable design collection
            </p>
          </div>

          {/* Patterns Gallery */}
          <div className="bg-white p-4 rounded-xl border-2 border-pink-200 min-h-[400px]">
            {savedPatterns.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🎨</div>
                <p className="text-gray-600 font-nunito mb-2">No patterns saved yet!</p>
                <p className="text-sm text-gray-500">Create a pattern on the left and save it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedPatterns.map((pattern) => (
                  <motion.div
                    key={pattern.id}
                    className="bg-gradient-to-br from-pink-50 to-purple-50 p-3 rounded-lg border-2 border-pink-200"
                    whileHover={{ scale: 1.02 }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <h5 className="text-sm font-fredoka font-bold text-pink-700 mb-2 text-center truncate">
                      {pattern.name}
                    </h5>
                    <div
                      className="grid gap-1 p-1 bg-white border rounded mx-auto"
                      style={{
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 8px)`,
                        width: GRID_SIZE * 8 + 8,
                      }}
                    >
                      {pattern.grid.map((row, y) =>
                        row.map((cell, x) => (
                          <div
                            key={`${y}-${x}`}
                            className="w-1 h-1 border border-gray-200"
                            style={{
                              backgroundColor: cell ? pattern.color : 'transparent',
                            }}
                          />
                        ))
                      )}
                    </div>
                    <div className="flex justify-center mt-2">
                      <motion.button
                        className="text-xs bg-pink-500 text-white px-2 py-1 rounded font-nunito"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setGrid(pattern.grid.map(row => [...row]));
                          setSelectedColor(pattern.color);
                          setPatternName(pattern.name);
                          alert(`Pattern "${pattern.name}" loaded for editing!`);
                        }}
                      >
                        ✏️ Edit
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-xl border-2 border-orange-200"
          >
            <h4 className="text-lg font-fredoka font-bold text-orange-600 mb-2 text-center">
              🎯 How to Create Patterns
            </h4>
            <ul className="text-sm font-nunito text-orange-700 space-y-1">
              <li>• Click cells on the grid to fill/unfill</li>
              <li>• Hold mouse down to paint multiple cells</li>
              <li>• Choose your favorite color</li>
              <li>• Give it a name and save to your collection</li>
              <li>• Use patterns as reusable design elements!</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default PatternMaker;
