import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playWin, playUnlock } from '../../utils/sounds';
import { DOODLE_WORDS } from '../../online/doodleWords';
import { isClean } from '../../utils/cleanText';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import ConfettiBurst from '../ConfettiBurst';
import { useHelloGate, useArenaFinish, msLeft } from '../../online/helloGate';
import {
  MAX_WRITE, stepsFor, stepMode, stepMs, taskPayload, fileStep, bookDwellMs, revealCountAt, coopRanking,
  type Book, type Entry, type StepMode,
} from './pictureTelephoneLogic';

// "Eat-poop-you-cat" / Gartic Phone: each player's secret word travels around
// the room, alternating draw → guess → draw, then the whole chain is revealed
// for laughs. Host is authoritative; drawings travel as small JPEG dataURLs.
// It's cooperative, so everyone shares first place at the end.

interface BookMsg {
  index: number;
  total: number;
  owner: string;
  seed: string;
  entries: Entry[];
}
type Phase = 'intro' | 'task' | 'sent' | 'reveal' | 'done';
interface Task { step: number; steps: number; mode: StepMode; payload: string; endsAt: number }

// Messages (all prefixed pt_). `to` = only for that device.
type PtMsg = { from?: string } & (
  | { t: 'pt_submit'; step: number; content?: string }
  | { t: 'pt_task'; to: string; step: number; steps: number; mode: StepMode; payload: string; ms: number; sent?: boolean }
  | { t: 'pt_progress'; done: number; of: number }
  | ({ t: 'pt_book'; to?: string; elapsed?: number } & BookMsg)
  | { t: 'pt_final'; to?: string; ranked: string[][] }
);

