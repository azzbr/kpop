import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { DOODLE_WORDS } from '../../online/doodleWords';
import { isClean } from '../../utils/cleanText';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle, type DrawPt } from './DrawCanvas';
import { useHelloGate, useArenaFinish, msLeft, placeOf } from '../../online/helloGate';
import {
  ROUND_MS, DRAWER_BONUS, MAX_GUESS, isRightGuess, guessPoints, wordShape, drawOrder, addBatch,
  doodleRanking, allGuessed, type StrokeBatch,
} from './doodleDashLogic';

// One player draws a secret word, everyone else guesses on the on-screen keyboard.
// Host-authoritative: the host picks drawers and words, checks guesses and keeps the picture
// so far, so a device that mounts late gets the drawing, scores and round (dd_sync).

const FLUSH_MS = 150; // stroke points are batched, at most one message per 150 ms
const BREAK_MS = 3800;

type Phase = 'intro' | 'draw' | 'round_end' | 'final';

interface FeedItem { name: string; text: string; correct: boolean }

// Messages (all prefixed dd_)
type DdMsg = { from?: string } & (
  | { t: 'dd_guess'; text: string }
  | { t: 'dd_round'; round: number; total: number; drawerId: string; shape: number[]; ms: number }
  | { t: 'dd_word'; to: string; word: string }
  | { t: 'dd_stroke'; pts: DrawPt[]; c: string; w: number }
  | { t: 'dd_clear' }
  | { t: 'dd_correct'; playerId: string; gained: number; scores: Record<string, number> }
  | { t: 'dd_nope'; playerId: string; text: string }
  | { t: 'dd_endround'; round: number; word: string; scores: Record<string, number> }
  | { t: 'dd_final'; ranked: (string | string[])[]; scores: Record<string, number> }
  | {
      t: 'dd_sync'; to: string; phase: Phase; round: number; total: number; drawerId: string; shape: number[];
      ms: number; word?: string; strokes: StrokeBatch[]; scores: Record<string, number>; guessed: string[];
      reveal?: string; ranked?: (string | string[])[];
    }
);

