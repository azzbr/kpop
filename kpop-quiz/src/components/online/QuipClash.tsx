import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { playClick, playPop, playCorrect, playWrong, playWin } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { PartyFrame, TimerBar, PausedNote, NextButton } from './partyParts';
import { useAddressed, useAskUntil, useBoard } from './partyHooks';
import {
  ROUNDS, WRITE_MS, WRITE_TWO_MS, VOTE_MS, RESULT_MS, SCORES_MS, MAX_QUIP,
  makeMatchups, tasksOf, answersEach, answerKey, tidyQuip, checkQuip, shownQuip, scoreMatchup, roundMult, pickQuipPrompts, pairKey,
} from './quipClashLogic';
import type { Matchup, MatchupResult } from './quipClashLogic';

// Quip Clash: friends in a matchup answer the same funny prompt; everyone else votes for the
// funnier answer. Answers and who wrote what stay on the host until each matchup's result.
// Each device asks the host for its own prompts (`qc_tasks`, addressed), so the view never
// says who is paired with whom.

const PER_ROUND = 12;

interface State {
  ids: string[];
  prompts: string[];
  round: number;
  phase: 'write' | 'vote' | 'result' | 'scores' | 'final';
  endsAt: number;
  matchups: Matchup[];
  answers: Record<string, string>;
  done: string[];
  mi: number;
  slots: string[];
  votes: Record<string, string>;
  result: MatchupResult | null;
  gain: Record<string, number>;
  met: string[];
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface ResultOption { author: string; text: string; votes: number; voters: string[]; gain: number }
interface View {
  round: number; phase: State['phase']; ms: number; ids: string[];
  done: string[]; writers: number; total: number;
  vote?: { mi: number; n: number; of: number; prompt: string; options: string[]; voted: number; need: number };
  result?: { mi: number; n: number; of: number; prompt: string; options: ResultOption[]; quiplash: string | null; mult: number };
  gain?: Record<string, number>;
  scores: Record<string, number>;
  ranked?: (string | string[])[];
}
interface Task { mi: number; prompt: string }

type Present = () => string[];
interface Ctx { t: HostTools<State>; present: Present }

const here = (ids: string[], present: string[]) => ids.filter(id => present.includes(id));
const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const answered = (s: State, mi: number) => s.matchups[mi].authors.filter(a => s.answers[answerKey(mi, a)] !== undefined);
const voters = (s: State, present: string[]) => here(s.ids, present).filter(id => !s.matchups[s.mi]?.authors.includes(id));
const shown = (s: State) => s.matchups.map((_, i) => i).filter(i => answered(s, i).length > 0);

function startWrite(c: Ctx, s: State): State {
  const round = s.round + 1;
  const players = here(s.ids, c.present());
  const matchups = makeMatchups(players.length >= 2 ? players : s.ids, s.prompts.slice((round - 1) * PER_ROUND, round * PER_ROUND), Math.random, new Set(s.met));
  const ms = answersEach(matchups) === 2 ? WRITE_TWO_MS : WRITE_MS;
  const met = [...s.met];
  for (const m of matchups) for (let i = 0; i < m.authors.length; i++) for (let j = i + 1; j < m.authors.length; j++) met.push(pairKey(m.authors[i], m.authors[j]));
  c.t.after('phase', ms + 500, () => c.t.set(startVoting(c, c.t.get(), 0)));
  return { ...s, round, phase: 'write', endsAt: Date.now() + ms, matchups, answers: {}, done: [], mi: -1, slots: [], votes: {}, result: null, gain: {}, met };
}

function startVoting(c: Ctx, s: State, from: number): State {
  if (s.phase !== 'write' && s.phase !== 'result') return s;
  let mi = from;
  while (mi < s.matchups.length && answered(s, mi).length === 0) mi++;
  if (mi >= s.matchups.length) return roundScores(c, s);
  const n: State = { ...s, phase: 'vote', mi, slots: shuffle(s.matchups[mi].authors), votes: {}, result: null, endsAt: Date.now() + VOTE_MS };
  if (voters(n, c.present()).length === 0) return showResult(c, n);
  c.t.after('phase', VOTE_MS + 300, () => c.t.set(showResult(c, c.t.get())));
  return n;
}

function showResult(c: Ctx, s: State): State {
  if (s.phase !== 'vote') return s;
  const m = s.matchups[s.mi];
  const timedOut = m.authors.filter(a => s.answers[answerKey(s.mi, a)] === undefined);
  const result = scoreMatchup(m.authors, s.votes, roundMult(s.round), timedOut);
  const scores = { ...s.scores };
  const gain = { ...s.gain };
  for (const [id, p] of Object.entries(result.points)) { scores[id] = (scores[id] ?? 0) + p; gain[id] = (gain[id] ?? 0) + p; }
  c.t.after('phase', RESULT_MS, () => c.t.set(afterResult(c, c.t.get())));
  return { ...s, phase: 'result', endsAt: Date.now() + RESULT_MS, result, scores, gain };
}

const afterResult = (c: Ctx, s: State): State => (s.phase === 'result' ? startVoting(c, s, s.mi + 1) : s);

function roundScores(c: Ctx, s: State): State {
  c.t.after('phase', SCORES_MS, () => c.t.set(afterScores(c, c.t.get())));
  return { ...s, phase: 'scores', endsAt: Date.now() + SCORES_MS };
}

function afterScores(c: Ctx, s: State): State {
  if (s.phase !== 'scores') return s;
  if (s.round >= ROUNDS) { c.t.cancel('phase'); return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) }; }
  return startWrite(c, s);
}

