import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore, STAR_COINS } from './store';
import { gameOfTheWeek } from './utils/weeklyGame';
import { challengeFor } from './utils/dailyChallenge';
import { MASTERY, MASTERY_IDS } from './data/mastery';
import { GAME_BADGES } from './data/gameBadges';

// Rewards from finishRound: game of the week (2×) and mastery-star coins.
const DAY = '2026-11-04';

function fresh() {
  // Every badge already earned and the daily challenge already done, so only the new rules pay.
  useGameStore.setState({
    xp: 0, userCurrency: 0, highScores: {}, rounds: {}, playLog: {},
    gameBadges: GAME_BADGES.map(b => b.id), dailyDoneDate: DAY,
  });
}

/** A mastery game that is neither this week's game nor today's daily challenge. */
const ordinaryGame = () => MASTERY_IDS.find(id => id !== gameOfTheWeek(DAY) && id !== challengeFor(DAY).gameId)!;

describe('finishRound rewards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${DAY}T12:00:00`));
    fresh();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('game of the week gives 2× XP and so 2× coins', () => {
    // Score 0: no new best and no stars, just the minimum 5 XP.
    const normal = useGameStore.getState().finishRound(ordinaryGame(), 0, 1);
    const double = useGameStore.getState().finishRound(gameOfTheWeek(DAY), 0, 1);
    expect(normal).toMatchObject({ weekly: false, xp: 5, coins: 1 });
    expect(double).toMatchObject({ weekly: true, xp: 10, coins: 2 });
  });

  it('pays STAR_COINS for each new star, and nothing extra for a lower re-run', () => {
    const id = ordinaryGame();
    const twoStars = MASTERY[id]!.stars[1];
    const first = useGameStore.getState().finishRound(id, twoStars, 1e9);
    expect([first.starsBefore, first.starsAfter]).toEqual([0, 2]);
    // 5 XP + 25 for a new best = 30 XP → 6 coins, plus 2 new stars.
    expect(first.coins).toBe(6 + 2 * STAR_COINS);
    const again = useGameStore.getState().finishRound(id, 1, 1e9);
    expect([again.starsBefore, again.starsAfter]).toEqual([2, 2]);
    expect(again.coins).toBe(1);
    expect(useGameStore.getState().userCurrency).toBe(6 + 2 * STAR_COINS + 1);
  });

  it('games without mastery stars report 0 stars', () => {
    const r = useGameStore.getState().finishRound('truth_or_dare', 50, 1);
    expect([r.starsBefore, r.starsAfter]).toEqual([0, 0]);
  });
});
