import { useEffect, useRef, useState } from 'react';
import type { GameMsg } from './useRoom';
import { playPop } from '../utils/sounds';

// Emoji reactions in a Friends Arena room: tap one and it floats up on every screen.
// One per second per player (checked when sending and again when receiving).

export const REACT = 'react';
export const REACTIONS = ['🎉', '😂', '👏', '😮', '❤️', '🔥'];
const GAP_MS = 1000;

export interface Floater { key: number; e: string; x: number; who?: string }

interface Room { myId: string; players: { id: string; emoji: string }[]; send: (m: GameMsg) => void; onMessage: (h: (m: GameMsg) => void) => () => void }

export function useReactions(room: Room) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const last = useRef(new Map<string, number>());
  const seq = useRef(0);
  const playersRef = useRef(room.players);
  playersRef.current = room.players;

  const { onMessage, send } = room;
  useEffect(() => onMessage((m) => {
    if (m.t !== REACT || !m.from || typeof m.e !== 'string' || !REACTIONS.includes(m.e)) return;
    const now = Date.now();
    if (now - (last.current.get(`in${m.from}`) ?? 0) < GAP_MS - 100) return;
    last.current.set(`in${m.from}`, now);
    const key = ++seq.current;
    const who = playersRef.current.find(p => p.id === m.from)?.emoji;
    setFloaters(f => [...f.slice(-14), { key, e: m.e as string, x: 8 + Math.random() * 84, who }]);
    window.setTimeout(() => setFloaters(f => f.filter(x => x.key !== key)), 2600);
  }), [onMessage]);

  const react = (e: string) => {
    const now = Date.now();
    if (now - (last.current.get('out') ?? 0) < GAP_MS) return false;
    last.current.set('out', now);
    playPop();
    send({ t: REACT, e });
    return true;
  };

  return { floaters, react };
}

