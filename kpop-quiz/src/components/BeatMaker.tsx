import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin } from '../utils/sounds';
import { createRng } from '../games/engine/rng';
import ScreenFrame from './ui/ScreenFrame';
import ConfettiBurst from './ConfettiBurst';
import {
  INSTRUMENTS, STEPS, PRESETS, MIN_BPM, MAX_BPM, BPM_STEP, MAX_SAVED, SAVE_KEY,
  emptyGrid, cloneGrid, toggleCell, randomGrid, clampBpm, stepSeconds, synthFreq,
  encodeGrid, decodeGrid, parseSaved, addBeat, removeBeat, beatName, isEmpty,
} from './beatMakerLogic';
import type { Grid, Instrument, SavedBeat } from './beatMakerLogic';

// Beat Maker: a 6-instrument, 16-step drum machine. A toy — no score or XP.
// Sound: its own Web Audio graph (all voices → one master gain set to the parent's sound-effect
// volume), scheduled ~100 ms ahead on the AudioContext clock so the beat never drifts.

const LOOKAHEAD_S = 0.1;
const TIMER_MS = 25;

// ── Synth voices ──────────────────────────────────────────────────────────────

class DrumKit {
  readonly ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;

  constructor(ctx: AudioContext, volume: number) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.setVolume(volume);
    const len = Math.floor(ctx.sampleRate * 0.3);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) { this.master.gain.value = Math.max(0, Math.min(1, v)) * 0.8; }

  private env(t: number, peak: number, dur: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.master);
    return g;
  }

  private noiseHit(t: number, filter: BiquadFilterType, freq: number, q: number, peak: number, dur: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    src.connect(f).connect(this.env(t, peak, dur));
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(t: number, type: OscillatorType, from: number, to: number, peak: number, dur: number) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
    osc.connect(this.env(t, peak, dur));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(inst: Instrument, t: number, step: number) {
    switch (inst) {
      case 'kick': this.tone(t, 'sine', 150, 40, 0.9, 0.3); break;
      case 'snare':
        this.noiseHit(t, 'bandpass', 2500, 0.6, 0.5, 0.18);
        this.tone(t, 'triangle', 220, 180, 0.2, 0.08);
        break;
      case 'hihat': this.noiseHit(t, 'highpass', 7000, 0.7, 0.25, 0.07); break;
      case 'clap':
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.012, 'bandpass', 1500, 0.8, 0.35, 0.06);
        break;
      case 'bass': this.tone(t, 'sawtooth', 82, 62, 0.35, 0.25); break;
      case 'synth': this.tone(t, 'square', synthFreq(step), synthFreq(step), 0.12, 0.16); break;
    }
  }
}

function newAudioContext(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { return new AC(); } catch { return null; }
}

