import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface DrawingCanvasProps {
  onDrawingChange?: (hasDrawing: boolean) => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onDrawingChange }) => {
  const { incrementDrawingsCreated } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#FF6B9D');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [lastDrawStart, setLastDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);

  const colors = [
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

  const brushSizes = [3, 5, 8, 12, 16];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state
    saveState();
  }, []);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);

    onDrawingChange?.(true);
  }, [history, historyStep, onDrawingChange]);

  const restoreState = useCallback((imageData: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(imageData, 0, 0);
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.strokeStyle = isEraser ? 'white' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [isDrawing, color, brushSize, isEraser]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveState();
    // Track drawing creation for stats
    incrementDrawingsCreated();
  }, [isDrawing, saveState, incrementDrawingsCreated]);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    startDrawing(mouseEvent);
  }, [startDrawing]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    draw(mouseEvent);
  }, [draw]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopDrawing();
  }, [stopDrawing]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  }, [saveState]);

  const undo = useCallback(() => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      restoreState(history[newStep]);
    }
  }, [history, historyStep, restoreState]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      restoreState(history[newStep]);
    }
  }, [history, historyStep, restoreState]);

  const handleCustomColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    setIsEraser(false);

    // Add to custom colors if not already there (up to 6 colors)
    setCustomColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== newColor.toLowerCase());
      const newCustomColors = [newColor, ...filtered].slice(0, 6);
      return newCustomColors;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Drawing Canvas */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full h-80 border-4 border-purple-300 rounded-2xl bg-white shadow-lg cursor-crosshair"
          style={{ touchAction: 'none' }}
        />

        {/* Canvas Border Animation */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(168, 85, 247, 0.7)',
              '0 0 0 4px rgba(168, 85, 247, 0)',
              '0 0 0 0 rgba(168, 85, 247, 0.7)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
        />
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col space-y-4 bg-pink-50 p-4 rounded-xl border-2 border-pink-200"
      >
        {/* Color Palette */}
        <div>
          <h4 className="text-sm font-fredoka font-bold text-pink-700 mb-3">🎨 Colors</h4>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <motion.button
                key={c}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c && !isEraser ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-300'
                }`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>

          {/* Custom Color Picker */}
          <div className="mt-3">
            <input
              type="color"
              value={color}
              onChange={handleCustomColorChange}
              className="w-10 h-8 rounded-full border-2 border-gray-300 cursor-pointer"
              title="🎨 Pick any color!"
            />
            <span className="ml-2 text-sm font-nunito text-pink-600">🌈 Custom Color</span>
          </div>

          {/* Recent Custom Colors */}
          {customColors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-nunito text-pink-600 mb-1">Your Colors:</p>
              <div className="flex flex-wrap gap-1">
                {customColors.map((customColor) => (
                  <motion.button
                    key={customColor}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setColor(customColor);
                      setIsEraser(false);
                    }}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === customColor && !isEraser ? 'border-purple-500 ring-1 ring-purple-300' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: customColor }}
                    title={`Custom Color: ${customColor}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Brush Sizes */}
        <div>
          <h4 className="text-sm font-fredoka font-bold text-pink-700 mb-3">✏️ Brush Size</h4>
          <div className="flex items-center gap-2">
            {brushSizes.map((size) => (
              <motion.button
                key={size}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setBrushSize(size)}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                  brushSize === size && !isEraser ? 'border-purple-500 bg-purple-100' : 'border-pink-300 bg-white'
                }`}
              >
                <div
                  className="rounded-full bg-pink-500"
                  style={{ width: size * 0.3, height: size * 0.3 }}
                />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <h4 className="text-sm font-fredoka font-bold text-pink-700 mb-3">🔧 Tools</h4>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEraser(false)}
              className={`px-4 py-2 rounded-lg font-fredoka font-semibold text-sm ${
                !isEraser ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              ✏️ Draw
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEraser(true)}
              className={`px-4 py-2 rounded-lg font-fredoka font-semibold text-sm ${
                isEraser ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              🧼 Erase
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={undo}
              disabled={historyStep <= 0}
              className={`px-4 py-2 rounded-lg font-fredoka font-semibold text-sm ${
                historyStep > 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ↶ Undo
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className={`px-4 py-2 rounded-lg font-fredoka font-semibold text-sm ${
                historyStep < history.length - 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ↷ Redo
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearCanvas}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-fredoka font-semibold text-sm hover:bg-red-600"
            >
              🗑️ Clear
            </motion.button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-xs text-pink-600 font-nunito">
            💡 Tip: Click and drag to draw! Use 🌈 Custom Color for unlimited colors!
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default DrawingCanvas;
