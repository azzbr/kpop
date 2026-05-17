let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

type Tone = { freq: number; duration: number; type?: OscillatorType; volume?: number };

function playTones(tones: Tone[], gapMs = 0) {
  const ac = ctx();
  if (!ac) return;
  const start = ac.currentTime;
  let offset = 0;
  tones.forEach((t) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;
    const v = t.volume ?? 0.15;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(v, start + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + t.duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(start + offset);
    osc.stop(start + offset + t.duration + 0.05);
    offset += t.duration + gapMs / 1000;
  });
}

export const playClick = () =>
  playTones([{ freq: 600, duration: 0.05, type: 'square', volume: 0.08 }]);

export const playCorrect = () =>
  playTones(
    [
      { freq: 660, duration: 0.1, type: 'triangle' },
      { freq: 880, duration: 0.15, type: 'triangle' },
    ],
    20
  );

export const playWrong = () =>
  playTones([{ freq: 180, duration: 0.25, type: 'sawtooth', volume: 0.12 }]);

export const playWin = () =>
  playTones(
    [
      { freq: 523, duration: 0.12, type: 'triangle' },
      { freq: 659, duration: 0.12, type: 'triangle' },
      { freq: 784, duration: 0.12, type: 'triangle' },
      { freq: 1047, duration: 0.25, type: 'triangle' },
    ],
    10
  );

export const playPop = () =>
  playTones([{ freq: 900, duration: 0.06, type: 'sine', volume: 0.15 }]);

export const playHit = () =>
  playTones([{ freq: 740, duration: 0.08, type: 'triangle', volume: 0.18 }]);

export const playPerfect = () =>
  playTones(
    [
      { freq: 880, duration: 0.06, type: 'triangle' },
      { freq: 1320, duration: 0.1, type: 'triangle' },
    ],
    5
  );
