import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { REAL_OR_FAKE } from '../../data/realOrFake';
import type { RofFact } from '../../data/realOrFake';
import ConfettiBurst from '../ConfettiBurst';
import { playCorrect, playPerfect, playWrong, playClick } from '../../utils/sounds';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { drawFresh } from './drawLogic';
import { ROUND_SIZE, LIVES, SWIPE_THRESHOLD, newRof, answerRof, isOver, swipeAnswer } from './realOrFakeLogic';
import type { RofState } from './realOrFakeLogic';

// Facts seen earlier this session, so the next round starts with new ones.
const seenFacts = new Set<number>();

const RIGHT_CHEERS = ['You got it! 🎯', 'Super sleuth! 🕵️', 'Nailed it! 🔨', 'Brain power! 🧠', 'Correct! 🌟'];
const WRONG_CHEERS = ['Tricky one! 🤔', 'Sneaky fact! 🦊', 'Now you know! 💡', 'Good try! 💪'];

export default function RealOrFake() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [facts, setFacts] = useState<RofFact[]>([]);
  const [st, setSt] = useState<RofState>(newRof);
  const [feedback, setFeedback] = useState<{ ok: boolean; fact: RofFact; cheer: string } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fly, setFly] = useState<0 | 1 | -1>(0);
  const [party, setParty] = useState(0);
  const drag = useRef<{ id: number; x0: number } | null>(null);
  const later = useSafeTimeout();

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    setFacts(drawFresh(REAL_OR_FAKE.length, ROUND_SIZE, seenFacts, rng).map(i => REAL_OR_FAKE[i]));
    setSt(newRof());
    setFeedback(null);
    setDx(0); setFly(0); setDragging(false);
    drag.current = null;
    setRound(r => r + 1);
    setStatus('playing');
  };

  const fact = facts[st.index];
  const active = status === 'playing' && !feedback && !fly && !!fact;

  const answer = useCallback((saidReal: boolean) => {
    if (!active) return;
    setFly(saidReal ? 1 : -1);
    later(() => {
      const res = answerRof(st, fact.real, saidReal);
      if (res.ok) {
        playCorrect();
        if (res.state.streak > 0 && res.state.streak % 5 === 0) { playPerfect(); setParty(p => p + 1); }
      } else playWrong();
      setSt(res.state);
      const pool = res.ok ? RIGHT_CHEERS : WRONG_CHEERS;
      setFeedback({ ok: res.ok, fact, cheer: pool[Math.floor(Math.random() * pool.length)] });
      setFly(0);
      setDx(0);
    }, 220);
  }, [active, st, fact, later]);

  const next = () => {
    playClick();
    if (isOver(st, facts.length)) { setStatus('over'); return; }
    setFeedback(null);
  };

  // Laptop / Bluetooth keyboard: ← fake, → real.
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') answer(true);
      else if (e.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, answer]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || drag.current) return;
    drag.current = { id: e.pointerId, x0: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    setDx(e.clientX - drag.current.x0);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    const d = e.clientX - drag.current.x0;
    drag.current = null;
    setDragging(false);
    const res = e.type === 'pointercancel' ? null : swipeAnswer(d);
    if (res === null) setDx(0);
    else answer(res);
  };

  const lean = Math.max(-1, Math.min(1, dx / SWIPE_THRESHOLD));
  const cardX = fly ? fly * 700 : dx;
  const over = isOver(st, facts.length);

  return (
    <GameShell
      gameId="real_or_fake"
      title="Real or Fake?"
      icon="🕵️"
      xpScale={0.2}
      status={status}
      score={st.bestStreak}
      round={round}
      formatScore={s => `🔥 ${s}`}
      overTitle={st.lives <= 0 ? 'Out of hearts — great detective work!' : `All ${facts.length} facts done!`}
      overStats={[
        { label: 'Right answers', value: `${st.correct}/${st.index}` },
        { label: 'Best streak', value: `🔥 ${st.bestStreak}` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-2 font-nunito text-lg text-violet-100">
          <p>Is the fact <b className="text-green-300">REAL</b> or <b className="text-rose-300">FAKE</b>?</p>
          <p>👉 Swipe right for Real · 👈 Swipe left for Fake<br />or tap the big buttons.</p>
          <p>{ROUND_SIZE} facts · {'❤️'.repeat(LIVES)} · Your score is your best 🔥 streak!</p>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {party > 0 && <ConfettiBurst key={party} count={40} durationMs={2000} />}
        {fact || feedback ? (
          <div className="max-w-xl mx-auto flex flex-col gap-3">
            <div className="flex justify-between items-center font-fredoka text-lg">
              <span className="rounded-full bg-white/10 px-3 py-1">{Math.min(st.index + (feedback ? 0 : 1), facts.length)}/{facts.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">🔥 {st.streak} · 🏅 {st.bestStreak}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 tracking-wider" aria-label={`${st.lives} lives`}>
                {Array.from({ length: LIVES }, (_, i) => (i < st.lives ? '❤️' : '🤍')).join('')}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {feedback ? (
                <motion.div key={`fb${st.index}`} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-3xl p-5 text-center shadow-xl ${feedback.ok ? 'bg-green-600' : 'bg-rose-600'}`}>
                  <div className="text-6xl">{feedback.ok ? '🎉' : '💡'}</div>
                  <div className="font-fredoka text-3xl">{feedback.cheer}</div>
                  <div className="font-fredoka text-xl mt-1">It's {feedback.fact.real ? '✅ REAL' : '❌ FAKE'}!</div>
                  <p className="font-nunito text-lg mt-3 bg-black/20 rounded-2xl p-3">{feedback.fact.emoji} {feedback.fact.explain}</p>
                  <button onClick={next}
                    className="mt-4 w-full min-h-[56px] rounded-full bg-white text-slate-900 font-fredoka text-2xl shadow-lg active:scale-95 transition-transform">
                    {over ? '🏁 See results' : 'Next fact ➡️'}
                  </button>
                </motion.div>
              ) : (
                <motion.div key={`card${st.index}`} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <div
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className="relative rounded-3xl bg-white text-slate-900 px-5 py-8 text-center shadow-2xl select-none cursor-grab min-h-[260px] flex flex-col justify-center"
                    style={{
                      touchAction: 'none',
                      transform: `translateX(${cardX}px) rotate(${cardX / 18}deg)`,
                      transition: dragging ? 'none' : 'transform 0.22s ease-out',
                    }}
                  >
                    <div className="absolute top-3 left-3 rounded-xl border-4 border-rose-500 text-rose-500 px-2 font-fredoka text-2xl -rotate-12"
                      style={{ opacity: Math.max(0, -lean) }}>FAKE ❌</div>
                    <div className="absolute top-3 right-3 rounded-xl border-4 border-green-600 text-green-600 px-2 font-fredoka text-2xl rotate-12"
                      style={{ opacity: Math.max(0, lean) }}>REAL ✅</div>
                    <div className="text-7xl mb-3">{fact?.emoji}</div>
                    <p className="font-fredoka text-2xl md:text-3xl leading-snug">{fact?.text}</p>
                    <p className="font-nunito text-base text-slate-500 mt-4">👈 Fake · swipe · Real 👉</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!feedback && (
              <div className="grid grid-cols-2 gap-3">
                <button disabled={!active} onClick={() => answer(false)}
                  className="min-h-[72px] rounded-3xl bg-rose-500 font-fredoka text-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-60">
                  ❌ Fake
                </button>
                <button disabled={!active} onClick={() => answer(true)}
                  className="min-h-[72px] rounded-3xl bg-green-500 font-fredoka text-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-60">
                  ✅ Real
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </GameShell>
  );
}