const DoodleDash: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { finish, reward } = useArenaFinish(room);

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [total, setTotal] = useState(0);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [word, setWord] = useState(''); // only ever set on the drawer's device
  const [shape, setShape] = useState<number[]>([]);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [guess, setGuess] = useState('');
  const [iGuessed, setIGuessed] = useState(false);
  const [note, setNote] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [revealWord, setRevealWord] = useState('');
  const [ranked, setRanked] = useState<(string | string[])[] | null>(null);

  const canvas = useRef<DrawCanvasHandle>(null);
  const buf = useRef<{ pts: DrawPt[]; c: string; w: number }>({ pts: [], c: '', w: 0 });

  const playersRef = useRef(players);
  playersRef.current = players;

  // Host-side authoritative state
  const hd = useRef({
    ids: [] as string[],
    order: [] as string[],
    words: [] as string[],
    round: 0,
    word: '',
    drawer: '',
    correct: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    strokes: [] as StrokeBatch[],
    endsAt: 0,
    phase: 'intro' as Phase,
    reveal: '',
    ranked: null as (string | string[])[] | null,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: 'Friend', emoji: '🙂', isHost: false, joinedAt: 0 };

  const iAmDrawer = drawerId === myId;

  // ---- HOST: game master ----
  const hostStartRound = (r: number) => {
    const h = hd.current;
    h.round = r;
    h.drawer = h.order[r - 1];
    h.word = h.words[r - 1];
    h.correct = {};
    h.strokes = [];
    h.phase = 'draw';
    h.endsAt = Date.now() + ROUND_MS;
    send({ t: 'dd_round', round: r, total: h.order.length, drawerId: h.drawer, shape: wordShape(h.word), ms: ROUND_MS });
    send({ t: 'dd_word', to: h.drawer, word: h.word });
    window.clearTimeout(h.timer);
    h.timer = window.setTimeout(hostEndRound, ROUND_MS + 400);
  };

  const hostEndRound = () => {
    const h = hd.current;
    if (h.phase !== 'draw') return;
    h.phase = 'round_end';
    h.reveal = h.word;
    window.clearTimeout(h.timer);
    send({ t: 'dd_endround', round: h.round, word: h.word, scores: { ...h.scores } });
    h.timer = window.setTimeout(() => {
      if (h.round < h.order.length) hostStartRound(h.round + 1);
      else {
        h.phase = 'final';
        h.ranked = doodleRanking(h.scores, h.ids);
        send({ t: 'dd_final', ranked: h.ranked, scores: { ...h.scores } });
      }
    }, BREAK_MS);
  };

  const hostSync = (to: string) => {
    const h = hd.current;
    send({
      t: 'dd_sync', to, phase: h.phase, round: h.round, total: h.order.length, drawerId: h.drawer,
      shape: h.word ? wordShape(h.word) : [], ms: msLeft(h.endsAt),
      word: to === h.drawer && h.phase === 'draw' ? h.word : undefined,
      strokes: h.phase === 'draw' ? h.strokes : [], scores: { ...h.scores },
      guessed: Object.keys(h.correct), reveal: h.phase === 'round_end' || h.phase === 'final' ? h.reveal : undefined,
      ranked: h.ranked ?? undefined,
    });
  };

  useHelloGate(room, 'dd', {
    onStart: () => {
      const h = hd.current;
      h.ids = playersRef.current.map((p) => p.id);
      h.order = drawOrder(h.ids);
      h.words = [...DOODLE_WORDS].sort(() => Math.random() - 0.5);
      h.ids.forEach((id) => (h.scores[id] = 0));
      hostStartRound(1);
    },
    onHello: hostSync,
  });

  const hostHandle = (m: DdMsg) => {
    const h = hd.current;
    if (m.t === 'dd_stroke' && m.from === h.drawer && h.phase === 'draw') {
      h.strokes = addBatch(h.strokes, { pts: m.pts, c: m.c, w: m.w });
    } else if (m.t === 'dd_clear' && m.from === h.drawer) {
      h.strokes = [];
    } else if (m.t === 'dd_guess' && m.from && h.phase === 'draw' && m.from !== h.drawer && !h.correct[m.from]) {
      const text = String(m.text).slice(0, MAX_GUESS);
      if (isRightGuess(text, h.word)) {
        h.correct[m.from] = true;
        const pts = guessPoints(h.endsAt - Date.now());
        h.scores[m.from] = (h.scores[m.from] || 0) + pts;
        h.scores[h.drawer] = (h.scores[h.drawer] || 0) + DRAWER_BONUS;
        send({ t: 'dd_correct', playerId: m.from, gained: pts, scores: { ...h.scores } });
        const here = new Set(playersRef.current.map((p) => p.id));
        const guessers = h.ids.filter((id) => id !== h.drawer && here.has(id));
        if (allGuessed(guessers, h.correct)) hostEndRound();
      } else {
        send({ t: 'dd_nope', playerId: m.from, text: isClean(text) ? text : '🤐' });
      }
    }
  };

  // ---- EVERYONE: messages ----
  const startDrawPhase = (r: number, tot: number, drawer: string, shp: number[], ms: number) => {
    setPhase('draw');
    setRound(r);
    setTotal(tot);
    setDrawerId(drawer);
    setShape(shp);
    setEndsAt(Date.now() + ms);
    setTimeLeft(Math.ceil(ms / 1000));
    setIGuessed(false);
    setFeed([]);
    setGuess('');
    setNote('');
    if (drawer !== myId) setWord('');
    buf.current = { pts: [], c: '', w: 0 };
    canvas.current?.clear();
  };

  const handle = (m: DdMsg) => {
    if (isHost) hostHandle(m);
    switch (m.t) {
      case 'dd_round':
        startDrawPhase(m.round, m.total, m.drawerId, m.shape, m.ms);
        break;
      case 'dd_word':
        if (m.to === myId) setWord(m.word);
        break;
      case 'dd_stroke':
        if (m.from !== myId) canvas.current?.drawPoints(m.pts, m.c, m.w);
        break;
      case 'dd_clear':
        if (m.from !== myId) canvas.current?.clear();
        break;
      case 'dd_correct': {
        setScores(m.scores);
        const nm = byId(m.playerId).name;
        setFeed((f) => [{ name: nm, text: `guessed it! +${m.gained}`, correct: true }, ...f].slice(0, 6));
        if (m.playerId === myId) {
          setIGuessed(true);
          setGuess('');
          playCorrect();
        }
        break;
      }
      case 'dd_nope':
        setFeed((f) => [{ name: byId(m.playerId).name, text: m.text, correct: false }, ...f].slice(0, 6));
        break;
      case 'dd_endround':
        setPhase('round_end');
        setRevealWord(m.word);
        setScores(m.scores);
        setWord('');
        break;
      case 'dd_final':
        setPhase('final');
        setRanked(m.ranked);
        setScores(m.scores);
        playWin();
        finish(m.ranked);
        break;
      case 'dd_sync':
        if (m.to !== myId) break;
        setScores(m.scores);
        if (m.phase === 'draw') {
          startDrawPhase(m.round, m.total, m.drawerId, m.shape, m.ms);
          if (m.word) setWord(m.word);
          setIGuessed(m.guessed.includes(myId));
          for (const b of m.strokes) canvas.current?.drawPoints(b.pts, b.c, b.w);
        } else if (m.phase === 'round_end') {
          setRound(m.round);
          setTotal(m.total);
          setRevealWord(m.reveal || '');
          setPhase('round_end');
        } else if (m.phase === 'final' && m.ranked) {
          setRanked(m.ranked);
          setPhase('final');
          finish(m.ranked);
        }
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as DdMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearTimeout(h.timer);
    };
  }, [onMessage]);

  // Drawer: send batched points at most every FLUSH_MS
  const flush = () => {
    const b = buf.current;
    if (b.pts.length === 0) return;
    send({ t: 'dd_stroke', pts: b.pts, c: b.c, w: b.w });
    buf.current = { pts: [], c: b.c, w: b.w };
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const iv = window.setInterval(() => flushRef.current(), FLUSH_MS);
    return () => window.clearInterval(iv);
  }, []);

  const onPoints = (pt: DrawPt, c: string, w: number) => {
    if (!iAmDrawer || phase !== 'draw') return;
    const b = buf.current;
    if (b.pts.length > 0 && (b.c !== c || b.w !== w)) flush(); // a batch has one pen
    buf.current.c = c;
    buf.current.w = w;
    buf.current.pts.push(pt);
  };

  const onClear = () => {
    buf.current.pts = [];
    send({ t: 'dd_clear' });
  };

  // Countdown
  useEffect(() => {
    if (phase !== 'draw') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 400);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  // Guessing on the on-screen keyboard
  const canGuess = !iAmDrawer && phase === 'draw' && !iGuessed && drawerId !== null;
  const onKey = (k: string) => {
    setNote('');
    setGuess((g) => (g.length >= MAX_GUESS || (k === ' ' && (g === '' || g.endsWith(' '))) ? g : g + k.toLowerCase()));
  };
  const onBackspace = () => setGuess((g) => g.slice(0, -1));
  const onEnter = () => {
    const text = guess.trim();
    if (!canGuess || !text) return;
    if (!isClean(text)) {
      setNote('Let’s keep it kind — try another word! 🙂');
      setGuess('');
      return;
    }
    playClick();
    send({ t: 'dd_guess', text });
    setGuess('');
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  const blanks = shape.map((n) => '_'.repeat(n).split('').join(' ')).join('   ');
  const winners = ranked && ranked[0] ? (Array.isArray(ranked[0]) ? ranked[0] : [ranked[0]]) : [];
  const flatRank = ranked ? ranked.flatMap((r) => (Array.isArray(r) ? r : [r])) : [];

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-orange-950 via-rose-950 to-purple-950 text-white px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-5xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">🎨 Doodle Dash</h1>
        <p className="text-center font-nunito text-orange-200 text-lg mb-3">
          {phase === 'intro' ? 'Picking the first artist…' : `Round ${round}/${total} · ⏱️ ${timeLeft}s`}
        </p>

        {/* Drawer banner */}
        {phase === 'draw' && (
          <div className="text-center mb-3">
            {iAmDrawer ? (
              <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka text-lg">
                ✏️ YOUR word: <span className="font-bold text-amber-300 text-2xl uppercase tracking-wider">{word || '…'}</span> — draw it!
              </div>
            ) : (
              <div className="inline-block bg-white/10 rounded-2xl px-5 py-2 font-fredoka text-lg">
                ✏️ {byId(drawerId || '').emoji} {byId(drawerId || '').name} is drawing —{' '}
                <span className="text-amber-300 tracking-widest whitespace-pre">{blanks}</span>
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-4 ${!iAmDrawer && phase === 'draw' ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
          {/* Canvas */}
          <div className={`relative w-full mx-auto ${iAmDrawer ? 'max-w-2xl' : 'max-w-xl lg:max-w-none'}`}>
            <DrawCanvas ref={canvas} disabled={!iAmDrawer || phase !== 'draw'} onPoints={onPoints} onClear={onClear} />
            {iGuessed && phase === 'draw' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-fredoka text-lg rounded-full px-4 py-1 shadow-lg">
                ✅ You got it! Shhh… 🤫
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Guess pad */}
            {!iAmDrawer && phase === 'draw' && (
              <div>
                <div className={`min-h-[52px] rounded-2xl px-4 py-2 font-fredoka text-2xl flex items-center justify-center tracking-wide mb-2 ${iGuessed ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/90 text-gray-800'}`}>
                  {iGuessed ? 'You guessed it! 🎉' : guess ? guess.toUpperCase() : <span className="text-gray-400 text-xl">Tap letters to guess…</span>}
                </div>
                {note && <div className="text-center font-nunito text-amber-200 text-base mb-2">{note}</div>}
                <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={!canGuess} enterLabel="Guess" />
              </div>
            )}

            {/* Guess feed + scores */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-3 min-h-[5rem]">
                <div className="font-fredoka text-base text-orange-300 mb-1">Guesses</div>
                {feed.map((f, i) => (
                  <div key={i} className={`font-nunito text-base py-0.5 break-words ${f.correct ? 'text-emerald-300 font-bold' : 'text-white/75'}`}>
                    {f.correct ? '✅' : '💬'} {f.name}: {f.text}
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-2xl p-3">
                <div className="font-fredoka text-base text-orange-300 mb-1">Top scores</div>
                {topScores.map((s) => (
                  <div key={s.id} className="font-nunito text-base py-0.5 flex justify-between gap-2">
                    <span className="truncate">{byId(s.id).emoji} {byId(s.id).name}</span>
                    <span className="text-amber-300 font-bold">{s.s}</span>
                  </div>
                ))}
              </div>
            </div>
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
              <p className="font-nunito text-lg text-rose-200">{round < total ? 'Next artist coming up…' : 'Adding up the scores…'}</p>
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && ranked && (
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
                {winners.map((id) => `${byId(id).emoji} ${byId(id).name}`).join(' & ')} win{winners.length === 1 ? 's' : ''}!
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-52 overflow-y-auto">
                {flatRank.slice(0, 10).map((id) => (
                  <div key={id} className={`flex justify-between font-nunito text-base py-0.5 ${id === myId ? 'text-amber-200 font-bold' : ''}`}>
                    <span>#{placeOf(ranked, id)} {byId(id).emoji} {byId(id).name}</span>
                    <span className="text-amber-200">{scores[id] ?? 0}</span>
                  </div>
                ))}
              </div>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-rose-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DoodleDash;
