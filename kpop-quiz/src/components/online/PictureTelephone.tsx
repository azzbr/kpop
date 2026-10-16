import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig, GameMsg } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { DOODLE_WORDS } from '../../online/doodleWords';
import { isKidSafe } from '../../online/rudeWords';
import { playClick, playPop, playUnlock, playCorrect, playWrong } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import { FinalCard } from './RaceParts';
import { ArenaFrame, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { usePictures, snapPicture, newSheet, loadImage, fitText, saveSheet, type Pictures } from './arenaPictures';
import {
  GRACE_MS, VOTE_MS, AWARDS_MS, AUTO_PAGE_MS, MAX_WRITE,
  startMode, stepsFor, stepMode, stepMs, taskPayload, fileStep, bookPages, stepReveal, picId, tidyText,
  canVote, doneVoting, hasChoice, findPage, tallyAwards, sheetLayout,
  type StartMode, type StepMode, type Book, type Page, type RevealPos, type Votes, type VoteKind, type Awards,
} from './pictureTelephoneLogic';

// Picture Telephone 2.0 ("eat-poop-you-cat" / Gartic Phone). Every book travels round the room:
// draw → guess → draw … ending on a guess. Host-authoritative on useHostGame (prefix pt):
//  - each page is its own message: a drawing is one `pt_pic` (see arenaPictures) plus a tiny
//    `pt_in { kind: 'page', pic }`; a guess is `pt_in { kind: 'page', text }`;
//  - what each player must draw/guess next is private: the host sends `pt_task { to }` (and
//    answers `pt_in { kind: 'task' }` from a device that missed it). The view only says who is done;
//  - the reveal is host-controlled (◀ ▶, 🔁 replay, 📺 big screen) and the view carries only the
//    current book's pages so far; everyone sees the page the host shows;
//  - then 😂 funniest-moment and 🎨 best-drawing votes → awards → FinalCard (ranked by votes).

const PREFIX = 'pt';

interface State {
  ids: string[];
  start: StartMode;
  steps: number;
  books: Book[];
  phase: 'steps' | 'reveal' | 'vote' | 'awards' | 'final';
  step: number;
  endsAt: number;
  closing: boolean;
  submitted: Record<string, string>;
  rv: RevealPos & { big: boolean; auto: boolean };
  votes: Votes;
  awards: Awards | null;
  ranked: (string | string[])[];
}

interface View {
  phase: State['phase'];
  start: StartMode;
  steps: number;
  step: number;
  mode: StepMode;
  ms: number;
  closing: boolean;
  ids: string[];
  owners: string[];
  done: string[];
  rv?: { book: number; page: number; big: boolean; auto: boolean; total: number; pages: Page[] };
  all?: Page[][];
  awards?: Awards;
  ranked?: (string | string[])[];
}

interface G { t: HostTools<State>; send: (m: GameMsg) => void; present: () => string[] }

const allPages = (s: State) => s.books.map((b, i) => bookPages(b, i, s.start));
const shuffle = <T,>(a: T[]) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

function sendTasks(g: G, s: State, only?: string) {
  if (s.phase !== 'steps') return;
  s.ids.forEach((id, pi) => {
    if (only && id !== only) return;
    g.send({ t: 'pt_task', to: id, step: s.step, mode: stepMode(s.step, s.start), payload: taskPayload(s.books, pi, s.step, s.start) });
  });
}

function startStep(g: G, s: State, step: number): State {
  const ms = stepMs(step, s.start);
  const n: State = { ...s, phase: 'steps', step, endsAt: Date.now() + ms, closing: false, submitted: {} };
  g.t.after('step', ms + 300, () => g.t.set(closeStep(g, g.t.get())));
  sendTasks(g, n);
  return n;
}

/** Time's up: every device sends what it has; anything still missing after GRACE_MS is filed blank. */
function closeStep(g: G, s: State): State {
  if (s.phase !== 'steps' || s.closing) return s;
  g.t.after('step', GRACE_MS, () => g.t.set(endStep(g, g.t.get())));
  return { ...s, closing: true };
}

function endStep(g: G, s: State): State {
  if (s.phase !== 'steps') return s;
  g.t.cancel('step');
  const n: State = { ...s, books: fileStep(s.books, s.ids, s.step, s.submitted, s.start) };
  if (s.step + 1 < s.steps) return startStep(g, n, s.step + 1);
  return { ...n, phase: 'reveal', closing: false, submitted: {}, rv: { book: 0, page: 0, big: false, auto: false } };
}

function startVote(g: G, s: State): State {
  g.t.cancel('auto');
  g.t.after('vote', VOTE_MS + 300, () => g.t.set(endVote(g, g.t.get())));
  return maybeAdvance(g, { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, votes: { fun: {}, art: {} } });
}

function endVote(g: G, s: State): State {
  if (s.phase !== 'vote') return s;
  g.t.cancel('vote');
  g.t.after('awards', AWARDS_MS, () => g.t.set(toFinal(g, g.t.get())));
  return { ...s, phase: 'awards', endsAt: Date.now() + AWARDS_MS, awards: tallyAwards(allPages(s), s.votes, s.ids) };
}

function toFinal(g: G, s: State): State {
  if (s.phase !== 'awards' || !s.awards) return s;
  g.t.cancel('awards');
  return { ...s, phase: 'final', ranked: rankByScore(s.awards.points, s.ids) };
}

/** Move on early once everyone still in the room is done. */
function maybeAdvance(g: G, s: State): State {
  const here = s.ids.filter(id => g.present().includes(id));
  if (s.phase === 'steps' && here.every(id => s.submitted[id] !== undefined)) return endStep(g, s);
  if (s.phase === 'vote') {
    const all = allPages(s);
    if (here.every(id => doneVoting(all, s.votes, id))) return endVote(g, s);
  }
  return s;
}

function autoTick(g: G) {
  const s = g.t.get();
  if (s.phase !== 'reveal' || !s.rv.auto) return;
  const count = bookPages(s.books[s.rv.book], s.rv.book, s.start).length;
  if (s.rv.page < count - 1) {
    g.t.set({ ...s, rv: { ...s.rv, page: s.rv.page + 1 } });
    g.t.after('auto', AUTO_PAGE_MS, () => autoTick(g));
  } else g.t.set({ ...s, rv: { ...s.rv, auto: false } });
}

function revealOp(g: G, s: State, op: unknown): State | undefined {
  if (s.phase !== 'reveal') return undefined;
  if (op === 'next' || op === 'prev') {
    g.t.cancel('auto');
    const r = stepReveal(s.rv, allPages(s).map(p => p.length), op === 'next' ? 1 : -1);
    if (r === 'end') return startVote(g, s);
    return { ...s, rv: { ...s.rv, ...r, auto: false } };
  }
  if (op === 'replay') {
    g.t.after('auto', AUTO_PAGE_MS, () => autoTick(g));
    return { ...s, rv: { ...s.rv, page: 0, auto: true } };
  }
  if (op === 'big') return { ...s, rv: { ...s.rv, big: !s.rv.big } };
  if (op === 'votes') return startVote(g, s);
  return undefined;
}

/** Every picture id the host's state mentions (the host keeps them all, to resend). */
function hostPics(s: State | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const b of s.books) for (const e of b.entries) if (e?.kind === 'draw' && e.content) out.push(e.content);
  if (s.phase === 'steps' && stepMode(s.step, s.start) === 'draw') for (const c of Object.values(s.submitted)) if (c) out.push(c);
  return out;
}

