import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  createWorld, step, spawnAt, moveSnake, rebuildHash, addFood, angleDiff, turnRateOf, segCountOf, radiusOf, leaderboard,
  BASE_SPEED, BOOST_SPEED, MIN_LEN, START_LEN, WORLD_R, RESPAWN_TICKS, TICK_HZ, BOT_APPETITE,
} from './snakeArenaLogic';
import type { SnakeWorld, Snake } from './snakeArenaLogic';

/** A world with no food and every snake parked out of play, so tests set things up by hand. */
function emptyWorld(bots = 2): SnakeWorld {
  const w = createWorld({ rng: createRng(1), bots, foodCount: 0 });
  w.food = [];
  for (const s of w.snakes) { s.alive = false; s.isHuman = true; } // isHuman: no AI, no respawn
  return w;
}

function park(w: SnakeWorld, s: Snake, x: number, y: number, angle: number, len = START_LEN) {
  spawnAt(s, x, y, angle, len);
  rebuildHash(w);
}

/** Natural food keeps respawning; stop that so length changes are easy to read. */
function stepNoFood(w: SnakeWorld, n = 1) {
  for (let i = 0; i < n; i++) {
    step(w);
    w.food = w.food.filter(f => f.big || f.color === '__keep');
  }
}

describe('movement and turning', () => {
  it('moves forward at the base speed', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    stepNoFood(w, 10);
    expect(s.segs[0].x).toBeCloseTo(BASE_SPEED * 10, 5);
    expect(s.segs[0].y).toBeCloseTo(0, 5);
  });

  it('turns towards the target angle no faster than the turn rate', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    s.input.angle = Math.PI / 2;
    const rate = turnRateOf(s.len);
    stepNoFood(w, 1);
    expect(s.angle).toBeCloseTo(rate, 6);
    stepNoFood(w, 40);
    expect(Math.abs(angleDiff(s.angle, Math.PI / 2))).toBeLessThan(1e-6); // reached it and stopped turning
  });

  it('takes the short way round', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0.1);
    s.input.angle = -0.3; // just to the left: should turn negative, not all the way round
    stepNoFood(w, 1);
    expect(s.angle).toBeLessThan(0.1);
  });

  it('keyboard turning overrides the finger angle', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    s.input.angle = -1;
    s.input.turn = 1;
    stepNoFood(w, 3);
    expect(s.angle).toBeCloseTo(3 * turnRateOf(s.len), 6);
  });

  it('longer snakes turn slower and are thicker', () => {
    expect(turnRateOf(300)).toBeLessThan(turnRateOf(START_LEN));
    expect(radiusOf(300)).toBeGreaterThan(radiusOf(START_LEN));
  });

  it('the body follows the head with even spacing', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    s.input.angle = 2;
    stepNoFood(w, 60);
    for (let i = 1; i < s.segs.length; i++) {
      const d = Math.hypot(s.segs[i].x - s.segs[i - 1].x, s.segs[i].y - s.segs[i - 1].y);
      expect(d).toBeLessThanOrEqual(radiusOf(s.len) * 0.45 + 1e-6);
    }
  });

  it('keeps the previous position for interpolation', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    stepNoFood(w, 1);
    expect(s.segs[0].x - s.segs[0].px).toBeCloseTo(BASE_SPEED, 6);
  });
});

describe('eating', () => {
  it('eating a dot makes the snake longer and removes the dot', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    addFood(w, 15, 0, 3, 5, '__keep', false);
    const before = s.len;
    const segsBefore = s.segs.length;
    step(w);
    expect(s.len).toBeCloseTo(before + 3, 6);
    expect(s.maxLen).toBeCloseTo(before + 3, 6);
    expect(w.food.some(f => f.color === '__keep')).toBe(false);
    expect(w.events.some(e => e.type === 'eat' && e.snakeId === 1)).toBe(true);
    step(w);
    expect(s.segs.length).toBe(segCountOf(s.len));
    expect(s.segs.length).toBeGreaterThan(segsBefore);
  });

  it('does not eat food that is far away', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    addFood(w, 0, 300, 3, 5, '__keep', false);
    step(w);
    expect(s.len).toBe(START_LEN);
  });

  it('bots grow a little slower than the player', () => {
    expect(BOT_APPETITE).toBeLessThan(1);
    expect(BOT_APPETITE).toBeGreaterThan(0.4);
  });
});

