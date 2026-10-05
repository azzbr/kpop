// Tug-of-War (2 players, one iPad) — pure rules, no React.

/** Best of 3: first to 2 round wins. */
export const WIN_SCORE = 2;
/** How far (in % of the track) the ribbon moves per tap. */
export const PULL = 2.4;
export const LEFT_GOAL = 8;
export const RIGHT_GOAL = 92;

/** Player 0 pulls left, player 1 pulls right. */
export const pullRope = (pos: number, player: 0 | 1) => Math.max(0, Math.min(100, player === 0 ? pos - PULL : pos + PULL));

/** Who has pulled the ribbon into their goal, if anyone. */
export const roundWinner = (pos: number): 0 | 1 | null => (pos <= LEFT_GOAL ? 0 : pos >= RIGHT_GOAL ? 1 : null);

/** Fewest taps that can win a round from the middle (no pulls from the other side). */
export const minPullsToWin = () => Math.ceil((50 - LEFT_GOAL) / PULL);

/** The score saved for a match: every pull both players made (they share the iPad, and the reward). */
export const matchScore = (pulls: [number, number]) => pulls[0] + pulls[1];
