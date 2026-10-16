import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { makeKeyPair, seal, unseal } from '../../online/sealed';
import type { KeyPair, Sealed } from '../../online/sealed';
import { RIDDLES } from '../../online/riddles';
import type { Riddle, RiddleDifficulty, RiddleKind } from '../../online/riddles';
import { createRng } from '../../games/engine/rng';
import {
  ROUNDS, ROUND_MS, HINT_AT, ANSWER_MS, MAX_GUESS, points, maskAnswer, lengthLabel, judgeGuess, chooseRiddles, readConfig,
} from '../../online/riddleRushLogic';
import type { Judgement } from '../../online/riddleRushLogic';
import { playClick, playCorrect, playPop, playTick, playUnlock } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import { FinalCard } from './RaceParts';
import { ArenaFrame, RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { exposeRaceDebug } from './useRaceGate';

// 🧩 Riddle Rush 2.0: everyone races to solve the same riddle. The letter count shows from
// the start, then a hint (12 s), the first letter (22 s) and the last letter (29 s) — each one
// lowers the points. Guesses are SEALED to the host (online/sealed.ts), so other devices can't
// read them, and "So close!" goes only to the guesser. The answer and its explanation show
// after the round. Teacher pause/skip come from useHostGame; board mode = the host's device is
// the big screen (big riddle, timer, who has solved it).

const READY_MS = 3500;
const MAX_TRIES = 40;

interface Solve { id: string; pts: number; level: number }
interface State {
  ids: string[];
  riddles: Riddle[];
  round: number;
  phase: 'ready' | 'play' | 'answer' | 'final';
  startAt: number;
  endsAt: number;
  level: number;
  solved: Solve[];
  tries: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  ids: string[];
  round: number;
  total: number;
  phase: State['phase'];
  ms: number;
  level: number;
  q?: string;
  kind?: RiddleKind;
  difficulty?: RiddleDifficulty;
  len?: string;
  mask?: (string | null)[][];
  hint?: string;
  solved: Solve[];
  scores: Record<string, number>;
  answer?: string;
  explanation?: string;
  ranked?: (string | string[])[];
  /** The host's public key: guesses are sealed with it. */
  pk: string | null;
}

const DIFF_LABEL: Record<RiddleDifficulty, string> = { easy: '😀 Easy', tricky: '🤓 Tricky', genius: '🧠 Genius' };

function startRound(t: HostTools<State>, s: State, round: number): State {
  const now = Date.now();
  HINT_AT.forEach((at, i) => t.after(`hint${i}`, at, () => {
    const cur = t.get();
    if (cur.phase === 'play' && cur.round === round) t.set({ ...cur, level: Math.max(cur.level, i + 1) });
  }));
  t.after('end', ROUND_MS + 300, () => t.set(endRound(t, t.get())));
  return { ...s, round, phase: 'play', startAt: now, endsAt: now + ROUND_MS, level: 0, solved: [], tries: {} };
}

function endRound(t: HostTools<State>, s: State): State {
  if (s.phase !== 'play') return s;
  HINT_AT.forEach((_, i) => t.cancel(`hint${i}`));
  t.cancel('end');
  t.after('next', ANSWER_MS, () => t.set(advance(t, t.get())));
  return { ...s, phase: 'answer', endsAt: Date.now() + ANSWER_MS };
}

function advance(t: HostTools<State>, s: State): State {
  if (s.phase === 'ready') return startRound(t, s, 1);
  if (s.phase !== 'answer') return s;
  t.cancel('next');
  if (s.round >= s.riddles.length) return { ...s, phase: 'final', endsAt: 0, ranked: rankByScore(s.scores, s.ids) };
  return startRound(t, s, s.round + 1);
}

export default function RiddleRush({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const cfg = readConfig(config);
  const { finish, reward } = useArenaFinish(room);
  const hostKeys = useRef<KeyPair | null>(null);
  const myKeys = useRef<Promise<KeyPair | null> | null>(null);
  if (!myKeys.current) myKeys.current = makeKeyPair().then(k => { hostKeys.current = k; return k; });
  const pausedRef = useRef(false);
  const [fb, setFb] = useState<{ round: number; kind: Judgement; n: number } | null>(null);

  /** Host: apply one guess (already unsealed). */
  const apply = (s: State, from: string, raw: string): State | undefined => {
    if (s.phase !== 'play' || pausedRef.current) return;
    if (cfg.board && from === room.myId) return;
    let n = s;
    if (!n.ids.includes(from)) n = { ...n, ids: [...n.ids, from], scores: { ...n.scores, [from]: n.scores[from] ?? 0 } };
    if (n.solved.some(x => x.id === from) || (n.tries[from] ?? 0) >= MAX_TRIES) return n === s ? undefined : n;
    const text = raw.slice(0, MAX_GUESS);
    const r = n.riddles[n.round - 1];
    const verdict = judgeGuess(text, r);
    n = { ...n, tries: { ...n.tries, [from]: (n.tries[from] ?? 0) + 1 } };
    room.send({ t: 'rid_fb', to: from, round: n.round, kind: verdict });
    if (verdict !== 'right') return n;
    const pts = points(n.level, n.endsAt - Date.now());
    n = { ...n, solved: [...n.solved, { id: from, pts, level: n.level }], scores: { ...n.scores, [from]: (n.scores[from] ?? 0) + pts } };
    const present = n.ids.filter(id => room.players.some(p => p.id === id));
    const done = present.length > 0 && present.every(id => n.solved.some(x => x.id === id));
    return done ? endRound(toolsRef.current!, n) : n;
  };

  const { view, input, tools, paused } = useHostGame<State, View>(room, 'rid', {
    board: cfg.board,
    start: (ids, t) => {
      const riddles = chooseRiddles(RIDDLES, cfg.difficulty, cfg.kind, ROUNDS, createRng(Date.now() % 1e9));
      t.after('go', READY_MS, () => t.set(advance(t, t.get())));
      return { ids, riddles, round: 0, phase: 'ready', startAt: 0, endsAt: Date.now() + READY_MS, level: 0, solved: [], tries: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [] };
    },
    onInput: (s, from, m, t) => {
      if (m.round !== s.round) return;
      if (m.box && typeof m.pk === 'string') {
        const hk = hostKeys.current;
        if (!hk) return;
        void unseal(hk, m.pk, m.box as Sealed).then(text => {
          if (text === null) return;
          const next = apply(t.get(), from, text);
          if (next) t.set(next);
        });
        return;
      }
      return apply(s, from, String(m.text ?? ''));
    },
    onSkip: (s, t) => (s.phase === 'play' ? endRound(t, s) : s.phase === 'answer' || s.phase === 'ready' ? advance(t, s) : undefined),
    view: (s) => {
      const r = s.riddles[s.round - 1];
      const showing = !!r && (s.phase === 'play' || s.phase === 'answer');
      const after = s.phase === 'answer' || s.phase === 'final';
      return {
        ids: s.ids, round: s.round, total: s.riddles.length, phase: s.phase, ms: msLeft(s.endsAt), level: s.level,
        ...(showing ? {
          q: r.q, kind: r.kind, difficulty: r.difficulty, len: lengthLabel(r.answer),
          mask: maskAnswer(r.answer, after ? 0 : s.level), ...(s.level >= 1 || after ? { hint: r.hint } : {}),
        } : {}),
        ...(after && r ? { answer: r.answer, explanation: r.explanation } : {}),
        solved: s.solved, scores: s.scores,
        ...(s.phase === 'final' ? { ranked: s.ranked } : {}),
        pk: hostKeys.current?.pub ?? null,
      };
    },
  });
  const toolsRef = useRef<HostTools<State> | null>(null);
  toolsRef.current = tools;
  pausedRef.current = paused;

  useEffect(() => {
    if (room.isHost) exposeRaceDebug({ answer: () => tools.get()?.riddles[tools.get().round - 1]?.answer, phase: () => tools.get()?.phase, round: () => tools.get()?.round });
  });

  // Private feedback for my guesses.
  useEffect(() => room.onMessage(m => {
    if (m.t !== 'rid_fb' || m.to !== room.myId) return;
    const kind = m.kind as Judgement;
    setFb(prev => ({ round: Number(m.round), kind, n: (prev?.n ?? 0) + 1 }));
    if (kind === 'close') playPop();
  }), [room]);

  const isBoard = cfg.board && room.isHost;
  const iSolved = !!view?.solved.some(x => x.id === room.myId);
  const playing = !isBoard;

  // Sounds and rewards.
  const lastKey = useRef('');
  useEffect(() => {
    if (!view) return;
    const k = `${view.phase}:${view.round}`;
    if (k === lastKey.current) return;
    lastKey.current = k;
    if (view.phase === 'play') playUnlock();
  }, [view]);
  useEffect(() => { if (iSolved) playCorrect(); }, [iSolved, view?.round]);
  const rewarded = useRef(false);
  useEffect(() => {
    if (view?.phase !== 'final' || !view.ranked || rewarded.current) return;
    rewarded.current = true;
    if (isBoard) room.reportResult(view.ranked);
    else finish(view.ranked);
  }, [view?.phase, view?.ranked, finish, isBoard, room]);

  // Countdown (frozen while paused).
  const live = useCountdown(view && !paused ? view.ms : undefined, `${view?.phase}:${view?.round}:${view?.ms}`);
  const frozen = useRef(0);
  if (!paused) frozen.current = live;
  const secs = paused ? frozen.current : live;
  useEffect(() => {
    if (view?.phase === 'play' && !paused && secs > 0 && secs <= 5 && (isBoard || !iSolved)) playTick();
  }, [secs, view?.phase, paused, isBoard, iSolved]);

  // Typing.
  const [guess, setGuess] = useState('');
  const [typedRound, setTypedRound] = useState(0);
  if (view && view.round !== typedRound) { setTypedRound(view.round); setGuess(''); }
  const canType = !!view && view.phase === 'play' && playing && !iSolved && !paused;
  const onKey = useCallback((k: string) => {
    if (!canType) return;
    if (k === ' ') setGuess(g => (g && !g.endsWith(' ') ? (g + ' ').slice(0, MAX_GUESS) : g));
    else setGuess(g => (g + k.toLowerCase()).slice(0, MAX_GUESS));
  }, [canType]);
  const onBackspace = useCallback(() => { if (canType) setGuess(g => g.slice(0, -1)); }, [canType]);
  const onEnter = () => {
    const text = guess.trim();
    if (!canType || !text || !view) return;
    playClick();
    setGuess('');
    const round = view.round;
    const pk = view.pk;
    void myKeys.current!.then(async mine => {
      if (pk && mine) input({ round, box: await seal(mine, pk, text), pk: mine.pub });
      else input({ round, text }); // no WebCrypto on this device (plain-http testing)
    });
  };

  if (!view) return <ArenaFrame title="Riddle Rush" icon="🧩" tint="from-emerald-950 via-teal-950 to-cyan-950"><Waiting /></ArenaFrame>;

  const mineFb = fb && fb.round === view.round && view.phase === 'play' && !iSolved ? fb : null;
  const myPts = view.solved.find(x => x.id === room.myId)?.pts;
  const elapsed = ROUND_MS / 1000 - secs;
  const nextHint = view.level < HINT_AT.length ? Math.max(0, Math.ceil(HINT_AT[view.level] / 1000 - elapsed)) : null;
  const emojiPics = view.kind === 'emoji' && view.q ? view.q.replace(/^What am I\?\s*/, '') : null;
  const big = isBoard;

  return (
    <ArenaFrame title="Riddle Rush" icon="🧩" tint="from-emerald-950 via-teal-950 to-cyan-950"
      subtitle={view.phase === 'ready' ? 'Get ready to think!' : view.difficulty ? `${DIFF_LABEL[view.difficulty]}${view.kind === 'emoji' ? ' · 🖼️ Emoji riddle' : ''}` : undefined}
      right={view.round > 0 ? <RoundPill round={view.round} of={view.total} seconds={view.phase === 'play' ? secs : undefined} /> : undefined}>

      {view.phase === 'ready' && (
        <div className="text-center py-12" data-testid="rid-ready">
          <div className="text-7xl mb-4 animate-bounce">🧩</div>
          <p className="font-fredoka text-3xl">{view.total} riddles coming up…</p>
          <p className="font-nunito text-xl text-emerald-200 mt-2">Answer fast — every hint makes it worth fewer points!</p>
        </div>
      )}

      {(view.phase === 'play' || view.phase === 'answer') && view.q && (
        <div className={`rounded-3xl bg-white/10 border border-white/15 p-5 md:p-7 mb-4 text-center shadow-xl ${big ? 'md:p-10' : ''}`} data-testid="rid-question">
          {emojiPics ? (
            <>
              <p className={`font-fredoka ${big ? 'text-4xl' : 'text-2xl'} mb-2`}>What am I?</p>
              <p className={`${big ? 'text-8xl' : 'text-6xl'} tracking-wide`}>{emojiPics}</p>
            </>
          ) : (
            <p className={`font-fredoka leading-snug ${big ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}>{view.q}</p>
          )}
          {view.mask && (
            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label={view.len}>
              {view.mask.map((wd, wi) => (
                <div key={wi} className="flex gap-1.5">
                  {wd.map((ch, ci) => (
                    <span key={ci} className={`${big ? 'w-14 h-16 text-4xl' : 'w-9 h-11 md:w-11 md:h-12 text-2xl md:text-3xl'} rounded-xl flex items-center justify-center font-fredoka ${ch ? 'bg-amber-300 text-emerald-950' : 'bg-black/30 border-2 border-white/25'}`}>{ch ?? ''}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className={`font-nunito ${big ? 'text-2xl' : 'text-lg'} text-emerald-200 mt-3`}>{view.len}</p>
          {view.phase === 'play' && (
            <AnimatePresence mode="wait">
              {view.hint ? (
                <motion.p key="hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`font-fredoka ${big ? 'text-3xl' : 'text-xl'} text-amber-200 mt-2`} data-testid="rid-hint">
                  💡 Hint: {view.hint}
                </motion.p>
              ) : (
                <motion.p key="wait" className={`font-nunito ${big ? 'text-2xl' : 'text-lg'} text-white/70 mt-2`}>💡 Hint in {nextHint ?? 0}s</motion.p>
              )}
            </AnimatePresence>
          )}
          {view.phase === 'play' && view.level >= 1 && nextHint !== null && (
            <p className="font-nunito text-base text-white/60 mt-1">{view.level === 1 ? 'First letter' : 'Last letter'} in {nextHint}s</p>
          )}
        </div>
      )}

      {view.phase === 'play' && playing && (
        <div className="mb-4">
          <div className={`mx-auto max-w-xl mb-2 min-h-[56px] rounded-2xl px-4 py-2 flex items-center justify-center font-fredoka text-2xl md:text-3xl tracking-wider border-2 ${
            iSolved ? 'bg-emerald-500/80 border-emerald-300 text-white' : 'bg-white/90 border-white/40 text-gray-800'}`} data-testid="rid-answer">
            {iSolved ? `✅ You got it! +${myPts ?? 0} 🎉` : guess ? <span className="uppercase">{guess}</span> : <span className="text-gray-400 text-xl font-nunito">Type your answer…</span>}
          </div>
          <div className="min-h-[32px] text-center font-fredoka text-xl" data-testid="rid-feedback">
            <AnimatePresence mode="wait">
              {mineFb && (
                <motion.span key={mineFb.n} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={mineFb.kind === 'close' ? 'text-amber-300' : 'text-sky-200'}>
                  {mineFb.kind === 'close' ? 'So close! 🔥 Check your spelling' : 'Not quite — keep trying! 💪'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {!iSolved && <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={!canType} enterLabel="Go!" />}
        </div>
      )}

      {(view.phase === 'play' || view.phase === 'answer') && (
        <div className="rounded-3xl bg-black/20 p-4 mb-4">
          <div className={`font-fredoka ${big ? 'text-2xl' : 'text-lg'} text-emerald-200 mb-2`}>🏁 Solved: {view.solved.length}/{view.ids.length}</div>
          <div className="flex flex-wrap gap-2">
            {(big ? view.ids : view.solved.map(x => x.id)).map(id => {
              const sv = view.solved.find(x => x.id === id);
              const w = who(room.players, id);
              return (
                <motion.span key={id} layout initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                  className={`rounded-full px-3 py-1 font-nunito ${big ? 'text-2xl' : 'text-lg'} ${sv ? 'bg-emerald-500/70' : 'bg-white/10'}`}>
                  {w.emoji} {w.name} {sv ? `✅ +${sv.pts}` : '🤔'}
                </motion.span>
              );
            })}
            {!big && view.solved.length === 0 && <span className="font-nunito text-lg text-white/60">Nobody yet — be the first!</span>}
          </div>
        </div>
      )}

      <Scores room={room} scores={view.scores} ids={view.ids} />

      <AnimatePresence>
        {view.phase === 'answer' && view.answer && (
          <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-testid="rid-reveal">
            {iSolved && <ConfettiBurst count={50} durationMs={2000} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className={`bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-7 text-center w-full ${big ? 'max-w-2xl' : 'max-w-md'}`}>
              <div className="text-5xl mb-2">💡</div>
              <h2 className={`font-fredoka font-bold ${big ? 'text-5xl' : 'text-3xl'} text-amber-300 mb-2`}>
                <span className="uppercase">{view.answer}</span>
              </h2>
              <p className={`font-nunito ${big ? 'text-2xl' : 'text-xl'} text-white mb-3`}>{view.explanation}</p>
              {playing && (
                <p className={`font-fredoka text-xl mb-1 ${iSolved ? 'text-emerald-300' : 'text-sky-200'}`}>
                  {iSolved ? `✅ You got it! +${myPts ?? 0}` : 'That was a tricky one — you’ll get the next! 💪'}
                </p>
              )}
              <p className="font-nunito text-lg text-slate-300">{view.solved.length} of {view.ids.length} solved it · {view.round < view.total ? 'Next riddle coming up…' : 'Final scores coming up…'}</p>
            </motion.div>
          </motion.div>
        )}
        {paused && view.phase !== 'final' && (
          <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 pointer-events-none" data-testid="rid-paused">
            <div className="rounded-3xl bg-slate-900 border-4 border-amber-300 px-8 py-6 text-center shadow-2xl">
              <div className="text-6xl mb-2">⏸️</div>
              <p className="font-fredoka text-3xl text-white">Paused</p>
              <p className="font-nunito text-lg text-slate-300">Get your thinking caps on!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={isBoard ? null : reward} />
      )}
    </ArenaFrame>
  );
}
