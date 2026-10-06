import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { playClick, playPop, playCorrect } from '../../utils/sounds';
import { FinalCard } from './RaceParts';
import { ArenaFrame, RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { ROUNDS, PICK_MS, RPS_EMOJI, RPS_NAME, roundPoints, counts, isRps } from './rpsShowdownLogic';
import type { Rps } from './rpsShowdownLogic';

// Rock Paper Scissors Showdown: everyone picks at once and plays everyone else.
// Picks stay on the host until the reveal (the view only lists who has picked).

const REVEAL_MS = 4500;

interface State {
  ids: string[];
  round: number;
  phase: 'pick' | 'reveal' | 'final';
  endsAt: number;
  picks: Record<string, Rps>;
  auto: string[];
  last: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  round: number; phase: State['phase']; ms: number; picked: string[];
  picks?: Record<string, Rps>; auto?: string[]; last?: Record<string, number>;
  scores: Record<string, number>; ranked?: (string | string[])[];
}

function nextRound(t: HostTools<State>, s: State): State {
  const n: State = { ...s, round: s.round + 1, phase: 'pick', endsAt: Date.now() + PICK_MS, picks: {}, auto: [], last: {} };
  t.after('pick', PICK_MS + 300, () => t.set(reveal(t, t.get())));
  return n;
}

function reveal(t: HostTools<State>, s: State): State {
  if (s.phase !== 'pick') return s;
  t.cancel('pick');
  const picks = { ...s.picks };
  const auto: string[] = [];
  for (const id of s.ids) if (picks[id] === undefined) { picks[id] = Math.floor(Math.random() * 3) as Rps; auto.push(id); }
  const last = roundPoints(picks);
  const scores = { ...s.scores };
  for (const id of s.ids) scores[id] = (scores[id] ?? 0) + (last[id] ?? 0);
  const done = s.round >= ROUNDS;
  t.after('next', REVEAL_MS, () => {
    const cur = t.get();
    t.set(done ? { ...cur, phase: 'final', ranked: rankByScore(cur.scores, cur.ids) } : nextRound(t, cur));
  });
  return { ...s, phase: 'reveal', picks, auto, last, scores };
}

export default function RpsShowdown({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const [mine, setMine] = useState<{ round: number; pick: Rps } | null>(null);

  const { view, input } = useHostGame<State, View>(room, 'rps', {
    start: (ids, t) => nextRound(t, { ids, round: 0, phase: 'pick', endsAt: 0, picks: {}, auto: [], last: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [] }),
    onInput: (s, from, m, t) => {
      if (s.phase !== 'pick' || m.round !== s.round || !s.ids.includes(from) || s.picks[from] !== undefined || !isRps(m.pick)) return;
      const n = { ...s, picks: { ...s.picks, [from]: m.pick } };
      return s.ids.every(id => n.picks[id] !== undefined) ? reveal(t, n) : n;
    },
    view: s => ({
      round: s.round, phase: s.phase, ms: msLeft(s.endsAt), picked: Object.keys(s.picks), scores: s.scores,
      ...(s.phase !== 'pick' ? { picks: s.picks, auto: s.auto, last: s.last } : {}),
      ...(s.phase === 'final' ? { ranked: s.ranked } : {}),
    }),
  });

  const seconds = useCountdown(view?.phase === 'pick' ? view.ms : undefined, view?.round);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); finish(view.ranked); } }, [view?.phase, view?.ranked, finish]);

  if (!view) return <ArenaFrame title="RPS Showdown" icon="✊"><Waiting /></ArenaFrame>;

  const myPick = mine?.round === view.round ? mine.pick : view.picked.includes(room.myId) ? -1 : null;
  const pick = (p: Rps) => {
    if (view.phase !== 'pick' || myPick !== null) return;
    playClick();
    setMine({ round: view.round, pick: p });
    input({ round: view.round, pick: p });
  };
  const c = view.picks ? counts(view.picks) : null;

  return (
    <ArenaFrame title="RPS Showdown" icon="✊" subtitle="Beat as many friends as you can — the rare pick wins big!"
      right={<RoundPill round={view.round} of={ROUNDS} seconds={view.phase === 'pick' ? seconds : undefined} />}>
      {view.phase === 'pick' && (
        <div className="rounded-3xl bg-white/10 p-5 mb-5 text-center">
          <div className="font-fredoka text-2xl mb-4">{myPick === null ? 'Pick secretly!' : '🤫 Locked in!'}</div>
          <div className="grid grid-cols-3 gap-3">
            {RPS_EMOJI.map((e, i) => (
              <motion.button key={i} whileTap={{ scale: 0.9 }} onPointerDown={() => pick(i as Rps)} disabled={myPick !== null}
                aria-label={RPS_NAME[i]}
                className={`min-h-[120px] rounded-3xl text-6xl border-4 ${myPick === i ? 'bg-amber-400/40 border-amber-300' : myPick !== null ? 'bg-white/5 border-transparent opacity-40' : 'bg-white/15 border-white/20'}`}>
                {e}<div className="font-fredoka text-lg mt-1">{RPS_NAME[i]}</div>
              </motion.button>
            ))}
          </div>
          <div className="font-nunito text-lg text-violet-200 mt-4">{view.picked.length}/{room.players.length} picked</div>
        </div>
      )}

      {view.phase !== 'pick' && view.picks && c && (
        <div className="rounded-3xl bg-white/10 p-5 mb-5">
          <div className="flex justify-center gap-6 font-fredoka text-3xl mb-4" aria-label="Counts">
            {RPS_EMOJI.map((e, i) => <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.15 }}>{c[i]} {e}</motion.span>)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(view.picks).map(([id, p]) => (
              <motion.div key={id} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }}
                className={`rounded-2xl px-3 py-2 flex items-center gap-2 font-nunito text-lg ${id === room.myId ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-black/20'}`}>
                <span className="text-3xl">{RPS_EMOJI[p]}</span>
                <span className="flex-1 truncate">{who(room.players, id).name}</span>
                <span className="font-fredoka text-green-300">+{view.last?.[id] ?? 0}</span>
              </motion.div>
            ))}
          </div>
          {view.auto?.includes(room.myId) && (
            <p className="font-nunito text-lg text-amber-200 mt-3 text-center">⏰ Time ran out, so we picked for you — be quick next round!</p>
          )}
        </div>
      )}

      <Scores room={room} scores={view.scores} />

      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </ArenaFrame>
  );
}
