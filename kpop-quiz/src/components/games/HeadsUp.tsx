import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import ConfettiBurst from '../ConfettiBurst';
import { playClick, playCorrect, playPop, playTick, playTimeOut, playWin } from '../../utils/sounds';
import { HEADS_UP_CATEGORIES, headsUpCategory } from '../../data/headsUpCards';
import type { HeadsUpCategoryId } from '../../data/headsUpCards';
import {
  createTilt, calibrate, feedTilt, manualAction, createDeck, drawCard, countGot,
  ROUND_CHOICES, COUNTDOWN_SECS,
} from './headsUpLogic';
import type { Deck, Reading, TiltState, TiltEvent, CardResult } from './headsUpLogic';

type Stage = 'countdown' | 'cards' | 'review';
/** none = no sensor API, denied = permission refused, waiting = asked but no readings yet, on = working. */
type Sensor = 'none' | 'denied' | 'waiting' | 'on';

const MANUAL_GUARD_MS = 300;

type DOEWithPermission = { requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'> };

function screenAngle(): number {
  const w = window as unknown as { orientation?: number };
  if (typeof w.orientation === 'number') return w.orientation; // iOS
  return screen.orientation?.angle ?? 0;
}

export default function HeadsUp() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [categoryId, setCategoryId] = useState<HeadsUpCategoryId>('animals');
  const [secs, setSecs] = useState<number>(60);
  const [stage, setStage] = useState<Stage>('countdown');
  const [countLeft, setCountLeft] = useState(COUNTDOWN_SECS);
  const [timeLeft, setTimeLeft] = useState(0);
  const [card, setCard] = useState('');
  const [results, setResults] = useState<CardResult[]>([]);
  const [flash, setFlash] = useState<{ kind: TiltEvent; n: number } | null>(null);
  const [sensor, setSensor] = useState<Sensor>('none');
  const later = useSafeTimeout();

  const rng = useRef(createRng(Date.now() % 1e9));
  const deck = useRef<Deck>({ order: [], index: 0 });
  const tilt = useRef<TiltState>(createTilt());
  const reading = useRef<Reading | null>(null);
  const endsAt = useRef(0); // countdown or card-timer end, depending on stage
  const remaining = useRef(0); // card time left while paused / counting down again
  const lastManual = useRef(0);
  const lastTickSec = useRef(-1);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const statusRef = useRef(status);
  statusRef.current = status;
  const cardRef = useRef(card);
  cardRef.current = card;

  const score = countGot(results);

  // ---- motion permission (must be called straight from the Start tap on iOS 13+) ----
  const requestTilt = () => {
    const DOE = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as unknown as DOEWithPermission | undefined;
    if (!DOE) { setSensor('none'); return; }
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then(r => setSensor(s => (r === 'granted' ? (s === 'on' ? 'on' : 'waiting') : 'denied')))
        .catch(() => setSensor('denied'));
    } else {
      setSensor(s => (s === 'on' ? 'on' : 'waiting'));
    }
  };

  const beginCountdown = useCallback(() => {
    setStage('countdown');
    setCountLeft(COUNTDOWN_SECS);
    endsAt.current = Date.now() + COUNTDOWN_SECS * 1000;
    lastTickSec.current = COUNTDOWN_SECS;
    playTick();
  }, []);

  const start = () => {
    requestTilt();
    deck.current = createDeck(headsUpCategory(categoryId).cards, rng.current);
    tilt.current = createTilt();
    remaining.current = secs * 1000;
    setResults([]);
    setCard('');
    setFlash(null);
    setTimeLeft(secs);
    setRound(r => r + 1);
    setStatus('playing');
    beginCountdown();
  };

  const nextCard = useCallback(() => {
    const res = drawCard(deck.current, rng.current);
    deck.current = res.deck;
    setCard(res.card);
  }, []);

  const startCards = useCallback(() => {
    const now = Date.now();
    tilt.current = reading.current ? calibrate(reading.current, screenAngle(), now) : createTilt();
    endsAt.current = now + remaining.current;
    lastTickSec.current = -1;
    setStage('cards');
    if (!cardRef.current) nextCard();
  }, [nextCard]);

  const finishCards = useCallback(() => {
    setStage('review');
    setTimeLeft(0);
    playTimeOut();
    later(() => playWin(), 700);
  }, [later]);

  const advance = useCallback((kind: TiltEvent) => {
    if (statusRef.current !== 'playing' || stageRef.current !== 'cards' || !cardRef.current) return;
    const got = kind === 'correct';
    setResults(r => [...r, { card: cardRef.current, got }]);
    setFlash(f => ({ kind, n: (f?.n ?? 0) + 1 }));
    if (got) playCorrect(); else playPop();
    later(() => setFlash(null), 450);
    nextCard();
  }, [later, nextCard]);

  const manual = useCallback((kind: TiltEvent) => {
    const now = Date.now();
    if (now - lastManual.current < MANUAL_GUARD_MS) return;
    lastManual.current = now;
    tilt.current = manualAction(tilt.current, now);
    advance(kind);
  }, [advance]);

  // ---- clock: countdown and card timer ----
  useEffect(() => {
    if (status !== 'playing' || stage === 'review') return;
    const id = window.setInterval(() => {
      const left = endsAt.current - Date.now();
      const sec = Math.max(0, Math.ceil(left / 1000));
      if (stageRef.current === 'countdown') {
        setCountLeft(sec);
        if (sec !== lastTickSec.current && sec > 0) { lastTickSec.current = sec; playTick(); }
        if (left <= 0) startCards();
      } else if (stageRef.current === 'cards') {
        setTimeLeft(sec);
        if (sec <= 5 && sec > 0 && sec !== lastTickSec.current) { lastTickSec.current = sec; playTick(); }
        if (left <= 0) finishCards();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [status, stage, startCards, finishCards]);

  // ---- tilt sensor ----
  useEffect(() => {
    if (status !== 'playing' || (sensor !== 'waiting' && sensor !== 'on')) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const r = { beta: e.beta, gamma: e.gamma };
      reading.current = r;
      if (sensor === 'waiting') setSensor('on');
      if (stageRef.current !== 'cards') return;
      if (tilt.current.neutral === null) { tilt.current = calibrate(r, screenAngle(), Date.now()); return; }
      const res = feedTilt(tilt.current, r, Date.now());
      tilt.current = res.state;
      if (res.event) advance(res.event);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [status, sensor, advance]);

  // ---- keyboard (grown-ups / laptops) ----
  useEffect(() => {
    if (status !== 'playing' || stage !== 'cards') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); manual('correct'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); manual('pass'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, stage, manual]);

  // ---- pause ----
  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    if (stageRef.current === 'cards') remaining.current = Math.max(0, endsAt.current - Date.now());
    setStatus('paused');
  }, []);

  useEffect(() => {
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause]);

  const resume = () => {
    if (stageRef.current === 'review') { setStatus('playing'); return; }
    setStatus('playing');
    // They probably took it off their forehead: count down and calibrate again.
    beginCountdown();
  };

  const cat = headsUpCategory(categoryId);
  const tiltOn = sensor === 'on';
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const got = results.filter(r => r.got);
  const passed = results.filter(r => !r.got);

  const readyContent = (
    <div className="text-left space-y-3">
      <p className="font-nunito text-lg text-violet-100">
        Hold the iPad on your forehead (sideways) so your friends can see the word. They act it out or describe it — you guess!
      </p>
      <p className="font-nunito text-lg text-violet-100">
        Tilt <b>down</b> ✅ when you get it · tilt <b>up</b> ⏭ to pass.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {HEADS_UP_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => { playClick(); setCategoryId(c.id); }}
            className={`min-h-[56px] rounded-2xl font-fredoka text-lg px-2 ${categoryId === c.id ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-fredoka text-lg">⏱️</span>
        {ROUND_CHOICES.map(s => (
          <button key={s} onClick={() => { playClick(); setSecs(s); }}
            className={`flex-1 min-h-[48px] rounded-2xl font-fredoka text-lg ${secs === s ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
            {s}s
          </button>
        ))}
      </div>
      <p className="font-nunito text-base text-violet-300">The iPad may ask to use motion — tap Allow. No tilt? Use the buttons instead.</p>
    </div>
  );

  return (
    <GameShell
      gameId="heads_up" title="Heads Up" icon="🙆" xpScale={0.3}
      status={status} score={score} round={round}
      formatScore={s => `${s} ✅`}
      overTitle={score > 0 ? `${score} card${score === 1 ? '' : 's'} guessed!` : 'Good try!'}
      overStats={[{ label: '✅ Got', value: String(got.length) }, { label: '⏭ Passed', value: String(passed.length) }]}
      readyContent={readyContent}
      startLabel="▶ Start"
      onStart={start} onPause={pause} onResume={resume}
    >
      <div className="absolute inset-0 flex flex-col">
        {/* Flash */}
        <AnimatePresence>
          {flash && (
            <motion.div key={flash.n} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className={`absolute inset-0 z-10 pointer-events-none flex items-center justify-center ${flash.kind === 'correct' ? 'bg-green-500' : 'bg-orange-500'}`}>
              <span className="text-[10rem] leading-none">{flash.kind === 'correct' ? '✅' : '⏭'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {stage === 'countdown' && status === 'playing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="font-fredoka text-3xl md:text-5xl mb-4">Put it on your forehead! 🙆</p>
            <motion.div key={countLeft} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="font-fredoka text-[9rem] md:text-[12rem] leading-none text-yellow-300">
              {Math.max(1, countLeft)}
            </motion.div>
            <p className="font-nunito text-xl text-violet-200 mt-4">{cat.emoji} {cat.name} · {cat.hint}</p>
            {portrait && <p className="font-fredoka text-2xl text-orange-200 mt-3">Turn the iPad sideways 🔄</p>}
          </div>
        )}

        {stage === 'cards' && (
          <>
            <div className="flex items-center justify-between px-4 py-2 font-fredoka text-2xl md:text-3xl">
              <span>{cat.emoji} {cat.name}</span>
              <span className={timeLeft <= 5 ? 'text-orange-300' : 'text-yellow-300'}>⏱️ {timeLeft}</span>
              <span>✅ {score}</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-4 min-h-0">
              <motion.div key={card} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}
                className="font-fredoka text-center leading-tight break-words max-w-full"
                style={{ fontSize: 'clamp(3rem, 11vw, 9rem)' }}>
                {card}
              </motion.div>
            </div>
            {!tiltOn ? (
              <div className="grid grid-cols-2 gap-3 p-3">
                <button onPointerDown={(e) => { e.preventDefault(); manual('pass'); }}
                  className="min-h-[88px] rounded-3xl bg-orange-500 font-fredoka text-3xl active:scale-95">⏭ Pass</button>
                <button onPointerDown={(e) => { e.preventDefault(); manual('correct'); }}
                  className="min-h-[88px] rounded-3xl bg-green-600 font-fredoka text-3xl active:scale-95">✅ Got it!</button>
                {sensor === 'denied' && (
                  <p className="col-span-2 text-center font-nunito text-base text-violet-200">Motion is off, so tap the buttons (or use ⬇️ / ⬆️ keys).</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3">
                <button onPointerDown={(e) => { e.preventDefault(); manual('pass'); }}
                  className="min-h-[48px] min-w-[48px] px-4 rounded-full bg-orange-500/70 font-fredoka text-lg" aria-label="Pass">⏭</button>
                <span className="font-nunito text-base text-violet-200 text-center">Tilt down ✅ · Tilt up ⏭</span>
                <button onPointerDown={(e) => { e.preventDefault(); manual('correct'); }}
                  className="min-h-[48px] min-w-[48px] px-4 rounded-full bg-green-600/70 font-fredoka text-lg" aria-label="Got it">✅</button>
              </div>
            )}
          </>
        )}

        {stage === 'review' && (
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ touchAction: 'pan-y' }}>
            {got.length > 0 && status === 'playing' && <ConfettiBurst count={70} durationMs={3000} />}
            <div className="max-w-3xl mx-auto text-center">
              <p className="font-fredoka text-4xl mb-1">⏰ Time's up!</p>
              <p className="font-fredoka text-3xl text-yellow-300 mb-4">
                {got.length > 0 ? `You got ${got.length}! 🎉` : 'Great acting, everyone! 🎭'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-5">
                <div className="rounded-3xl bg-green-700/40 border-2 border-green-400/60 p-4">
                  <h3 className="font-fredoka text-2xl mb-2">✅ Got it ({got.length})</h3>
                  {got.length === 0 && <p className="font-nunito text-lg text-green-100">None this time — next round!</p>}
                  {got.map((r, i) => <p key={i} className="font-nunito text-xl py-0.5">{r.card}</p>)}
                </div>
                <div className="rounded-3xl bg-orange-700/40 border-2 border-orange-400/60 p-4">
                  <h3 className="font-fredoka text-2xl mb-2">⏭ Passed ({passed.length})</h3>
                  {passed.length === 0 && <p className="font-nunito text-lg text-orange-100">No passes — wow!</p>}
                  {passed.map((r, i) => <p key={i} className="font-nunito text-xl py-0.5">{r.card}</p>)}
                </div>
              </div>
              <button onClick={() => { playClick(); setStatus('over'); }}
                className="min-h-[56px] px-10 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                🏆 See my score
              </button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
