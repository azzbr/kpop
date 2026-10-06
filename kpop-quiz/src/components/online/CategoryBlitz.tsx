import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import type { BlitzCategory } from '../../online/blitzCategories';
import { playClick, playPop, playCorrect } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { ArenaFrame, RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import {
  ROUNDS, CATS_PER_ROUND, WRITE_MS, REVIEW_MS, SCORES_MS, GRACE_MS, MAX_ANSWER,
  answerKey, buildReview, finalRoundScores, pickRound, strikeNeeded, voteId,
} from './categoryBlitzLogic';
import type { ReviewAnswer } from './categoryBlitzLogic';

// Category Blitz: one letter, five categories, 60 seconds. Answers stay on the host while
// everyone writes; the review then shows every answer (with who wrote it) so friends can 👎
// answers that don't fit.

interface State {
  ids: string[];
  round: number;
  phase: 'write' | 'review' | 'scores' | 'final';
  endsAt: number;
  letter: string;
  cats: BlitzCategory[];
  usedLetters: string[];
  usedCats: string[];
  answers: Record<string, string[]>;
  done: string[];
  review: ReviewAnswer[][];
  votes: Record<string, string[]>;
  last: { points: Record<string, number>; struck: string[]; cells: Record<string, number[]> } | null;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  round: number; phase: State['phase']; ms: number; letter: string; cats: BlitzCategory[]; done: string[];
  review?: ReviewAnswer[][]; votes?: Record<string, string[]>; last?: State['last'];
  scores: Record<string, number>; ranked?: (string | string[])[];
}

const here = (s: State, present: string[]) => s.ids.filter(id => present.includes(id));

type Present = () => string[];

function startWrite(t: HostTools<State>, s: State, p: Present): State {
  const { letter, cats } = pickRound(Math.random, s.usedLetters, s.usedCats);
  t.after('phase', WRITE_MS + GRACE_MS, () => t.set(startReview(t, t.get(), p)));
  return {
    ...s, round: s.round + 1, phase: 'write', endsAt: Date.now() + WRITE_MS, letter, cats,
    usedLetters: [...s.usedLetters, letter], usedCats: [...s.usedCats, ...cats.map(c => c.id)],
    answers: {}, done: [], review: [], votes: {}, last: null,
  };
}

function startReview(t: HostTools<State>, s: State, p: Present): State {
  if (s.phase !== 'write') return s;
  t.after('phase', REVIEW_MS, () => t.set(startScores(t, t.get(), p)));
  return { ...s, phase: 'review', endsAt: Date.now() + REVIEW_MS, review: buildReview(s.answers, s.letter, s.cats.length), votes: {} };
}

function startScores(t: HostTools<State>, s: State, p: Present): State {
  if (s.phase !== 'review') return s;
  const ids = here(s, p());
  const last = finalRoundScores(s.review, s.votes, ids.length ? ids : s.ids);
  const scores = { ...s.scores };
  for (const [id, p] of Object.entries(last.points)) scores[id] = (scores[id] ?? 0) + p;
  t.after('phase', SCORES_MS, () => t.set(afterScores(t, t.get(), p)));
  return { ...s, phase: 'scores', endsAt: Date.now() + SCORES_MS, last, scores };
}

function afterScores(t: HostTools<State>, s: State, p: Present): State {
  if (s.phase !== 'scores') return s;
  if (s.round >= ROUNDS) { t.cancel('phase'); return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) }; }
  return startWrite(t, s, p);
}

const cleanList = (v: unknown): string[] | null =>
  Array.isArray(v) ? Array.from({ length: CATS_PER_ROUND }, (_, i) => (typeof v[i] === 'string' ? (v[i] as string).slice(0, MAX_ANSWER) : '')) : null;