function readSaved(): SavedBeat[] {
  try { return parseSaved(localStorage.getItem(SAVE_KEY)); } catch { return []; }
}
function writeSaved(list: SavedBeat[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

/** 16 steps in one row on a wide (landscape iPad) screen, 2 rows of 8 otherwise, 4 rows of 4 on a phone. */
function useColumns(): number {
  const calc = () => (typeof window === 'undefined' ? 8 : window.innerWidth >= 1100 ? 16 : window.innerWidth >= 520 ? 8 : 4);
  const [cols, setCols] = useState(calc);
  useEffect(() => {
    const onResize = () => setCols(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return cols;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BeatMaker() {
  const sfxVolume = useGameStore(s => s.parent.sfxVolume);
  const cols = useColumns();
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(PRESETS['Pop Beat']));
  const [bpm, setBpm] = useState(110);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [saved, setSaved] = useState<SavedBeat[]>(readSaved);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);

  const kitRef = useRef<DrumKit | null>(null);
  const gridRef = useRef(grid);
  const bpmRef = useRef(bpm);
  const nextTimeRef = useRef(0);
  const nextStepRef = useRef(0);
  const queueRef = useRef<{ step: number; time: number }[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { kitRef.current?.setVolume(sfxVolume); }, [sfxVolume]);

  /** Must run inside a tap (iPad Safari only starts audio from a user gesture). */
  const ensureKit = useCallback((): DrumKit | null => {
    if (!kitRef.current) {
      const ctx = newAudioContext();
      if (!ctx) return null;
      kitRef.current = new DrumKit(ctx, useGameStore.getState().parent.sfxVolume);
    }
    if (kitRef.current.ctx.state === 'suspended') kitRef.current.ctx.resume().catch(() => {});
    return kitRef.current;
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    queueRef.current = [];
    setPlaying(false);
    setCurrentStep(-1);
  }, []);

  const start = useCallback(() => {
    const kit = ensureKit();
    if (!kit) return;
    const ctx = kit.ctx;
    nextStepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.06;
    queueRef.current = [];

    const schedule = () => {
      // If the timer was held up (busy page), skip ahead instead of firing a burst of late notes.
      if (nextTimeRef.current < ctx.currentTime - 0.05) nextTimeRef.current = ctx.currentTime + 0.02;
      while (nextTimeRef.current < ctx.currentTime + LOOKAHEAD_S) {
        const step = nextStepRef.current;
        const t = nextTimeRef.current;
        gridRef.current.forEach((r, i) => { if (r[step]) kit.play(INSTRUMENTS[i].id, t, step); });
        queueRef.current.push({ step, time: t });
        nextTimeRef.current += stepSeconds(bpmRef.current);
        nextStepRef.current = (step + 1) % STEPS;
      }
    };
    const draw = () => {
      const q = queueRef.current;
      let shown = -1;
      while (q.length && q[0].time <= ctx.currentTime) shown = q.shift()!.step;
      if (shown >= 0) setCurrentStep(shown);
      rafRef.current = requestAnimationFrame(draw);
    };
    schedule();
    timerRef.current = window.setInterval(schedule, TIMER_MS);
    rafRef.current = requestAnimationFrame(draw);
    setPlaying(true);
  }, [ensureKit]);

  // Stop when she switches apps; close the audio graph when leaving.
  useEffect(() => {
    const onVis = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
      kitRef.current?.ctx.close().catch(() => {});
      kitRef.current = null;
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, [stop]);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const tapCell = (inst: number, step: number) => {
    const turningOn = !grid[inst][step];
    setGrid(g => toggleCell(g, inst, step));
    if (turningOn) {
      // Preview the sound right away (or a click if audio can't start).
      const kit = ensureKit();
      if (kit && !playing) kit.play(INSTRUMENTS[inst].id, kit.ctx.currentTime + 0.01, step);
      else if (!kit) playClick();
    }
  };

  const changeBpm = (d: number) => { playClick(); setBpm(b => clampBpm(b + d)); };
  const loadGrid = (g: Grid, newBpm?: number) => { playClick(); setGrid(cloneGrid(g)); if (newBpm) setBpm(clampBpm(newBpm)); };

  const save = () => {
    if (isEmpty(grid)) { playClick(); flash('Tap some squares first! 🎵'); return; }
    const beat: SavedBeat = {
      id: `${Date.now()}`,
      name: beatName(saved.map(b => b.name), createRng(Date.now() % 1e9)),
      bpm,
      rows: encodeGrid(grid),
    };
    const next = addBeat(saved, beat);
    if (!next) { playClick(); flash(`You have ${MAX_SAVED} beats — delete one first`); return; }
    setSaved(next);
    writeSaved(next);
    playWin();
    setConfetti(c => c + 1);
    flash(`Saved as ${beat.name}!`);
  };

  const load = (b: SavedBeat) => {
    const g = decodeGrid(b.rows);
    if (g) { loadGrid(g, b.bpm); flash(`Loaded ${b.name}`); }
  };

  const del = (id: string) => {
    playClick();
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    const next = removeBeat(saved, id);
    setSaved(next);
    writeSaved(next);
    setConfirmDelete(null);
  };

  const chip = 'min-h-[48px] px-4 rounded-full font-fredoka text-lg bg-white/15 active:bg-white/30';

  return (
    <ScreenFrame title="Beat Maker" icon="🎛️" width="max-w-6xl">
      {confetti > 0 && <ConfettiBurst key={confetti} count={60} durationMs={2000} />}

      {/* Controls */}
      <div className="rounded-3xl bg-white/10 p-3 mb-3 flex flex-wrap items-center gap-3">
        <motion.button whileTap={{ scale: 0.94 }}
          onClick={() => (playing ? (playClick(), stop()) : start())}
          className={`min-h-[56px] px-7 rounded-full font-fredoka text-2xl shadow-lg ${playing ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}>
          {playing ? '⏹ Stop' : '▶ Play'}
        </motion.button>

        <div className="flex items-center gap-2 rounded-full bg-black/25 p-1">
          <button onClick={() => changeBpm(-BPM_STEP)} disabled={bpm <= MIN_BPM} aria-label="Slower"
            className="min-h-[48px] min-w-[48px] rounded-full bg-white/15 font-fredoka text-2xl disabled:opacity-30">−</button>
          <div className="text-center min-w-[84px]">
            <div className="font-fredoka text-2xl leading-none">{bpm}</div>
            <div className="font-nunito text-sm text-violet-200">beats/min</div>
          </div>
          <button onClick={() => changeBpm(BPM_STEP)} disabled={bpm >= MAX_BPM} aria-label="Faster"
            className="min-h-[48px] min-w-[48px] rounded-full bg-white/15 font-fredoka text-2xl disabled:opacity-30">+</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map(name => (
            <button key={name} onClick={() => loadGrid(PRESETS[name])} className={chip}>{name}</button>
          ))}
          <button onClick={() => loadGrid(randomGrid(createRng(Date.now() % 1e9)))} className={chip}>🎲 Random</button>
          <button onClick={() => loadGrid(emptyGrid())} className={chip}>🗑️ Clear</button>
        </div>
      </div>

      {/* Step grid */}
      <div className="rounded-3xl bg-white/10 p-3 mb-3 space-y-3 select-none"
        style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}>
        {INSTRUMENTS.map((inst, ti) => (
          <div key={inst.id} className="flex items-center gap-2">
            <div className="w-16 sm:w-20 shrink-0 text-center">
              <div className="text-2xl">{inst.emoji}</div>
              <div className="font-fredoka text-base leading-tight">{inst.name}</div>
            </div>
            <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: STEPS }, (_, si) => {
                const on = grid[ti][si];
                const now = playing && currentStep === si;
                const beatStart = si % 4 === 0;
                return (
                  <button key={si}
                    onClick={() => tapCell(ti, si)}
                    aria-label={`${inst.name} step ${si + 1}${on ? ' on' : ''}`}
                    aria-pressed={on}
                    className={`min-h-[48px] min-w-[44px] rounded-lg border-2 transition-[transform,filter] duration-75
                      ${on ? inst.on : beatStart ? 'bg-white/20 border-white/25' : 'bg-white/[0.08] border-white/10'}
                      ${now ? (on ? 'brightness-150 scale-105' : 'ring-2 ring-yellow-300') : ''}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center font-fredoka text-xl text-yellow-300 mb-3">{toast}</motion.p>
        )}
      </AnimatePresence>

      {/* Saved beats */}
      <div className="rounded-3xl bg-white/10 p-3">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="font-fredoka text-2xl flex-1">💾 My beats <span className="font-nunito text-base text-violet-200">({saved.length}/{MAX_SAVED})</span></h2>
          <button onClick={save} disabled={saved.length >= MAX_SAVED}
            className="min-h-[52px] px-6 rounded-full font-fredoka text-xl bg-gradient-to-r from-fuchsia-500 to-orange-400 shadow disabled:opacity-40">
            {saved.length >= MAX_SAVED ? 'Full — delete one' : '💾 Save this beat'}
          </button>
        </div>
        {saved.length === 0 && <p className="font-nunito text-lg text-violet-200">Make a beat you like and save it here — you can keep {MAX_SAVED}.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {saved.map(b => (
            <div key={b.id} className="flex items-center gap-2 rounded-2xl bg-black/25 p-2 pl-4">
              <div className="flex-1 min-w-0">
                <p className="font-fredoka text-lg truncate">{b.name}</p>
                <p className="font-nunito text-base text-violet-200">{b.bpm} beats/min</p>
              </div>
              <button onClick={() => load(b)} className="min-h-[48px] px-4 rounded-full bg-green-500/80 font-fredoka text-lg">▶ Load</button>
              <button onClick={() => del(b.id)}
                className={`min-h-[48px] min-w-[48px] px-3 rounded-full font-fredoka text-lg ${confirmDelete === b.id ? 'bg-rose-500' : 'bg-white/15'}`}
                aria-label={`Delete ${b.name}`}>
                {confirmDelete === b.id ? 'Delete?' : '🗑️'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center font-nunito text-lg text-violet-200 mt-4">
        💡 Tap squares to add sounds — you can change them while the beat plays!
      </p>
    </ScreenFrame>
  );
}
