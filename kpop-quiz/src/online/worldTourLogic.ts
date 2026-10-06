// World Tour Tycoon rules (pure): a 30-tile board race from Home Town around the world to London.
import { rankByScore } from './boardSync';

export type TileKind = 'start' | 'plain' | 'boost' | 'trap' | 'coin' | 'quiz' | 'finish';

// Emoji on plain tiles are a true fact about the place (fact-checked):
// Tokyo Tower 🗼 · giant pandas live at Beijing Zoo 🐼 · Bangkok's temples 🛕 · kangaroos in Australia 🦘 ·
// camels by Cairo's pyramids 🐪 · Rome's Colosseum/temples 🏛️ · Vienna, city of classical music 🎻 ·
// flamenco comes from Andalusia, home of Seville 💃 · croissants in Paris 🥐 · skiing at Oslo's Holmenkollen ⛷️ ·
// northern lights over Reykjavik 🌌 · Edinburgh Castle 🏰 · the London Eye 🎡.
export const BOARD: { kind: TileKind; label: string; emoji: string }[] = [
  { kind: 'start', label: 'Home Town', emoji: '🏡' },
  { kind: 'plain', label: 'Tokyo', emoji: '🗼' },
  { kind: 'coin', label: 'Osaka', emoji: '💰' },
  { kind: 'plain', label: 'Beijing', emoji: '🐼' },
  { kind: 'quiz', label: 'Hong Kong', emoji: '❓' },
  { kind: 'boost', label: 'Singapore', emoji: '🚀' },
  { kind: 'plain', label: 'Bangkok', emoji: '🛕' },
  { kind: 'trap', label: 'Jakarta', emoji: '🌧️' },
  { kind: 'plain', label: 'Sydney', emoji: '🦘' },
  { kind: 'coin', label: 'Mumbai', emoji: '💰' },
  { kind: 'quiz', label: 'Dubai', emoji: '❓' },
  { kind: 'plain', label: 'Cairo', emoji: '🐪' },
  { kind: 'boost', label: 'Athens', emoji: '🚀' },
  { kind: 'plain', label: 'Rome', emoji: '🏛️' },
  { kind: 'trap', label: 'Berlin', emoji: '🌧️' },
  { kind: 'coin', label: 'Prague', emoji: '💰' },
  { kind: 'plain', label: 'Vienna', emoji: '🎻' },
  { kind: 'quiz', label: 'Zurich', emoji: '❓' },
  { kind: 'plain', label: 'Seville', emoji: '💃' },
  { kind: 'boost', label: 'Lisbon', emoji: '🚀' },
  { kind: 'plain', label: 'Paris', emoji: '🥐' },
  { kind: 'trap', label: 'Brussels', emoji: '🌧️' },
  { kind: 'coin', label: 'Amsterdam', emoji: '💰' },
  { kind: 'plain', label: 'Oslo', emoji: '⛷️' },
  { kind: 'quiz', label: 'Stockholm', emoji: '❓' },
  { kind: 'plain', label: 'Reykjavik', emoji: '🌌' },
  { kind: 'boost', label: 'Dublin', emoji: '🚀' },
  { kind: 'trap', label: 'Cardiff', emoji: '🌧️' },
  { kind: 'plain', label: 'Edinburgh', emoji: '🏰' },
  { kind: 'finish', label: 'London', emoji: '🎡' },
];
export const FINISH = BOARD.length - 1;

export const START_COINS = 150;
export const PRICE = 40;
export const RENT = 25;
export const HOME_BONUS = 10;
export const COIN_TILE = 40;
export const BOOST = 3;
export const TRAP = 3;
export const QUIZ_JUMP = 2;

export interface RollResult {
  dice: number;
  to: number;
  final: number;
  kind: TileKind;
  rent: { to: string; amount: number } | null;
  home: number;
  canBuy: boolean;
}

/**
 * Moves a player by a dice roll and settles the tile they land on. Mutates pos/coins
 * (the host's state) and returns what happened.
 */
export function resolveRoll(
  pid: string, dice: number,
  pos: Record<string, number>, coins: Record<string, number>, owners: Record<number, string>,
): RollResult {
  const to = Math.min(pos[pid] + dice, FINISH);
  const kind = BOARD[to].kind;
  let final = to;
  if (kind === 'boost') final = Math.min(to + BOOST, FINISH);
  if (kind === 'trap') final = Math.max(to - TRAP, 0);
  if (kind === 'coin') coins[pid] += COIN_TILE;
  pos[pid] = final;

  let rent: RollResult['rent'] = null;
  let home = 0;
  let canBuy = false;
  if (BOARD[final].kind === 'plain') {
    const owner = owners[final];
    if (owner && owner !== pid) {
      const amt = Math.min(RENT, coins[pid]);
      coins[pid] -= amt;
      coins[owner] = (coins[owner] || 0) + amt;
      rent = { to: owner, amount: amt };
    } else if (owner === pid) {
      home = HOME_BONUS;
      coins[pid] += HOME_BONUS;
    } else if (coins[pid] >= PRICE) {
      canBuy = true;
    }
  }
  return { dice, to, final, kind, rent, home, canBuy };
}

/** Coins plus what your hotels cost. */
export const netWorth = (id: string, coins: Record<string, number>, owners: Record<number, string>) =>
  (coins[id] || 0) + Object.values(owners).filter((o) => o === id).length * PRICE;

/** Final standings: whoever reached London first, then everyone else by net worth (ties share a place). */
export function finalRanking(order: string[], winnerId: string, coins: Record<string, number>, owners: Record<number, string>): (string | string[])[] {
  const rest = order.filter((id) => id !== winnerId);
  return [winnerId, ...rankByScore(rest, (id) => netWorth(id, coins, owners))];
}