describe('knock-outs', () => {
  it('a head that touches another body is out, and the body becomes big food', () => {
    const w = emptyWorld(1);
    const [me, bot] = w.snakes;
    // Bot's body lies across the player's path (bot heading away); the player drives into its middle.
    park(w, bot, 100, -60, -Math.PI / 2, 40);
    park(w, me, 40, 0, 0);
    let ticks = 0;
    while (me.alive && ticks < 60) { stepNoFood(w); ticks++; }
    expect(me.alive).toBe(false);
    expect(me.deathCause).toBe('snake');
    expect(me.killedBy).toBe(bot.id);
    expect(bot.alive).toBe(true);
    expect(bot.kills).toBe(1);
    const big = w.food.filter(f => f.big && f.color === me.color);
    expect(big.length).toBeGreaterThanOrEqual(4);
    const total = big.reduce((t, f) => t + f.value, 0);
    expect(total).toBeGreaterThanOrEqual(START_LEN * 0.5 - 1e-6);
    // The food lies along where the body was.
    for (const f of big) expect(Math.hypot(f.x - me.segs[0].x, f.y - me.segs[0].y)).toBeLessThan(200);
  });

  it('crossing your own body is safe', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0, 80);
    s.input.turn = 1; // tight circle through its own body
    stepNoFood(w, 200);
    expect(s.alive).toBe(true);
  });

  it('touching the wall knocks you out', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, WORLD_R - 30, 0, 0);
    stepNoFood(w, 10);
    expect(s.alive).toBe(false);
    expect(s.deathCause).toBe('wall');
  });

  it('bots respawn after 3 seconds; the human does not', () => {
    const w = createWorld({ rng: createRng(4), bots: 2 });
    const bot = w.snakes[1];
    const me = w.snakes[0];
    bot.alive = false;
    bot.respawnAt = w.tick + RESPAWN_TICKS;
    me.alive = false;
    me.respawnAt = 0;
    for (let i = 0; i < RESPAWN_TICKS - 1; i++) step(w);
    expect(bot.alive).toBe(false);
    step(w);
    expect(bot.alive).toBe(true);
    expect(RESPAWN_TICKS).toBe(3 * TICK_HZ);
    expect(me.alive).toBe(false);
  });
});

describe('boost', () => {
  it('goes faster and costs length', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0, 40);
    s.input.boost = true;
    for (let i = 0; i < 10; i++) step(w);
    expect(s.boosting).toBe(true);
    expect(s.segs[0].x).toBeCloseTo(BOOST_SPEED * 10, 5);
    expect(s.len).toBeLessThan(40);
    // Some food in the snake's colour is dropped behind it.
    expect(w.food.filter(f => f.color === s.color).length).toBeGreaterThan(0);
  });

  it('never shrinks below the minimum length, and stops boosting there', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0, MIN_LEN + 2);
    s.input.boost = true;
    stepNoFood(w, 200);
    expect(s.len).toBeGreaterThanOrEqual(MIN_LEN);
    expect(s.boosting).toBe(false);
    const x = s.segs[0].x;
    stepNoFood(w, 1);
    expect(s.segs[0].x - x).toBeCloseTo(BASE_SPEED, 5);
  });

  it('max length remembers the peak even after boosting', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0, 30);
    s.maxLen = 30;
    s.input.boost = true;
    stepNoFood(w, 30);
    expect(s.len).toBeLessThan(30);
    expect(s.maxLen).toBe(30);
  });
});

