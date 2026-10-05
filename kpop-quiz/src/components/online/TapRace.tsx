import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import type { RoundResult } from '../../store';
import { finishArenaGame } from '../../online/arenaRewards';
import { playClick, playCorrect, playUnlock, playWin, playWrong } from '../../utils/sounds';
import { FinalCard, ScoreList } from './RaceParts';
import { everyoneDone, rankScores, speedPoints } from './raceLogic';
import { exposeRaceDebug, useCountdown, useRaceGate } from './useRaceGate';

// Shared "everyone taps the right option, fastest scores most" engine. One tap per round per
// player (right or wrong locks you in) so it stays a race. Powers Odd One Out, True or False
// Race (Brain Buzzer), Colour Clash and What's Missing.
//
// Sync: the host owns the game and broadcasts a full `<gp>_state` snapshot whenever something
// changes (the right option only appears once the round is over). Players send `<gp>_pick`.
// A device that mounts late says `<gp>_hello` and gets the current snapshot (see useRaceGate).

export interface TapOption {
  emoji?: string;
  label: string;
  /** A colour swatch instead of a picture; the label only appears on the answer (Colour Clash). */
  hex?: string;
}
export interface TapRound<P = string, St = unknown> {
  prompt: P;
  options: TapOption[];
  correctIndex: number; // host-only until the round ends
  /** With the `study` prop: shown for `studyMs` before the options appear (What's Missing). */
  study?: St;
  studyMs?: number;
}

type Phase = 'intro' | 'study' | 'play' | 'answer' | 'final';

interface TapRaceProps<P, St> {
  room: RoomApi;
  gp: string; // message prefix, e.g. 'oo' → oo_state, oo_pick, oo_hello
  title: string;
  icon: string;
  themeClass: string;
  accent: string;
  roundMs: number;
  rounds: number;
  buildRounds: () => TapRound<P, St>[];
  /** One line of instructions under the title. */
  subtitle?: string;
  /** Draws the prompt (default: the prompt as a line of text). */
  renderPrompt?: (a: { prompt: P; phase: Phase; options: TapOption[]; correctIndex: number | null }) => React.ReactNode;
  /** Optional memorise phase before each round's options appear. */
  study?: { render: (study: St) => React.ReactNode };
  /** Pause on the answer between rounds. */
  answerMs?: number;
  /** Show the timer with tenths (very short rounds). */
  tenths?: boolean;
}

/** The host's snapshot. `correctIndex` only from phase 'answer'; `study` only in phase 'study'. */
interface TapState<P, St> {
  t: string;
  phase: Phase;
  round: number;
  total: number;
  prompt?: P;
  options: TapOption[];
  study?: St;
  leftMs: number;
  scores: Record<string, number>;
  answered: string[];
  gained: Record<string, number>; // this round's points per player, sent with the answer
  correctIndex: number | null;
  ranked?: string[][];
}

