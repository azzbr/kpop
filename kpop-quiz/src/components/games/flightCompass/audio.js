// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Flight Compass — synthesised sound effects (Web Audio) and vibration. No audio files needed.
  const root = window;

  class Feedback {
    constructor() {
      this.ctx = null;
      this.soundOn = true;
      this.vibrateOn = true;
      this.volume = 1;
      this.master = null;
    }

    /** Fun Quest's sound-effect volume (Grown-ups corner), 0..1. */
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = this.volume;
    }

    close() {
      if (this.ctx) this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
    }

    /** Browsers only allow audio after a user gesture; call this from a click/tap handler. */
    unlock() {
      if (!this.ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _tone(freq, { start = 0, dur = 0.12, type = 'sine', gain = 0.15, slideTo = null } = {}) {
      const ctx = this.ctx;
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(amp).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _noise({ dur = 0.8, gain = 0.12, from = 400, to = 2400 } = {}) {
      const ctx = this.ctx;
      const length = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      const t = ctx.currentTime;
      filter.frequency.setValueAtTime(from, t);
      filter.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
      filter.frequency.exponentialRampToValueAtTime(from, t + dur);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter).connect(amp).connect(this.master);
      src.start(t);
    }

    _buzz(pattern) {
      if (this.vibrateOn && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (_) { /* unsupported */ }
      }
    }

    /** One rising note per hit in a row: a major pentatonic scale climbing two octaves. */
    streakNote(streak) {
      if (!this.soundOn || !this.ctx) return;
      const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const step = steps[Math.min(steps.length, Math.max(1, streak)) - 1];
      const freq = 392 * Math.pow(2, step / 12);
      this._tone(freq, { dur: 0.22, type: 'sine', gain: 0.11 });
      this._tone(freq * 2, { start: 0.01, dur: 0.12, type: 'triangle', gain: 0.03 });
    }

    play(name) {
      if (name === 'stamp') this._buzz(25);
      if (name === 'streak') this._buzz([30, 60, 30, 60, 60]);
      if (name === 'tickMinor' || name === 'tickMajor') this._buzz(name === 'tickMajor' ? 12 : 5);
      if (name === 'bullseye' || name === 'sharp') this._buzz([20, 50, 30]);
      if (name === 'miss') this._buzz([30, 40, 30, 40, 40]);
      if (name === 'land') this._buzz(15);
      if (!this.soundOn || !this.ctx) return;
      switch (name) {
        case 'tickMinor': this._tone(1800, { dur: 0.025, type: 'square', gain: 0.025 }); break;
        case 'tickMajor': this._tone(1200, { dur: 0.05, type: 'square', gain: 0.05 }); break;
        case 'lock': this._tone(520, { dur: 0.08, type: 'triangle', gain: 0.14 }); this._tone(780, { start: 0.07, dur: 0.12, type: 'triangle', gain: 0.14 }); break;
        case 'takeoff': this._noise({ dur: 1.1, gain: 0.1 }); break;
        case 'land': this._tone(180, { dur: 0.22, type: 'sine', gain: 0.25, slideTo: 90 }); break;
        case 'bullseye': [660, 830, 990, 1320].forEach((f, i) => this._tone(f, { start: i * 0.07, dur: 0.18, type: 'triangle', gain: 0.12 })); break;
        case 'sharp': [660, 880, 1100].forEach((f, i) => this._tone(f, { start: i * 0.07, dur: 0.16, type: 'triangle', gain: 0.11 })); break;
        case 'good': [600, 800].forEach((f, i) => this._tone(f, { start: i * 0.08, dur: 0.16, type: 'triangle', gain: 0.1 })); break;
        case 'near': this._tone(560, { dur: 0.2, type: 'triangle', gain: 0.1 }); break;
        case 'miss': this._tone(220, { dur: 0.35, type: 'sawtooth', gain: 0.08, slideTo: 140 }); break;
        case 'streak': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this._tone(f, { start: i * 0.075, dur: i === 5 ? 0.4 : 0.11, type: 'square', gain: 0.045 })); break;
        case 'stamp':
          this._noise({ dur: 0.09, gain: 0.25, from: 180, to: 420 });
          this._tone(110, { dur: 0.12, type: 'sine', gain: 0.3, slideTo: 60 });
          break;
        case 'tap': this._tone(900, { dur: 0.04, type: 'sine', gain: 0.06 }); break;
        case 'gameOver': [523, 440, 349].forEach((f, i) => this._tone(f, { start: i * 0.16, dur: 0.3, type: 'triangle', gain: 0.1 })); break;
        case 'record': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, { start: i * 0.1, dur: 0.3, type: 'triangle', gain: 0.12 })); break;
        default: break;
      }
    }
  }

  export default Feedback;
