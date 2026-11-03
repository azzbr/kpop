// Short vibrations for big, happy moments — Android only (iPhone/iPad web apps can't vibrate).
// Rule: positive moments only (new best, new star, daily challenge, badge, a party game's finale),
// never a loss or a mistake. Grown-ups can switch it off (parent.vibration).
import { useGameStore } from '../store';

export type BuzzTier = 'good' | 'great';

const PATTERNS: Record<BuzzTier, number | number[]> = { good: 35, great: [40, 50, 90] };
const GAP_MS = 300;
let last = { at: 0, tier: 'good' as BuzzTier };

export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function buzz(tier: BuzzTier) {
  if (!canVibrate() || useGameStore.getState().parent.vibration === false) return;
  const now = Date.now();
  // Two at once (round end + badge): keep the first, unless the second is stronger.
  if (now - last.at < GAP_MS && !(tier === 'great' && last.tier === 'good')) return;
  last = { at: now, tier };
  try { navigator.vibrate(PATTERNS[tier]); } catch { /* not allowed right now */ }
}
