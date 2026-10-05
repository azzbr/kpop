import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, RoomPlayer } from '../../online/useRoom';
import type { RoundResult } from '../../store';
import { playClick } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';
import { lookupPlayer, placesOf } from './raceLogic';

// UI bits shared by GuessRace and TapRace: the score list, the end-of-game card and a
// big number pad for maths / memory answers.

export function ScoreList({ players, scores, accent, max = 6 }: { players: RoomPlayer[]; scores: Record<string, number>; accent: string; max?: number }) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, max);
  return (
    <div className="bg-white/5 rounded-2xl p-3">
      <div className={`font-fredoka text-base mb-1 ${accent}`}>Top scores</div>
      {rows.length === 0 && <div className="font-nunito text-base text-white/60">No points yet — go go go!</div>}
      <div className="grid sm:grid-cols-2 gap-x-4">
        {rows.map(([id, s]) => {
          const p = lookupPlayer(players, id);
          return (
            <div key={id} className="font-nunito text-base py-0.5 flex justify-between gap-2">
              <span className="truncate">{p.emoji} {p.name}</span>
              <span className="text-amber-300 font-bold">{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FinalCardProps {
  room: RoomApi;
  ranked: string[][];
  scores: Record<string, number>;
  reward: RoundResult | null;
}

export function FinalCard({ room, ranked, scores, reward }: FinalCardProps) {
  const places = placesOf(ranked);
  const winners = ranked[0] ?? [];
  const flat = ranked.flat();
  const name = (id: string) => lookupPlayer(room.players, id);
  const headline =
    winners.length === 0 || (scores[winners[0]] ?? 0) === 0
      ? 'Great game, everyone!'
      : winners.length === 1
        ? `${name(winners[0]).emoji} ${name(winners[0]).name} wins!`
        : `${winners.map(id => name(id).name).join(' & ')} tie for the win!`;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
      <ConfettiBurst count={90} durationMs={4500} />
      <motion.div
        initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-6 md:p-8 text-center max-w-sm w-full text-white"
        data-testid="race-final"
      >
        <div className="text-7xl mb-3">🏆</div>
        <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">{headline}</h2>
        <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-56 overflow-y-auto">
          {flat.slice(0, 12).map(id => (
            <div key={id} className={`flex justify-between font-nunito text-lg py-0.5 ${id === room.myId ? 'text-amber-200 font-bold' : ''}`}>
              <span className="truncate">#{places[id]} {name(id).emoji} {name(id).name}</span>
              <span className="text-amber-200">{scores[id] ?? 0}</span>
            </div>
          ))}
        </div>
        {reward && (
          <p className="font-fredoka text-xl text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙{reward.isBest ? ' · New best! ⭐' : ''}</p>
        )}
        {room.isHost ? (
          <button
            onClick={() => { playClick(); room.send({ t: 'to_lobby' }); }}
            className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95"
          >
            Back to Lobby 🏠
          </button>
        ) : (
          <div className="font-nunito text-lg text-slate-300">Waiting for the host…</div>
        )}
      </motion.div>
    </motion.div>
  );
}

interface NumberPadProps {
  onKey: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
  enterLabel?: string;
}

/** Big 0–9 pad (calculator layout) for number answers. A real keyboard works too. */
export function NumberPad({ onKey, onBackspace, onEnter, disabled, enterLabel = 'Go!' }: NumberPadProps) {
  const latest = useRef({ onKey, onBackspace, onEnter });
  useEffect(() => { latest.current = { onKey, onBackspace, onEnter }; });
  useEffect(() => {
    if (disabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') { e.preventDefault(); latest.current.onEnter(); }
      else if (e.key === 'Backspace') { e.preventDefault(); latest.current.onBackspace(); }
      else if (/^[0-9]$/.test(e.key)) latest.current.onKey(e.key);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [disabled]);

  const key = (label: string, onPress: () => void, cls: string, aria?: string) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      aria-label={aria ?? label}
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={`h-14 md:h-16 rounded-2xl font-fredoka text-2xl md:text-3xl select-none active:scale-95 transition-transform disabled:opacity-40 ${cls}`}
    >
      {label}
    </button>
  );
  return (
    <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-2 game-surface" role="group" aria-label="Number pad">
      {'123456789'.split('').map(d => key(d, () => onKey(d), 'bg-slate-500 text-white'))}
      {key('⌫', onBackspace, 'bg-slate-600 text-white', 'Backspace')}
      {key('0', () => onKey('0'), 'bg-slate-500 text-white')}
      {key(enterLabel, onEnter, 'bg-fuchsia-600 text-white text-xl md:text-2xl', 'Enter')}
    </div>
  );
}