const pagePics = (pages: Page[] | undefined) => (pages ?? []).filter(p => p.kind === 'draw' && p.content).map(p => p.content);

export default function PictureTelephone({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const board = config?.board === '1';
  const start = startMode(config?.start);
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const hostId = useRef(room.myId);
  const mk = (t: HostTools<State>): G => ({ t, send: room.send, present: () => presentRef.current });

  const { view, input, tools, paused } = useHostGame<State, View>(room, PREFIX, {
    board,
    start: (ids, t) => {
      const seeds = shuffle(DOODLE_WORDS);
      const books = ids.map((owner, i) => ({ owner, seed: seeds[i % seeds.length], entries: [] }));
      const s0: State = {
        ids, start, steps: stepsFor(ids.length, start), books, phase: 'steps', step: 0, endsAt: 0, closing: false,
        submitted: {}, rv: { book: 0, page: 0, big: false, auto: false }, votes: { fun: {}, art: {} }, awards: null, ranked: [],
      };
      return startStep(mk(t), s0, 0);
    },
    onInput: (s, from, m, t) => {
      const g = mk(t);
      if (m.kind === 'rv') return from === hostId.current ? revealOp(g, s, m.op) : undefined;
      if (m.kind === 'final') return from === hostId.current && s.phase === 'awards' ? toFinal(g, s) : undefined;
      if (!s.ids.includes(from)) return undefined;
      if (m.kind === 'task') {
        if (s.phase === 'steps' && m.step === s.step) sendTasks(g, s, from);
        return undefined;
      }
      if (m.kind === 'page') {
        if (s.phase !== 'steps' || m.step !== s.step || s.submitted[from] !== undefined) return undefined;
        let content = '';
        if (stepMode(s.step, s.start) === 'draw') content = m.pic === picId(s.step, from) ? m.pic : '';
        else {
          const text = tidyText(String(m.text ?? ''));
          content = text && isKidSafe(text) ? text : '';
        }
        return maybeAdvance(g, { ...s, submitted: { ...s.submitted, [from]: content } });
      }
      if (m.kind === 'vote') {
        if (s.phase !== 'vote' || (m.vote !== 'fun' && m.vote !== 'art') || typeof m.key !== 'string') return undefined;
        const kind = m.vote as VoteKind;
        if (!canVote(findPage(allPages(s), m.key), from, kind)) return undefined;
        return maybeAdvance(g, { ...s, votes: { ...s.votes, [kind]: { ...s.votes[kind], [from]: m.key } } });
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const g = mk(t);
      if (s.phase === 'steps') return s.closing ? endStep(g, s) : closeStep(g, s);
      if (s.phase === 'reveal') {
        const counts = allPages(s).map(p => p.length);
        return s.rv.book + 1 < counts.length ? { ...s, rv: { book: s.rv.book + 1, page: 0, big: s.rv.big, auto: false } } : startVote(g, s);
      }
      if (s.phase === 'vote') return endVote(g, s);
      if (s.phase === 'awards') return toFinal(g, s);
      return undefined;
    },
    view: s => {
      const v: View = {
        phase: s.phase, start: s.start, steps: s.steps, step: s.step, mode: stepMode(s.step, s.start), ms: msLeft(s.endsAt),
        closing: s.closing, ids: s.ids, owners: s.books.map(b => b.owner), done: [],
      };
      if (s.phase === 'steps') v.done = Object.keys(s.submitted);
      if (s.phase === 'reveal') {
        const pages = bookPages(s.books[s.rv.book], s.rv.book, s.start);
        v.rv = { ...s.rv, total: pages.length, pages: pages.slice(0, s.rv.page + 1) };
      }
      if (s.phase === 'vote' || s.phase === 'awards' || s.phase === 'final') {
        const all = allPages(s);
        v.all = all;
        if (s.phase === 'vote') v.done = s.ids.filter(id => doneVoting(all, s.votes, id));
      }
      if (s.awards && s.phase !== 'vote') v.awards = s.awards;
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
    const n = maybeAdvance(mk(tools), s);
    if (n !== s) tools.set(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  // My private task for the current step.
  const [task, setTask] = useState<{ step: number; mode: StepMode; payload: string } | null>(null);
  const { onMessage, myId } = room;
  useEffect(() => onMessage((m: GameMsg) => {
    if (m.t !== 'pt_task' || m.to !== myId || typeof m.step !== 'number') return;
    setTask({ step: m.step, mode: m.mode === 'write' ? 'write' : 'draw', payload: String(m.payload ?? '') });
  }), [onMessage, myId]);
  const amPlayer = !!view?.ids.includes(room.myId);
  const needTask = view?.phase === 'steps' && amPlayer && task?.step !== view.step;
  const viewStep = view?.step;
  useEffect(() => {
    if (!needTask) return;
    const ask = () => input({ kind: 'task', step: viewStep });
    const first = window.setTimeout(ask, 900);
    const iv = window.setInterval(ask, 2500);
    return () => { window.clearTimeout(first); window.clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needTask, viewStep]);

  const myTask = task && view && task.step === view.step ? task : null;
  const wanted = [
    ...(room.isHost ? hostPics(tools.get()) : []),
    ...(view?.phase === 'steps' && myTask?.mode === 'write' && /^pt\d+\./.test(myTask.payload) ? [myTask.payload] : []),
    ...pagePics(view?.rv?.pages),
    ...(view?.all ?? []).flatMap(pagePics),
  ];
  const pics = usePictures(room, PREFIX, [...new Set(wanted)]);

  useEffect(() => { if (view?.phase === 'steps') playUnlock(); }, [view?.phase, view?.step]);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.rv?.book, view?.rv?.page]);
  useEffect(() => { if (view?.phase === 'awards') playCorrect(); }, [view?.phase]);
  // The big screen doesn't play, so it gets no reward.
  const watching = board && room.isHost;
  useEffect(() => { if (view?.phase === 'final' && view.ranked && !watching) finish(view.ranked); }, [view?.phase, view?.ranked, finish, watching]);

  const seconds = useCountdown(view && (view.phase === 'steps' || view.phase === 'vote') && !view.closing ? view.ms : undefined, `${view?.phase}-${view?.step}-${view?.closing}`);

  if (!view) return <ArenaFrame title="Picture Telephone" icon="✏️" tint={TINT}><Waiting /></ArenaFrame>;

  const name = (id: string) => who(room.players, id);
  const hostName = name(room.players.find(p => p.isHost)?.id ?? '').name;
  const pill = (view.phase === 'steps' || view.phase === 'vote' || paused) && (
    <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right" aria-label="Timer">
      {view.phase === 'steps' && <div>Turn {view.step + 1}/{view.steps}</div>}
      {paused ? <div className="text-amber-300">⏸️ Paused</div>
        : view.closing ? <div className="text-amber-300">📨 Sending…</div>
          : (view.phase === 'steps' || view.phase === 'vote') && <div className={seconds <= 5 ? 'text-amber-300' : 'text-fuchsia-200'}>⏱️ {seconds}s</div>}
    </div>
  );
  const myBook = view.owners.indexOf(room.myId);

  return (
    <ArenaFrame title="Picture Telephone" icon="✏️" tint={TINT} right={pill}
      subtitle={view.phase === 'steps' ? 'Pass the picture around the room!' : view.phase === 'reveal' ? 'The big reveal! 🎭' : view.phase === 'vote' ? 'Vote for your favourites!' : 'And the awards go to…'}>
      {paused && <div className="rounded-2xl bg-amber-400/25 ring-2 ring-amber-300 px-4 py-2 mb-3 text-center font-fredoka text-xl">⏸️ The game is paused — pencils down for a moment!</div>}

      {view.phase === 'steps' && (amPlayer
        ? <StepPanel key={view.step} room={room} view={view} task={myTask} pics={pics} input={input} paused={paused} />
        : <BoardProgress room={room} view={view} seconds={seconds} />)}

      {view.phase === 'reveal' && view.rv && (
        <RevealPanel room={room} view={view} pics={pics} isHost={room.isHost} board={board} hostName={hostName}
          op={op => { playClick(); input({ kind: 'rv', op }); }} />
      )}

      {view.phase === 'vote' && view.all && (
        amPlayer
          ? <VotePanel key="vote" room={room} view={view} all={view.all} pics={pics} input={input} />
          : <BoardVotes room={room} view={view} all={view.all} pics={pics} />
      )}

      {(view.phase === 'awards' || view.phase === 'final') && view.all && view.awards && (
        <AwardsPanel room={room} view={view} all={view.all} awards={view.awards} pics={pics} big={board}
          onFinal={room.isHost && view.phase === 'awards' ? () => { playClick(); input({ kind: 'final' }); } : undefined} />
      )}

      {view.phase === 'final' && view.ranked && view.awards && (
        <>
          <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.awards.points} reward={reward} />
          {view.all && myBook >= 0 && (
            <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <SaveButton label="💾 Save my book" pages={view.all[myBook]} title={`📞 ${name(room.myId).name}'s Picture Telephone book`} pics={pics} room={room} />
            </div>
          )}
        </>
      )}
    </ArenaFrame>
  );
}

const TINT = 'from-violet-950 via-fuchsia-950 to-rose-950';

// ---------- Steps ----------

function StepPanel({ room, view, task, pics, input, paused }: {
  room: RoomApi; view: View; task: { step: number; mode: StepMode; payload: string } | null; pics: Pictures;
  input: (d: Record<string, unknown>) => void; paused: boolean;
}) {
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const lastSend = useRef<Record<string, unknown> | null>(null);
  const done = view.done.includes(room.myId);

  const submit = useCallback((auto: boolean) => {
    if (sent || !task) return;
    let data: Record<string, unknown>;
    if (task.mode === 'draw') {
      const img = snapPicture(canvasRef.current);
      const id = picId(task.step, room.myId);
      if (img) pics.send(id, img);
      data = { kind: 'page', step: task.step, pic: img ? id : '' };
    } else {
      const t = tidyText(text);
      if (!auto && !t) { setNote('Type something first ✍️'); playWrong(); return; }
      if (t && !isKidSafe(t)) {
        if (!auto) { setNote('Let’s keep it kind — try something else 🙂'); setText(''); playWrong(); return; }
        data = { kind: 'page', step: task.step, text: '' };
      } else data = { kind: 'page', step: task.step, text: t };
    }
    if (!auto) playClick();
    lastSend.current = data;
    setSent(true);
    input(data);
  }, [sent, task, text, pics, room.myId, input]);

  // Time's up on the host: send what we have right now.
  useEffect(() => { if (view.closing && !sent && task) submit(true); }, [view.closing, sent, task, submit]);
  // A page sent during a pause (or lost) is sent again until the host has it.
  useEffect(() => {
    if (!sent || done || paused) return;
    const iv = window.setInterval(() => { if (lastSend.current) input(lastSend.current); }, 3500);
    return () => window.clearInterval(iv);
  }, [sent, done, paused, input]);

  const onKey = useCallback((k: string) => {
    setNote('');
    setText(g => (g.length >= MAX_WRITE || (k === ' ' && (g === '' || g.endsWith(' '))) ? g : g + k.toLowerCase()));
  }, []);
  const onBackspace = useCallback(() => setText(g => g.slice(0, -1)), []);
  const onEnter = useCallback(() => submit(false), [submit]);

  if (sent || done) {
    return (
      <div className="bg-white/10 rounded-3xl p-8 text-center border border-white/15">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-6xl mb-3">📨</motion.div>
        <div className="font-fredoka text-2xl">Sent! Passing it on…</div>
        <div className="font-nunito text-fuchsia-200 text-lg mt-1">{view.done.length} of {view.ids.length} friends are done.</div>
      </div>
    );
  }
  if (!task) return <Waiting text="Getting your page…" />;

  if (task.mode === 'draw') {
    const isStart = task.step === 0;
    return (
      <div>
        <div className="text-center mb-3">
          <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka text-xl" data-testid="pt-prompt">
            {isStart ? '🎲 Your secret card:' : '✏️ Draw this:'}{' '}
            <span className="font-bold text-amber-300 text-2xl tracking-wide">{task.payload || '???'}</span>
          </div>
        </div>
        <DrawCanvas ref={canvasRef} />
        <button onClick={() => submit(false)} disabled={paused}
          className="mt-4 w-full min-h-[56px] py-3 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95 disabled:opacity-50">
          ✅ Done drawing!
        </button>
      </div>
    );
  }

  const isStart = view.start === 'write' && task.step === 0;
  return (
    <div>
      {isStart ? (
        <div className="rounded-3xl bg-white/10 p-4 mb-3 text-center">
          <div className="font-fredoka text-2xl">✍️ Write something silly to draw!</div>
          <div className="font-nunito text-lg text-fuchsia-200">Like “a cat on a skateboard” or “a happy cloud”. A friend will draw it!</div>
        </div>
      ) : (
        <>
          <div className="text-center font-fredoka text-2xl mb-2">🔍 What is this a picture of?</div>
          <PicBox id={task.payload} pics={pics} className="w-full max-w-lg mx-auto" />
        </>
      )}
      <div className="flex gap-2 mt-4 mb-2 max-w-xl mx-auto">
        <div className="flex-1 min-h-[56px] rounded-2xl bg-white/90 text-gray-800 font-fredoka text-2xl flex items-center px-4 tracking-wide" data-testid="pt-draft">
          {text ? text : <span className="text-gray-400 text-xl">{isStart ? 'A…' : 'It’s a…'}</span>}
        </div>
        <button type="button" onClick={() => submit(false)} disabled={paused}
          className="min-h-[56px] px-6 rounded-2xl font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 disabled:opacity-50">Send!</button>
      </div>
      {note && <div className="text-center font-nunito text-amber-200 text-lg mb-2" role="status">{note}</div>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space enterLabel="Send" disabled={paused} />
    </div>
  );
}

function BoardProgress({ room, view, seconds }: { room: RoomApi; view: View; seconds: number }) {
  const drawing = view.mode === 'draw';
  return (
    <div className="rounded-3xl bg-white/10 p-8 text-center">
      <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-7xl mb-3">
        {drawing ? '✏️' : view.start === 'write' && view.step === 0 ? '✍️' : '🔍'}
      </motion.div>
      <div className="font-fredoka text-3xl md:text-4xl mb-2">
        {drawing ? 'Everyone is drawing…' : view.start === 'write' && view.step === 0 ? 'Everyone is writing a silly start…' : 'Everyone is guessing…'}
      </div>
      <div className="font-nunito text-xl text-fuchsia-200 mb-4">Turn {view.step + 1} of {view.steps} · {view.closing ? 'collecting pages…' : `${seconds}s left`}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {view.ids.map(id => (
          <span key={id} className={`rounded-full px-3 py-1 font-nunito text-lg ${view.done.includes(id) ? 'bg-green-500/40' : 'bg-black/25'}`}>
            {view.done.includes(id) ? '✅' : '⏳'} {who(room.players, id).emoji} {who(room.players, id).name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Pages ----------

function PicBox({ id, pics, className = '' }: { id: string; pics: Pictures; className?: string }) {
  const src = id ? pics.get(id) : undefined;
  if (src) return <img src={src} alt="a friend's drawing" className={`block aspect-[4/3] bg-white rounded-2xl shadow-xl object-contain ${className}`} />;
  return (
    <div className={`aspect-[4/3] bg-white/80 rounded-2xl flex items-center justify-center text-gray-600 font-nunito text-lg text-center px-3 ${className}`}>
      {id ? '🖼️ Picture on its way…' : '(left blank — use your imagination!)'}
    </div>
  );
}

function caption(p: Page, room: RoomApi) {
  const w = p.by ? who(room.players, p.by) : null;
  if (p.kind === 'seed') return '🎲 The word card was';
  if (p.kind === 'start') return `✍️ ${w?.emoji} ${w?.name} started with`;
  if (p.kind === 'draw') return `✏️ ${w?.emoji} ${w?.name} drew`;
  return `💬 ${w?.emoji} ${w?.name} guessed`;
}

function PageCard({ page, room, pics, size = 'md' }: { page: Page; room: RoomApi; pics: Pictures; size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-4xl md:text-6xl' : size === 'md' ? 'text-3xl' : 'text-xl';
  return (
    <div className={`rounded-2xl p-3 ${page.kind === 'seed' ? 'bg-amber-400/20 border-2 border-amber-400' : 'bg-white/10 border border-white/15'}`}>
      <div className={`font-nunito text-fuchsia-100 mb-1 text-center ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>{caption(page, room)}</div>
      {page.kind === 'draw'
        ? <PicBox id={page.content} pics={pics} className={size === 'lg' ? 'w-full max-h-[62vh] mx-auto' : 'w-full'} />
        : <div className={`font-fredoka text-center text-amber-200 py-3 break-words ${text}`}>“{page.content}”</div>}
    </div>
  );
}

function SaveButton({ label, pages, title, pics, room }: { label: string; pages: Page[]; title: string; pics: Pictures; room: RoomApi }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const save = async () => {
    if (state !== 'idle') return;
    playClick();
    setState('busy');
    const ok = await composeBook(pages, title, pics, room);
    setState(ok ? 'ok' : 'fail');
    if (ok) playUnlock();
  };
  return (
    <button onClick={save} disabled={state !== 'idle'} data-testid="pt-save"
      className="min-h-[52px] px-6 rounded-full font-fredoka text-xl bg-gradient-to-r from-sky-400 to-violet-500 shadow-xl active:scale-95 disabled:opacity-90">
      {state === 'idle' ? label : state === 'busy' ? 'Saving… 💾' : state === 'ok' ? '✅ Saved in your Doodle Pad gallery!' : 'Couldn’t save on this device 😕'}
    </button>
  );
}

/** One 1200×900 sheet per book (the Doodle Pad board shape), every page with its caption. */
async function composeBook(pages: Page[], title: string, pics: Pictures, room: RoomApi): Promise<boolean> {
  const sheet = newSheet();
  if (!sheet) return false;
  const { canvas, ctx } = sheet;
  fitText(ctx, title, 20, 10, 1160, 70, 44, '#86198f');
  const cells = sheetLayout(pages.length);
  for (const [i, p] of pages.entries()) {
    const c = cells[i];
    const x = c.x + 10, y = c.y + 8, w = c.w - 20, h = c.h - 16;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 18); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    const capH = 36;
    fitText(ctx, `${i + 1}. ${caption(p, room).replace(/^\S+\s/, '')}`, x + 8, y + 4, w - 16, capH, 24, '#6b21a8');
    const bx = x + 10, by = y + capH + 6, bw = w - 20, bh = h - capH - 14;
    if (p.kind === 'draw') {
      const img = p.content ? await loadImage(pics.get(p.content) ?? '') : null;
      if (img) {
        const s = Math.min(bw / 4, bh / 3);
        ctx.drawImage(img, bx + (bw - 4 * s) / 2, by + (bh - 3 * s) / 2, 4 * s, 3 * s);
      } else fitText(ctx, '(left blank)', bx, by, bw, bh, 28, '#9ca3af');
    } else fitText(ctx, `“${p.content}”`, bx, by, bw, bh, 52, p.kind === 'seed' ? '#b45309' : '#be185d');
  }
  return saveSheet(canvas);
}

// ---------- Reveal ----------

function RevealPanel({ room, view, pics, isHost, board, hostName, op }: {
  room: RoomApi; view: View; pics: Pictures; isHost: boolean; board: boolean; hostName: string; op: (o: string) => void;
}) {
  const rv = view.rv!;
  const page = rv.pages[rv.page];
  const owner = who(room.players, view.owners[rv.book]);
  const lastBook = rv.book === view.owners.length - 1;
  const atEnd = rv.page === rv.total - 1;
  const big = rv.big || board;
  const header = (
    <div className="text-center font-fredoka text-2xl mb-3" data-testid="pt-book">
      📖 Book {rv.book + 1} of {view.owners.length} — started by {owner.emoji} {owner.name}
      <div className="flex justify-center gap-1.5 mt-2" aria-label={`Page ${rv.page + 1} of ${rv.total}`}>
        {Array.from({ length: rv.total }, (_, i) => <span key={i} className={`w-3 h-3 rounded-full ${i <= rv.page ? 'bg-amber-300' : 'bg-white/25'}`} />)}
      </div>
    </div>
  );
  const chips = rv.page > 0 && (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3" aria-label="Earlier pages">
      {rv.pages.slice(0, rv.page).map(p => (
        <div key={p.key} className="shrink-0 w-28 rounded-xl bg-black/25 p-1 text-center">
          {p.kind === 'draw' ? <PicBox id={p.content} pics={pics} className="w-full !rounded-lg" /> : <div className="font-fredoka text-base text-amber-200 break-words py-2">“{p.content}”</div>}
        </div>
      ))}
    </div>
  );
  const btn = 'min-h-[56px] px-5 rounded-full font-fredoka text-xl active:scale-95';
  const controls = isHost ? (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      <button onClick={() => op('prev')} disabled={rv.book === 0 && rv.page === 0} className={`${btn} bg-white/15 disabled:opacity-40`} aria-label="Previous page">◀</button>
      <motion.button onClick={() => op('next')} animate={rv.auto ? {} : { scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
        className={`${btn} px-8 bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl`} aria-label="Next page">
        {!atEnd ? 'Next page ▶' : lastBook ? 'Time to vote! 🗳️' : 'Next book ▶'}
      </motion.button>
      <button onClick={() => op('replay')} className={`${btn} bg-white/15`}>🔁 Replay</button>
      {!board && <button onClick={() => op('big')} className={`${btn} bg-white/15`}>{rv.big ? '📱 Back to small' : '📺 Show on big screen'}</button>}
    </div>
  ) : (
    <div className="text-center font-nunito text-lg text-fuchsia-200 mt-3">👑 {hostName} is turning the pages {rv.auto ? '(replaying…)' : ''}</div>
  );
  const save = atEnd && (
    <div className="flex justify-center mt-3">
      <SaveButton key={rv.book} label="💾 Save this book" pages={rv.pages} title={`📞 ${owner.name}'s Picture Telephone book`} pics={pics} room={room} />
    </div>
  );
  const pageEl = page && (
    <AnimatePresence mode="wait">
      <motion.div key={page.key} initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
        <PageCard page={page} room={room} pics={pics} size={big ? 'lg' : 'md'} />
      </motion.div>
    </AnimatePresence>
  );

  if (big) {
    return (
      <div className={board ? '' : 'fixed inset-0 z-20 overflow-y-auto bg-gradient-to-br from-violet-950 via-fuchsia-950 to-rose-950 px-4'}
        style={board ? undefined : { paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-4xl mx-auto">
          {header}
          {chips}
          {pageEl}
          {controls}
          {save}
        </div>
      </div>
    );
  }
  return <div>{header}{chips}{pageEl}{controls}{save}</div>;
}

// ---------- Votes ----------

const VOTES: { kind: VoteKind; icon: string; title: string }[] = [
  { kind: 'fun', icon: '😂', title: 'Funniest moment' },
  { kind: 'art', icon: '🎨', title: 'Best drawing' },
];

function VotePanel({ room, view, all, pics, input }: { room: RoomApi; view: View; all: Page[][]; pics: Pictures; input: (d: Record<string, unknown>) => void }) {
  const me = room.myId;
  const [mine, setMine] = useState<Partial<Record<VoteKind, string>>>({});
  const firstOpen = VOTES.find(v => hasChoice(all, me, v.kind))?.kind ?? 'fun';
  const [tab, setTab] = useState<VoteKind>(firstOpen);
  const done = view.done.includes(me);
  const can = (k: VoteKind) => hasChoice(all, me, k);

  const pick = (p: Page) => {
    if (!canVote(p, me, tab)) return;
    playClick();
    setMine(m => ({ ...m, [tab]: p.key }));
    input({ kind: 'vote', vote: tab, key: p.key });
    const other: VoteKind = tab === 'fun' ? 'art' : 'fun';
    if (!mine[other] && can(other)) window.setTimeout(() => setTab(other), 500);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {VOTES.map(v => (
          <button key={v.kind} onClick={() => { playClick(); setTab(v.kind); }} disabled={!can(v.kind)}
            className={`min-h-[56px] rounded-2xl font-fredoka text-xl border-4 disabled:opacity-40 ${tab === v.kind ? 'bg-amber-400/30 border-amber-300' : 'bg-white/10 border-transparent'}`}>
            {v.icon} {v.title} {mine[v.kind] ? '✅' : ''}
          </button>
        ))}
      </div>
      <div className="font-nunito text-lg text-center text-fuchsia-100 mb-3" role="status">
        {done ? `✅ Votes in! Waiting for friends… ${view.done.length}/${view.ids.length}` : tab === 'fun' ? 'Tap the page that made you laugh the most!' : 'Tap the best drawing (not your own)!'}
      </div>
      <Gallery room={room} all={all} pics={pics} owners={view.owners}
        state={p => (mine[tab] === p.key ? 'picked' : canVote(p, me, tab) ? 'open' : p.by === me ? 'mine' : 'off')}
        onPick={pick} badge={tab === 'fun' ? '😂' : '🎨'} />
    </div>
  );
}

function BoardVotes({ room, view, all, pics }: { room: RoomApi; view: View; all: Page[][]; pics: Pictures }) {
  return (
    <div>
      <div className="rounded-3xl bg-white/10 p-4 mb-3 text-center font-fredoka text-3xl">
        🗳️ Vote on your iPads! 😂 Funniest moment · 🎨 Best drawing
        <div className="font-nunito text-xl text-fuchsia-200 mt-1">{view.done.length}/{view.ids.length} have voted</div>
      </div>
      <Gallery room={room} all={all} pics={pics} owners={view.owners} state={() => 'off'} />
    </div>
  );
}

function Gallery({ room, all, pics, owners, state, onPick, badge }: {
  room: RoomApi; all: Page[][]; pics: Pictures; owners: string[];
  state: (p: Page) => 'open' | 'picked' | 'mine' | 'off'; onPick?: (p: Page) => void; badge?: string;
}) {
  return (
    <div className="space-y-4 mb-4">
      {all.map((pages, b) => (
        <div key={b} className="rounded-3xl bg-black/20 p-3">
          <div className="font-fredoka text-xl mb-2">📖 {who(room.players, owners[b]).emoji} {who(room.players, owners[b]).name}’s book</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {pages.map(p => {
              const st = state(p);
              return (
                <motion.button key={p.key} whileTap={st === 'open' ? { scale: 0.95 } : undefined} onClick={() => onPick?.(p)}
                  disabled={!onPick || st === 'off' || st === 'mine'} data-testid="pt-vote-page" data-key={p.key} data-state={st}
                  className={`relative text-left rounded-2xl p-2 border-4 ${st === 'picked' ? 'border-amber-300 bg-amber-400/25' : st === 'open' ? 'border-white/20 bg-white/10' : 'border-transparent bg-white/5'} ${st === 'mine' || (onPick && st === 'off') ? 'opacity-50' : ''}`}>
                  <div className="font-nunito text-base text-fuchsia-100 mb-1 truncate">{caption(p, room)}</div>
                  {p.kind === 'draw' ? <PicBox id={p.content} pics={pics} className="w-full" /> : <div className="font-fredoka text-xl text-amber-200 break-words py-2">“{p.content}”</div>}
                  {st === 'mine' && <div className="font-nunito text-base text-center">✍️ yours</div>}
                  {st === 'picked' && badge && <span className="absolute -top-3 -right-2 text-4xl">{badge}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Awards ----------

function AwardsPanel({ room, view, all, awards, pics, big, onFinal }: {
  room: RoomApi; view: View; all: Page[][]; awards: Awards; pics: Pictures; big: boolean; onFinal?: () => void;
}) {
  const myBook = view.owners.indexOf(room.myId);
  return (
    <div className="mb-4">
      <div className="grid gap-4 mb-4 md:grid-cols-2">
        {VOTES.map((v, i) => {
          const wins = awards[v.kind];
          return (
            <motion.div key={v.kind} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 + i * 1.2, type: 'spring', stiffness: 180 }}
              className="rounded-3xl p-4 bg-amber-400/15 ring-4 ring-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.35)]" data-testid={`pt-award-${v.kind}`}>
              <div className="font-fredoka text-3xl text-center mb-2">{v.icon} {v.title}</div>
              {wins.length === 0 && <div className="font-nunito text-lg text-center text-fuchsia-100">No votes this time — everyone’s a winner! 🌟</div>}
              {wins.map(w => {
                const p = findPage(all, w.key);
                return p ? (
                  <div key={w.key} className="mb-2">
                    <PageCard page={p} room={room} pics={pics} size={big ? 'lg' : 'md'} />
                    <div className="font-fredoka text-xl text-center text-green-300 mt-1">{w.votes} vote{w.votes === 1 ? '' : 's'}!</div>
                  </div>
                ) : null;
              })}
            </motion.div>
          );
        })}
      </div>
      <div className="font-fredoka text-xl mb-2">⭐ Votes received</div>
      <Scores room={room} scores={awards.points} ids={view.ids} />
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {myBook >= 0 && <SaveButton label="💾 Save my book" pages={all[myBook]} title={`📞 ${who(room.players, room.myId).name}'s Picture Telephone book`} pics={pics} room={room} />}
        {onFinal && <button onClick={onFinal} className="min-h-[56px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95">🏁 See the standings</button>}
      </div>
    </div>
  );
}
