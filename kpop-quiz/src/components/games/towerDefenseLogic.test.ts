import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import {
  MAPS, COLS, ROWS, TICK_HZ, START_HEARTS, MAX_WAVES, QUESTIONS_PER_BREAK, FIRST_BREAK_QUESTIONS, TOWERS, ENEMIES,
  createWorld, step, startWave, runWave, posAt, pathCells, pathLength, spawnEnemy, enemyPos,
  placeTower, canPlace, upgradeTower, upgradeCost, sellTower, sellValue, pickTarget, applyAnswer,
  answerReward, waveSpawns, isBossWave, scoreOf, coverage, tileFree,
} from './towerDefenseLogic';
import type { World, TowerKind, Difficulty } from './towerDefenseLogic';

/** A world mid-wave with no spawns queued, so tests can place enemies by hand. */
function arena(mapId = 'meadow', coins = 10_000): World {
  const w = createWorld({ mapId, coins });
  startWave(w);
  w.queue = [];
  return w;
}

describe('maps', () => {
  it('every map has a connected road of straight segments that stays on the grid at the end', () => {
    for (const m of MAPS) {
      for (let i = 0; i < m.waypoints.length - 1; i++) {
        const a = m.waypoints[i], b = m.waypoints[i + 1];
        expect(a.x === b.x || a.y === b.y).toBe(true);
      }
      const end = m.waypoints[m.waypoints.length - 1];
      expect(end.x >= 0 && end.x < COLS && end.y >= 0 && end.y < ROWS).toBe(true);
      const cells = pathCells(m);
      expect(cells.size).toBeGreaterThan(20);
      // Room for plenty of towers.
      expect(COLS * ROWS - cells.size).toBeGreaterThan(50);
    }
  });

  it('posAt follows the waypoints', () => {
    const m = MAPS[0];
    expect(posAt(m, 0)).toEqual({ x: -0.5, y: 1.5 });
    expect(posAt(m, 10)).toEqual({ x: 9.5, y: 1.5 }); // first corner
    expect(posAt(m, 11.5)).toEqual({ x: 9.5, y: 3 });
    const end = m.waypoints[m.waypoints.length - 1];
    expect(posAt(m, pathLength(m) + 5)).toEqual({ x: end.x + 0.5, y: end.y + 0.5 });
  });
});

describe('path following', () => {
  it('an enemy walks the whole road and costs a heart at the end', () => {
    for (const m of MAPS) {
      const w = arena(m.id);
      const e = spawnEnemy(w, 'ladybird');
      e.hp = e.maxHp = 1e9; // can't be stopped
      let ticks = 0;
      while (w.enemies.length && ticks < 10_000) { step(w); ticks++; }
      expect(w.hearts).toBe(START_HEARTS - 1);
      expect(w.leaked).toBe(1);
      const expected = (w.length / ENEMIES.ladybird.speed) * TICK_HZ;
      expect(Math.abs(ticks - expected)).toBeLessThanOrEqual(2);
    }
  });

  it('the boss turtle costs 3 hearts', () => {
    const w = arena();
    spawnEnemy(w, 'turtle', w.length - 0.01);
    step(w);
    expect(w.hearts).toBe(START_HEARTS - 3);
  });
});

describe('targeting', () => {
  it('picks the enemy furthest along the road that is in range', () => {
    const w = arena();
    // Archer at (5,2): right under the first row of road (y = 1).
    const t = placeTower(w, 5, 2, 'archer')!;
    const behind = spawnEnemy(w, 'slug', 5); // x ≈ 4.5
    const ahead = spawnEnemy(w, 'slug', 7); // x ≈ 6.5
    spawnEnemy(w, 'slug', 9.9); // x ≈ 9.4 — out of range (2.5)
    expect(pickTarget(w, t)?.id).toBe(ahead.id);
    ahead.dist = 30; // far away now
    expect(pickTarget(w, t)?.id).toBe(behind.id);
  });

  it('a tower with no one in range does not shoot', () => {
    const w = arena();
    const t = placeTower(w, 0, 7, 'archer')!;
    spawnEnemy(w, 'slug', 20); // somewhere far
    step(w);
    expect(t.shots).toBe(0);
  });
});

