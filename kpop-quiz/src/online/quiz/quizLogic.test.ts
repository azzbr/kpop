import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { mc, tf, typed, ordered } from '../../data/quiz/types';
import type { QuizQuestion } from '../../data/quiz/types';
import {
  newPlayer, matchTyped, isCorrect, classicPoints, scoreAnswer, rollChests, openChest, buyUpgrade,
  cashEarn, raceGoal, rankPlayers, teamResults, prepare, publicQuestion, toOriginal, correctText, assignTeams,
} from './quizLogic';
import type { QPlayer, Chest } from './quizLogic';

const LIMIT = 20000;

describe('typed answers', () => {
  it('ignores case, punctuation and "the"', () => {
    expect(matchTyped('  the PACIFIC ocean!! ', ['Pacific Ocean'])).toBe(true);
    expect(matchTyped('mount everest', ['Mount Everest'])).toBe(true);
  });
  it('allows one typo on longer words but not short ones', () => {
    expect(matchTyped('jupitor', ['Jupiter'])).toBe(true);
    expect(matchTyped('mars', ['Mars'])).toBe(true);
    expect(matchTyped('mors', ['Mars'])).toBe(false);
    expect(matchTyped('saturn', ['Jupiter'])).toBe(false);
  });
  it('accepts alternative answers and spacing differences', () => {
    expect(matchTyped('tyrannosaurus', ['T-Rex', 'Tyrannosaurus'])).toBe(true);
    expect(matchTyped('icecream', ['ice cream'])).toBe(true);
  });
  it('rejects empty input', () => {
    expect(matchTyped('   ', ['Paris'])).toBe(false);
  });
});

describe('isCorrect', () => {
  it('handles every question type', () => {
    expect(isCorrect(mc('Q', 'A', ['B', 'C', 'D']), { choice: 0 })).toBe(true);
    expect(isCorrect(mc('Q', 'A', ['B', 'C', 'D']), { choice: 2 })).toBe(false);
    expect(isCorrect(tf('Q', false), { choice: 1 })).toBe(true);
    expect(isCorrect(typed('Q', ['Paris']), { text: 'paris' })).toBe(true);
    expect(isCorrect(ordered('Q', ['a', 'b', 'c']), { order: [0, 1, 2] })).toBe(true);
    expect(isCorrect(ordered('Q', ['a', 'b', 'c']), { order: [1, 0, 2] })).toBe(false);
    expect(isCorrect({ type: 'poll', text: 'Fav?', options: ['x', 'y'] }, { choice: 1 })).toBe(null);
    expect(isCorrect(mc('Q', 'A', ['B', 'C', 'D']), undefined)).toBe(false);
  });
});

describe('classic scoring', () => {
  it('gives 500–1000 for speed and nothing for wrong', () => {
    expect(classicPoints(true, 0, LIMIT, 1)).toBe(1000);
    expect(classicPoints(true, LIMIT, LIMIT, 1)).toBe(500);
    expect(classicPoints(true, LIMIT / 2, LIMIT, 1)).toBe(750);
    expect(classicPoints(false, 0, LIMIT, 0)).toBe(0);
  });
  it('adds a capped streak bonus', () => {
    expect(classicPoints(true, LIMIT, LIMIT, 2)).toBe(600);
    expect(classicPoints(true, LIMIT, LIMIT, 20)).toBe(1000);
  });
  it('builds streaks and resets them on a wrong answer', () => {
    const q = mc('Q', 'A', ['B', 'C', 'D']);
    let p = newPlayer('a', 'A', '😀');
    p = scoreAnswer('classic', p, q, { choice: 0 }, 1000, LIMIT, 1, 10);
    p = scoreAnswer('classic', p, q, { choice: 0 }, 1000, LIMIT, 2, 10);
    expect(p.streak).toBe(2);
    expect(p.bestStreak).toBe(2);
    p = scoreAnswer('classic', p, q, { choice: 3 }, 1000, LIMIT, 3, 10);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(p.correct).toBe(2);
    expect(p.answered).toBe(3);
    expect(p.fastestMs).toBe(1000);
  });
  it('a missing answer counts as wrong', () => {
    const p = scoreAnswer('classic', newPlayer('a', 'A', '😀'), mc('Q', 'A', ['B', 'C', 'D']), undefined, 0, LIMIT, 1, 10);
    expect(p.score).toBe(0);
    expect(p.lastCorrect).toBe(false);
  });
});

