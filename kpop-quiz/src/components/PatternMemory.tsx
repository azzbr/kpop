import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { useGameStore } from '../store';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { initAudio, playWrong, playCorrect } from '../utils/sounds';

const PADS = [
  { id: 0, name: 'Pink', color: '#ec4899', glow: '#fbcfe8', freq: 330 },
  { id: 1, name: 'Blue', color: '#3b82f6', glow: '#bfdbfe', freq: 415 },
  { id: 2, name: 'Yellow', color: '#eab308', glow: '#fef08a', freq: 523 },
  { id: 3, name: 'Green', color: '#22c55e', glow: '#bbf7d0', freq: 659 },
];
const MAX_ROUNDS = 20;

type Phase = 'showing' | 'input' | 'done';

// utils/sounds has no "play this note" helper yet, so the pads use a small one here. It follows the
// Parent corner's sound-effect volume (parent.sfxVolume), like every other sound.
let toneCtx: AudioContext | null = null;
function unlockTones() {
  initAudio();
  try {
    if (!toneCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) toneCtx = new AC();
    }
    if (toneCtx?.state === 'suspended') toneCtx.resume().catch(() => {});
  } catch { /* audio is optional */ }
}
function playNote(freq: number, ms: number) {
  const vol = useGameStore.getState().parent?.sfxVolume ?? 1;
  const ctx = toneCtx;
  if (!ctx || vol <= 0 || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.3 * vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.05);
}

export default function PatternMemory() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('showing');
  const [lit, setLit] = useState<number | null>(null);
  const [level, setLevel] = useState(0); // current sequence length
  const [progress, setProgress] = useState(0);
  const [reached, setReached] = useState(0);
  // Refs, not state: taps can arrive faster than React re-renders, and each one must be
  // checked against the step the player is actually on.
  const seqRef = useRef<number[]>([]);
  const idxRef = useRef(0);
  const phaseRef = useRef<Phase>('showing');
  // Bumped to stop an in-flight playback (pause, restart, leaving the screen).
  const runRef = useRef(0);

  useEffect(() => () => { runRef.current++; }, []);
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  // Pausing stops the playback; resuming shows the whole pattern again.
  useEffect(() => {
    if (status === 'paused') { runRef.current++; setLit(null); }
  }, [status]);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const wait = (ms: number) => new Promise<void>(r => later(r, ms));

  const flash = async (id: number, ms: number) => {
    playNote(PADS[id].freq, ms);
    setLit(id);
    await wait(ms);
    setLit(l => (l === id ? null : l));
  };

  const showSequence = async (seq: number[]) => {
    const run = ++runRef.current;
    go('showing');
    await wait(600);
    // a little faster as the pattern grows
    const on = seq.length > 12 ? 300 : seq.length > 6 ? 350 : 420;
    for (const id of seq) {
      if (runRef.current !== run) return;
      await flash(id, on);
      await wait(180);
    }
    if (runRef.current !== run) return;
    idxRef.current = 0;
    setProgress(0);
    go('input');
  };

  const end = (score: number) => {
    runRef.current++;
    go('done');
    setReached(score);
    later(() => setStatus('over'), 700);
  };

  const start = () => {
    unlockTones();
    seqRef.current = [Math.floor(Math.random() * 4)];
    setLevel(1);
    setReached(0);
    setRound(r => r + 1);
    setStatus('playing');
    showSequence(seqRef.current);
  };

  const resume = () => {
    unlockTones();
    setStatus('playing');
    showSequence(seqRef.current);
  };

  const press = (id: number) => {
    if (status !== 'playing' || phaseRef.current !== 'input') return;
    flash(id, 200);
    const seq = seqRef.current;
    if (id !== seq[idxRef.current]) {
      playWrong();
      end(seq.length - 1);
      return;
    }
    idxRef.current++;
    setProgress(idxRef.current);
    if (idxRef.current < seq.length) return;

    // Pattern complete
    phaseRef.current = 'showing';
    playCorrect();
    if (seq.length >= MAX_ROUNDS) { end(MAX_ROUNDS); return; }
    seqRef.current = [...seq, Math.floor(Math.random() * 4)];
    setLevel(seqRef.current.length);
    const run = runRef.current;
    later(() => { if (runRef.current === run) showSequence(seqRef.current); }, 500);
  };

  const best = useGameStore(s => s.highScores.pattern_memory ?? 0);

  return (
    <GameShell
      gameId="pattern_memory"
      title="Pattern Memory"
      icon="🧠"
      xpScale={0.25}
      status={status}
      score={reached}
      round={round}
      formatScore={s => `Round ${s}`}
      overTitle={reached >= MAX_ROUNDS ? `All ${MAX_ROUNDS} rounds — memory master! 🏆` : `You remembered ${reached} in a row!`}
      overStats={[
        { label: '🧠 Pattern length', value: String(reached) },
        { label: '🏅 Best', value: String(Math.max(best, reached)) },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={resume}
      readyContent={
        <p className="font-nunito text-lg text-violet-100">
          Watch the pads light up, then tap them in the same order. Each round adds one more. How far can you go? (Up to {MAX_ROUNDS}!)
        </p>
      }
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 py-4">
        <div className="flex gap-2 font-fredoka text-lg">
          <span className="rounded-full bg-white/10 px-4 py-1">Round {level}</span>
          <span className="rounded-full bg-white/10 px-4 py-1 text-yellow-300">🏅 {best}</span>
        </div>
        <div className="h-9 font-fredoka text-2xl text-center">
          {phase === 'showing' && <span className="text-sky-300">👀 Watch carefully…</span>}
          {phase === 'input' && <span className="text-green-300">👆 Your turn! {progress}/{level}</span>}
          {phase === 'done' && <span className="text-orange-300">{reached >= MAX_ROUNDS ? '🏆 Perfect!' : 'Oops! Nice try 💪'}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4" style={{ width: 'min(88vw, calc(100dvh - 260px), 520px)' }}>
          {PADS.map(p => {
            const on = lit === p.id;
            return (
              <motion.button
                key={p.id}
                type="button"
                aria-label={p.name}
                onPointerDown={e => { e.preventDefault(); press(p.id); }}
                animate={{ scale: on ? 0.94 : 1 }}
                transition={{ duration: 0.08 }}
                className={`aspect-square rounded-[2rem] border-4 border-white/20 ${phase === 'input' ? '' : 'opacity-80'}`}
                style={{
                  background: on ? p.glow : p.color,
                  boxShadow: on ? `0 0 48px 12px ${p.color}` : '0 8px 20px rgba(0,0,0,0.35)',
                }}
              />
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
