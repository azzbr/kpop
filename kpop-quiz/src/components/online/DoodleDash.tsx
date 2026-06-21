import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { DOODLE_WORDS } from '../../online/doodleWords';

const ROUND_MS = 75000;
const CW = 640;
const CH = 480;

const COLORS = ['#1f2937', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
const ERASER = '#ffffff';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}

type Pt = [number, number, number]; // x, y, newStroke

type Phase = 'intro' | 'draw' | 'round_end' | 'final';

const DoodleDash: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [total, setTotal] = useState(0);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [word, setWord] = useState('');
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [guess, setGuess] = useState('');
  const [iGuessed, setIGuessed] = useState(false);
  const [feed, setFeed] = useState<{ name: string; text: string; correct: boolean }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [revealWord, setRevealWord] = useState('');
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const [colorIdx, setColorIdx] = useState(0);
  const [eraser, setEraser] = useState(false);
  const xpGiven = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const buf = useRef<Pt[]>([]);
  const colorRef = useRef({ c: COLORS[0], w: 5 });

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Host-side authoritative state
  const hd = useRef({
    drawOrder: [] as string[],
    words: [] as string[],
    round: 0,
    word: '',
    drawer: '',
    correct: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const iAmDrawer = drawerId === myId;

  // Canvas setup
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
  }, [phase === 'intro']); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
    lastPt.current = null;
  };

  const applyPts = (pts: Pt[], color: string, width: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [x, y, ns] of pts) {
      const px = x * CW;
      const py = y * CH;
      if (ns || !lastPt.current) {
        ctx.beginPath();
        ctx.arc(px, py, width / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        lastPt.current = { x: px, y: py };
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(lastPt.current.x, lastPt.current.y);
      ctx.lineTo(px, py);
      ctx.stroke();
      lastPt.current = { x: px, y: py };
    }
  };

  // ---- HOST: game master ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const ids = players.map((p) => p.id).sort(() => Math.random() - 0.5);
    h.drawOrder = ids.slice(0, Math.min(6, ids.length));
    h.words = [...DOODLE_WORDS].sort(() => Math.random() - 0.5);
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      h.round = r;
      h.drawer = h.drawOrder[r - 1];
      h.word = h.words[r - 1];
      h.correct = {};
      h.ended = false;
      h.endsAt = Date.now() + ROUND_MS;
      send({ t: 'dd_round', round: r, total: h.drawOrder.length, drawerId: h.drawer, word: h.word, endsAt: h.endsAt });
      h.timer = window.setTimeout(endRound, ROUND_MS + 400);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'dd_endround', round: h.round, word: h.word, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < h.drawOrder.length) {
          startRound(h.round + 1);
        } else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'dd_final', top });
        }
      }, 3800);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'dd_guess' && !h.ended && m.from !== h.drawer && !h.correct[m.from]) {
        if (normalize(m.text) === normalize(h.word)) {
          h.correct[m.from] = true;
          const pts = 100 + Math.round(100 * Math.max(0, h.endsAt - Date.now()) / ROUND_MS);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          h.scores[h.drawer] = (h.scores[h.drawer] || 0) + 25;
          send({ t: 'dd_correct', playerId: m.from, gained: pts, scores: { ...h.scores } });
          const guessers = playersRef.current.filter((p) => p.id !== h.drawer);
          if (guessers.length > 0 && guessers.every((p) => h.correct[p.id])) endRound();
        } else {
          send({ t: 'dd_nope', playerId: m.from, text: String(m.text).slice(0, 30) });
        }
      }
    });

    h.timer = window.setTimeout(() => startRound(1), 1500);

    return () => {
      offMsg();
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: messages ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      switch (m.t) {
        case 'dd_round':
          setPhase('draw');
          setRound(m.round);
          setTotal(m.total);
          setDrawerId(m.drawerId);
          setWord(m.word);
          setEndsAt(m.endsAt);
          setIGuessed(false);
          setFeed([]);
          setGuess('');
          clearCanvas();
          break;
        case 'dd_stroke':
          if (m.from !== myId) applyPts(m.pts, m.c, m.w);
          break;
        case 'dd_clear':
          if (m.from !== myId) clearCanvas();
          break;
        case 'dd_correct': {
          setScores(m.scores);
          const nm = byId(m.playerId).name;
          setFeed((f) => [{ name: nm, text: `guessed it! +${m.gained}`, correct: true }, ...f].slice(0, 6));
          if (m.playerId === myId) {
            setIGuessed(true);
            playCorrect();
          }
          break;
        }
        case 'dd_nope': {
          const nm2 = byId(m.playerId).name;
          setFeed((f) => [{ name: nm2, text: m.text, correct: false }, ...f].slice(0, 6));
          break;
        }
        case 'dd_endround':
          setPhase('round_end');
          setRevealWord(m.word);
          setScores(m.scores);
          break;
        case 'dd_final':
          setPhase('final');
          setFinalTop(m.top);
          playWin();
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.top[0]?.id === myId ? 40 : 15);
          }
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Stroke buffer flush (drawer only)
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (buf.current.length > 0) {
        send({ t: 'dd_stroke', pts: buf.current.splice(0), c: colorRef.current.c, w: colorRef.current.w });
      }
    }, 120);
    return () => window.clearInterval(iv);
  }, [send]);

  // Countdown
  useEffect(() => {
    if (phase !== 'draw') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 400);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  // Update pen
  useEffect(() => {
    colorRef.current = eraser ? { c: ERASER, w: 24 } : { c: COLORS[colorIdx], w: 5 };
  }, [colorIdx, eraser]);

  const getNorm = (e: React.PointerEvent): [number, number] => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const penDown = (e: React.PointerEvent) => {
    if (!iAmDrawer || phase !== 'draw') return;
    e.preventDefault();
    drawing.current = true;
    const [x, y] = getNorm(e);
    applyPts([[x, y, 1]], colorRef.current.c, colorRef.current.w);
    buf.current.push([x, y, 1]);
  };

  const penMove = (e: React.PointerEvent) => {
    if (!drawing.current || !iAmDrawer || phase !== 'draw') return;
    e.preventDefault();
    const [x, y] = getNorm(e);
    applyPts([[x, y, 0]], colorRef.current.c, colorRef.current.w);
    buf.current.push([x, y, 0]);
  };

  const penUp = () => {
    drawing.current = false;
  };

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || iGuessed || iAmDrawer || phase !== 'draw') return;
    playClick();
    send({ t: 'dd_guess', text: guess.trim() });
    setGuess('');
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-rose-950 to-purple-950 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🎨 Doodle Dash</h1>
        <p className="text-center font-nunito text-orange-200 text-sm mb-4">
          {phase === 'intro' ? 'Picking the first artist…' : `Round ${round}/${total} · ⏱️ ${timeLeft}s`}
        </p>

        {/* Drawer banner */}
        {phase === 'draw' && (
          <div className="text-center mb-3">
            {iAmDrawer ? (
              <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka">
                ✏️ YOUR word: <span className="font-bold text-amber-300 text-xl uppercase tracking-wider">{word}</span> — draw it!
              </div>
            ) : (
              <div className="inline-block bg-white/10 rounded-2xl px-5 py-2 font-fredoka">
                ✏️ {byId(drawerId || '').emoji} {byId(drawerId || '').name} is drawing —{' '}
                <span className="text-amber-300">{word.length} letters!</span>
              </div>
            )}
          </div>
        )}

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            onPointerDown={penDown}
            onPointerMove={penMove}
            onPointerUp={penUp}
            onPointerLeave={penUp}
            className={`w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl ${iAmDrawer && phase === 'draw' ? 'cursor-crosshair' : ''}`}
            style={{ touchAction: 'none' }}
          />
          {iGuessed && phase === 'draw' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-fredoka rounded-full px-4 py-1 shadow-lg">
              ✅ You got it! Shhh… 🤫
            </div>
          )}
        </div>

        {/* Drawer tools */}
        {iAmDrawer && phase === 'draw' && (
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            {COLORS.map((c, i) => (
              <button
                key={c}
                onClick={() => { setColorIdx(i); setEraser(false); }}
                className={`w-9 h-9 rounded-full border-4 ${colorIdx === i && !eraser ? 'border-amber-300 scale-110' : 'border-white/30'}`}
                style={{ background: c }}
              />
            ))}
            <button
              onClick={() => setEraser(!eraser)}
              className={`px-3 h-9 rounded-full font-fredoka text-sm border-2 ${eraser ? 'bg-amber-400/30 border-amber-300' : 'bg-white/10 border-white/30'}`}
            >
              🧽 Eraser
            </button>
            <button
              onClick={() => { playClick(); clearCanvas(); send({ t: 'dd_clear' }); }}
              className="px-3 h-9 rounded-full font-fredoka text-sm bg-red-500/30 border-2 border-red-400"
            >
              🗑️ Clear
            </button>
          </div>
        )}

        {/* Guess input */}
        {!iAmDrawer && phase === 'draw' && (
          <form onSubmit={submitGuess} className="flex gap-2 mt-3">
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={iGuessed}
              placeholder={iGuessed ? 'You guessed it! 🎉' : 'Type your guess…'}
              maxLength={30}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito border-2 border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={iGuessed || !guess.trim()}
              className={`px-6 rounded-2xl font-fredoka font-bold ${iGuessed || !guess.trim() ? 'bg-gray-600/50 text-gray-400' : 'bg-gradient-to-r from-amber-400 to-pink-500'}`}
            >
              Guess!
            </button>
          </form>
        )}

        {/* Guess feed + scores */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white/5 rounded-2xl p-3 min-h-[5rem]">
            <div className="font-fredoka text-xs text-orange-300 mb-1">Guesses:</div>
            {feed.map((f, i) => (
              <div key={i} className={`font-nunito text-xs py-0.5 ${f.correct ? 'text-emerald-300 font-bold' : 'text-white/70'}`}>
                {f.correct ? '✅' : '💬'} {f.name}: {f.text}
              </div>
            ))}
          </div>
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-xs text-orange-300 mb-1">Top scores:</div>
            {topScores.map((s) => (
              <div key={s.id} className="font-nunito text-xs py-0.5 flex justify-between">
                <span>{byId(s.id).emoji} {byId(s.id).name}</span>
                <span className="text-amber-300 font-bold">{s.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === 'round_end' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-rose-800 to-purple-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full"
            >
              <div className="text-5xl mb-2">🖼️</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-1">
                The word was: <span className="uppercase">{revealWord}</span>
              </h2>
              <p className="font-nunito text-rose-200">Next round starting…</p>
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-rose-800 to-purple-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">
                {finalTop[0] ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Game over!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {finalTop.slice(0, 8).map((e, i) => (
                  <div key={e.id} className="flex justify-between font-nunito text-sm py-0.5">
                    <span>#{i + 1} {e.emoji} {e.name}</span>
                    <span className="text-amber-200">{e.score}</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{finalTop[0]?.id === myId ? 40 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-rose-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DoodleDash;
