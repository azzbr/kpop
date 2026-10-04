// Real or Fake rules. Pure — no React.

export const ROUND_SIZE = 15;
export const LIVES = 3;
/** How far (px) the card must be dragged before letting go counts as an answer. */
export const SWIPE_THRESHOLD = 110;

export interface RofState {
  index: number;
  lives: number;
  streak: number;
  bestStreak: number;
  correct: number;
}

export const newRof = (): RofState => ({ index: 0, lives: LIVES, streak: 0, bestStreak: 0, correct: 0 });

/** Apply one answer. `real` is what the fact really is, `saidReal` is what she picked. */
export function answerRof(s: RofState, real: boolean, saidReal: boolean): { state: RofState; ok: boolean } {
  const ok = real === saidReal;
  const streak = ok ? s.streak + 1 : 0;
  return {
    ok,
    state: {
      index: s.index + 1,
      lives: ok ? s.lives : s.lives - 1,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      correct: s.correct + (ok ? 1 : 0),
    },
  };
}

export const isOver = (s: RofState, total: number) => s.lives <= 0 || s.index >= total;

/** Swipe → answer: right = Real, left = Fake, short drags = no answer. */
export function swipeAnswer(dx: number): boolean | null {
  if (dx >= SWIPE_THRESHOLD) return true;
  if (dx <= -SWIPE_THRESHOLD) return false;
  return null;
}