describe('tower effects', () => {
  it('Bubble Blaster splash hits several enemies at once', () => {
    const w = arena();
    placeTower(w, 5, 2, 'bubble');
    const a = spawnEnemy(w, 'duck', 6);
    const b = spawnEnemy(w, 'duck', 6.4);
    const c = spawnEnemy(w, 'duck', 5.7);
    step(w);
    for (const e of [a, b, c]) expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('an Archer only hits one enemy', () => {
    const w = arena();
    placeTower(w, 5, 2, 'archer');
    const a = spawnEnemy(w, 'duck', 6);
    const b = spawnEnemy(w, 'duck', 6.4);
    step(w);
    expect([a, b].filter(e => e.hp < e.maxHp).length).toBe(1);
  });

  it('Freeze slows enemies down, and the slow wears off', () => {
    const w = arena();
    placeTower(w, 5, 2, 'freeze');
    const cold = spawnEnemy(w, 'duck', 5);
    cold.hp = cold.maxHp = 1e6;
    step(w); // move + get frozen
    const before = cold.dist;
    step(w);
    const slowedStep = cold.dist - before;
    const normalStep = ENEMIES.duck.speed / TICK_HZ;
    expect(slowedStep).toBeCloseTo(normalStep * (1 - TOWERS.freeze.levels[0].slow!), 5);
    // Walk away from the tower and wait for it to wear off.
    w.towers = [];
    for (let i = 0; i < 100; i++) step(w);
    const d0 = cold.dist;
    step(w);
    expect(cold.dist - d0).toBeCloseTo(normalStep, 5);
  });

  it('Zapper chains to nearby enemies', () => {
    const w = arena();
    placeTower(w, 5, 2, 'zapper');
    const es = [6, 5.2, 4.4, 3.6].map(d => spawnEnemy(w, 'duck', d));
    step(w);
    expect(es.filter(e => e.hp < e.maxHp).length).toBe(4);
  });

  it('popped enemies count as stopped and the score adds up', () => {
    const w = arena();
    placeTower(w, 5, 2, 'archer');
    const e = spawnEnemy(w, 'slug', 6);
    e.hp = 1;
    step(w);
    expect(w.stopped).toBe(1);
    expect(w.enemies.length).toBe(0);
    expect(w.events.some(ev => ev.type === 'pop')).toBe(true);
    expect(w.phase).toBe('build'); // wave 1 cleared
    expect(scoreOf(w)).toBe(101);
  });
});

describe('economy', () => {
  it('starts with no coins; coins only come from answers', () => {
    const w = createWorld();
    expect(w.coins).toBe(0);
    expect(placeTower(w, 5, 2, 'archer')).toBeNull();
    expect(w.towers.length).toBe(0);
    const gain = applyAnswer(w, true, 1000);
    expect(gain).toBeGreaterThanOrEqual(20);
    expect(w.coins).toBe(gain);
    expect(w.questionsLeft).toBe(FIRST_BREAK_QUESTIONS - 1);
  });

  it('rewards: fast and streaks pay more, wrong pays a little', () => {
    expect(answerReward(false, 1000, 0)).toBe(5);
    expect(answerReward(true, 0, 1)).toBe(30);
    expect(answerReward(true, 20_000, 1)).toBe(20);
    expect(answerReward(true, 20_000, 3)).toBe(30);
    expect(answerReward(true, 20_000, 10)).toBe(35); // streak bonus is capped
    const w = createWorld();
    applyAnswer(w, true, 20_000);
    applyAnswer(w, true, 20_000);
    applyAnswer(w, false, 20_000);
    expect(w.streak).toBe(0);
    expect(w.bestStreak).toBe(2);
    expect(w.coins).toBe(20 + 25 + 5);
  });

  it('runs out of questions until the next break', () => {
    const w = createWorld();
    for (let i = 0; i < FIRST_BREAK_QUESTIONS; i++) applyAnswer(w, true, 0);
    expect(applyAnswer(w, true, 0)).toBe(0);
    runWave(w); // no towers: everything leaks, but the break refills the questions
    expect(w.questionsLeft).toBe(QUESTIONS_PER_BREAK);
  });

  it("can't build on the road, on another tower, or without enough coins", () => {
    const w = createWorld({ coins: 120 });
    expect(canPlace(w, 3, 1, 'archer')).toBe(false); // road
    expect(placeTower(w, 5, 2, 'archer')).not.toBeNull();
    expect(canPlace(w, 5, 2, 'archer')).toBe(false); // taken
    expect(w.coins).toBe(70);
    expect(placeTower(w, 6, 2, 'bubble')).toBeNull(); // 80 > 70
    expect(placeTower(w, 6, 2, 'freeze')).not.toBeNull(); // 60
    expect(w.coins).toBe(10);
  });

  it('upgrades cost coins, stop at level 3, and selling refunds part of everything spent', () => {
    const w = createWorld({ coins: 1000 });
    const t = placeTower(w, 5, 2, 'archer')!;
    expect(upgradeCost(t)).toBe(TOWERS.archer.upgrades[0]);
    expect(upgradeTower(w, t.id)).toBe(true);
    expect(t.level).toBe(2);
    expect(upgradeTower(w, t.id)).toBe(true);
    expect(t.level).toBe(3);
    expect(upgradeCost(t)).toBeNull();
    expect(upgradeTower(w, t.id)).toBe(false);
    const spent = TOWERS.archer.cost + TOWERS.archer.upgrades[0] + TOWERS.archer.upgrades[1];
    expect(w.coins).toBe(1000 - spent);
    expect(sellValue(t)).toBe(Math.floor(spent * 0.7));
    const refund = sellTower(w, t.id);
    expect(refund).toBe(Math.floor(spent * 0.7));
    expect(w.coins).toBe(1000 - spent + refund);
    expect(w.towers.length).toBe(0);
    expect(tileFree(w, 5, 2)).toBe(true);
  });

  it("can't upgrade without enough coins", () => {
    const w = createWorld({ coins: 60 });
    const t = placeTower(w, 5, 2, 'archer')!;
    expect(upgradeTower(w, t.id)).toBe(false);
    expect(t.level).toBe(1);
    expect(w.coins).toBe(10);
  });
});

describe('waves', () => {
  it('a boss turtle comes every 5th wave, and only then', () => {
    for (let n = 1; n <= MAX_WAVES; n++) {
      const hasBoss = waveSpawns(n).some(s => s.kind === 'turtle');
      expect(hasBoss).toBe(isBossWave(n));
      expect(isBossWave(n)).toBe(n % 5 === 0);
    }
    expect(waveSpawns(10).filter(s => s.kind === 'turtle').length).toBe(2);
  });

  it('waves get bigger and spawn times are in order', () => {
    let last = 0;
    for (let n = 1; n <= MAX_WAVES; n++) {
      const s = waveSpawns(n);
      for (let i = 1; i < s.length; i++) expect(s[i].at).toBeGreaterThanOrEqual(s[i - 1].at);
      if (!isBossWave(n)) { expect(s.length).toBeGreaterThan(last); last = s.length; }
    }
    expect(waveSpawns(1).every(s => s.kind === 'slug')).toBe(true);
  });

  it('wave count goes up, and start only works between waves', () => {
    const w = createWorld();
    expect(startWave(w)).toBe(true);
    expect(w.wave).toBe(1);
    expect(startWave(w)).toBe(false);
    expect(w.wave).toBe(1);
  });

  it('a well-defended wave 1 loses no hearts (deterministic)', () => {
    const w = createWorld({ mapId: 'meadow', coins: 0 });
    for (let i = 0; i < 5; i++) applyAnswer(w, i < 4, 6000); // 4 of 5 right
    // Two archers covering the first stretch of road.
    expect(placeTower(w, 4, 2, 'archer')).not.toBeNull();
    expect(placeTower(w, 8, 2, 'archer')).not.toBeNull();
    runWave(w);
    expect(w.phase).toBe('build');
    expect(w.hearts).toBe(START_HEARTS);
    expect(w.cleared).toBe(1);
    expect(w.stopped).toBe(waveSpawns(1).length);
    expect(scoreOf(w)).toBe(100 + waveSpawns(1).length);
  });

  it('game over when the hearts run out', () => {
    const w = createWorld();
    let guard = 0;
    while (w.phase !== 'lost' && guard++ < 20) runWave(w);
    expect(w.phase).toBe('lost');
    expect(w.hearts).toBe(0);
    expect(startWave(w)).toBe(false);
    // Nothing moves after the game is over.
    const t = w.tick;
    step(w);
    expect(w.tick).toBe(t);
  });

  it('hearts never go below 0', () => {
    const w = arena();
    w.hearts = 2;
    spawnEnemy(w, 'turtle', w.length - 0.001);
    step(w);
    expect(w.hearts).toBe(0);
    expect(w.phase).toBe('lost');
  });
});

// ------------------------------------------------------------------ balance check

/**
 * A simple simulated player: answers every question in each break (`accuracy` right, ~6 s each),
 * then builds towers and upgrades them. `casual` picks any tile next to the road instead of the best one.
 */
function simulate(mapId: string, accuracy: number, difficulty: Difficulty, rng: Rng, casual = false) {
  const w = createWorld({ mapId, difficulty });
  const order: TowerKind[] = ['archer', 'archer', 'freeze', 'bubble', 'zapper', 'archer', 'bubble', 'zapper'];
  let next = 0;
  const spots = () => {
    const out: { x: number; y: number; c: number }[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (tileFree(w, x, y)) out.push({ x, y, c: coverage(w, x, y, 2.5) });
    if (casual) {
      const ok = out.filter(s => s.c >= 3);
      return ok.length ? [ok[Math.floor(rng() * ok.length)]] : out;
    }
    return out.sort((a, b) => b.c - a.c);
  };
  while (w.phase === 'build') {
    while (w.questionsLeft > 0) applyAnswer(w, rng() < accuracy, 4000 + rng() * 6000);
    for (;;) {
      const wantTowers = 2 + Math.ceil(w.wave * 0.6);
      if (w.towers.length < wantTowers) {
        const kind = order[next % order.length];
        if (w.coins < TOWERS[kind].cost) break;
        const s = spots()[0];
        placeTower(w, s.x, s.y, kind);
        next++;
      } else {
        const up = w.towers.filter(t => upgradeCost(t) !== null).sort((a, b) => upgradeCost(a)! - upgradeCost(b)!)[0];
        if (!up || w.coins < upgradeCost(up)!) {
          const kind = order[next % order.length];
          const s = spots()[0];
          if (!s || !placeTower(w, s.x, s.y, kind)) break;
          next++;
          continue;
        }
        upgradeTower(w, up.id);
      }
    }
    runWave(w);
  }
  return w;
}

describe('balance (simulated kid)', () => {
  const runs = (accuracy: number, difficulty: Difficulty = 'normal', casual = false) => {
    const out: { map: string; cleared: number; hearts: number }[] = [];
    for (const m of MAPS) for (let seed = 1; seed <= 4; seed++) {
      const w = simulate(m.id, accuracy, difficulty, createRng(seed * 7919), casual);
      out.push({ map: m.id, cleared: w.cleared, hearts: w.hearts });
    }
    return out;
  };
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('a kid answering ~70% right reaches wave 10 on normal, but winning all 15 is not a given', () => {
    const r70 = runs(0.7);
    const r40 = runs(0.4);
    const r95 = runs(0.95);
    const r70easy = runs(0.7, 'easy');
    const r70hard = runs(0.7, 'hard');
    const r70casual = runs(0.7, 'normal', true);
    const summary = (r: typeof r70) => `avg ${avg(r.map(x => x.cleared)).toFixed(1)} min ${Math.min(...r.map(x => x.cleared))} max ${Math.max(...r.map(x => x.cleared))}`;
    console.log(`[balance] waves cleared — 40%: ${summary(r40)} | 70%: ${summary(r70)} | 95%: ${summary(r95)} | 70% easy: ${summary(r70easy)} | 70% hard: ${summary(r70hard)} | 70% casual builder: ${summary(r70casual)}`);
    expect(Math.min(...r70.map(x => x.cleared))).toBeGreaterThanOrEqual(10);
    expect(avg(r95.map(x => x.cleared))).toBeGreaterThanOrEqual(avg(r70.map(x => x.cleared)));
    expect(avg(r40.map(x => x.cleared))).toBeLessThan(avg(r95.map(x => x.cleared)));
    // Even with so-so tower spots, 70% right gets near wave 10 on average.
    expect(avg(r70casual.map(x => x.cleared))).toBeGreaterThanOrEqual(9);
    // Hard with 70% should not be a guaranteed full win.
    expect(r70hard.some(x => x.cleared < MAX_WAVES)).toBe(true);
  });
});

// Keep enemyPos exercised (used by the renderer).
it('enemyPos interpolates between ticks', () => {
  const w = arena();
  const e = spawnEnemy(w, 'slug', 2);
  e.prevDist = 1;
  expect(enemyPos(w, e, 0.5)).toEqual(posAt(w.map, 1.5));
});