const TapRace = <P = string, St = unknown>({
  room, gp, title, icon, themeClass, accent, roundMs, rounds, buildRounds, subtitle, renderPrompt, study, answerMs = 3000, tenths,
}: TapRaceProps<P, St>) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [st, setSt] = useState<TapState<P, St> | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef<number | null>(null);
  const [reward, setReward] = useState<RoundResult | null>(null);
  const finished = useRef(false);
  const lastRound = useRef(0);
  const lastPhase = useRef<Phase>('intro');

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  // ---- HOST ----
  const H = useRef({
    rounds: [] as TapRound<P, St>[],
    phase: 'intro' as Phase,
    round: 0,
    endsAt: 0,
    answered: {} as Record<string, boolean>,
    gained: {} as Record<string, number>,
    scores: {} as Record<string, number>,
    ranked: undefined as string[][] | undefined,
    timer: 0,
    pushTimer: 0,
  });

  const snapshot = useCallback((): TapState<P, St> => {
    const h = H.current;
    const item = h.rounds[h.round - 1];
    const showing = h.phase === 'play' || h.phase === 'answer';
    const over = h.phase === 'answer' || h.phase === 'final';
    return {
      t: `${gp}_state`,
      phase: h.phase,
      round: h.round,
      total: h.rounds.length || rounds,
      prompt: item && showing ? item.prompt : undefined,
      options: item && showing ? item.options : [],
      study: item && h.phase === 'study' ? item.study : undefined,
      leftMs: Math.max(0, h.endsAt - Date.now()),
      scores: { ...h.scores },
      answered: Object.keys(h.answered),
      gained: over ? { ...h.gained } : {},
      correctIndex: item && over ? item.correctIndex : null,
      ranked: h.ranked,
    };
  }, [gp, rounds]);

  const broadcast = useCallback(() => {
    window.clearTimeout(H.current.pushTimer);
    H.current.pushTimer = 0;
    send(snapshot() as unknown as Parameters<typeof send>[0]);
  }, [send, snapshot]);

  // A whole class tapping at once → one snapshot every ~150 ms at most.
  const pushSoon = useCallback(() => {
    if (H.current.pushTimer) return;
    H.current.pushTimer = window.setTimeout(broadcast, 150);
  }, [broadcast]);

  const flow = useRef({ start: () => {} });

  useEffect(() => {
    if (!isHost) return;
    const h = H.current;
    h.rounds = buildRounds().slice(0, rounds);
    playersRef.current.forEach(p => { h.scores[p.id] = h.scores[p.id] ?? 0; });

    const beginPlay = () => {
      h.phase = 'play';
      h.endsAt = Date.now() + roundMs;
      broadcast();
      h.timer = window.setTimeout(endRound, roundMs + 250);
    };
    const startRound = (r: number) => {
      const item = h.rounds[r - 1];
      h.round = r;
      h.answered = {};
      h.gained = {};
      if (study && item.study !== undefined) {
        h.phase = 'study';
        h.endsAt = Date.now() + (item.studyMs ?? 5000);
        broadcast();
        h.timer = window.setTimeout(beginPlay, item.studyMs ?? 5000);
      } else {
        beginPlay();
      }
    };
    const endRound = () => {
      if (h.phase !== 'play') return;
      window.clearTimeout(h.timer);
      h.phase = 'answer';
      h.endsAt = 0;
      broadcast();
      h.timer = window.setTimeout(() => {
        if (h.round < h.rounds.length) startRound(h.round + 1);
        else {
          h.phase = 'final';
          h.ranked = rankScores(h.scores, playersRef.current.map(p => p.id));
          broadcast();
        }
      }, answerMs);
    };
    flow.current = { start: () => { if (h.phase === 'intro' && h.rounds.length) startRound(1); } };

    const off = onMessage(raw => {
      const m = raw as unknown as { t: string; from?: string; index?: number; round?: number };
      if (m.t !== `${gp}_pick` || !m.from || h.phase !== 'play' || m.round !== h.round || h.answered[m.from]) return;
      h.answered[m.from] = true;
      const item = h.rounds[h.round - 1];
      if (m.index === item.correctIndex) {
        const pts = speedPoints(h.endsAt - Date.now(), roundMs);
        h.gained[m.from] = pts;
        h.scores[m.from] = (h.scores[m.from] ?? 0) + pts;
      } else {
        h.gained[m.from] = 0;
        h.scores[m.from] = h.scores[m.from] ?? 0;
      }
      if (everyoneDone(playersRef.current.map(p => p.id), h.answered)) endRound();
      else pushSoon();
    });

    exposeRaceDebug({ correctIndex: () => h.rounds[h.round - 1]?.correctIndex, phase: () => h.phase, round: () => h.round });
    broadcast();
    return () => {
      off();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.pushTimer);
      h.pushTimer = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  useRaceGate(room, gp, () => broadcast(), () => flow.current.start());

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage(raw => {
      if (raw.t !== `${gp}_state`) return;
      const m = raw as unknown as TapState<P, St>;
      setSt(m);
      setEndsAt(Date.now() + m.leftMs);
      if (m.round !== lastRound.current) {
        lastRound.current = m.round;
        pickedRef.current = null;
        setPicked(null);
        if (m.phase === 'study') playUnlock();
      }
      if (m.phase === 'answer' && lastPhase.current !== 'answer') {
        const g = m.gained[myId];
        if (g > 0) playCorrect();
        else if (g === 0) playWrong();
      }
      lastPhase.current = m.phase;
      if (m.phase === 'final' && m.ranked && !finished.current) {
        finished.current = true;
        playWin();
        setReward(finishArenaGame(room, m.ranked));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, gp, myId]);

  const phase: Phase = st?.phase ?? 'intro';
  const left = useCountdown(phase === 'play' || phase === 'study', endsAt, tenths ? 100 : 250);
  const timeText = tenths ? left.toFixed(1) : String(Math.ceil(left));
  const iAnswered = picked !== null || !!st?.answered.includes(myId);

  const tap = (i: number) => {
    if (pickedRef.current !== null || phase !== 'play' || !st || st.answered.includes(myId)) return;
    pickedRef.current = i;
    playClick();
    setPicked(i);
    send({ t: `${gp}_pick`, index: i, round: st.round });
  };

  const correctIndex = st?.correctIndex ?? null;
  const optClass = (i: number, o: TapOption) => {
    if (phase === 'answer') {
      if (i === correctIndex) return o.hex ? 'ring-4 ring-emerald-300 scale-105' : 'bg-emerald-500/80 border-emerald-300';
      if (i === picked) return o.hex ? 'ring-4 ring-red-400 opacity-70' : 'bg-red-500/70 border-red-300';
      return o.hex ? 'opacity-50' : 'bg-white/10 border-white/15 opacity-60';
    }
    if (picked === i) return o.hex ? 'ring-4 ring-white scale-105' : 'bg-amber-400/40 border-amber-300 scale-105';
    return o.hex ? '' : 'bg-white/10 border-white/20 active:bg-white/20';
  };

  const statusLine =
    phase === 'intro' ? 'Get ready…'
      : phase === 'study' ? `👀 Memorise! · ${timeText}s · Round ${st?.round}/${st?.total}`
        : phase === 'play' ? `Round ${st?.round}/${st?.total} · ⏱️ ${timeText}s · ${st?.answered.length ?? 0} answered`
          : phase === 'answer' ? `Round ${st?.round}/${st?.total} · Answer!`
            : 'Game over!';
  const myGain = st && phase === 'answer' ? st.gained[myId] : undefined;

  const opts = st?.options ?? [];
  return (
    <div className={`min-h-screen-d bg-gradient-to-br ${themeClass} text-white px-4 py-6`}>
      <div className="max-w-2xl mx-auto pt-8">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">{icon} {title}</h1>
        {subtitle && <p className="text-center font-nunito text-white/80 text-lg mb-1">{subtitle}</p>}
        <p className="text-center font-nunito text-white/80 text-lg mb-4" data-testid="race-status">{statusLine}</p>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-2xl text-white/80 py-10">⏳ Waiting for everyone…</div>
        )}

        {phase === 'study' && study && st?.study !== undefined && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4">
            {study.render(st.study)}
          </motion.div>
        )}

        {(phase === 'play' || phase === 'answer') && st && (
          <>
            {renderPrompt
              ? renderPrompt({ prompt: st.prompt as P, phase, options: opts, correctIndex })
              : <div className={`text-center font-fredoka text-2xl md:text-3xl mb-4 ${accent}`}>{String(st.prompt ?? '')}</div>}
            <div className="grid grid-cols-2 gap-3 mb-4 game-surface">
              {opts.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onPointerDown={e => { e.preventDefault(); tap(i); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') tap(i); }}
                  disabled={iAnswered || phase === 'answer'}
                  aria-label={o.label}
                  className={o.hex
                    ? `h-20 rounded-2xl border-2 border-white/20 font-fredoka font-bold text-xl text-white transition-all ${optClass(i, o)}`
                    : `rounded-3xl border-2 p-4 flex flex-col items-center justify-center gap-1 transition-all min-h-[6rem] ${optClass(i, o)}`}
                  style={o.hex ? { background: o.hex } : undefined}
                >
                  {o.hex ? (phase === 'answer' ? o.label : '') : (
                    <>
                      {o.emoji && <span className="text-5xl md:text-6xl">{o.emoji}</span>}
                      <span className="font-fredoka text-lg md:text-xl">{o.label}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            {phase === 'play' && iAnswered && (
              <div className="text-center mb-3">
                <span className="inline-block bg-white/15 rounded-full px-4 py-1 font-fredoka text-lg">Locked in! ⏳ Waiting for the others…</span>
              </div>
            )}
            {myGain !== undefined && (
              <div className="text-center mb-3">
                <span className={`inline-block rounded-full px-4 py-1 font-fredoka text-lg ${myGain > 0 ? 'bg-emerald-500' : 'bg-sky-600'}`}>
                  {myGain > 0 ? `✅ Yes! +${myGain}` : '💪 Not this time — next one!'}
                </span>
              </div>
            )}
            {phase === 'answer' && myGain === undefined && (
              <div className="text-center mb-3">
                <span className="inline-block rounded-full px-4 py-1 font-fredoka text-lg bg-sky-600">⏰ Too slow — get the next one!</span>
              </div>
            )}
          </>
        )}

        <ScoreList players={players} scores={st?.scores ?? {}} accent={accent} />
      </div>

      <AnimatePresence>
        {phase === 'final' && st?.ranked && (
          <FinalCard key="final" room={room} ranked={st.ranked} scores={st.scores} reward={reward} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TapRace;
