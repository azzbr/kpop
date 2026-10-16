import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { PARTS, type Part, type MonsterTheme } from '../../online/monsterParts';
import { playClick, playPop, playCorrect, playWrong, playUnlock, playWin } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import { FinalCard } from './RaceParts';
import { ArenaFrame, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { usePictures, snapPicture, newSheet, loadImage, fitText, saveSheet, type Pictures } from './arenaPictures';
import {
  DRAW_MS, NAME_MS, VOTE_MS, GRACE_MS, RESULT_MS, MAX_NAME, MAKER_POINTS, PART_DROP_MS, stackMs,
  monsterPlan, assignParts, neighbours, makeSeams, pickThemes, roundsFrom, checkName, tidyName, nameKey,
  nameOptions, canVoteName, hasNameChoice, scoreNames, picId,
  type Slot, type NameOption, type NameCheck,
} from './monsterMashLogic';

// Monster Mash: everyone secretly draws one part of a monster (with guide dots where the
// neighbours join), then the parts are stacked and revealed, everyone names the monster and
// votes for the best name. Cooperative and silly. Host-authoritative on useHostGame (prefix
// mash). Part assignments are public; the drawings travel one `mash_pic` each (arenaPictures)
// and the view only names picture ids, and only once the monster is revealed.

const PREFIX = 'mash';
type Phase = 'draw' | 'stack' | 'name' | 'vote' | 'result' | 'final';

interface State {
  ids: string[];
  rounds: number;
  round: number;
  themes: MonsterTheme[];
  plan: Part[][];
  assign: Record<string, Slot>;
  seams: number[][][];
  phase: Phase;
  endsAt: number;
  closing: boolean;
  drew: Record<string, string>;
  names: Record<string, string>;
  notes: Record<string, { n: number; r: NameCheck }>;
  options: NameOption[][];
  votes: Record<string, string>;
  counts: Record<string, number>[];
  winners: string[][];
  gained: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface PartPic { part: Part; by?: string; pic: string }
interface View {
  phase: Phase; ms: number; closing: boolean; ids: string[];
  round: number; rounds: number; theme: MonsterTheme; plan: Part[][]; assign: Record<string, Slot>; seams: number[][][];
  done: string[];
  notes: State['notes'];
  monsters?: PartPic[][];
  options?: { key: string; text: string }[][];
  result?: { options: NameOption[][]; counts: Record<string, number>[]; winners: string[][]; gained: Record<string, number> };
  scores: Record<string, number>;
  ranked?: (string | string[])[];
}

interface G { t: HostTools<State>; present: () => string[] }

const nMonsters = (s: { plan: Part[][] }) => s.plan.length;
/** Which monster a player names / votes on (with two monsters: the other team's / their own). */
const nameTarget = (s: { plan: Part[][]; assign: Record<string, Slot> }, id: string) => (nMonsters(s) === 1 ? 0 : 1 - (s.assign[id]?.monster ?? 0));
const voteTarget = (s: { plan: Part[][]; assign: Record<string, Slot> }, id: string) => (nMonsters(s) === 1 ? 0 : s.assign[id]?.monster ?? 0);

function monsterPics(s: State): PartPic[][] {
  return s.plan.map((parts, m) => parts.map((part, slot) => {
    const by = s.ids.find(id => s.assign[id]?.monster === m && s.assign[id]?.slot === slot);
    return { part, by, pic: by ? s.drew[by] ?? '' : '' };
  }));
}

function startRound(g: G, s: State, round: number): State {
  const n: State = {
    ...s, round, assign: assignParts(s.ids, round), seams: makeSeams(s.plan), phase: 'draw', endsAt: Date.now() + DRAW_MS, closing: false,
    drew: {}, names: {}, notes: {}, options: [], votes: {}, counts: [], winners: [], gained: {},
  };
  g.t.after('phase', DRAW_MS + 300, () => { const c = g.t.get(); if (c.phase === 'draw' && c.round === round) g.t.set(close(g, c, endDraw)); });
  return n;
}

function close(g: G, s: State, then: (g: G, s: State) => State): State {
  if (s.closing) return s;
  g.t.after('phase', GRACE_MS, () => g.t.set(then(g, g.t.get())));
  return { ...s, closing: true };
}

function endDraw(g: G, s: State): State {
  if (s.phase !== 'draw') return s;
  g.t.cancel('phase');
  const gained: Record<string, number> = {};
  const scores = { ...s.scores };
  for (const id of s.ids) if (s.drew[id] !== undefined) { gained[id] = MAKER_POINTS; scores[id] = (scores[id] ?? 0) + MAKER_POINTS; }
  const ms = stackMs(Math.max(...s.plan.map(p => p.length)));
  g.t.after('phase', ms, () => g.t.set(startName(g, g.t.get())));
  return { ...s, phase: 'stack', endsAt: Date.now() + ms, closing: false, gained, scores };
}

function startName(g: G, s: State): State {
  if (s.phase !== 'stack') return s;
  g.t.after('phase', NAME_MS + 300, () => { const c = g.t.get(); if (c.phase === 'name' && c.round === s.round) g.t.set(close(g, c, startVote)); });
  return maybeAdvance(g, { ...s, phase: 'name', endsAt: Date.now() + NAME_MS, closing: false, names: {}, notes: {} });
}

function startVote(g: G, s: State): State {
  if (s.phase !== 'name') return s;
  g.t.cancel('phase');
  const options = s.plan.map((_, m) => nameOptions(Object.fromEntries(Object.entries(s.names).filter(([id]) => nameTarget(s, id) === m))));
  const n: State = { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, closing: false, options, votes: {} };
  if (!s.ids.some(id => hasNameChoice(options[voteTarget(s, id)] ?? [], id))) return result(g, n);
  g.t.after('phase', VOTE_MS + 300, () => g.t.set(result(g, g.t.get())));
  return maybeAdvance(g, n);
}

function result(g: G, s: State): State {
  if (s.phase !== 'vote') return s;
  g.t.cancel('phase');
  const scores = { ...s.scores };
  const gained: Record<string, number> = { ...s.gained };
  const counts: Record<string, number>[] = [];
  const winners: string[][] = [];
  s.plan.forEach((_, m) => {
    const votes = Object.fromEntries(Object.entries(s.votes).filter(([id]) => voteTarget(s, id) === m));
    const r = scoreNames(s.options[m] ?? [], votes);
    counts.push(r.counts);
    winners.push(r.winners);
    for (const [id, p] of Object.entries(r.points)) { gained[id] = (gained[id] ?? 0) + p; scores[id] = (scores[id] ?? 0) + p; }
  });
  g.t.after('phase', RESULT_MS, () => g.t.set(afterResult(g, g.t.get())));
  return { ...s, phase: 'result', endsAt: Date.now() + RESULT_MS, counts, winners, gained, scores };
}

function afterResult(g: G, s: State): State {
  if (s.phase !== 'result') return s;
  g.t.cancel('phase');
  if (s.round + 1 >= s.rounds) return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) };
  return startRound(g, s, s.round + 1);
}