describe('bots', () => {
  function run(seed: number, ticks: number) {
    const w = createWorld({ rng: createRng(seed) });
    const me = w.snakes[0];
    let botDeaths = 0;
    for (let i = 0; i < ticks; i++) {
      // Keep the player circling safely so the bots have someone to chase.
      if (me.alive) { const h = me.segs[0]; me.input.angle = Math.atan2(-h.y, -h.x) + 1.3; }
      step(w);
      for (const e of w.events) if (e.type === 'death' && e.snakeId !== 1) botDeaths++;
    }
    return { w, botDeaths };
  }

  it('rarely hit the wall over a long run (5 minutes of play)', () => {
    let wall = 0;
    for (const seed of [1, 2, 3]) wall += run(seed, 5 * 60 * TICK_HZ).w.wallDeaths;
    expect(wall).toBeLessThanOrEqual(3); // 18 bot-runs of 5 minutes
  });

  it('eat and grow, and stay inside the world', () => {
    const { w } = run(7, 60 * TICK_HZ);
    const bots = w.snakes.slice(1);
    expect(Math.max(...bots.map(b => b.maxLen))).toBeGreaterThan(START_LEN + 20);
    for (const b of bots) if (b.alive) expect(Math.hypot(b.segs[0].x, b.segs[0].y)).toBeLessThan(WORLD_R);
  });

  it('avoid bodies ahead most of the time', () => {
    const { botDeaths } = run(5, 2 * 60 * TICK_HZ);
    expect(botDeaths).toBeLessThan(15); // 6 bots × 2 minutes
  });

  it.each([true, false])('a bot steers away from a body right in front of it (AI on: %s)', (ai) => {
    const w = emptyWorld(1);
    const [wall, bot] = w.snakes;
    bot.isHuman = !ai; // with the AI off it drives straight on, proving the setup really is a crash course
    // A long "wall" snake lying across the bot's path.
    park(w, wall, 0, 300, Math.PI / 2, 150);
    park(w, bot, -120, 0, 0);
    for (let i = 0; i < 40; i++) {
      // Freeze the wall snake in place.
      wall.input = { angle: null, turn: 0, boost: false };
      const saved = wall.segs.map(g => ({ ...g }));
      step(w);
      wall.segs = saved;
      rebuildHash(w);
      w.food = [];
    }
    expect(bot.alive).toBe(ai);
  });
});

describe('determinism and helpers', () => {
  it('the same seed plays the same game', () => {
    const play = () => {
      const w = createWorld({ rng: createRng(123) });
      for (let i = 0; i < 600; i++) { w.snakes[0].input.angle = i * 0.01; step(w); }
      return JSON.stringify(w.snakes.map(s => [s.alive, s.len.toFixed(3), s.segs[0].x.toFixed(3), s.segs[0].y.toFixed(3)]));
    };
    expect(play()).toBe(play());
  });

  it('starts with 7 snakes, the player in the middle, and lots of food', () => {
    const w = createWorld({ rng: createRng(9), humanEmoji: '🐲', humanColor: '#123456' });
    expect(w.snakes).toHaveLength(7);
    expect(w.snakes.every(s => s.alive)).toBe(true);
    expect(w.snakes[0].emoji).toBe('🐲');
    expect(w.snakes[0].color).toBe('#123456');
    expect(Math.hypot(w.snakes[0].segs[0].x, w.snakes[0].segs[0].y)).toBeLessThan(1);
    expect(w.food.length).toBeGreaterThan(500);
  });

  it('leaderboard is sorted by length', () => {
    const w = createWorld({ rng: createRng(2) });
    w.snakes[3].len = 99;
    const lb = leaderboard(w);
    expect(lb[0].id).toBe(4);
    for (let i = 1; i < lb.length; i++) expect(lb[i - 1].len).toBeGreaterThanOrEqual(lb[i].len);
  });

  it('angleDiff wraps around', () => {
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2, 6);
    expect(angleDiff(-3, 3)).toBeCloseTo(Math.PI * 2 - 6, 6);
  });

  it('moveSnake grows the body by one segment per unit of length', () => {
    const w = emptyWorld(0);
    const s = w.snakes[0];
    park(w, s, 0, 0, 0);
    s.len += 5;
    moveSnake(w, s);
    expect(s.segs.length).toBe(segCountOf(START_LEN + 5));
  });
});