/** Move on early once everyone still here is done. */
function maybeAdvance(c: Ctx, s: State): State {
  const present = c.present();
  if (s.phase === 'write') {
    const writers = Object.keys(tasksOf(s.matchups));
    if (here(writers, present).every(id => s.done.includes(id))) return startVoting(c, s, 0);
  }
  if (s.phase === 'vote' && voters(s, present).every(id => s.votes[id] !== undefined)) return showResult(c, s);
  return s;
}

export default function QuipClash({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const { boardMode, isBoard } = useBoard(room, config);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;
  const hostId = useRef(room.myId);
  const [tasks, setTasks] = useState<{ round: number; items: Task[]; sent: number[] } | null>(null);

  const { view, input, tools, paused } = useHostGame<State, View>(room, 'qc', {
    board: boardMode,
    start: (ids, t) => startWrite({ t, present }, {
      ids, prompts: pickQuipPrompts(ROUNDS * PER_ROUND), round: 0, phase: 'write', endsAt: 0, matchups: [], answers: {}, done: [], mi: -1,
      slots: [], votes: {}, result: null, gain: {}, met: [], scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
    }),
    onInput: (s, from, m, t) => {
      const c = { t, present };
      if (m.kind === 'next') {
        if (from !== hostId.current) return undefined;
        return s.phase === 'result' ? afterResult(c, s) : s.phase === 'scores' ? afterScores(c, s) : undefined;
      }
      if (m.kind === 'tasks') {
        const mine = tasksOf(s.matchups)[from] ?? [];
        room.send({ t: 'qc_tasks', to: from, round: s.round, items: mine.map(mi => ({ mi, prompt: s.matchups[mi].prompt })), sent: mine.filter(mi => s.answers[answerKey(mi, from)] !== undefined) });
        return undefined;
      }
      if (!s.ids.includes(from) || m.round !== s.round) return undefined;
      if (m.kind === 'ans' && s.phase === 'write' && typeof m.mi === 'number' && typeof m.text === 'string') {
        const mine = tasksOf(s.matchups)[from] ?? [];
        const k = answerKey(m.mi, from);
        if (!mine.includes(m.mi) || s.answers[k] !== undefined || checkQuip(m.text) === 'empty') return undefined;
        const answers = { ...s.answers, [k]: tidyQuip(m.text) };
        const done = mine.every(mi => answers[answerKey(mi, from)] !== undefined) ? [...s.done, from] : s.done;
        return maybeAdvance(c, { ...s, answers, done });
      }
      if (m.kind === 'vote' && s.phase === 'vote' && m.mi === s.mi && typeof m.slot === 'number') {
        const author = s.slots[m.slot];
        if (!author || s.matchups[s.mi].authors.includes(from) || s.votes[from] !== undefined) return undefined;
        return maybeAdvance(c, { ...s, votes: { ...s.votes, [from]: author } });
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const c = { t, present };
      if (s.phase === 'write') return startVoting(c, s, 0);
      if (s.phase === 'vote') return showResult(c, s);
      if (s.phase === 'result') return afterResult(c, s);
      if (s.phase === 'scores') return afterScores(c, s);
      return undefined;
    },
    view: s => {
      const order = shown(s);
      const v: View = {
        round: s.round, phase: s.phase, ms: msLeft(s.endsAt), ids: s.ids, done: s.done, writers: Object.keys(tasksOf(s.matchups)).length, scores: s.scores,
        total: s.phase === 'write' ? (answersEach(s.matchups) === 2 ? WRITE_TWO_MS : WRITE_MS) : s.phase === 'vote' ? VOTE_MS : 0,
      };
      const prompt = s.matchups[s.mi]?.prompt ?? '';
      if (s.phase === 'vote') {
        v.vote = {
          mi: s.mi, n: order.indexOf(s.mi) + 1, of: order.length, prompt,
          options: s.slots.map(a => shownQuip(s.answers[answerKey(s.mi, a)])),
          voted: Object.keys(s.votes).length, need: voters(s, presentRef.current).length,
        };
      }
      if (s.phase === 'result' && s.result) {
        const r = s.result;
        v.result = {
          mi: s.mi, n: order.indexOf(s.mi) + 1, of: order.length, prompt, quiplash: r.quiplash, mult: roundMult(s.round),
          options: s.slots.map(a => ({
            author: a, text: shownQuip(s.answers[answerKey(s.mi, a)]), votes: r.counts[a] ?? 0, gain: r.points[a] ?? 0,
            voters: Object.keys(s.votes).filter(id => s.votes[id] === a),
          })),
        };
      }
      if (s.phase === 'scores' || s.phase === 'final') v.gain = s.gain;
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  // Someone leaving can mean everyone left is done.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s) return;
    const n = maybeAdvance({ t: tools, present }, s);
    if (n !== s) tools.set(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  useAddressed(room, 'qc_tasks', m => {
    setTasks({ round: Number(m.round), items: (m.items as Task[]) ?? [], sent: (m.sent as number[]) ?? [] });
  });
  const playing = !!view && view.ids.includes(room.myId);
  useAskUntil(!!view && view.phase === 'write' && playing && tasks?.round !== view.round, () => input({ kind: 'tasks' }), view?.round);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.round}-${view?.phase}-${view?.vote?.mi ?? view?.result?.mi}`);
  useEffect(() => { if (view?.phase === 'vote' || view?.phase === 'scores') playPop(); }, [view?.phase, view?.vote?.mi]);
  useEffect(() => { if (view?.result?.quiplash) playWin(); }, [view?.result?.quiplash, view?.result?.mi]);
  useEffect(() => {
    if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!isBoard) finish(view.ranked); }
  }, [view?.phase, view?.ranked, finish, isBoard]);

  if (!view) return <PartyFrame board={isBoard} title="Quip Clash" icon="🎤"><Waiting /></PartyFrame>;

  const myTasks = tasks?.round === view.round ? tasks : null;
  const mineIn = (mi: number) => !!myTasks?.items.some(x => x.mi === mi);
  const total = view.total / 1000;
  const next = () => { playClick(); input({ kind: 'next' }); };

  return (
    <PartyFrame board={isBoard} title="Quip Clash" icon="🎤"
      subtitle={view.round >= ROUNDS && view.phase !== 'final' ? '⭐ Final round — every vote counts DOUBLE!' : 'Write something funny — then vote for the funniest!'}
      right={<RoundPill round={view.round} of={ROUNDS} seconds={view.phase === 'write' || view.phase === 'vote' ? seconds : undefined} />}>
      <PausedNote paused={paused} />
      {(view.phase === 'write' || view.phase === 'vote') && total > 0 && <TimerBar seconds={seconds} total={total} />}

      {view.phase === 'write' && (isBoard || !playing
        ? <WritingBoard room={room} view={view} big={isBoard} />
        : myTasks ? <WritePhase key={view.round} view={view} tasks={myTasks} input={input} /> : <Waiting text="Getting your prompt…" />)}

      {view.phase === 'vote' && view.vote && (
        <VotePhase key={`${view.round}-${view.vote.mi}`} view={view} input={input} mine={mineIn(view.vote.mi)} watching={isBoard || !playing} big={isBoard} />
      )}

      {view.phase === 'result' && view.result && (
        <ResultPhase key={`${view.round}-${view.result.mi}`} room={room} view={view} big={isBoard} onNext={room.isHost ? next : undefined} />
      )}

      {(view.phase === 'scores' || view.phase === 'final') && (
        <div className="mb-4">
          <h2 className={`font-fredoka text-center mb-3 ${isBoard ? 'text-5xl' : 'text-3xl'}`}>{view.phase === 'final' ? '🏁 Final scores' : `📊 Scores after round ${view.round}`}</h2>
          {room.isHost && view.phase === 'scores' && <NextButton onClick={next} />}
        </div>
      )}

      <div className={isBoard ? 'text-2xl' : ''}>
        <Scores room={room} scores={view.scores} ids={view.ids}
          note={id => (view.phase === 'scores' || view.phase === 'final') && view.gain?.[id] ? (
            <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-fredoka text-green-300">+{view.gain[id]}</motion.span>
          ) : null} />
      </div>

      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </PartyFrame>
  );
}

function PromptCard({ text, big, label }: { text: string; big?: boolean; label?: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center" data-testid="qc-prompt">
      {label && <div className={`font-nunito text-violet-200 mb-1 ${big ? 'text-2xl' : 'text-lg'}`}>{label}</div>}
      <p className={`font-fredoka leading-snug ${big ? 'text-5xl md:text-6xl' : 'text-2xl md:text-3xl'}`}>{text}</p>
    </div>
  );
}

function WritingBoard({ room, view, big }: { room: RoomApi; view: View; big: boolean }) {
  return (
    <div className="rounded-3xl bg-white/10 p-6 mb-4 text-center">
      <div className={`font-fredoka mb-3 ${big ? 'text-5xl' : 'text-2xl'}`}>✍️ Everyone is writing on their device…</div>
      <div className={`font-nunito text-violet-200 mb-4 ${big ? 'text-3xl' : 'text-lg'}`}>{view.done.length}/{view.writers} done</div>
      <div className="flex flex-wrap justify-center gap-3">
        {view.ids.map(id => {
          const w = who(room.players, id);
          const done = view.done.includes(id);
          return (
            <motion.span key={id} animate={{ scale: done ? 1.1 : 1 }}
              className={`rounded-full px-4 py-2 font-fredoka ${big ? 'text-3xl' : 'text-lg'} ${done ? 'bg-green-500/40' : 'bg-black/25 opacity-70'}`}>
              {w.emoji} {w.name} {done ? '✅' : '✏️'}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}

function WritePhase({ view, tasks, input }: { view: View; tasks: { items: Task[]; sent: number[] }; input: (d: Record<string, unknown>) => void }) {
  const [sent, setSent] = useState<number[]>(tasks.sent);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const cur = tasks.items.find(t => !sent.includes(t.mi));

  const onKey = useCallback((k: string) => {
    setMsg(null);
    setDraft(d => (d.length >= MAX_QUIP || (k === ' ' && (d === '' || d.endsWith(' '))) ? d : d + (d === '' ? k : k.toLowerCase())));
  }, []);
  const onBackspace = useCallback(() => { setMsg(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => {
    if (!cur) return;
    const r = checkQuip(draft);
    if (r === 'empty') { setMsg('Type something funny first ✍️'); playWrong(); return; }
    if (r === 'unkind') { setMsg('Let’s keep it kind — try another one 🙂'); playWrong(); return; }
    playClick();
    input({ kind: 'ans', round: view.round, mi: cur.mi, text: tidyQuip(draft) });
    setSent(s => [...s, cur.mi]);
    setDraft('');
  }, [cur, draft, input, view.round]);

  if (!cur) {
    return (
      <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center">
        <div className="font-fredoka text-2xl">✅ Answer{tasks.items.length > 1 ? 's' : ''} sent!</div>
        <div className="font-nunito text-lg text-violet-200 mt-1">Waiting for friends… {view.done.length}/{view.writers} done</div>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <PromptCard text={cur.prompt} label={tasks.items.length > 1 ? `Prompt ${sent.length + 1} of ${tasks.items.length}` : 'Your prompt'} />
      <div className="rounded-3xl bg-white/10 p-4">
        <div className="min-h-[60px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-2xl md:text-3xl text-center mb-2 break-words" data-testid="qc-draft">
          {draft || <span className="text-white/30">Your funny answer…</span>}
        </div>
        <div className="font-nunito text-base text-violet-200 text-right mb-1">{draft.length}/{MAX_QUIP}</div>
        {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
        <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space digits enterLabel="Send 🎤" />
      </div>
    </div>
  );
}

const LETTERS = ['🅰️', '🅱️', '🌟'];
const OPTION_CLS = ['from-pink-500/50 to-rose-500/40', 'from-sky-500/50 to-indigo-500/40', 'from-amber-400/50 to-orange-500/40'];

function VotePhase({ view, input, mine, watching, big }: { view: View; input: (d: Record<string, unknown>) => void; mine: boolean; watching: boolean; big: boolean }) {
  const v = view.vote!;
  const [pick, setPick] = useState<number | null>(null);
  const canVote = !mine && !watching && pick === null;
  const vote = (slot: number) => {
    if (!canVote) return;
    playClick();
    setPick(slot);
    input({ kind: 'vote', round: view.round, mi: v.mi, slot });
  };
  return (
    <div className="mb-4">
      <PromptCard text={v.prompt} big={big} label={`Matchup ${v.n} of ${v.of}`} />
      <div className={`grid gap-4 mb-3 ${v.options.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {v.options.map((text, i) => (
          <motion.button key={i} type="button" data-testid="qc-opt" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.25 }}
            whileTap={canVote ? { scale: 0.95 } : undefined} disabled={!canVote} onClick={() => vote(i)}
            className={`rounded-3xl p-5 bg-gradient-to-br ${OPTION_CLS[i]} border-4 text-left ${pick === i ? 'border-amber-300' : 'border-transparent'} ${pick !== null && pick !== i ? 'opacity-50' : ''} ${big ? 'min-h-[180px]' : 'min-h-[96px]'}`}>
            <span className={big ? 'text-4xl' : 'text-2xl'}>{LETTERS[i]}</span>
            <span className={`block font-fredoka mt-1 break-words ${big ? 'text-5xl' : 'text-2xl md:text-3xl'}`}>{text}</span>
          </motion.button>
        ))}
      </div>
      <p className={`font-nunito text-center ${big ? 'text-3xl' : 'text-lg'} text-violet-200`} role="status">
        {mine ? '🤫 One of these is yours — sit back and watch the votes!'
          : watching ? `🗳️ Vote on your devices! ${v.voted}/${v.need} voted`
            : pick !== null ? `🗳️ Vote in! ${v.voted}/${v.need} voted` : 'Tap the funniest answer!'}
      </p>
    </div>
  );
}

function ResultPhase({ room, view, big, onNext }: { room: RoomApi; view: View; big: boolean; onNext?: () => void }) {
  const r = view.result!;
  return (
    <div className="mb-4" aria-label="Result">
      <PromptCard text={r.prompt} big={big} label={`Matchup ${r.n} of ${r.of}`} />
      {r.quiplash && (
        <motion.div initial={{ scale: 0.2, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220 }}
          className={`text-center font-fredoka text-amber-300 drop-shadow-[0_0_20px_rgba(252,211,77,0.8)] mb-3 ${big ? 'text-7xl' : 'text-5xl'}`}>
          💥 QUIPLASH! 💥
          <div className={`font-nunito text-white ${big ? 'text-3xl' : 'text-lg'}`}>{who(room.players, r.quiplash).name} got every vote!</div>
        </motion.div>
      )}
      <div className={`grid gap-4 ${r.options.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {r.options.map((o, i) => {
          const w = who(room.players, o.author);
          const top = o.votes > 0 && o.votes === Math.max(...r.options.map(x => x.votes));
          return (
            <motion.div key={o.author} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.4 }}
              className={`rounded-3xl p-5 bg-gradient-to-br ${OPTION_CLS[i]} ${top ? 'ring-4 ring-amber-300' : ''} ${o.author === room.myId ? 'outline outline-2 outline-white/60' : ''}`}>
              <div className={`font-fredoka break-words ${big ? 'text-4xl' : 'text-2xl'}`}>{o.text}</div>
              <div className={`font-nunito mt-2 ${big ? 'text-2xl' : 'text-lg'}`}>✍️ {w.emoji} {w.name}</div>
              <div className={`font-fredoka mt-1 ${big ? 'text-3xl' : 'text-xl'}`}>
                {o.votes} vote{o.votes === 1 ? '' : 's'} {o.gain > 0 && <span className="text-green-300">+{o.gain}</span>}
              </div>
              {o.voters.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {o.voters.map(id => <span key={id} className="rounded-full bg-black/25 px-2 py-0.5 font-nunito text-base">{who(room.players, id).emoji} {who(room.players, id).name}</span>)}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      {r.options.every(o => o.votes === 0) && <p className="font-nunito text-lg text-violet-200 text-center mt-3">No votes this time — you all made us smile! 😄</p>}
      {onNext && <NextButton onClick={onNext} />}
    </div>
  );
}
