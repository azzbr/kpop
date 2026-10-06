import type { RoomPlayer } from '../../online/useRoom';

/** FinalCard wants rungs of ids; rankByScore gives single ids or arrays. */
export const toRungs = (ranked: (string | string[])[]): string[][] => ranked.map(r => (Array.isArray(r) ? r : [r]));

export function who(players: RoomPlayer[], id: string): { name: string; emoji: string } {
  const p = players.find(x => x.id === id);
  return p ? { name: p.name, emoji: p.emoji } : { name: 'A friend', emoji: '🙂' };
}

