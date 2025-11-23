import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store';

// Official Chrome Dino Run adaptation

const KPopRushGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setGameState } = useGameStore();

  /*--------- Dino Game Code from Chromium (simplified adaptation) ---------*/
  let canvas: HTMLCanvasElement | null, ctx: CanvasRenderingContext2D | null, ground, player: any, obstacles: any[] = [], collectibles: any[] = [];
  let score = 0, highScore = 0, speed = 6, gravity = 0.6, jumpPower = -15;
  let jumping = false, groundY = 400, running = false;
  let frameCount = 0, speedIncrement = 0.0001; // Very gradual

  function createPlayer() {
    return { x: 100, y: groundY - 40, w: 40, h: 40, vy: 0, emoji: '🐻' };
  }

  function jump() {
    if (!running) startGame();
    if (!jumping) {
      player.vy = jumpPower;
      jumping = true;
    }
  }

  function startGame() {
    running = true;
    score = 0;
    obstacles = [];
    collectibles = [];
    player = createPlayer();
    speed = 6;
    frameCount = 0;
  }

  function update() {
    // Physics
    player.vy += gravity;
    player.y += player.vy;

    if (player.y >= groundY - 40) {
      player.y = groundY - 40;
      jumping = false;
      player.vy = 0;
    }

    // Speed increment (proper Dino style)
    speed += speedIncrement;
    if (speed > 13) speed = 13;

    // Move obstacles
    obstacles.forEach(obs => obs.x -= speed);
    obstacles = obstacles.filter(obs => obs.x > -50);

    // Move collectibles
    collectibles.forEach(col => col.x -= speed);
    collectibles = collectibles.filter(col => col.x > -50 && !col.collected);

    // Spawn obstacles
    if (frameCount % 120 === 0) {
      obstacles.push({
        x: 800,
        y: groundY - 40,
        w: 40,
        h: 40,
        type: 'cactus'
      });
    }

    // Spawn power-ups
    if (frameCount % 300 === 0) {
      collectibles.push({
        x: 800,
        y: groundY - 80,
        w: 30,
        h: 30,
        collected: false
      });
    }

    // Collision
    obstacles.forEach(obs => {
      if (player.x < obs.x + obs.w &&
          player.x + player.w > obs.x &&
          player.y < obs.y + obs.h &&
          player.y + player.h > obs.y) {
        running = false;
        if (score > highScore) highScore = score;
      }
    });

    // Collect
    collectibles.forEach(col => {
      if (!col.collected &&
          player.x < col.x + col.w &&
          player.x + player.w > col.x &&
          player.y < col.y + col.h &&
          player.y + player.h > col.y) {
        col.collected = true;
        score += 10;
      }
    });

    frameCount++;
    score += 0.01; // Increment score
  }

  function draw() {
    if (!ctx || !player) return;
    ctx.clearRect(0, 0, 800, 400);

    // Sky
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, 800, 400);

    // Ground
    ctx.fillStyle = '#535353';
    ctx.fillRect(0, groundY - 10, 800, 10);

    // Player
    ctx.font = '40px Arial';
    ctx.fillText(player.emoji, player.x, player.y + 35);

    // Obstacles (cactus)
    obstacles.forEach(obs => {
      ctx.font = '40px Arial';
      ctx.fillText('🌵', obs.x, obs.y + 35);
    });

    // Collectibles
    collectibles.forEach(col => {
      if (!col.collected) {
        ctx.font = '30px Arial';
        ctx.fillText('🍗', col.x, col.y + 30);
      }
    });

    // UI
    ctx.fillStyle = '#000';
    ctx.font = '24px Arial';
    ctx.fillText("Score: " + Math.floor(score), 10, 30);
    ctx.fillText("High: " + Math.floor(highScore), 10, 60);

    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 800, 400);
      ctx.fillStyle = '#fff';
      ctx.font = '36px Arial';
      ctx.fillText("Press Space to Restart", 200, 200);
    }
  }

  function gameLoop() {
    if (running) {
      update();
    }
    draw();
    requestAnimationFrame(gameLoop);
  }

  useEffect(() => {
    canvas = canvasRef.current;
    if (canvas) {
      ctx = canvas.getContext('2d');
      player = createPlayer();

      const handleKey = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault();
          jump();
        }
      };
      window.addEventListener('keydown', handleKey);

      // Start loop
      gameLoop();

      return () => window.removeEventListener('keydown', handleKey);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-blue-600">🐻 K-Pop Duo</h1>
        <p>Official Chrome Dino Run Clone - Use Space to Jump!</p>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="bg-white border-2 border-gray-300 rounded-lg shadow-lg"
      />

      <button
        onClick={() => setGameState('welcome')}
        className="mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold"
      >
        ◀ Back to Menu
      </button>
    </div>
  );
};

export default KPopRushGame;