function maybeAdvance(g: G, s: State): State {
  const here = s.ids.filter(id => g.present().includes(id));
  if (s.phase === 'draw' && here.every(id => s.drew[id] !== undefined)) return endDraw(g, s);
  if (s.phase === 'name' && here.every(id => s.names[id] !== undefined)) return startVote(g, s);
  if (s.phase === 'vote' && here.every(id => s.votes[id] !== undefined || !hasNameChoice(s.options[voteTarget(s, id)] ?? [], id))) return result(g, s);
  return s;
}

export default function MonsterMash({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const board = config?.board === '1';
  const rounds = roundsFrom(config?.rounds);
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const hostId = useRef(room.myId);
  const mk = (t: HostTools<State>): G => ({ t, present: () => presentRef.current });
  const myNames = useRef(new Map<number, string>());

  const { view, input, tools, paused } = useHostGame<State, View>(room, PREFIX, {
    board,
    start: (ids, t) => {
      const order = [...ids];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const s: State = {
        ids: order, rounds, round: 0, themes: pickThemes(rounds), plan: monsterPlan(order.length), assign: {}, seams: [], phase: 'draw', endsAt: 0,
        closing: false, drew: {}, names: {}, notes: {}, options: [], votes: {}, counts: [], winners: [], gained: {},
        scores: Object.fromEntries(order.map(id => [id, 0])), ranked: [],
      };
      return startRound(mk(t), s, 0);
    },
    onInput: (s, from, m, t) => {
      const g = mk(t);
      if (m.kind === 'next') return from === hostId.current && s.phase === 'result' ? afterResult(g, s) : undefined;
      if (!s.ids.includes(from) || m.round !== s.round) return undefined;
      if (m.kind === 'drew' && s.phase === 'draw' && s.drew[from] === undefined) {
        return maybeAdvance(g, { ...s, drew: { ...s.drew, [from]: m.pic === picId(s.round, from) ? m.pic : '' } });
      }
      if (m.kind === 'name' && s.phase === 'name' && s.names[from] === undefined && typeof m.text === 'string') {
        const text = tidyName(m.text);
        const r = checkName(text);
        const n = Number(m.n) || 0;
        if (r !== 'ok') return { ...s, notes: { ...s.notes, [from]: { n, r } } };
        return maybeAdvance(g, { ...s, names: { ...s.names, [from]: text }, notes: { ...s.notes, [from]: { n, r } } });
      }
      if (m.kind === 'vote' && s.phase === 'vote' && s.votes[from] === undefined && typeof m.key === 'string') {
        const opt = (s.options[voteTarget(s, from)] ?? []).find(o => o.key === m.key);
        if (!canVoteName(opt, from)) return undefined;
        return maybeAdvance(g, { ...s, votes: { ...s.votes, [from]: m.key } });
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const g = mk(t);
      if (s.phase === 'draw') return s.closing ? endDraw(g, s) : close(g, s, endDraw);
      if (s.phase === 'stack') return startName(g, s);
      if (s.phase === 'name') return s.closing ? startVote(g, s) : close(g, s, startVote);
      if (s.phase === 'vote') return result(g, s);
      if (s.phase === 'result') return afterResult(g, s);
      return undefined;
    },
    view: s => {
      const v: View = {
        phase: s.phase, ms: msLeft(s.endsAt), closing: s.closing, ids: s.ids, round: s.round, rounds: s.rounds, theme: s.themes[s.round] ?? s.themes[0],
        plan: s.plan, assign: s.assign, seams: s.seams, done: [], notes: s.phase === 'name' ? s.notes : {}, scores: s.scores,
      };
      if (s.phase === 'draw') v.done = Object.keys(s.drew);
      if (s.phase !== 'draw') v.monsters = monsterPics(s);
      if (s.phase === 'name') v.done = Object.keys(s.names);
      if (s.phase === 'vote') {
        v.done = s.ids.filter(id => s.votes[id] !== undefined || !hasNameChoice(s.options[voteTarget(s, id)] ?? [], id));
        v.options = s.options.map(os => os.map(o => ({ key: o.key, text: o.text })));
      }
      if (s.phase === 'result' || (s.phase === 'final' && s.options.length)) v.result = { options: s.options, counts: s.counts, winners: s.winners, gained: s.gained };
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s) return;
    const n = maybeAdvance(mk(tools), s);
    if (n !== s) tools.set(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  const hostState = room.isHost ? tools.get() : null;
  const wanted = [
    ...(hostState ? Object.values(hostState.drew).filter(Boolean) : []),
    ...(view?.monsters ?? []).flat().map(p => p.pic).filter(Boolean),
  ];
  const pics = usePictures(room, PREFIX, [...new Set(wanted)]);

  const seconds = useCountdown(view && ['draw', 'name', 'vote'].includes(view.phase) && !view.closing ? view.ms : undefined, `${view?.phase}-${view?.round}-${view?.closing}`);
  useEffect(() => { if (view?.phase === 'draw') playUnlock(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'stack') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'result') playWin(); }, [view?.phase, view?.round]);
  // The big screen doesn't play, so it gets no reward.
  const watching = board && room.isHost;
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!watching) finish(view.ranked); } }, [view?.phase, view?.ranked, finish, watching]);

  if (!view) return <ArenaFrame title="Monster Mash" icon="🧟" tint={TINT}><Waiting /></ArenaFrame>;

  const me = room.myId;
  const amPlayer = view.ids.includes(me);
  const two = view.plan.length === 2;
  const pill = (
    <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right" aria-label="Timer">
      <div>Round {view.round + 1}/{view.rounds}</div>
      {paused ? <div className="text-amber-300">⏸️ Paused</div>
        : view.closing ? <div className="text-amber-300">📨 Sending…</div>
          : ['draw', 'name', 'vote'].includes(view.phase) && <div className={seconds <= 5 ? 'text-amber-300' : 'text-lime-200'}>⏱️ {seconds}s</div>}
    </div>
  );
  const themeCard = (
    <div className="rounded-3xl bg-white/10 px-4 py-3 mb-3 text-center" data-testid="mash-theme">
      <span className="font-nunito text-lg text-lime-100">This round: </span>
      <span className="font-fredoka text-2xl">{view.theme.emoji} {view.theme.text}</span>
    </div>
  );
  const nameMonsterIdx = amPlayer ? nameTarget(view, me) : 0;
  const voteMonsterIdx = amPlayer ? voteTarget(view, me) : 0;

  return (
    <ArenaFrame title="Monster Mash" icon="🧟" tint={TINT} right={pill}
      subtitle="Draw a secret part — then meet your silly monster!">
      {paused && <div className="rounded-2xl bg-amber-400/25 ring-2 ring-amber-300 px-4 py-2 mb-3 text-center font-fredoka text-xl">⏸️ The game is paused — back in a moment!</div>}
      {view.phase !== 'final' && themeCard}

      {view.phase === 'draw' && (amPlayer && view.assign[me]
        ? <DrawPhase key={view.round} room={room} view={view} slot={view.assign[me]} pics={pics} input={input} paused={paused} />
        : <Progress room={room} ids={view.ids} done={view.done} text="Everyone is drawing a secret monster part…" />)}

      {(view.phase === 'stack' || view.phase === 'name' || view.phase === 'vote' || view.phase === 'result') && view.monsters && (
        <div className={`flex flex-wrap justify-center gap-6 mb-4 ${view.phase === 'name' || view.phase === 'vote' ? '' : ''}`}>
          {view.monsters.map((parts, m) => {
            // While naming / voting with two monsters, show only the one you're working on.
            if (amPlayer && two && view.phase === 'name' && m !== nameMonsterIdx) return null;
            if (amPlayer && two && view.phase === 'vote' && m !== voteMonsterIdx) return null;
            const names = view.result?.winners[m]?.map(k => view.result!.options[m].find(o => o.key === k)?.text).filter(Boolean) as string[] | undefined;
            return (
              <div key={`${view.round}-${m}`} className="text-center">
                {two && <div className="font-fredoka text-xl mb-1">{m === 0 ? '🟢 Monster A' : '🟣 Monster B'}</div>}
                <MonsterStack parts={parts} pics={pics} animate={view.phase === 'stack'} size={board ? 'lg' : two ? 'sm' : 'md'} room={room} />
                {view.phase === 'result' && (
                  <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                    className="font-fredoka text-3xl md:text-4xl mt-3 text-lime-200" data-testid="mash-winner">
                    {names?.length ? `👑 ${names.join(' & ')}` : '👑 The Mystery Monster'}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view.phase === 'stack' && <div className="text-center font-fredoka text-3xl mb-4 animate-pulse">🥁 Here comes your monster…</div>}

      {view.phase === 'name' && (amPlayer
        ? <NamePhase key={view.round} room={room} view={view} input={input} paused={paused} two={two} mine={myNames.current} />
        : <Progress room={room} ids={view.ids} done={view.done} text="Everyone is thinking of a name…" />)}

      {view.phase === 'vote' && view.options && (amPlayer
        ? <VotePhase key={view.round} room={room} view={view} options={view.options[voteMonsterIdx] ?? []} input={input} two={two} own={myNames.current.get(view.round)} />
        : <Progress room={room} ids={view.ids} done={view.done} text="Vote for the best name on your iPads!" />)}

      {view.phase === 'result' && view.result && (
        <ResultPhase room={room} view={view} pics={pics}
          onNext={room.isHost ? () => { playClick(); input({ kind: 'next' }); } : undefined} />
      )}

      <Scores room={room} scores={view.scores} ids={view.ids}
        note={id => view.phase === 'result' && view.result?.gained[id] ? (
          <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-fredoka text-green-300">+{view.result.gained[id]}</motion.span>
        ) : null} />

      {view.phase === 'final' && view.ranked && <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />}
    </ArenaFrame>
  );
}

const TINT = 'from-emerald-950 via-teal-900 to-violet-950';

function Progress({ room, ids, done, text }: { room: RoomApi; ids: string[]; done: string[]; text: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-6 mb-4 text-center">
      <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-6xl mb-2">🧟</motion.div>
      <div className="font-fredoka text-2xl md:text-3xl mb-3">{text}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {ids.map(id => (
          <span key={id} className={`rounded-full px-3 py-1 font-nunito text-lg ${done.includes(id) ? 'bg-green-500/40' : 'bg-black/25'}`}>
            {done.includes(id) ? '✅' : '⏳'} {who(room.players, id).emoji} {who(room.players, id).name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Drawing a part ----------

function DrawPhase({ room, view, slot, pics, input, paused }: {
  room: RoomApi; view: View; slot: Slot; pics: Pictures; input: (d: Record<string, unknown>) => void; paused: boolean;
}) {
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const [sent, setSent] = useState(false);
  const last = useRef<Record<string, unknown> | null>(null);
  const done = view.done.includes(room.myId);
  const info = PARTS[slot.part];
  const { above, below } = neighbours(view.plan, slot);
  const seams = view.seams[slot.monster] ?? [];

  const submit = useCallback((auto: boolean) => {
    if (sent) return;
    const img = snapPicture(canvasRef.current);
    const id = picId(view.round, room.myId);
    if (img) pics.send(id, img);
    if (!auto) playClick();
    last.current = { kind: 'drew', round: view.round, pic: img ? id : '' };
    setSent(true);
    input(last.current);
  }, [sent, pics, room.myId, input, view.round]);
  useEffect(() => { if (view.closing && !sent && !done) submit(true); }, [view.closing, sent, done, submit]);
  useEffect(() => {
    if (!sent || done || paused) return;
    const iv = window.setInterval(() => { if (last.current) input(last.current); }, 3500);
    return () => window.clearInterval(iv);
  }, [sent, done, paused, input]);

  if (sent || done) return <Progress room={room} ids={view.ids} done={view.done} text="Part sent! Waiting for the other monster makers…" />;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
        <div className="rounded-2xl bg-amber-400/20 border-2 border-amber-400 px-5 py-2 text-center" data-testid="mash-part">
          <div className="font-fredoka text-2xl">You’re drawing the {info.emoji} <span className="text-amber-300 uppercase">{info.label}</span>!</div>
          <div className="font-nunito text-lg text-amber-100">{info.tip} Fill the page — big and silly!</div>
        </div>
        <div className="flex flex-col gap-1" aria-label="The monster">
          {view.plan[slot.monster].map((p, i) => (
            <span key={i} className={`rounded-full px-3 py-0.5 font-nunito text-base ${i === slot.slot ? 'bg-amber-400 text-stone-900 font-bold' : 'bg-white/10'}`}>
              {PARTS[p].emoji} {PARTS[p].label}{i === slot.slot ? ' ← you' : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <DrawCanvas ref={canvasRef} />
        <GuideOverlay top={above ? { xs: seams[slot.slot - 1] ?? [], label: `⬆️ the ${PARTS[above].label.toLowerCase()} joins here` } : undefined}
          bottom={below ? { xs: seams[slot.slot] ?? [], label: `⬇️ the ${PARTS[below].label.toLowerCase()} joins here` } : undefined} />
      </div>
      <p className="font-nunito text-lg text-lime-100 text-center mt-2">Start your lines on the dots so the parts join up!</p>
      <button onClick={() => submit(false)} disabled={paused}
        className="mt-3 w-full min-h-[56px] rounded-full font-fredoka text-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-stone-900 shadow-xl active:scale-95 disabled:opacity-50">
        ✅ Done — send my part!
      </button>
    </div>
  );
}

/** Faint guide bands over the canvas (not part of the picture): where the neighbouring parts join. */
function GuideOverlay({ top, bottom }: { top?: { xs: number[]; label: string }; bottom?: { xs: number[]; label: string } }) {
  const [box, setBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const markRef = useRef<HTMLDivElement>(null);
  // Sits over the canvas wherever DrawCanvas puts it (the toolbar may be above or below).
  useLayoutEffect(() => {
    const wrap = markRef.current?.parentElement;
    const cv = wrap?.querySelector('canvas');
    if (!wrap || !cv) return;
    const upd = () => {
      const a = wrap.getBoundingClientRect();
      const b = cv.getBoundingClientRect();
      setBox({ l: b.left - a.left, t: b.top - a.top, w: b.width, h: b.height });
    };
    upd();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(upd) : null;
    ro?.observe(cv);
    ro?.observe(wrap);
    window.addEventListener('resize', upd);
    return () => { ro?.disconnect(); window.removeEventListener('resize', upd); };
  }, []);
  if (!box) return <div ref={markRef} className="hidden" />;
  const band = (edge: 'top' | 'bottom', g: { xs: number[]; label: string }) => {
    const y = edge === 'top' ? 1.2 : 73.8;
    return (
      <g key={edge}>
        <rect x={0} y={edge === 'top' ? 0 : 67} width={100} height={8} fill="#a855f7" opacity={0.08} />
        <line x1={0} y1={y} x2={100} y2={y} stroke="#a855f7" strokeWidth={0.4} strokeDasharray="1.5 1.5" opacity={0.5} />
        {g.xs.map(x => <circle key={x} cx={x * 100} cy={y} r={1.6} fill="#a855f7" opacity={0.55} />)}
      </g>
    );
  };
  const label = 'absolute left-0 right-0 text-center font-nunito text-base text-purple-500/80 pointer-events-none';
  return (
    <div ref={markRef} className="absolute pointer-events-none" style={{ left: box.l, top: box.t, width: box.w, height: box.h }} aria-hidden data-testid="mash-guide">
      <svg viewBox="0 0 100 75" preserveAspectRatio="none" className="w-full h-full">
        {top && band('top', top)}
        {bottom && band('bottom', bottom)}
      </svg>
      {top && <div className={label} style={{ top: '3%' }}>{top.label}</div>}
      {bottom && <div className={label} style={{ bottom: '3%' }}>{bottom.label}</div>}
    </div>
  );
}

// ---------- The stacked monster ----------

const STACK_W = { sm: 260, md: 320, lg: 420 };

function MonsterStack({ parts, pics, animate, size, room }: { parts: PartPic[]; pics: Pictures; animate: boolean; size: 'sm' | 'md' | 'lg'; room: RoomApi }) {
  const drop = PART_DROP_MS / 1000;
  return (
    <motion.div className="mx-auto rounded-3xl overflow-hidden bg-white shadow-2xl ring-4 ring-lime-300/60"
      // As wide as fits: the whole monster should stay on screen (4:3 parts stacked).
      style={{ width: `min(${STACK_W[size]}px, 80vw, max(150px, calc((100dvh - 320px) * ${(4 / (3 * Math.max(1, parts.length))).toFixed(3)})))` }}
      animate={animate ? { rotate: [0, 0, -3, 3, -2, 0] } : {}} transition={animate ? { delay: parts.length * drop + 0.2, duration: 1 } : undefined}
      data-testid="mash-monster">
      {parts.map((p, i) => {
        const src = p.pic ? pics.get(p.pic) : undefined;
        return (
          <motion.div key={i} initial={animate ? { y: -260, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: animate ? i * drop : 0, type: 'spring', stiffness: 160, damping: 14 }}
            className="relative aspect-[4/3] bg-white" title={`${PARTS[p.part].label}${p.by ? ` by ${who(room.players, p.by).name}` : ''}`}>
            {src ? <img src={src} alt={PARTS[p.part].label} className="block w-full h-full" />
              : <div className="w-full h-full flex items-center justify-center text-gray-500 font-nunito text-base text-center px-2">
                {p.pic ? '🖼️ on its way…' : `🙈 the ${PARTS[p.part].label.toLowerCase()} went missing — imagine it!`}
              </div>}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ---------- Naming & voting ----------

function NamePhase({ room, view, input, paused, two, mine }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; paused: boolean; two: boolean; mine: Map<number, string> }) {
  const [draft, setDraft] = useState('');
  const [tries, setTries] = useState(0);
  const [local, setLocal] = useState<NameCheck | null>(null);
  const done = view.done.includes(room.myId);
  const note = view.notes[room.myId];
  const answered = note && note.n === tries ? note.r : null;
  const checking = tries > 0 && !done && !answered;
  const send = useCallback((auto: boolean) => {
    const r = checkName(draft);
    if (r !== 'ok') { if (!auto) { setLocal(r); playWrong(); } return; }
    if (!auto) playClick();
    const n = tries + 1;
    setTries(n);
    mine.set(view.round, draft);
    input({ kind: 'name', round: view.round, text: draft, n });
  }, [draft, tries, input, view.round, mine]);
  useEffect(() => { if (view.closing && !done && !checking) send(true); }, [view.closing]); // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = useCallback((k: string) => {
    setLocal(null);
    setDraft(d => (d.length >= MAX_NAME || (k === ' ' && (d === '' || d.endsWith(' '))) ? d : d + (d === '' || d.endsWith(' ') ? k.toUpperCase() : k.toLowerCase())));
  }, []);
  const onBackspace = useCallback(() => { setLocal(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => send(false), [send]);

  if (done) {
    return (
      <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center">
        <div className="font-fredoka text-2xl">✅ Name sent!</div>
        <div className="font-nunito text-lg text-lime-100 mt-1">Waiting for friends… {view.done.length}/{view.ids.length} done</div>
      </div>
    );
  }
  const msg = local === 'empty' ? 'Type a name first ✍️' : local === 'unkind' || answered === 'unkind' ? 'Let’s keep it kind — try a different name 🙂' : null;
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-fredoka text-2xl text-center mb-2">{two ? '✍️ Name the other team’s monster!' : '✍️ What’s this monster called?'}</div>
      <div className="min-h-[56px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-3xl text-center tracking-wide mb-2" data-testid="mash-draft">
        {draft || <span className="text-white/30">Sir Wobbles…</span>}
      </div>
      {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
      {checking && <p className="font-nunito text-lg text-lime-100 text-center mb-2">Checking… 🔍</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={checking || paused} enterLabel="Send ✍️" />
    </div>
  );
}

function VotePhase({ room, view, options, input, two, own: ownText }: {
  room: RoomApi; view: View; options: { key: string; text: string }[]; input: (d: Record<string, unknown>) => void; two: boolean; own?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = view.done.includes(room.myId);
  // Authors stay secret until the result, so this device remembers the name it typed.
  const own = ownText ? nameKey(ownText) : null;
  const pick = (key: string) => {
    if (done || picked) return;
    playClick();
    setPicked(key);
    input({ kind: 'vote', round: view.round, key });
  };
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-fredoka text-2xl text-center mb-3">
        {done || picked ? '🤞 Vote in!' : two ? '🗳️ Pick the best name for YOUR team’s monster!' : '🗳️ Pick the best name (not your own)!'}
      </div>
      {options.length === 0 && <p className="font-nunito text-lg text-center">Nobody named it — it’s a mystery monster! 🤷</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map(o => {
          const mine = own !== null && nameKey(o.text) === own;
          return (
            <motion.button key={o.key} data-testid="mash-opt" whileTap={{ scale: 0.95 }} disabled={done || !!picked || mine} onClick={() => pick(o.key)}
              className={`min-h-[64px] rounded-2xl px-4 py-3 font-fredoka text-2xl border-4 ${picked === o.key ? 'bg-amber-400/40 border-amber-300' : mine ? 'bg-white/5 border-transparent opacity-50' : 'bg-white/15 border-white/20'}`}>
              {o.text}{mine && <span className="block font-nunito text-base">✍️ yours</span>}
            </motion.button>
          );
        })}
      </div>
      <div className="font-nunito text-base text-lime-100 text-center mt-3">{view.done.length}/{view.ids.length} voted</div>
    </div>
  );
}

function ResultPhase({ room, view, pics, onNext }: { room: RoomApi; view: View; pics: Pictures; onNext?: () => void }) {
  const r = view.result!;
  const names = (ids: string[]) => ids.map(id => who(room.players, id).name).join(' & ');
  const title = (m: number) => r.winners[m]?.map(k => r.options[m].find(o => o.key === k)?.text).filter(Boolean).join(' & ') || 'The Mystery Monster';
  return (
    <div className="mb-4">
      <div className={`grid gap-3 mb-3 ${view.plan.length === 2 ? 'md:grid-cols-2' : ''}`}>
        {view.plan.map((_, m) => (
          <div key={m} className="rounded-3xl bg-black/25 p-3">
            {view.plan.length === 2 && <div className="font-fredoka text-xl mb-1">{m === 0 ? '🟢 Monster A' : '🟣 Monster B'}</div>}
            {(r.options[m] ?? []).length === 0 && <div className="font-nunito text-lg">No names this time!</div>}
            {(r.options[m] ?? []).map(o => (
              <div key={o.key} className={`flex items-center gap-2 rounded-2xl px-3 py-2 mb-1 font-nunito text-lg ${r.winners[m]?.includes(o.key) ? 'bg-lime-400/25 ring-2 ring-lime-300' : 'bg-white/10'}`}>
                <span className="font-fredoka text-xl flex-1">{r.winners[m]?.includes(o.key) ? '👑 ' : ''}{o.text}</span>
                <span className="text-lime-100">by {names(o.authors)}</span>
                <span className="font-fredoka text-amber-200">{r.counts[m]?.[o.key] ?? 0} 🗳️</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="font-nunito text-lg text-center text-lime-100 mb-3">🧟 Everyone who sent a part got a Monster Maker point!</p>
      <div className="flex flex-wrap justify-center gap-3">
        {view.monsters && <SaveMonster monsters={view.monsters} names={view.plan.map((_, m) => title(m))} theme={view.theme} pics={pics} />}
        {onNext && <button onClick={onNext} className="min-h-[56px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-stone-900 active:scale-95">Next ▶</button>}
      </div>
    </div>
  );
}

function SaveMonster({ monsters, names, theme, pics }: { monsters: PartPic[][]; names: string[]; theme: MonsterTheme; pics: Pictures }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const save = async () => {
    if (state !== 'idle') return;
    playClick();
    setState('busy');
    const ok = await composeMonsters(monsters, names, theme, pics);
    setState(ok ? 'ok' : 'fail');
    if (ok) playUnlock();
  };
  return (
    <button onClick={save} disabled={state !== 'idle'} data-testid="mash-save"
      className="min-h-[56px] px-6 rounded-full font-fredoka text-xl bg-gradient-to-r from-sky-400 to-violet-500 shadow-xl active:scale-95 disabled:opacity-90">
      {state === 'idle' ? '💾 Save the monster' : state === 'busy' ? 'Saving… 💾' : state === 'ok' ? '✅ Saved in your Doodle Pad gallery!' : 'Couldn’t save on this device 😕'}
    </button>
  );
}

/** The monster(s) on one 1200×900 sheet (the Doodle Pad board shape), named. */
async function composeMonsters(monsters: PartPic[][], names: string[], theme: MonsterTheme, pics: Pictures): Promise<boolean> {
  const sheet = newSheet();
  if (!sheet) return false;
  const { canvas, ctx } = sheet;
  fitText(ctx, `${theme.emoji} ${theme.text}`, 20, 8, 1160, 50, 32, '#047857');
  const maxParts = Math.max(...monsters.map(m => m.length));
  const partH = Math.min(240, (900 - 140) / maxParts);
  const partW = partH * (4 / 3);
  for (const [m, parts] of monsters.entries()) {
    const cx = monsters.length === 1 ? 600 : m === 0 ? 300 : 900;
    const x = cx - partW / 2;
    const top = 64;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, top, partW, partH * parts.length);
    for (const [i, p] of parts.entries()) {
      const img = p.pic ? await loadImage(pics.get(p.pic) ?? '') : null;
      if (img) ctx.drawImage(img, x, top + i * partH, partW, partH);
      else fitText(ctx, '(missing!)', x, top + i * partH, partW, partH, 24, '#9ca3af');
    }
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 6;
    ctx.strokeRect(x, top, partW, partH * parts.length);
    fitText(ctx, `👑 ${names[m] ?? ''}`, cx - 290, top + partH * parts.length + 8, 580, 60, 40, '#6d28d9');
  }
  return saveSheet(canvas);
}
