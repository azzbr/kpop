import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import type { RoundResult } from '../../store';
import { finishArenaGame } from '../../online/arenaRewards';
import { playClick, playCorrect, playUnlock, playWin, playWrong } from '../../utils/sounds';
import { isClean } from '../../utils/cleanText';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard, NumberPad, ScoreList } from './RaceParts';
import { answerLength, checkGuess, everyoneDone, lookupPlayer, rankScores, speedPoints, type AnswerKind } from './raceLogic';
import { exposeRaceDebug, useCountdown, useRaceGate } from './useRaceGate';

// Shared "everyone races to type the answer" engine. Emoji Detective, Riddle Rush, Word
// Scramble, Math Sprint, Pattern Quest and Memory Digits are all this game with a different
// prompt — they pass `buildRounds` (host-only, answers stay host-side) and `renderPrompt`.
//
// Sync: the host owns the game and broadcasts a full `<gp>_state` snapshot whenever something
// changes (answers only appear once the round is over). Players send `<gp>_guess`. A device that
// mounts late says `<gp>_hello` and gets the current snapshot (see useRaceGate).

export interface GuessRound<P = unknown, S = unknown> {
  prompt: P; // serializable payload broadcast to clients (string or object)
  answer: string; // host-only until the round ends
  alts?: string[]; // host-only accepted variants
  hint?: string;
  /** With the `reveal` prop: shown for `showMs` before typing starts, then hidden (Memory Digits). */
  show?: S;
  showMs?: number;
  /** This round's typing time, if it differs from `roundMs`. */
  ms?: number;
}

interface GuessRaceProps<P, S> {
  room: RoomApi;
  gp: string; // message-type prefix, e.g. 'ed' → ed_state, ed_guess, ed_hello
  title: string;
  icon: string;
  themeClass: string; // gradient bg classes for the screen
  accent: string; // tailwind text colour for highlights, e.g. 'text-fuchsia-300'
  /** Shown in the answer box before typing, e.g. "What do the emojis mean?" */
  inputPlaceholder: string;
  roundMs: number;
  rounds: number;
  buildRounds: () => GuessRound<P, S>[];
  renderPrompt: (args: { prompt: P; hint?: string; len: number }) => React.ReactNode;
  /** 'words' = letters keyboard with space; 'digits' = number pad. */
  answerKind?: AnswerKind;
  /** Forgive one small typo (riddles, emoji). Off for Word Scramble. */
  fuzzy?: boolean;
  /** Optional memorise phase: each round's `show` is displayed, then hidden before typing starts. */
  reveal?: { render: (show: S) => React.ReactNode };
  /** One answer per round (Memory Digits) instead of unlimited guesses. */
  oneTry?: boolean;
  /** Points for a right answer (default: 100 + up to 100 for speed). */
  points?: (a: { answer: string; leftMs: number; roundMs: number }) => number;
  /** Pause on the answer between rounds. */
  answerMs?: number;
}

type Phase = 'intro' | 'show' | 'play' | 'answer' | 'final';

interface FeedItem { id: string; text: string; ok: boolean }

/** The host's snapshot. Never holds the answer before phase 'answer', nor `show` after phase 'show'. */
interface GrState<P, S> {
  t: string;
  phase: Phase;
  round: number;
  total: number;
  prompt?: P;
  hint?: string;
  len: number;
  leftMs: number;
  show?: S;
  scores: Record<string, number>;
  got: string[];
  tried: string[];
  feed: FeedItem[];
  answer?: string;
  ranked?: string[][];
}

