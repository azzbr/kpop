// Pure rules for teacher mode in Friends Arena (no React, no network): Class Cup teams,
// team points from each game's ranking, and the lesson id gold stars are counted against.

export const TEAMS = [
  { name: 'Red Rockets', emoji: '🔴', cls: 'bg-red-500' },
  { name: 'Blue Comets', emoji: '🔵', cls: 'bg-blue-500' },
  { name: 'Green Geckos', emoji: '🟢', cls: 'bg-green-500' },
  { name: 'Yellow Yetis', emoji: '🟡', cls: 'bg-yellow-400' },
];

/** Splits players into `n` teams as evenly as possible (shuffled with `rand`). */
export function assignTeams(ids: string[], n: number, rand: () => number = Math.random): Record<string, number> {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return Object.fromEntries(a.map((id, i) => [id, i % n]));
}

/** Puts newcomers on the smallest team (lowest index on a tie); keeps everyone else where they are. */
export function addToTeams(teams: Record<string, number>, ids: string[], n: number): Record<string, number> {
  const out = { ...teams };
  for (const id of ids) {
    if (out[id] !== undefined) continue;
    const size = Array.from({ length: n }, (_, t) => Object.values(out).filter(x => x === t).length);
    out[id] = size.indexOf(Math.min(...size));
  }
  return out;
}

/**
 * Class Cup points from one game's ranking (best first, tied rungs share a place): every player
 * earns their team 1 point for playing, plus 3 / 2 / 1 for 1st / 2nd / 3rd place.
 */
export function cupPoints(ranked: (string | string[])[], teams: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  ranked.forEach((rung, i) => {
    for (const id of Array.isArray(rung) ? rung : [rung]) {
      const t = teams[id];
      if (t === undefined) continue;
      out[t] = (out[t] ?? 0) + 1 + Math.max(0, 3 - i);
    }
  });
  return out;
}

export function addCup(cup: Record<number, number>, pts: Record<number, number>): Record<number, number> {
  const out = { ...cup };
  for (const [t, p] of Object.entries(pts)) out[Number(t)] = (out[Number(t)] ?? 0) + p;
  return out;
}

/** Leading team(s) of the cup, or [] if nobody has points. */
export function cupLeaders(cup: Record<number, number>): number[] {
  const best = Math.max(0, ...Object.values(cup));
  return best > 0 ? Object.keys(cup).map(Number).filter(t => cup[t] === best) : [];
}

/** One lesson = one room on one day; gold stars are capped per lesson. */
export const lessonId = (roomCode: string, dateKey: string) => `${roomCode}-${dateKey}`;
