// Rules for Truth or Dare (pure — no React). See TruthOrDare.tsx for the screen.
import type { Rng } from '../../games/engine/rng';
import type { TodCard, TodLevel, TodPack } from '../../data/truthOrDare';
import type { TodCustomCard } from '../../store';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const SKIPS_PER_PLAYER = 3;
export const LAP_CHOICES = [2, 3, 5];

export interface TodPlayer {
  name: string;
  emoji: string;
  color: string;
  stars: number;
  skipsLeft: number;
  truths: number;
  dares: number;
  funny: number;
}

export function newPlayer(name: string, emoji: string, color: string): TodPlayer {
  return { name, emoji, color, stars: 0, skipsLeft: SKIPS_PER_PLAYER, truths: 0, dares: 0, funny: 0 };
}

function shuffled(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One lap: every player exactly once, in a random order. The first player of the lap is never
 * the one who went last, so nobody gets two turns in a row.
 */
export function lapOrder(n: number, lastPlayer: number | null, rng: Rng): number[] {
  const order = shuffled(n, rng);
  if (n > 1 && lastPlayer !== null && order[0] === lastPlayer) {
    const swap = 1 + Math.floor(rng() * (n - 1));
    [order[0], order[swap]] = [order[swap], order[0]];
  }
  return order;
}

/** "Our cards" written by the kids, in the same shape as the built-in ones. */
export function customToCards(custom: TodCustomCard[]): TodCard[] {
  return custom.map(c => ({ id: `mine-${c.id}`, pack: 'silly', kind: c.kind, level: 1, text: c.text, emoji: c.emoji }));
}

/**
 * The two decks for a game: cards from every chosen pack, at or below the chosen level
 * (the level is a ceiling — Brave also deals Easy cards). Dares include "everyone" and "double".
 */
export function buildPools(cards: TodCard[], packs: TodPack[], level: TodLevel, custom: TodCard[] = []) {
  const pick = [...cards.filter(c => packs.includes(c.pack) && c.level <= level), ...custom];
  return {
    truths: pick.filter(c => c.kind === 'truth'),
    dares: pick.filter(c => c.kind !== 'truth'),
  };
}

/**
 * Draws a card not seen yet this game. When every card in the pool has been seen, the pool
 * reshuffles (`reshuffled: true`) and the seen list for that pool starts again.
 */
export function drawCard(pool: TodCard[], seen: Set<string>, rng: Rng): { card: TodCard | null; reshuffled: boolean } {
  if (pool.length === 0) return { card: null, reshuffled: false };
  let fresh = pool.filter(c => !seen.has(c.id));
  let reshuffled = false;
  if (fresh.length === 0) {
    for (const c of pool) seen.delete(c.id);
    fresh = pool;
    reshuffled = true;
  }
  const card = fresh[Math.floor(rng() * fresh.length)];
  seen.add(card.id);
  return { card, reshuffled };
}

export type Outcome = 'done' | 'chicken';

/**
 * Stars for a finished card. Truth 1, dare 2, everyone/double 1 each (for every player who
 * joined in), +1 for picking 🎲 Surprise. Chickening out scores nothing.
 */
export function starsFor(card: TodCard, outcome: Outcome, surprise: boolean): number {
  if (outcome === 'chicken') return 0;
  const base = card.kind === 'truth' ? 1 : card.kind === 'dare' ? 2 : 1;
  return base + (surprise ? 1 : 0);
}

/**
 * Applies a finished turn. `partner` is the chosen partner for a double card; "everyone" cards
 * give every player 1 ⭐ (the performer also gets the surprise bonus).
 */
export function applyTurn(players: TodPlayer[], who: number, card: TodCard, outcome: Outcome, surprise: boolean, partner: number | null, funnyTaps: number): TodPlayer[] {
  const stars = starsFor(card, outcome, surprise);
  return players.map((p, i) => {
    let q = p;
    if (i === who) {
      q = {
        ...q,
        stars: q.stars + stars,
        skipsLeft: outcome === 'chicken' ? Math.max(0, q.skipsLeft - 1) : q.skipsLeft,
        truths: q.truths + (outcome === 'done' && card.kind === 'truth' ? 1 : 0),
        dares: q.dares + (outcome === 'done' && card.kind !== 'truth' ? 1 : 0),
        funny: q.funny + funnyTaps,
      };
    } else if (outcome === 'done' && (card.kind === 'everyone' || (card.kind === 'double' && i === partner))) {
      q = { ...q, stars: q.stars + 1 };
    }
    return q;
  });
}

/** Places with shared spots for ties: [10, 7, 7, 3] → [1, 2, 2, 4]. Returned in player order. */
export function places(players: TodPlayer[]): number[] {
  return players.map(p => 1 + players.filter(o => o.stars > p.stars).length);
}

export interface Award { title: string; emoji: string; winners: number[] }

/** Fun awards for the finale (skipped when nobody earned one). Ties share the award. */
export function awards(players: TodPlayer[]): Award[] {
  const top = (key: 'dares' | 'truths' | 'funny') => {
    const best = Math.max(...players.map(p => p[key]));
    return best > 0 ? players.map((p, i) => (p[key] === best ? i : -1)).filter(i => i >= 0) : [];
  };
  const list: Award[] = [
    { title: 'Bravest', emoji: '🦁', winners: top('dares') },
    { title: 'Most honest', emoji: '💬', winners: top('truths') },
    { title: 'Funniest', emoji: '😂', winners: top('funny') },
  ];
  return list.filter(a => a.winners.length > 0);
}

/**
 * Where the wheel stops: total rotation (degrees, clockwise) so the pointer at the top lands
 * inside wedge `index` of `n` (wedge 0 starts at the top). Spins a few full turns first and lands
 * somewhere inside the wedge, never on a line.
 */
export function wheelRotation(current: number, n: number, index: number, rng: Rng, turns = 4): number {
  const wedge = 360 / n;
  const inside = wedge * (0.2 + rng() * 0.6); // keep off the edges
  const targetAngle = index * wedge + inside; // wedge position that must end up under the pointer
  const finalMod = (360 - targetAngle) % 360;
  const base = current - (((current % 360) + 360) % 360);
  let rot = base + turns * 360 + finalMod;
  if (rot <= current + 360 * 2) rot += 360;
  return rot;
}

/** Which wedge is under the pointer for a given rotation (the inverse of wheelRotation). */
export function wedgeAt(rotation: number, n: number): number {
  const a = ((360 - (((rotation % 360) + 360) % 360)) % 360);
  return Math.floor(a / (360 / n)) % n;
}
