// ─── Audio Context ───────────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;

/** Call this once a user gesture has occurred so the context is running. */
export function initAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!_ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      _ctx = new AC();
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume().catch(() => {});
    }
  } catch (_) {
    // silently ignore — audio is not critical
  }
}

// Auto-unlock on first user gesture (covers sounds triggered from useEffect)
if (typeof document !== 'undefined') {
  const _unlock = () => {
    initAudio();
    document.removeEventListener('click', _unlock, true);
    document.removeEventListener('keydown', _unlock, true);
    document.removeEventListener('touchstart', _unlock, true);
  };
  document.addEventListener('click', _unlock, true);
  document.addEventListener('keydown', _unlock, true);
  document.addEventListener('touchstart', _unlock, true);
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) return null; // not yet unlocked; skip silently
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
    return null; // skip this sound — will work on next call
  }
  return _ctx;
}

// ─── Core engine ─────────────────────────────────────────────────────────────

type OscType = OscillatorType;

interface Tone {
  freq: number;
  dur: number;
  type?: OscType;
  vol?: number;
}

function schedule(tones: Tone[], gapSec = 0.04): void {
  const ctx = ac();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01; // tiny safety buffer
  let offset = 0;

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;

    const v = t.vol ?? 0.28;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.linearRampToValueAtTime(v, now + offset + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + t.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + t.dur + 0.04);

    offset += t.dur + gapSec;
  }
}

// ─── Sound effects ────────────────────────────────────────────────────────────

/** Short click — button tap */
export const playClick = () =>
  schedule([{ freq: 720, dur: 0.06, type: 'square', vol: 0.12 }], 0);

/** Two-note rising chime — correct answer */
export const playCorrect = () =>
  schedule(
    [
      { freq: 660, dur: 0.12, type: 'triangle', vol: 0.28 },
      { freq: 990, dur: 0.18, type: 'triangle', vol: 0.28 },
    ],
    0.03
  );

/** Low buzzer — wrong answer */
export const playWrong = () =>
  schedule([{ freq: 160, dur: 0.28, type: 'sawtooth', vol: 0.22 }], 0);

/** 4-note ascending fanfare — win / game complete */
export const playWin = () =>
  schedule(
    [
      { freq: 523, dur: 0.13, type: 'triangle', vol: 0.30 },
      { freq: 659, dur: 0.13, type: 'triangle', vol: 0.30 },
      { freq: 784, dur: 0.13, type: 'triangle', vol: 0.30 },
      { freq: 1047, dur: 0.30, type: 'triangle', vol: 0.32 },
    ],
    0.04
  );

/** Pop — card flip, bubble pop, tile match */
export const playPop = () =>
  schedule([{ freq: 880, dur: 0.07, type: 'sine', vol: 0.24 }], 0);

/** Hit — rhythm game good tap */
export const playHit = () =>
  schedule([{ freq: 740, dur: 0.09, type: 'triangle', vol: 0.26 }], 0);

/** Perfect — rhythm game perfect tap (two-tone sparkle) */
export const playPerfect = () =>
  schedule(
    [
      { freq: 1046, dur: 0.07, type: 'triangle', vol: 0.28 },
      { freq: 1318, dur: 0.12, type: 'triangle', vol: 0.26 },
    ],
    0.02
  );

/** Power-up / unlock — easter egg revealed */
export const playUnlock = () =>
  schedule(
    [
      { freq: 440, dur: 0.10, type: 'sine', vol: 0.22 },
      { freq: 554, dur: 0.10, type: 'sine', vol: 0.22 },
      { freq: 659, dur: 0.10, type: 'sine', vol: 0.22 },
      { freq: 880, dur: 0.22, type: 'sine', vol: 0.26 },
    ],
    0.03
  );

/** Countdown tick */
export const playTick = () =>
  schedule([{ freq: 1100, dur: 0.06, type: 'square', vol: 0.16 }], 0);

/** Time-out warning buzz */
export const playTimeOut = () =>
  schedule(
    [
      { freq: 300, dur: 0.15, type: 'sawtooth', vol: 0.22 },
      { freq: 200, dur: 0.20, type: 'sawtooth', vol: 0.22 },
    ],
    0.02
  );

/** Coin / star collect */
export const playCoin = () =>
  schedule(
    [
      { freq: 987, dur: 0.08, type: 'triangle', vol: 0.25 },
      { freq: 1318, dur: 0.12, type: 'triangle', vol: 0.25 },
    ],
    0.02
  );
