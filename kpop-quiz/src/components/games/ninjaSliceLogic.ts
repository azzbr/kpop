// Ninja Slice rules — pure helpers (no React, no canvas).

/** Fruit odds (when the spawn isn't a bomb) — they add up to exactly 1. Points are the old units. */
export const FRUITS = [
  { emoji: '🍉', pts: 10, prob: 0.24 },
  { emoji: '🍓', pts: 15, prob: 0.20 },
  { emoji: '🍎', pts: 8,  prob: 0.22 },
  { emoji: '🍊', pts: 6,  prob: 0.16 },
  { emoji: '🍍', pts: 30, prob: 0.06 },
  { emoji: '🥥', pts: 20, prob: 0.08 },
  { emoji: '🍇', pts: 7,  prob: 0.04 },
];
export const BOMB_CHANCE = 0.16;

/** Pick a fruit from a 0–1 roll. */
export function pickFruit(r: number) {
  let cum = 0;
  for (const f of FRUITS) { cum += f.prob; if (r < cum) return f; }
  return FRUITS[0];
}

/** Combo multiplier: ×2 from the 4th fruit in a row, ×3 from the 8th… */
export const comboMult = (combo: number) => 1 + Math.floor(combo / 4);

/**
 * Did the blade move from a to b pass through the circle? Checking the whole segment (not just
 * the finger's latest point) means a fast swipe can't jump over a fruit between two frames.
 */
export function bladeHits(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
  const px = ax + u * dx - cx, py = ay + u * dy - cy;
  return px * px + py * py < r * r;
}
