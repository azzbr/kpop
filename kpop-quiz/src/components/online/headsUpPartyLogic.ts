// Heads Up Party rules (pure). One guesser can't see the word; everyone else in the room acts
// or explains it out loud. The guesser taps ✅ Got it or ⏭️ Pass. Solo: personal points (one per
// word guessed on your turn). Teams: two teams take turns, team points.
import { HEADS_UP_CATEGORIES } from '../../data/headsUpCards';

export const TURN_MS = 60_000;
export const READY_MS = 12_000;
export const RESULT_MS = 7000;

type Rng = () => number;

function shuffle<T>(a: T[], rng: Rng): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The cards for a deck option: a category id, or 'mix' (every deck, no duplicates). */
export function deckCards(deck: string | undefined): string[] {
  const cat = HEADS_UP_CATEGORIES.find(c => c.id === deck);
  const cards = cat ? cat.cards : HEADS_UP_CATEGORIES.flatMap(c => c.cards);
  const seen = new Set<string>();
  return cards.filter(c => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

export const deckName = (deck: string | undefined) => {
  const cat = HEADS_UP_CATEGORIES.find(c => c.id === deck);
  return cat ? `${cat.emoji} ${cat.name}` : '🎲 Mixed';
};
export const deckHint = (deck: string | undefined) => HEADS_UP_CATEGORIES.find(c => c.id === deck)?.hint ?? 'Act it out or explain it — no saying the word!';

/** Two balanced teams. */
export function makeTeams(ids: string[], rng: Rng = Math.random): [string[], string[]] {
  const order = shuffle(ids, rng);
  return [order.filter((_, i) => i % 2 === 0), order.filter((_, i) => i % 2 === 1)];
}

/** Number of turns: 'all' = everyone guesses once (solo never more than that); teams always get the same number. */
export function turnCount(option: string | undefined, players: number, teams: boolean): number {
  let n = option === 'all' ? players : Number(option) || 5;
  n = Math.max(1, n);
  // Solo: nobody guesses twice. Teams: both teams get the same number of turns.
  return teams ? Math.max(2, n + (n % 2)) : Math.min(n, Math.max(1, players));
}

/** Guessers in order: solo cycles a shuffled list; teams alternate, rotating within each team. */
export function guesserOrder(ids: string[], turns: number, teams: [string[], string[]] | null, rng: Rng = Math.random): string[] {
  if (!teams) {
    const order = shuffle(ids, rng);
    return Array.from({ length: turns }, (_, i) => order[i % order.length]);
  }
  const out: string[] = [];
  for (let i = 0; i < turns; i++) {
    const team = teams[i % 2].length ? teams[i % 2] : teams[(i + 1) % 2];
    out.push(team[Math.floor(i / 2) % team.length]);
  }
  return out;
}

export const teamOf = (teams: [string[], string[]] | null, id: string): number => (teams ? (teams[0].includes(id) ? 0 : teams[1].includes(id) ? 1 : -1) : -1);

export const TEAM_INFO: { name: string; short: string; emoji: string; cls: string }[] = [
  { name: 'Team Rocket Red', short: 'Red', emoji: '🔴', cls: 'bg-rose-500/30 ring-rose-300' },
  { name: 'Team Blue Lightning', short: 'Blue', emoji: '🔵', cls: 'bg-sky-500/30 ring-sky-300' },
];

/** Final ranking: solo by personal points; teams by team points (each team one rung, a tie shares). */
export function rankHeadsUp(points: Record<string, number>, ids: string[], teams: [string[], string[]] | null): { ranked: string[][]; shown: Record<string, number> } {
  if (!teams) {
    const sorted = [...ids].sort((a, b) => (points[b] ?? 0) - (points[a] ?? 0));
    const ranked: string[][] = [];
    let prev: number | null = null;
    for (const id of sorted) {
      const p = points[id] ?? 0;
      if (prev !== null && p === prev) ranked[ranked.length - 1].push(id);
      else ranked.push([id]);
      prev = p;
    }
    return { ranked, shown: Object.fromEntries(ids.map(id => [id, points[id] ?? 0])) };
  }
  const t = teamTotals(points, teams);
  const shown: Record<string, number> = {};
  teams.forEach((team, i) => team.forEach(id => { shown[id] = t[i]; }));
  const members = teams.map(team => team.filter(id => ids.includes(id)));
  const ranked = t[0] === t[1] ? [[...members[0], ...members[1]]] : t[0] > t[1] ? [members[0], members[1]] : [members[1], members[0]];
  return { ranked: ranked.filter(r => r.length), shown };
}

export const teamTotals = (points: Record<string, number>, teams: [string[], string[]]): [number, number] =>
  [teams[0].reduce((n, id) => n + (points[id] ?? 0), 0), teams[1].reduce((n, id) => n + (points[id] ?? 0), 0)];
