import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { playClick, playPop, playCorrect } from '../../utils/sounds';
import { WOULD_YOU_RATHER } from '../../data/wouldYouRather';
import { FinalCard } from './RaceParts';
import { ArenaFrame, RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs } from './arenaHelpers';
import { ROUNDS, ANSWER_MS, REVEAL_MS, pickQuestions, scoreRound, funStats, isSide } from './crowdPleaserLogic';
import type { Answer, Side, RoundTally } from './crowdPleaserLogic';

// Crowd Pleaser: a "Would you rather…" question; pick your side, then guess what most of the
// room picked. Answers stay on the host until the reveal (the view only lists who has answered).

const STATS_MS = 6000;

interface Reveal { a: number; b: number; maj: Side | 'tie'; points: Record<string, number>; choices: Record<string, Side> }
interface State {
  ids: string[];
  qs: number[];
  round: number;
  phase: 'answer' | 'reveal' | 'final';
  endsAt: number;
  answers: Record<string, Answer>;
  scores: Record<string, number>;
  last: Reveal | null;
  history: RoundTally[];
  ranked: (string | string[])[];
}
type Stats = ReturnType<typeof funStats>;
interface View {
  round: number; qi: number; phase: State['phase']; ms: number; answered: string[];
  scores: Record<string, number>; last?: Reveal; ranked?: (string | string[])[]; stats?: Stats;
}

function nextRound(t: HostTools<State>, s: State): State {
  t.after('answer', ANSWER_MS + 300, () => t.set(reveal(t, t.get())));
  return { ...s, round: s.round + 1, phase: 'answer', endsAt: Date.now() + ANSWER_MS, answers: {}, last: null };
}

function reveal(t: HostTools<State>, s: State): State {
  if (s.phase !== 'answer') return s;
  t.cancel('answer');
  const r = scoreRound(s.answers, s.ids);
  const scores = { ...s.scores };
  for (const id of s.ids) scores[id] = (scores[id] ?? 0) + (r.points[id] ?? 0);
  const choices = Object.fromEntries(Object.entries(s.answers).map(([id, x]) => [id, x.choice]));
  const history = [...s.history, { qi: s.qs[s.round - 1], a: r.a, b: r.b }];
  const done = s.round >= s.qs.length;
  t.after('next', REVEAL_MS, () => {
    const cur = t.get();
    t.set(done ? { ...cur, phase: 'final', ranked: rankByScore(cur.scores, cur.ids) } : nextRound(t, cur));
  });
  return { ...s, phase: 'reveal', scores, history, last: { a: r.a, b: r.b, maj: r.maj, points: r.points, choices } };
}

function SideCard({ side, qi, picked, dim, onPick, big, label }: {
  side: Side; qi: number; picked: boolean; dim: boolean; onPick: () => void; big: boolean; label?: string;
}) {
  const q = WOULD_YOU_RATHER[qi];
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onPointerDown={e => { e.preventDefault(); onPick(); }}
      aria-label={label ?? (side === 'a' ? q.a : q.b)}
      className={`rounded-3xl border-4 px-4 ${big ? 'min-h-[180px] py-5' : 'min-h-[110px] py-3'} flex flex-col items-center justify-center gap-2 text-center ${
        picked ? 'bg-amber-400/35 border-amber-300' : dim ? 'bg-white/5 border-transparent opacity-50'
          : side === 'a' ? 'bg-sky-500/25 border-sky-300/50' : 'bg-pink-500/25 border-pink-300/50'}`}>
      <span className={big ? 'text-6xl' : 'text-4xl'}>{side === 'a' ? q.emojiA : q.emojiB}</span>
      <span className={`font-fredoka ${big ? 'text-2xl' : 'text-xl'}`}>{side === 'a' ? q.a : q.b}</span>
    </motion.button>
  );
}