export default function CategoryBlitz({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;
  const hostId = useRef(room.myId);

  const { view, input, tools } = useHostGame<State, View>(room, 'cb2', {
    start: (ids, t) => startWrite(t, {
      ids, round: 0, phase: 'write', endsAt: 0, letter: 'A', cats: [], usedLetters: [], usedCats: [], answers: {}, done: [],
      review: [], votes: {}, last: null, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
    }, present),
    onInput: (s, from, m, t) => {
      if (m.kind === 'next') {
        if (from !== hostId.current) return undefined;
        if (s.phase === 'review') return startScores(t, s, present);
        if (s.phase === 'scores') return afterScores(t, s, present);
        return undefined;
      }
      if (!s.ids.includes(from) || m.round !== s.round) return undefined;
      if ((m.kind === 'ans' || m.kind === 'done') && s.phase === 'write') {
        const list = cleanList(m.list);
        if (!list) return undefined;
        const n: State = { ...s, answers: { ...s.answers, [from]: list }, done: m.kind === 'done' && !s.done.includes(from) ? [...s.done, from] : s.done };
        return here(n, presentRef.current).every(id => n.done.includes(id)) ? startReview(t, n, present) : n;
      }
      if (m.kind === 'vote' && s.phase === 'review' && typeof m.cat === 'number' && typeof m.key === 'string') {
        const a = s.review[m.cat]?.find(x => x.key === m.key);
        if (!a || a.authors.includes(from) || !a.valid) return undefined;
        const id = voteId(m.cat, m.key);
        const cur = (s.votes[id] ?? []).filter(v => v !== from);
        return { ...s, votes: { ...s.votes, [id]: m.on ? [...cur, from] : cur } };
      }
      return undefined;
    },
    view: s => ({
      round: s.round, phase: s.phase, ms: msLeft(s.endsAt), letter: s.letter, cats: s.cats, done: s.done, scores: s.scores,
      ...(s.phase !== 'write' ? { review: s.review, votes: s.votes } : {}),
      ...(s.phase === 'scores' || s.phase === 'final' ? { last: s.last } : {}),
      ...(s.phase === 'final' ? { ranked: s.ranked } : {}),
    }),
  });

  // Someone leaving can mean everyone left is done writing.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (s?.phase === 'write' && here(s, presentRef.current).every(id => s.done.includes(id))) tools.set(startReview(tools, s, present));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.round}-${view?.phase}`);
  useEffect(() => { if (view?.phase === 'review' || view?.phase === 'scores') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); finish(view.ranked); } }, [view?.phase, view?.ranked, finish]);

  if (!view) return <ArenaFrame title="Category Blitz" icon="🔠"><Waiting /></ArenaFrame>;
  const lastPts = view.phase === 'scores' ? view.last?.points : undefined;

  return (
    <ArenaFrame title="Category Blitz" icon="🔠" subtitle="Everything starts with the same letter. Be original!"
      right={<RoundPill round={view.round} of={ROUNDS} seconds={view.phase !== 'final' ? seconds : undefined} />}>
      {view.phase === 'write' && <WritePhase key={view.round} room={room} view={view} seconds={seconds} input={input} />}
      {view.phase !== 'write' && view.review && (
        <ReviewPhase room={room} view={view} input={input} />
      )}
      <Scores room={room} scores={view.scores}
        note={id => lastPts?.[id] !== undefined ? <span className="font-fredoka text-green-300">+{lastPts[id]}</span> : null} />
      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </ArenaFrame>
  );
}