const GuessRace = <P, S = unknown>({
  room, gp, title, icon, themeClass, accent, inputPlaceholder, roundMs, rounds, buildRounds, renderPrompt,
  answerKind = 'words', fuzzy = true, reveal, oneTry = false, points, answerMs = 3200,
}: GuessRaceProps<P, S>) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [st, setSt] = useState<GrState<P, S> | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [guess, setGuess] = useState('');
  const [sentThisRound, setSentThisRound] = useState(false);
  const [reward, setReward] = useState<RoundResult | null>(null);
  const finished = useRef(false);
  const lastRound = useRef(0);
  const iGotIt = useRef(false);
  const wrongTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  // ---- HOST: authoritative state ----
  const H = useRef({
    rounds: [] as GuessRound<P, S>[],
    phase: 'intro' as Phase,
    round: 0,
    endsAt: 0,
    ms: roundMs,
    got: new Set<string>(),
    tried: new Set<string>(),
    feed: [] as FeedItem[],
    scores: {} as Record<string, number>,
    ranked: undefined as string[][] | undefined,
    timer: 0,
    pushTimer: 0,
  });

  const snapshot = useCallback((): GrState<P, S> => {
    const h = H.current;
    const item = h.rounds[h.round - 1];
    const showing = h.phase === 'play' || h.phase === 'answer';
    return {
      t: `${gp}_state`,
      phase: h.phase,
      round: h.round,
      total: h.rounds.length || rounds,
      prompt: item && showing ? item.prompt : undefined,
      hint: item && showing ? item.hint : undefined,
      len: item ? answerLength(item.answer) : 0,
      leftMs: Math.max(0, h.endsAt - Date.now()),
      show: item && h.phase === 'show' ? item.show : undefined,
      scores: { ...h.scores },
      got: [...h.got],
      tried: [...h.tried],
      feed: h.feed,
      answer: item && (h.phase === 'answer' || h.phase === 'final') ? item.answer : undefined,
      ranked: h.ranked,
    };
  }, [gp, rounds]);

  const broadcast = useCallback(() => {
    window.clearTimeout(H.current.pushTimer);
    H.current.pushTimer = 0;
    send(snapshot() as unknown as Parameters<typeof send>[0]);
  }, [send, snapshot]);

  // Several answers at once (a whole class) → one snapshot every ~150 ms at most.
  const pushSoon = useCallback(() => {
    if (H.current.pushTimer) return;
    H.current.pushTimer = window.setTimeout(broadcast, 150);
  }, [broadcast]);

  const flow = useRef({
    start: () => {},
    endRound: () => {},
  });

  // Build the host's flow once (it only reads refs).
  useEffect(() => {
    if (!isHost) return;
    const h = H.current;
    h.rounds = buildRounds().slice(0, rounds);
    playersRef.current.forEach(p => { h.scores[p.id] = h.scores[p.id] ?? 0; });

    const beginPlay = () => {
      const item = h.rounds[h.round - 1];
      h.phase = 'play';
      h.ms = item.ms ?? roundMs;
      h.endsAt = Date.now() + h.ms;
      broadcast();
      h.timer = window.setTimeout(endRound, h.ms + 300);
    };
    const startRound = (r: number) => {
      const item = h.rounds[r - 1];
      h.round = r;
      h.got = new Set();
      h.tried = new Set();
      h.feed = [];
      if (reveal && item.show !== undefined) {
        h.phase = 'show';
        h.endsAt = Date.now() + (item.showMs ?? 4000);
        broadcast();
        h.timer = window.setTimeout(beginPlay, item.showMs ?? 4000);
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
    flow.current = {
      start: () => { if (h.phase === 'intro' && h.rounds.length) startRound(1); },
      endRound,
    };

    const off = onMessage(raw => {
      const m = raw as unknown as { t: string; from?: string; text?: unknown; round?: number };
      if (m.t !== `${gp}_guess` || !m.from || h.phase !== 'play' || m.round !== h.round) return;
      const from = m.from;
      if (h.got.has(from) || (oneTry && h.tried.has(from))) return;
      const text = String(m.text ?? '').slice(0, 30);
      const item = h.rounds[h.round - 1];
      h.tried.add(from);
      if (checkGuess(text, item.answer, item.alts, answerKind, fuzzy)) {
        const leftMs = Math.max(0, h.endsAt - Date.now());
        const pts = points ? points({ answer: item.answer, leftMs, roundMs: h.ms }) : speedPoints(leftMs, h.ms);
        h.got.add(from);
        h.scores[from] = (h.scores[from] ?? 0) + pts;
        h.feed = [{ id: from, text: oneTry ? '🔒 locked in' : `got it! +${pts}`, ok: !oneTry }, ...h.feed].slice(0, 7);
      } else {
        h.scores[from] = h.scores[from] ?? 0;
        const shown = oneTry ? '🔒 locked in' : isClean(text) ? text : '🙊';
        h.feed = [{ id: from, text: shown, ok: false }, ...h.feed].slice(0, 7);
      }
      const ids = playersRef.current.map(p => p.id);
      const done = Object.fromEntries([...(oneTry ? h.tried : h.got)].map(id => [id, true]));
      if (everyoneDone(ids, done)) endRound();
      else pushSoon();
    });

    exposeRaceDebug({ answer: () => h.rounds[h.round - 1]?.answer, phase: () => h.phase, round: () => h.round });
    broadcast(); // intro snapshot for anyone already listening
    return () => {
      off();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.pushTimer);
      h.pushTimer = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  useRaceGate(room, gp, () => broadcast(), () => flow.current.start());

  // ---- EVERYONE: apply snapshots ----
  useEffect(() => {
    return onMessage(raw => {
      if (raw.t !== `${gp}_state`) return;
      const m = raw as unknown as GrState<P, S>;
      setSt(m);
      setEndsAt(Date.now() + m.leftMs);
      if (m.round !== lastRound.current) {
        lastRound.current = m.round;
        iGotIt.current = false;
        setGuess('');
        setSentThisRound(false);
        if (m.phase === 'show') playUnlock();
      }
      if (m.phase === 'show') { setGuess(''); setSentThisRound(false); }
      if (!iGotIt.current && m.got.includes(myId)) {
        iGotIt.current = true;
        playCorrect();
      }
      if (m.phase === 'final' && m.ranked && !finished.current) {
        finished.current = true;
        playWin();
        setReward(finishArenaGame(room, m.ranked));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, gp, myId]);

  const phase: Phase = st?.phase ?? 'intro';
  const timeLeft = Math.ceil(useCountdown(phase === 'play' || phase === 'show', endsAt));

  const iGot = !!st?.got.includes(myId);
  const locked = iGot || (oneTry && (sentThisRound || !!st?.tried.includes(myId)));
  const canType = phase === 'play' && !locked;
  const maxLen = answerKind === 'digits' && reveal && st?.len ? st.len : answerKind === 'digits' ? 9 : 30;

  const onKey = useCallback((k: string) => {
    if (!canType) return;
    if (k === ' ') setGuess(g => (g && !g.endsWith(' ') ? (g + ' ').slice(0, maxLen) : g));
    else setGuess(g => (g + k.toLowerCase()).slice(0, maxLen));
  }, [canType, maxLen]);
  const onBackspace = useCallback(() => { if (canType) setGuess(g => g.slice(0, -1)); }, [canType]);
  const onEnter = useCallback(() => {
    const text = guess.trim();
    if (!canType || !text || !st) return;
    playClick();
    send({ t: `${gp}_guess`, text, round: st.round });
    setGuess('');
    if (oneTry) setSentThisRound(true);
    else {
      window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => { if (!iGotIt.current) playWrong(); }, 700);
    }
  }, [canType, guess, st, send, gp, oneTry]);

  const statusLine =
    phase === 'intro' ? 'Get ready…'
      : phase === 'show' ? `👀 Memorise it! · ${timeLeft}s · Round ${st?.round}/${st?.total}`
        : phase === 'play' ? `Round ${st?.round}/${st?.total} · ⏱️ ${timeLeft}s`
          : phase === 'answer' ? `Round ${st?.round}/${st?.total} · Answer time!`
            : 'Game over!';

  const myResult = st && phase === 'answer' && (iGot ? '✅ You got it!' : st.tried.includes(myId) ? '💪 So close — next one!' : '⏰ Time’s up — next one!');

  return (
    <div className={`min-h-screen-d bg-gradient-to-br ${themeClass} text-white px-4 py-6`}>
      <div className="max-w-2xl mx-auto pt-8">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">{icon} {title}</h1>
        <p className="text-center font-nunito text-white/80 text-lg mb-4" data-testid="race-status">{statusLine}</p>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-2xl text-white/80 py-10">⏳ Waiting for everyone…</div>
        )}

        {phase === 'show' && st?.show !== undefined && reveal && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/10 border border-white/15 rounded-3xl px-4 py-6 mb-4 shadow-xl min-h-[8rem] flex items-center justify-center">
            {reveal.render(st.show)}
          </motion.div>
        )}

        {(phase === 'play' || phase === 'answer') && st && (
          <div className="bg-white/10 border border-white/15 rounded-3xl px-4 py-6 mb-4 shadow-xl min-h-[8rem] flex items-center justify-center">
            {renderPrompt({ prompt: st.prompt as P, hint: st.hint, len: st.len })}
          </div>
        )}

        {phase === 'play' && (
          <div className="mb-4">
            <div
              className={`mx-auto max-w-xl mb-3 min-h-[56px] rounded-2xl px-4 py-2 flex items-center justify-center font-fredoka text-2xl md:text-3xl tracking-wider border-2 ${
                locked ? 'bg-emerald-500/80 border-emerald-300 text-white' : 'bg-white/90 border-white/40 text-gray-800'
              }`}
              data-testid="race-answer"
            >
              {iGot ? 'You got it! 🎉 Wait for the others 🤫'
                : locked ? 'Locked in! ⏳'
                  : guess ? <span className={answerKind === 'digits' ? 'tracking-[0.25em]' : 'uppercase'}>{guess}</span>
                    : <span className="text-gray-400 text-xl font-nunito">{inputPlaceholder}</span>}
            </div>
            {answerKind === 'digits'
              ? <NumberPad onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} disabled={!canType} />
              : <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={!canType} enterLabel="Go!" />}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-2xl p-3 min-h-[6rem]">
            <div className={`font-fredoka text-base mb-1 ${accent}`}>Guesses</div>
            {(st?.feed ?? []).map((f, i) => (
              <div key={i} className={`font-nunito text-base py-0.5 truncate ${f.ok ? 'text-emerald-300 font-bold' : 'text-white/75'}`}>
                {f.ok ? '✅' : '💬'} {lookupPlayer(players, f.id).name}: {f.text}
              </div>
            ))}
          </div>
          <ScoreList players={players} scores={st?.scores ?? {}} accent={accent} />
        </div>
      </div>

      <AnimatePresence>
        {phase === 'answer' && st && (
          <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full">
              <div className="text-5xl mb-2">💡</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                The answer was: <span className={answerKind === 'digits' ? 'tracking-[0.2em]' : 'uppercase'}>{st.answer}</span>
              </h2>
              {myResult && <p className={`font-fredoka text-xl mb-1 ${iGot ? 'text-emerald-300' : 'text-sky-200'}`}>{myResult}</p>}
              <p className="font-nunito text-lg text-slate-300">{st.round < st.total ? 'Next one coming up…' : 'Final scores coming up…'}</p>
            </motion.div>
          </motion.div>
        )}
        {phase === 'final' && st?.ranked && (
          <FinalCard key="final" room={room} ranked={st.ranked} scores={st.scores} reward={reward} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GuessRace;