describe('racing', () => {
  it('moves 1 for right, 2 for fast, and stops at the finish', () => {
    const q = tf('Q', true);
    let p = newPlayer('a', 'A', '🚗');
    p = scoreAnswer('racing', p, q, { choice: 0 }, LIMIT - 1, LIMIT, 1, 4);
    expect(p.pos).toBe(1);
    p = scoreAnswer('racing', p, q, { choice: 0 }, 100, LIMIT, 2, 4);
    expect(p.pos).toBe(raceGoal(4)); // goal for 4 questions is 3
    expect(p.finishedAt).toBe(2);
    p = scoreAnswer('racing', p, q, { choice: 0 }, 100, LIMIT, 3, 4);
    expect(p.pos).toBe(raceGoal(4));
  });
  it('ranks finishers by who finished first', () => {
    const a = { ...newPlayer('a', 'A', '🚗'), pos: 3, finishedAt: 5 };
    const b = { ...newPlayer('b', 'B', '🚙'), pos: 3, finishedAt: 4 };
    const c = { ...newPlayer('c', 'C', '🏎️'), pos: 2 };
    expect(rankPlayers('racing', [a, b, c]).map(p => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('gold quest chests', () => {
  const mk = (gold: Record<string, number>): Record<string, QPlayer> =>
    Object.fromEntries(Object.entries(gold).map(([id, g]) => [id, { ...newPlayer(id, id, '🙂'), gold: g }]));
  const chest = (kind: Chest['kind'], amount: number): Chest => ({ kind, amount, label: '', emoji: '' });

  it('rolls three valid chests deterministically', () => {
    const a = rollChests(createRng(5));
    const b = rollChests(createRng(5));
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
  });
  it('applies gold, double, triple and lose', () => {
    expect(openChest(mk({ a: 10 }), 'a', chest('gold', 25)).a.gold).toBe(35);
    expect(openChest(mk({ a: 10 }), 'a', chest('double', 2)).a.gold).toBe(20);
    expect(openChest(mk({ a: 10 }), 'a', chest('triple', 3)).a.gold).toBe(30);
    expect(openChest(mk({ a: 100 }), 'a', chest('lose', 25)).a.gold).toBe(75);
  });
  it('steals a percentage from the chosen player', () => {
    const r = openChest(mk({ a: 10, b: 100 }), 'a', chest('steal', 20), 'b');
    expect(r.a.gold).toBe(30);
    expect(r.b.gold).toBe(80);
  });
  it('swaps gold with the chosen player', () => {
    const r = openChest(mk({ a: 10, b: 100 }), 'a', chest('swap', 0), 'b');
    expect(r.a.gold).toBe(100);
    expect(r.b.gold).toBe(10);
  });
  it('steal/swap without a valid target does nothing', () => {
    const before = mk({ a: 10, b: 100 });
    expect(openChest(before, 'a', chest('steal', 20)).a.gold).toBe(10);
    expect(openChest(before, 'a', chest('swap', 0), 'a').a.gold).toBe(10);
  });
  it('gold never goes negative', () => {
    expect(openChest(mk({ a: 0 }), 'a', chest('lose', 25)).a.gold).toBe(0);
  });
  it('roughly matches the intended odds over many rolls', () => {
    const rng = createRng(9);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) for (const c of rollChests(rng)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    expect(counts.gold / 9000).toBeGreaterThan(0.38);
    expect(counts.swap / 9000).toBeLessThan(0.06);
  });
});

describe('cash climb', () => {
  it('earns more with upgrades and streaks', () => {
    const p = newPlayer('a', 'A', '💵');
    expect(cashEarn(p)).toBe(50);
    expect(cashEarn({ ...p, upgrades: { mult: 1, streak: 0, insurance: 0 } })).toBe(100);
    expect(cashEarn({ ...p, streak: 3, upgrades: { mult: 0, streak: 1, insurance: 0 } })).toBe(50 + 60);
  });
  it('wrong answers cost money, insurance reduces it, and it never goes below 0', () => {
    const q = tf('Q', true);
    const rich = { ...newPlayer('a', 'A', '💵'), cash: 1000 };
    expect(scoreAnswer('cash', rich, q, { choice: 1 }, 0, LIMIT, 1, 10).cash).toBe(975);
    const insured = { ...rich, upgrades: { mult: 0, streak: 0, insurance: 3 } };
    expect(scoreAnswer('cash', insured, q, { choice: 1 }, 0, LIMIT, 1, 10).cash).toBe(1000);
    const broke = newPlayer('b', 'B', '💵');
    expect(scoreAnswer('cash', broke, q, { choice: 1 }, 0, LIMIT, 1, 10).cash).toBe(0);
  });
  it('buys upgrades only when affordable and not maxed', () => {
    const p = { ...newPlayer('a', 'A', '💵'), cash: 160 };
    const bought = buyUpgrade(p, 'mult');
    expect(bought?.upgrades.mult).toBe(1);
    expect(bought?.cash).toBe(10);
    expect(buyUpgrade(bought!, 'mult')).toBeNull();
    const maxed = { ...p, cash: 1e9, upgrades: { mult: 4, streak: 0, insurance: 0 } };
    expect(buyUpgrade(maxed, 'mult')).toBeNull();
  });
});

describe('teams', () => {
  it('splits evenly and averages scores', () => {
    const t = assignTeams(['a', 'b', 'c', 'd', 'e'], 2);
    expect(Object.values(t).filter(x => x === 0)).toHaveLength(3);
    const players = [
      { ...newPlayer('a', 'A', '1'), team: 0, score: 1000 },
      { ...newPlayer('b', 'B', '2'), team: 0, score: 0 },
      { ...newPlayer('c', 'C', '3'), team: 1, score: 600 },
    ];
    expect(teamResults('classic', players)).toEqual([
      { team: 1, members: 1, avg: 600 },
      { team: 0, members: 2, avg: 500 },
    ]);
  });
});

describe('question prep', () => {
  it('shuffles choice options and maps answers back', () => {
    const q: QuizQuestion = mc('Capital of France?', 'Paris', ['Rome', 'Madrid', 'Berlin']);
    const p = prepare(q, createRng(3));
    const pub = publicQuestion(p);
    const shownIdx = pub.options!.indexOf('Paris');
    expect(isCorrect(q, toOriginal(p, { choice: shownIdx }))).toBe(true);
    expect(JSON.stringify(pub)).not.toContain('"correct"');
  });
  it('never shows an order question already solved', () => {
    for (let s = 0; s < 50; s++) {
      const p = prepare(ordered('Q', ['a', 'b', 'c']), createRng(s));
      expect(p.display).not.toEqual([0, 1, 2]);
    }
  });
  it('maps an order answer from display positions back to the right order', () => {
    const q = ordered('Small → big', ['ant', 'cat', 'whale']);
    const p = prepare(q, createRng(1));
    // The player taps the shown items in the correct order:
    const tapOrder = [0, 1, 2].map(orig => p.display.indexOf(orig));
    expect(isCorrect(q, toOriginal(p, { order: tapOrder }))).toBe(true);
  });
  it('keeps True before False', () => {
    expect(publicQuestion(prepare(tf('Q', false), createRng(2))).options).toEqual(['True', 'False']);
  });
  it('gives readable correct answers', () => {
    expect(correctText(ordered('Q', ['a', 'b']))).toBe('a → b');
    expect(correctText(typed('Q', ['Paris', 'paris']))).toBe('Paris');
  });
});