const PictureTelephone: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { finish, reward } = useArenaFinish(room);

  const [phase, setPhase] = useState<Phase>('intro');
  const [task, setTask] = useState<Task | null>(null);
  const [writeText, setWriteText] = useState('');
  const [note, setNote] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [book, setBook] = useState<(BookMsg & { shownAt: number }) | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  const canvasRef = useRef<DrawCanvasHandle>(null);
  const submittedRef = useRef(false);
  const playersRef = useRef(players);
  playersRef.current = players;

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: 'Friend', emoji: '🙂', isHost: false, joinedAt: 0 };

  // ---- HOST: routes the books ----
  const hd = useRef({
    order: [] as string[],
    steps: 0,
    books: [] as Book[],
    step: -1,
    endsAt: 0,
    submitted: {} as Record<string, string>,
    closing: false,
    stage: 'intro' as 'intro' | 'steps' | 'reveal' | 'done',
    bookIdx: 0,
    bookAt: 0,
    timer: 0,
  });

  const hostSendTask = (pid: string, sentOnly = false) => {
    const h = hd.current;
    const pi = h.order.indexOf(pid);
    if (pi < 0) return;
    send({
      t: 'pt_task', to: pid, step: h.step, steps: h.steps, mode: stepMode(h.step),
      payload: taskPayload(h.books, pi, h.step), ms: msLeft(h.endsAt), sent: sentOnly || undefined,
    });
  };

  const hostStartStep = (s: number) => {
    const h = hd.current;
    h.step = s;
    h.submitted = {};
    h.closing = false;
    h.stage = 'steps';
    h.endsAt = Date.now() + stepMs(s);
    h.order.forEach((pid) => hostSendTask(pid));
    send({ t: 'pt_progress', done: 0, of: h.order.length });
    window.clearTimeout(h.timer);
    h.timer = window.setTimeout(hostEndStep, stepMs(s) + 800);
  };

  const hostEndStep = () => {
    const h = hd.current;
    if (h.closing) return;
    h.closing = true;
    window.clearTimeout(h.timer);
    h.books = fileStep(h.books, h.order, h.step, h.submitted);
    if (h.step + 1 < h.steps) h.timer = window.setTimeout(() => hostStartStep(h.step + 1), 700);
    else hostReveal(0);
  };

  const bookMsg = (i: number): BookMsg => {
    const b = hd.current.books[i];
    return { index: i, total: hd.current.books.length, owner: b.owner, seed: b.seed, entries: b.entries };
  };

  const hostReveal = (i: number) => {
    const h = hd.current;
    h.stage = 'reveal';
    if (i >= h.books.length) {
      h.stage = 'done';
      send({ t: 'pt_final', ranked: coopRanking(h.order) });
      return;
    }
    h.bookIdx = i;
    h.bookAt = Date.now();
    send({ t: 'pt_book', ...bookMsg(i) });
    h.timer = window.setTimeout(() => hostReveal(i + 1), bookDwellMs(h.books[i]));
  };

  useHelloGate(room, 'pt', {
    onStart: () => {
      const h = hd.current;
      h.order = playersRef.current.map((p) => p.id);
      h.steps = stepsFor(h.order.length);
      const seeds = [...DOODLE_WORDS].sort(() => Math.random() - 0.5).slice(0, h.order.length);
      h.books = h.order.map((owner, i) => ({ owner, seed: seeds[i], entries: [] }));
      hostStartStep(0);
    },
    onHello: (from) => {
      const h = hd.current;
      if (h.stage === 'steps') {
        if (!h.closing) hostSendTask(from, h.submitted[from] !== undefined);
        send({ t: 'pt_progress', done: Object.keys(h.submitted).length, of: h.order.length });
      } else if (h.stage === 'reveal') {
        send({ t: 'pt_book', to: from, elapsed: Date.now() - h.bookAt, ...bookMsg(h.bookIdx) });
      } else if (h.stage === 'done') {
        send({ t: 'pt_final', to: from, ranked: coopRanking(h.order) });
      }
    },
  });

  const hostHandle = (m: PtMsg) => {
    const h = hd.current;
    if (m.t === 'pt_submit' && m.from && !h.closing && h.stage === 'steps' && m.step === h.step && h.order.includes(m.from)) {
      if (h.submitted[m.from] === undefined) {
        let content = String(m.content ?? '');
        if (stepMode(h.step) === 'write') content = isClean(content) ? content.slice(0, MAX_WRITE) || '???' : '???';
        else if (!content.startsWith('data:image/')) content = '';
        h.submitted[m.from] = content;
        const done = Object.keys(h.submitted).length;
        send({ t: 'pt_progress', done, of: h.order.length });
        if (h.order.every((pid) => h.submitted[pid] !== undefined)) hostEndStep();
      }
    }
  };

  // ---- EVERYONE: my task / reveal ----
  const handle = (m: PtMsg) => {
    if (isHost) hostHandle(m);
    switch (m.t) {
      case 'pt_task':
        if (m.to !== myId) break;
        submittedRef.current = !!m.sent;
        setWriteText('');
        setNote('');
        setTask({ step: m.step, steps: m.steps, mode: m.mode, payload: m.payload, endsAt: Date.now() + m.ms });
        setTimeLeft(Math.ceil(m.ms / 1000));
        setPhase(m.sent ? 'sent' : 'task');
        if (!m.sent) playUnlock();
        break;
      case 'pt_progress':
        setProgress({ done: m.done, of: m.of });
        break;
      case 'pt_book':
        if (m.to && m.to !== myId) break;
        setBook({ index: m.index, total: m.total, owner: m.owner, seed: m.seed, entries: m.entries, shownAt: Date.now() - (m.elapsed ?? 0) });
        setRevealCount(revealCountAt(m.elapsed ?? 0, m.entries.length));
        setPhase('reveal');
        break;
      case 'pt_final':
        if (m.to && m.to !== myId) break;
        setPhase('done');
        playWin();
        finish(m.ranked);
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as PtMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearTimeout(h.timer);
    };
  }, [onMessage]);

  const doSubmit = (auto = false) => {
    if (submittedRef.current || !task) return;
    let content: string;
    if (task.mode === 'draw') content = canvasRef.current?.getImage() || '';
    else {
      const text = writeText.trim();
      if (!isClean(text)) {
        if (!auto) {
          setNote('Let’s keep it kind — try another guess! 🙂');
          setWriteText('');
          return;
        }
        content = '???';
      } else content = text || '???';
    }
    submittedRef.current = true;
    send({ t: 'pt_submit', step: task.step, content });
    setPhase('sent');
  };
  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // Task countdown + auto-submit when time is up
  useEffect(() => {
    if (phase !== 'task' || !task) return;
    const iv = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((task.endsAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0 && !submittedRef.current) doSubmitRef.current(true);
    }, 300);
    return () => window.clearInterval(iv);
  }, [phase, task]);

  // Reveal: pop the seed, then each entry one by one
  useEffect(() => {
    if (phase !== 'reveal' || !book) return;
    const iv = window.setInterval(() => {
      const c = revealCountAt(Date.now() - book.shownAt, book.entries.length);
      setRevealCount(c);
      if (c >= book.entries.length + 1) window.clearInterval(iv);
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, book]);

  const manualSubmit = () => {
    playClick();
    doSubmit();
  };

  const onKey = (k: string) => {
    setNote('');
    setWriteText((g) => (g.length >= MAX_WRITE || (k === ' ' && (g === '' || g.endsWith(' '))) ? g : g + k.toLowerCase()));
  };
  const onBackspace = () => setWriteText((g) => g.slice(0, -1));

  // Build the reveal strip: [seed, ...entries]
  const revealItems: { kind: 'seed' | 'draw' | 'write'; by?: string; content: string }[] = book
    ? [{ kind: 'seed', content: book.seed }, ...book.entries.map((e) => ({ kind: e.kind, by: e.by, content: e.content }))]
    : [];

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-violet-950 via-fuchsia-950 to-rose-950 text-white px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">📞 Picture Telephone</h1>
        <p className="text-center font-nunito text-fuchsia-200 text-lg mb-5">
          {phase === 'task' && task
            ? `${task.mode === 'draw' ? '✏️ Draw it!' : '🔍 Guess it!'} · Turn ${task.step + 1}/${task.steps} · ⏱️ ${timeLeft}s`
            : phase === 'reveal'
            ? 'The big reveal! 🎭'
            : 'Pass the picture around the room!'}
        </p>

        {/* INTRO */}
        {phase === 'intro' && (
          <div className="bg-white/10 rounded-3xl p-7 text-center border border-white/15">
            <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-6xl mb-3">
              🎨➡️💬➡️🎨
            </motion.div>
            <div className="font-fredoka text-2xl mb-2">Get your pencils ready!</div>
            <p className="font-nunito text-fuchsia-100 text-lg">
              You’ll get a secret word to draw. Then you’ll guess a friend’s drawing, and they’ll draw your guess… watch how silly it gets at the end!
            </p>
          </div>
        )}

        {/* TASK: DRAW */}
        {phase === 'task' && task && task.mode === 'draw' && (
          <div>
            <div className="text-center mb-3">
              <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka text-lg">
                {task.step === 0 ? 'Your secret word:' : 'Draw this guess:'}{' '}
                <span className="font-bold text-amber-300 text-2xl uppercase tracking-wide">{task.payload}</span>
              </div>
            </div>
            <DrawCanvas key={`draw-${task.step}`} ref={canvasRef} />
            <button
              onClick={manualSubmit}
              className="mt-4 w-full min-h-[56px] py-3 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
            >
              ✅ Done drawing!
            </button>
          </div>
        )}

        {/* TASK: WRITE */}
        {phase === 'task' && task && task.mode === 'write' && (
          <div>
            <div className="text-center font-fredoka text-xl mb-2">🔍 What is this a picture of?</div>
            {task.payload ? (
              <img src={task.payload} alt="a friend's drawing" className="w-full max-w-lg mx-auto block aspect-[4/3] bg-white rounded-2xl shadow-2xl object-contain" />
            ) : (
              <div className="w-full max-w-lg mx-auto aspect-[4/3] bg-white/80 rounded-2xl flex items-center justify-center text-gray-600 font-nunito text-lg">
                (no drawing — take a wild guess!)
              </div>
            )}
            <div className="flex gap-2 mt-4 mb-2 max-w-xl mx-auto">
              <div className="flex-1 min-h-[52px] rounded-2xl bg-white/90 text-gray-800 font-fredoka text-2xl flex items-center px-4 tracking-wide">
                {writeText ? writeText.toUpperCase() : <span className="text-gray-400 text-xl">It’s a…</span>}
              </div>
              <button type="button" onClick={manualSubmit} className="min-h-[52px] px-6 rounded-2xl font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500">
                Send!
              </button>
            </div>
            {note && <div className="text-center font-nunito text-amber-200 text-base mb-2">{note}</div>}
            <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={manualSubmit} space enterLabel="Send" />
          </div>
        )}

        {/* SENT */}
        {phase === 'sent' && (
          <div className="bg-white/10 rounded-3xl p-8 text-center border border-white/15">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-6xl mb-3">
              📨
            </motion.div>
            <div className="font-fredoka text-2xl">Sent! Passing it on…</div>
            <div className="font-nunito text-fuchsia-200 text-lg mt-1">
              {progress ? `${progress.done} of ${progress.of} friends are done.` : 'Waiting for everyone to finish their turn.'}
            </div>
          </div>
        )}

        {/* REVEAL */}
        {phase === 'reveal' && book && (
          <div>
            <div className="text-center font-fredoka text-xl mb-3">
              📖 Story {book.index + 1} of {book.total} — started by {byId(book.owner).emoji} {byId(book.owner).name}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {revealItems.slice(0, revealCount).map((it, i) => (
                  <motion.div
                    key={`${book.index}-${i}`}
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`rounded-2xl p-3 ${it.kind === 'seed' ? 'bg-amber-400/20 border-2 border-amber-400' : 'bg-white/10 border border-white/15'}`}
                  >
                    {it.kind === 'seed' && (
                      <div className="text-center font-fredoka text-lg">
                        🌱 The secret word was:{' '}
                        <span className="text-amber-300 font-bold uppercase tracking-wide">{it.content}</span>
                      </div>
                    )}
                    {it.kind === 'draw' && (
                      <div>
                        <div className="font-nunito text-base text-fuchsia-200 mb-1">
                          ✏️ {byId(it.by || '').emoji} {byId(it.by || '').name} drew:
                        </div>
                        {it.content ? (
                          <img src={it.content} alt="drawing" className="w-full max-w-xs mx-auto rounded-xl bg-white" />
                        ) : (
                          <div className="text-center font-nunito text-lg text-white/60 italic py-4">(left it blank!)</div>
                        )}
                      </div>
                    )}
                    {it.kind === 'write' && (
                      <div className="text-center font-fredoka text-lg">
                        💬 {byId(it.by || '').emoji} {byId(it.by || '').name} guessed:{' '}
                        <span className="text-fuchsia-200">“{it.content}”</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* DONE */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-fuchsia-800 to-violet-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <div className="text-7xl mb-3">🎭</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">That’s all, folks!</h2>
              <p className="font-nunito text-lg text-fuchsia-100 mb-4">Great teamwork — everyone wins this one! 😆</p>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-fuchsia-200">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PictureTelephone;
