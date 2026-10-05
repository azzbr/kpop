// Battle Arena rules — pure (no React), so they can be tested.

import type { Rng } from '../../games/engine/rng';

export interface Stats { id: string; name: string; emoji: string; color: string; atk: number; def: number; maxHp: number }
export interface Hero extends Stats { spec: string }

export const HEROES: Hero[] = [
  { id: 'storm',   name: 'STORM',   emoji: '⚡', color: 'from-blue-500 to-cyan-400',     atk: 90, def: 55, maxHp: 100, spec: '🌩️ Thunder Zap' },
  { id: 'blaze',   name: 'BLAZE',   emoji: '🔥', color: 'from-orange-500 to-red-500',    atk: 85, def: 60, maxHp: 110, spec: '🎆 Firework Fizz' },
  { id: 'frost',   name: 'FROST',   emoji: '❄️', color: 'from-sky-400 to-blue-500',      atk: 70, def: 82, maxHp: 95,  spec: '☃️ Snowball Storm' },
  { id: 'phantom', name: 'PHANTOM', emoji: '👻', color: 'from-violet-600 to-purple-500', atk: 95, def: 45, maxHp: 88,  spec: '🫧 Boo Bubble Blast' },
];

export const VILLAINS: Stats[] = [
  { id: 'dusk',   name: 'DUSK',   emoji: '🦹', color: 'from-red-700 to-rose-500',      atk: 82, def: 64, maxHp: 100 },
  { id: 'vortex', name: 'VORTEX', emoji: '🌀', color: 'from-slate-600 to-slate-400',   atk: 87, def: 52, maxHp: 98  },
  { id: 'shadow', name: 'SHADOW', emoji: '😼', color: 'from-purple-800 to-purple-600', atk: 92, def: 48, maxHp: 92  },
  { id: 'brute',  name: 'BRUTE',  emoji: '🦣', color: 'from-amber-700 to-stone-600',   atk: 76, def: 88, maxHp: 118 },
];

export type Move = 'punch' | 'kick' | 'special' | 'guard';

export const MOVES: Record<Move, { label: string; emoji: string; color: string; desc: string }> = {
  punch:   { label: 'Pillow Pummel', emoji: '🛏️', color: 'from-yellow-500 to-orange-500', desc: 'Steady bonks' },
  kick:    { label: 'Bouncy Boot',   emoji: '🥾', color: 'from-pink-500 to-rose-500',     desc: 'Big bounce, can miss' },
  special: { label: 'Rainbow Blast', emoji: '🌈', color: 'from-purple-500 to-fuchsia-500', desc: 'Huge! Needs 60 ⚡' },
  guard:   { label: 'Bubble Shield', emoji: '🫧', color: 'from-sky-500 to-cyan-500',      desc: 'Blocks most of a hit' },
};

export const SPECIAL_COST = 60;
export const ENERGY_PER_TURN = 25;
export const KICK_MISS = 0.2;

export const CHEERS = [
  'Boing! Right on target! ⭐',
  'The crowd cheers! 🎉',
  'What a bonk! 🎯',
  'Super combo! 🌈',
  'Wham! That was a big one! 💥',
  'The arena is buzzing! 🏟️',
  'Zap-tastic! ⚡',
  'Splat! A direct hit! 🎈',
];
export const MISS_LINES = ['Whoosh, they dodged it! 💨', 'Missed by a whisker! 😅', 'The crowd goes "ooooh"! 😮'];
export const GUARD_LINES = ['Bounced off the bubble! 🫧', 'Not today! Super shield! 💪', 'Blocked! Back to the drawing board! 🧱'];

export const pick = <T,>(rng: Rng, list: T[]) => list[Math.floor(rng() * list.length)];

export interface HitResult { dmg: number; miss: boolean; blocked: boolean }

export function calcDamage(atk: number, def: number, move: Move, targetGuarding: boolean, rng: Rng): HitResult {
  if (move === 'guard') return { dmg: 0, miss: false, blocked: false };
  let base: number;
  if (move === 'punch') base = atk * 0.38;
  else if (move === 'kick') {
    if (rng() < KICK_MISS) return { dmg: 0, miss: true, blocked: false };
    base = atk * 0.58;
  } else base = atk * 0.72;
  base *= 0.85 + rng() * 0.35;
  if (targetGuarding) base *= 0.35;
  base *= 1 - def / 380;
  return { dmg: Math.max(2, Math.round(base)), miss: false, blocked: targetGuarding };
}

export function cpuMove(energy: number, playerLastMove: Move | null, rng: Rng): Move {
  if (energy >= SPECIAL_COST && rng() < 0.38) return 'special';
  if (playerLastMove === 'special' && rng() < 0.3) return 'guard';
  const r = rng();
  if (r < 0.38) return 'punch';
  if (r < 0.66) return 'kick';
  if (r < 0.8 && energy >= SPECIAL_COST) return 'special';
  return 'guard';
}

export interface Fighter { hp: number; maxHp: number; energy: number }

export const newFighter = (s: Stats): Fighter => ({ hp: s.maxHp, maxHp: s.maxHp, energy: 0 });
export const canSpecial = (f: Fighter) => f.energy >= SPECIAL_COST;

export interface TurnResult {
  player: Fighter;
  cpu: Fighter;
  cMove: Move;
  /** What the player's move did to the bot, and what the bot's move did to the player. */
  pHit: HitResult;
  cHit: HitResult;
}

/** One turn: both pick a move, both hit at once (a guard protects for this turn). */
export function resolveTurn(hero: Stats, vil: Stats, player: Fighter, cpu: Fighter, pMove: Move, lastPlayerMove: Move | null, rng: Rng): TurnResult | null {
  if (pMove === 'special' && !canSpecial(player)) return null;
  let pEnergy = player.energy + ENERGY_PER_TURN - (pMove === 'special' ? SPECIAL_COST : 0);
  let cEnergy = cpu.energy + ENERGY_PER_TURN;
  const cMove = cpuMove(cEnergy, lastPlayerMove, rng);
  if (cMove === 'special') cEnergy -= SPECIAL_COST;
  const pHit = calcDamage(hero.atk, vil.def, pMove, cMove === 'guard', rng);
  const cHit = calcDamage(vil.atk, hero.def, cMove, pMove === 'guard', rng);
  pEnergy = Math.min(100, pEnergy);
  cEnergy = Math.min(100, cEnergy);
  return {
    player: { ...player, hp: Math.max(0, player.hp - cHit.dmg), energy: pEnergy },
    cpu: { ...cpu, hp: Math.max(0, cpu.hp - pHit.dmg), energy: cEnergy },
    cMove, pHit, cHit,
  };
}

export type Outcome = 'win' | 'lose' | null;

/** The bot is knocked out first → win. If both drop at once, the player still wins (kind rule). */
export function outcome(player: Fighter, cpu: Fighter): Outcome {
  if (cpu.hp <= 0) return 'win';
  if (player.hp <= 0) return 'lose';
  return null;
}

/** Score for one match: HP left × 10 on a win (at least 10), 0 on a loss. */
export function matchScore(player: Fighter, result: Outcome): number {
  return result === 'win' ? Math.max(1, player.hp) * 10 : 0;
}
