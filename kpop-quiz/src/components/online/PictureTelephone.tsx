import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playWin, playUnlock } from '../../utils/sounds';
import { DOODLE_WORDS } from '../../online/doodleWords';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import ConfettiBurst from '../ConfettiBurst';

// "Eat-poop-you-cat" / Gartic Phone: each player's secret word travels around
// the room, alternating draw → guess → draw, then the whole chain is revealed
// for laughs. Host is authoritative; drawings travel as small JPEG dataURLs.

const DRAW_MS = 50000;
const WRITE_MS = 25000;
const MAX_STEPS = 8;

interface Entry {
  kind: 'draw' | 'write';
  by: string;
  content: string;
}
interface BookMsg {
  index: number;
  total: number;
  owner: string;
  seed: string;
  entries: Entry[];
}
type Phase = 'intro' | 'task' | 'sent' | 'reveal' | 'done';

const PictureTelephone: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [task, setTask] = useState<{ step: number; mode: 'draw' | 'write'; payload: string; endsAt: number } | null>(null);
  const [writeText, setWriteText] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [book, setBook] = useState<BookMsg | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  const xpGiven = useRef(false);
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const submittedRef = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // ---- HOST: routes the books ----
  const hd = useRef({
    order: [] as string[],
    P: 0,
    steps: 0,
    books: [] as { owner: string; seed: string; entries: Entry[] }[],
    step: -1,
    submitted: {} as Record<string, string>,
    closing: false,
    timer: 0,
    revealTimer: 0,
  });

  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.order = players.map((p) => p.id);
    h.P = h.order.length;
    h.steps = Math.min(MAX_STEPS, h.P);
    const seeds = [...DOODLE_WORDS].sort(() => Math.random() - 0.5).slice(0, h.P);
    h.books = h.order.map((owner, i) => ({ owner, seed: seeds[i], entries: [] }));

    const bookOf = (pi: number, s: number) => (((pi - s) % h.P) + h.P) % h.P;

    const startStep = (s: number) => {
      h.step = s;
      h.submitted = {};
      h.closing = false;
      const mode: 'draw' | 'write' = s % 2 === 0 ? 'draw' : 'write';
      const ms = mode === 'draw' ? DRAW_MS : WRITE_MS;
      const endsAt = Date.now() + ms;
      h.order.forEach((pid, pi) => {
        const b = bookOf(pi, s);
        const payload = s === 0 ? h.books[b].seed : h.books[b].entries[s - 1].content;
        send({ t: 'pt_task', to: pid, step: s, mode, payload, endsAt });
      });
      h.timer = window.setTimeout(() => endStep(), ms + 800);
    };

    const endStep = () => {
      if (h.closing) return;
      h.closing = true;
      window.clearTimeout(h.timer);
      const s = h.step;
      const mode: 'draw' | 'write' = s % 2 === 0 ? 'draw' : 'write';
      h.order.forEach((pid, pi) => {
        const b = bookOf(pi, s);
        const content = h.submitted[pid] ?? (mode === 'draw' ? '' : '???');
        h.books[b].entries[s] = { kind: mode, by: pid, content };
      });
      if (s + 1 < h.steps) {
        window.setTimeout(() => startStep(s + 1), 700);
      } else {
        startReveal();
      }
    };

    const startReveal = () => {
      let bi = 0;
      const sendBook = () => {
        if (bi >= h.books.length) {
          send({ t: 'pt_done' });
          return;
        }
        const bk = h.books[bi];
        send({ t: 'pt_book', index: bi, total: h.books.length, owner: bk.owner, seed: bk.seed, entries: bk.entries });
        bi++;
        const dwell = 3200 + bk.entries.length * 1500;
        h.revealTimer = window.setTimeout(sendBook, dwell);
      };
      sendBook();
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'pt_submit' && m.from && !h.closing) {
        if (h.submitted[m.from] === undefined) {
          h.submitted[m.from] = String(m.content ?? '');
          if (h.order.every((pid) => h.submitted[pid] !== undefined)) endStep();
        }
      }
    });

    h.timer = window.setTimeout(() => startStep(0), 1300);

    return () => {
      offMsg();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.revealTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: my task / reveal ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'pt_task' && m.to === myId) {
        submittedRef.current = false;
        setWriteText('');
        setTask({ step: m.step, mode: m.mode, payload: m.payload, endsAt: m.endsAt });
        setPhase('task');
        playUnlock();
      } else if (m.t === 'pt_book') {
        setBook(m as BookMsg);
        setRevealCount(0);
        setPhase('reveal');
      } else if (m.t === 'pt_done') {
        setPhase('done');
        playWin();
        if (!xpGiven.current) {
          xpGiven.current = true;
          addXP(20);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const doSubmit = () => {
    if (submittedRef.current || !task) return;
    submittedRef.current = true;
    const content = task.mode === 'draw' ? canvasRef.current?.getImage() || '' : writeText.trim() || '???';
    send({ t: 'pt_submit', content });
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
      if (left <= 0 && !submittedRef.current) doSubmitRef.current();
    }, 300);
    return () => window.clearInterval(iv);
  }, [phase, task]);

  // Reveal: pop the seed, then each entry one by one
  useEffect(() => {
    if (phase !== 'reveal' || !book) return;
    setRevealCount(1);
    const iv = window.setInterval(() => {
      setRevealCount((c) => {
        if (c >= book.entries.length + 1) {
          window.clearInterval(iv);
          return c;
        }
        return c + 1;
      });
    }, 1500);
    return () => window.clearInterval(iv);
  }, [phase, book]);

  const manualSubmit = () => {
    playClick();
    doSubmit();
  };

  // Build the reveal strip: [seed, ...entries]
  const revealItems: { kind: 'seed' | 'draw' | 'write'; by?: string; content: string }[] = book
    ? [{ kind: 'seed', content: book.seed }, ...book.entries.map((e) => ({ kind: e.kind, by: e.by, content: e.content }))]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-fuchsia-950 to-rose-950 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">📞 Picture Telephone</h1>
        <p className="text-center font-nunito text-fuchsia-200 text-sm mb-5">
          {phase === 'task' && task
            ? `${task.mode === 'draw' ? '✏️ Draw it!' : '🔍 Guess it!'} · ⏱️ ${timeLeft}s`
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
            <div className="font-fredoka text-xl mb-2">Get your pencils ready!</div>
            <p className="font-nunito text-fuchsia-100 text-sm">
              You’ll get a secret word to draw. Then you’ll guess a friend’s drawing, and they’ll draw your guess… watch how silly it gets at the end!
            </p>
          </div>
        )}

        {/* TASK: DRAW */}
        {phase === 'task' && task && task.mode === 'draw' && (
          <div>
            <div className="text-center mb-3">
              <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka">
                {task.step === 0 ? 'Your secret word:' : 'Draw this guess:'}{' '}
                <span className="font-bold text-amber-300 text-xl uppercase tracking-wide">{task.payload}</span>
              </div>
            </div>
            <DrawCanvas key={`draw-${task.step}`} ref={canvasRef} />
            <button
              onClick={manualSubmit}
              className="mt-4 w-full py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
            >
              ✅ Done drawing!
            </button>
          </div>
        )}

        {/* TASK: WRITE */}
        {phase === 'task' && task && task.mode === 'write' && (
          <div>
            <div className="text-center font-fredoka text-lg mb-2">🔍 What is this a picture of?</div>
            {task.payload ? (
              <img src={task.payload} alt="a friend's drawing" className="w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl object-contain" />
            ) : (
              <div className="w-full aspect-[4/3] bg-white/80 rounded-2xl flex items-center justify-center text-gray-500 font-nunito">
                (no drawing — take a wild guess!)
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                manualSubmit();
              }}
              className="flex gap-2 mt-4"
            >
              <input
                type="text"
                value={writeText}
                onChange={(e) => setWriteText(e.target.value)}
                placeholder="It’s a…"
                maxLength={30}
                autoFocus
                className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito text-lg border-2 border-white/40 focus:outline-none focus:ring-4 focus:ring-white/40"
              />
              <button type="submit" className="px-6 rounded-2xl font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500">
                Send!
              </button>
            </form>
          </div>
        )}

        {/* SENT */}
        {phase === 'sent' && (
          <div className="bg-white/10 rounded-3xl p-8 text-center border border-white/15">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-6xl mb-3">
              📨
            </motion.div>
            <div className="font-fredoka text-xl">Sent! Passing it on…</div>
            <div className="font-nunito text-fuchsia-200 text-sm mt-1">Waiting for everyone to finish their turn.</div>
          </div>
        )}

        {/* REVEAL */}
        {phase === 'reveal' && book && (
          <div>
            <div className="text-center font-fredoka text-lg mb-3">
              📖 Story {book.index + 1} of {book.total} — started by {byId(book.owner).emoji} {byId(book.owner).name}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {revealItems.slice(0, revealCount).map((it, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`rounded-2xl p-3 ${it.kind === 'seed' ? 'bg-amber-400/20 border-2 border-amber-400' : 'bg-white/10 border border-white/15'}`}
                  >
                    {it.kind === 'seed' && (
                      <div className="text-center font-fredoka">
                        🌱 The secret word was:{' '}
                        <span className="text-amber-300 font-bold uppercase tracking-wide">{it.content}</span>
                      </div>
                    )}
                    {it.kind === 'draw' && (
                      <div>
                        <div className="font-nunito text-xs text-fuchsia-200 mb-1">
                          ✏️ {byId(it.by || '').emoji} {byId(it.by || '').name} drew:
                        </div>
                        {it.content ? (
                          <img src={it.content} alt="drawing" className="w-full max-w-xs mx-auto rounded-xl bg-white" />
                        ) : (
                          <div className="text-center font-nunito text-white/50 italic py-4">(left it blank!)</div>
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
              <p className="font-nunito text-fuchsia-100 mb-4">Hope the drawings made you giggle! 😆</p>
              <p className="font-fredoka text-green-300 mb-5">Everyone earned +20 XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-fuchsia-200">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PictureTelephone;