export default function CrowdPleaser({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const [mine, setMine] = useState<{ round: number; choice?: Side; guess?: Side }>({ round: 0 });
  const [statsDone, setStatsDone] = useState(false);

  const { view, input } = useHostGame<State, View>(room, 'cp', {
    start: (ids, t) => nextRound(t, {
      ids, qs: pickQuestions(ROUNDS, WOULD_YOU_RATHER.length, Math.random), round: 0, phase: 'answer', endsAt: 0,
      answers: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), last: null, history: [], ranked: [],
    }),
    onInput: (s, from, m, t) => {
      if (s.phase !== 'answer' || m.round !== s.round || !s.ids.includes(from) || s.answers[from]) return;
      if (!isSide(m.choice) || !isSide(m.guess)) return;
      const n = { ...s, answers: { ...s.answers, [from]: { choice: m.choice, guess: m.guess } } };
      return s.ids.every(id => n.answers[id]) ? reveal(t, n) : n;
    },
    view: s => ({
      round: s.round, qi: s.qs[s.round - 1] ?? 0, phase: s.phase, ms: msLeft(s.endsAt), answered: Object.keys(s.answers),
      scores: s.scores,
      ...(s.phase !== 'answer' && s.last ? { last: s.last } : {}),
      ...(s.phase === 'final' ? { ranked: s.ranked, stats: funStats(s.history) } : {}),
    }),
  });

  const seconds = useCountdown(view?.phase === 'answer' ? view.ms : undefined, view?.round);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); finish(view.ranked); } }, [view?.phase, view?.ranked, finish]);
  // At the end, the fun facts first, then the winners.
  const isFinal = view?.phase === 'final';
  useEffect(() => {
    if (!isFinal) return;
    const timer = window.setTimeout(() => setStatsDone(true), STATS_MS);
    return () => window.clearTimeout(timer);
  }, [isFinal]);

  if (!view) return <ArenaFrame title="Crowd Pleaser" icon="🧑‍🤝‍🧑"><Waiting /></ArenaFrame>;

  const q = WOULD_YOU_RATHER[view.qi];
  const my = mine.round === view.round ? mine : { round: view.round };
  const sent = view.answered.includes(room.myId) || (my.choice !== undefined && my.guess !== undefined);
  const pickChoice = (c: Side) => {
    if (view.phase !== 'answer' || sent) return;
    playClick();
    setMine({ round: view.round, choice: c });
  };
  const pickGuess = (g: Side) => {
    if (view.phase !== 'answer' || sent || !my.choice) return;
    playClick();
    setMine({ round: view.round, choice: my.choice, guess: g });
    input({ round: view.round, choice: my.choice, guess: g });
  };

  const last = view.last;
  const total = last ? last.a + last.b : 0;
  const aPct = last && total > 0 ? Math.round((last.a / total) * 100) : 50;
  const myChoice = last?.choices[room.myId];
  const myPts = last?.points[room.myId] ?? 0;

  return (
    <ArenaFrame title="Crowd Pleaser" icon="🧑‍🤝‍🧑" subtitle="Pick your side — then guess what most people picked!"
      right={<RoundPill round={view.round} of={ROUNDS} seconds={view.phase === 'answer' ? seconds : undefined} />}>
      {view.phase === 'answer' && (
        <div className="rounded-3xl bg-white/10 p-5 mb-5 text-center">
          {!sent && !my.choice && (
            <>
              <div className="font-fredoka text-3xl mb-4">Would you rather…</div>
              <div className="grid grid-cols-2 gap-3">
                <SideCard side="a" qi={view.qi} picked={false} dim={false} big onPick={() => pickChoice('a')} />
                <SideCard side="b" qi={view.qi} picked={false} dim={false} big onPick={() => pickChoice('b')} />
              </div>
            </>
          )}
          {!sent && my.choice && (
            <>
              <div className="font-fredoka text-3xl mb-1">🤔 Most people will pick…</div>
              <div className="font-nunito text-lg text-violet-200 mb-4">Guess right for +2 bonus points!</div>
              <div className="grid grid-cols-2 gap-3">
                <SideCard side="a" qi={view.qi} picked={false} dim={false} big={false} label={`Most will pick: ${q.a}`} onPick={() => pickGuess('a')} />
                <SideCard side="b" qi={view.qi} picked={false} dim={false} big={false} label={`Most will pick: ${q.b}`} onPick={() => pickGuess('b')} />
              </div>
              <button type="button" onClick={() => { playClick(); setMine({ round: view.round }); }}
                className="mt-4 min-h-[48px] px-6 rounded-full bg-white/15 font-fredoka text-lg active:scale-95">
                ↩ Change my pick
              </button>
            </>
          )}
          {sent && (
            <div className="py-8">
              <div className="text-6xl mb-3">🤫</div>
              <div className="font-fredoka text-3xl">Locked in!</div>
              <div className="font-nunito text-lg text-violet-200 mt-2">Waiting for friends…</div>
            </div>
          )}
          <div className="font-nunito text-lg text-violet-200 mt-4" data-testid="cp-count">{view.answered.length}/{room.players.length} answered</div>
        </div>
      )}

      {view.phase === 'reveal' && last && (
        <div className="rounded-3xl bg-white/10 p-5 mb-5" aria-label="Room split">
          <div className="font-fredoka text-2xl text-center mb-3">The room picked…</div>
          <div className="flex h-16 rounded-2xl overflow-hidden font-fredoka text-2xl mb-3">
            <motion.div initial={{ width: '50%' }} animate={{ width: `${total ? aPct : 50}%` }} transition={{ duration: 0.8 }}
              className={`bg-sky-500 flex items-center justify-start px-3 ${myChoice === 'a' ? 'ring-4 ring-inset ring-amber-300' : ''}`}>
              {total > 0 && last.a > 0 && `${q.emojiA} ${last.a}`}
            </motion.div>
            <motion.div initial={{ width: '50%' }} animate={{ width: `${total ? 100 - aPct : 50}%` }} transition={{ duration: 0.8 }}
              className={`bg-pink-500 flex items-center justify-end px-3 ${myChoice === 'b' ? 'ring-4 ring-inset ring-amber-300' : ''}`}>
              {total > 0 && last.b > 0 && `${last.b} ${q.emojiB}`}
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-3 font-nunito text-lg mb-3">
            <div className={`rounded-2xl p-3 ${myChoice === 'a' ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-black/20'}`}>
              {q.emojiA} {q.a}{myChoice === 'a' && <div className="font-fredoka text-amber-200">👆 Your pick</div>}
            </div>
            <div className={`rounded-2xl p-3 text-right ${myChoice === 'b' ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-black/20'}`}>
              {q.emojiB} {q.b}{myChoice === 'b' && <div className="font-fredoka text-amber-200">Your pick 👆</div>}
            </div>
          </div>
          <div className="text-center font-fredoka text-2xl" data-testid="cp-points">
            {last.maj === 'tie' ? '⚖️ A perfect split — every guess counts! ' : ''}
            {myChoice === undefined ? '⏰ Out of time — jump in next round!'
              : myPts >= 3 ? `+${myPts} 🎯 Mind reader!` : `+${myPts} Thanks for playing! 😊`}
          </div>
        </div>
      )}

      {isFinal && view.stats && (
        <div className="rounded-3xl bg-white/10 p-5 mb-5 font-nunito text-lg space-y-3" data-testid="cp-stats">
          <div className="font-fredoka text-2xl text-center">🎉 Fun facts</div>
          <div className="rounded-2xl bg-black/20 p-3">
            🤝 <b>Most agreed:</b> {WOULD_YOU_RATHER[view.stats.agreed.qi].a} vs {WOULD_YOU_RATHER[view.stats.agreed.qi].b} — {view.stats.agreed.a} to {view.stats.agreed.b}
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            ⚖️ <b>Most split:</b> {WOULD_YOU_RATHER[view.stats.split.qi].a} vs {WOULD_YOU_RATHER[view.stats.split.qi].b} — {view.stats.split.a} to {view.stats.split.b}
          </div>
          {!statsDone && (
            <div className="text-center">
              <button type="button" onClick={() => { playClick(); setStatsDone(true); }}
                className="min-h-[52px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 active:scale-95">
                See the winners 🏆
              </button>
            </div>
          )}
        </div>
      )}

      <Scores room={room} scores={view.scores} />

      {isFinal && view.ranked && (statsDone || !view.stats) && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </ArenaFrame>
  );
}
