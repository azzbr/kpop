/** Local-time YYYY-MM-DD (not UTC, so late-evening play counts as today). */
export function localDateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + delta));
}

export function getStreak(dates: string[]): { current: number; longest: number } {
  const set = new Set(dates);
  if (set.size === 0) return { current: 0, longest: 0 };
  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = shiftDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = localDateKey();
  let check = set.has(today) ? today : shiftDays(today, -1);
  let current = 0;
  while (set.has(check)) {
    current++;
    check = shiftDays(check, -1);
  }
  return { current, longest };
}