function LetterTile({ letter, small }: { letter: string; small?: boolean }) {
  return (
    <motion.div initial={{ rotate: -20, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
      className={`${small ? 'w-16 h-16 text-4xl' : 'w-24 h-24 text-6xl'} shrink-0 rounded-3xl bg-gradient-to-br from-amber-300 to-pink-500 flex items-center justify-center font-fredoka text-white shadow-xl`}
      aria-label={`Letter ${letter}`} data-testid="cb2-letter">
      {letter}
    </motion.div>
  );
}

function WritePhase({ room, view, seconds, input }: { room: RoomApi; view: View; seconds: number; input: (d: Record<string, unknown>) => void }) {
  const [list, setList] = useState<string[]>(() => Array(CATS_PER_ROUND).fill(''));
  const [active, setActive] = useState(0);
  const done = view.done.includes(room.myId);
  const listRef = useRef(list);
  listRef.current = list;
  const sendList = useCallback((kind: 'ans' | 'done') => input({ kind, round: view.round, list: listRef.current }), [input, view.round]);

  // Send what we have when our own clock runs out.
  const ticking = useRef(false);
  const sentAtZero = useRef(false);
  useEffect(() => {
    if (seconds > 0) ticking.current = true;
    else if (ticking.current && !sentAtZero.current && !done) { sentAtZero.current = true; sendList('ans'); }
  }, [seconds, done, sendList]);

  const go = (i: number) => { if (i !== active) { sendList('ans'); setActive(i); } };
  const onKey = useCallback((k: string) => {
    setList(l => {
      const cur = l[active];
      if (cur.length >= MAX_ANSWER || (k === ' ' && (cur === '' || cur.endsWith(' ')))) return l;
      const n = [...l]; n[active] = cur + k; return n;
    });
  }, [active]);
  const onBackspace = useCallback(() => setList(l => { const n = [...l]; n[active] = n[active].slice(0, -1); return n; }), [active]);
  const onEnter = useCallback(() => {
    playClick();
    sendList('ans');
    const l = listRef.current;
    for (let k = 1; k <= CATS_PER_ROUND; k++) {
      const i = (active + k) % CATS_PER_ROUND;
      if (!l[i].trim()) { setActive(i); return; }
    }
  }, [active, sendList]);

  const letter = view.letter.toLowerCase();
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="flex items-center gap-4 mb-3">
        <LetterTile letter={view.letter} small />
        <div className="flex-1 font-nunito text-lg text-violet-200">Every answer starts with <b className="text-white text-2xl">{view.letter}</b>. Answers nobody else thinks of score double!</div>
        {!done && (
          <button type="button" onClick={() => { playClick(); sendList('done'); }}
            className="shrink-0 min-h-[52px] px-6 rounded-full font-fredoka text-xl bg-gradient-to-r from-green-400 to-emerald-600 active:scale-95">I’m done ✅</button>
        )}
      </div>
      <div className="grid gap-2 mb-3">
        {view.cats.map((c, i) => {
          const k = answerKey(list[i]);
          const off = k.length > 0 && k[0] !== letter;
          return (
            <button key={c.id} type="button" disabled={done} onClick={() => go(i)} data-testid="cb2-row"
              className={`min-h-[56px] rounded-2xl px-4 py-2 flex items-center gap-3 text-left border-4 ${i === active && !done ? 'bg-white/20 border-amber-300' : 'bg-black/20 border-transparent'}`}>
              <span className="text-3xl">{c.emoji}</span>
              <span className="font-nunito text-lg text-violet-200 w-40 sm:w-56 shrink-0">{c.name}</span>
              <span className="flex-1 font-fredoka text-2xl truncate">{list[i] || <span className="text-white/30">{view.letter}…</span>}</span>
              {off && <span className="font-nunito text-base text-amber-200">Starts with {view.letter}? 🤔</span>}
            </button>
          );
        })}
      </div>
      {done ? (
        <div className="text-center font-fredoka text-2xl py-2">✅ Done! Waiting for friends… {view.done.length}/{room.players.length}</div>
      ) : (
        <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space enterLabel="Next ↵" />
      )}
    </div>
  );
}

function ReviewPhase({ room, view, input }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void }) {
  const review = view.review!;
  const votes = view.votes ?? {};
  const isScores = view.phase !== 'review';
  const struck = new Set(view.last?.struck ?? []);
  const ids = room.players.map(p => p.id);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-4 mb-3">
        <LetterTile letter={view.letter} small />
        <div className="flex-1 font-nunito text-lg text-violet-200">
          {isScores ? <>You scored <b className="text-green-300 text-2xl">+{view.last?.points[room.myId] ?? 0}</b> this round! 🎉</> : 'Does every answer fit? Tap 👎 on one that doesn’t.'}
        </div>
        {room.isHost && (view.phase === 'review' || view.phase === 'scores') && (
          <div className="shrink-0">
            <button type="button" onClick={() => { playClick(); input({ kind: 'next' }); }}
              className="min-h-[52px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 active:scale-95">
              {view.phase === 'review' ? 'Scores ▶' : view.round >= ROUNDS ? 'Results ▶' : 'Next round ▶'}
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-3" aria-label={isScores ? 'Round scores' : 'Review'}>
        {view.cats.map((c, ci) => (
          <div key={c.id} className="rounded-2xl bg-white/10 p-3">
            <div className="font-fredoka text-xl mb-2">{c.emoji} {c.name}</div>
            {review[ci]?.length ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {review[ci].map(a => {
                  const vid = voteId(ci, a.key);
                  const vs = votes[vid] ?? [];
                  const mine = a.authors.includes(room.myId);
                  const iVoted = vs.includes(room.myId);
                  const out = struck.has(vid);
                  const pts = !a.valid || out ? 0 : a.pts;
                  return (
                    <div key={a.key} data-testid="cb2-answer"
                      className={`rounded-xl px-3 py-2 flex items-center gap-2 ${mine ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-black/25'}`}>
                      <div className="flex-1 min-w-0">
                        <div className={`font-fredoka text-xl truncate ${out || !a.valid ? 'line-through text-white/50' : ''}`}>{a.text}</div>
                        <div className="font-nunito text-base text-violet-200 truncate">{a.authors.map(id => who(room.players, id).emoji + ' ' + who(room.players, id).name).join(', ')}</div>
                        {!a.valid && <div className="font-nunito text-base text-amber-200">Starts with another letter</div>}
                        {out && <div className="font-nunito text-base text-amber-200">Hmm, that one didn’t fit!</div>}
                        {!isScores && a.valid && vs.length > 0 && (
                          <div className="font-nunito text-base text-rose-200">👎 {vs.length} · {Number.isFinite(strikeNeeded(a.authors, ids)) ? `${strikeNeeded(a.authors, ids)} needed to strike` : 'nobody else can vote'}</div>
                        )}
                      </div>
                      <span className="font-fredoka text-xl text-green-300 shrink-0">{isScores || !a.valid ? `+${pts}` : `+${a.pts}`}</span>
                      {!isScores && a.valid && !mine && (
                        <button type="button" aria-label={`Thumbs down ${a.text}`} aria-pressed={iVoted}
                          onClick={() => { playClick(); input({ kind: 'vote', round: view.round, cat: ci, key: a.key, on: !iVoted }); }}
                          className={`min-w-[48px] min-h-[48px] rounded-xl text-2xl ${iVoted ? 'bg-rose-500/70' : 'bg-white/15'}`}>👎</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <div className="font-nunito text-base text-white/60">No answers this time</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
