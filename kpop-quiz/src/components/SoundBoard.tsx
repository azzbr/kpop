import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';

interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  key?: string;
  color: string;
}

type Category = 'funny' | 'animals' | 'instruments' | 'effects' | 'reactions';

const soundCategories: Record<Category, SoundEffect[]> = {
  funny: [
    { id: 'burp',        name: 'Big Burp',      emoji: '🤢',  key: 'Q', color: 'from-green-400 to-emerald-500' },
    { id: 'fart',        name: 'Mega Fart',      emoji: '💨',  key: 'W', color: 'from-yellow-400 to-green-400'  },
    { id: 'sneeze',      name: 'Sneeze',         emoji: '🤧',  key: 'E', color: 'from-blue-400 to-cyan-400'     },
    { id: 'hiccup',      name: 'Hiccup',         emoji: '😮',  key: 'R', color: 'from-pink-400 to-rose-500'    },
    { id: 'yawn',        name: 'Yawn',           emoji: '🥱',  key: 'T', color: 'from-purple-400 to-violet-500' },
    { id: 'giggle',      name: 'Giggle',         emoji: '😂',  key: 'Y', color: 'from-orange-400 to-yellow-400' },
    { id: 'sadtrombone', name: 'Sad Trombone',   emoji: '😢',  key: 'U', color: 'from-blue-500 to-indigo-500'  },
    { id: 'airhorn',     name: 'Air Horn!',      emoji: '📯',  key: 'I', color: 'from-red-500 to-orange-500'   },
  ],
  animals: [
    { id: 'cat',      name: 'Cat Meow',      emoji: '🐱', key: 'A', color: 'from-orange-300 to-yellow-400' },
    { id: 'dog',      name: 'Dog Bark',      emoji: '🐶', key: 'S', color: 'from-amber-400 to-orange-400'  },
    { id: 'duck',     name: 'Duck Quack',    emoji: '🦆', key: 'D', color: 'from-yellow-400 to-green-400'  },
    { id: 'pig',      name: 'Pig Oink',      emoji: '🐷', key: 'F', color: 'from-pink-400 to-rose-400'    },
    { id: 'cow',      name: 'Cow Moo',       emoji: '🐄', key: 'G', color: 'from-slate-400 to-gray-500'   },
    { id: 'frog',     name: 'Frog Ribbit',   emoji: '🐸', key: 'H', color: 'from-green-500 to-emerald-500' },
    { id: 'horse',    name: 'Horse Neigh',   emoji: '🐴', key: 'J', color: 'from-brown-400 to-amber-600'  },
    { id: 'elephant', name: 'Elephant!',     emoji: '🐘', key: 'K', color: 'from-gray-400 to-slate-500'   },
    { id: 'lion',     name: 'Lion Roar',     emoji: '🦁', key: 'L', color: 'from-yellow-500 to-orange-600' },
    { id: 'monkey',   name: 'Monkey',        emoji: '🐒', key: ';', color: 'from-amber-500 to-orange-500'  },
    { id: 'sheep',    name: 'Sheep Baa',     emoji: '🐑', key: "'", color: 'from-white to-gray-200'       },
    { id: 'bird',     name: 'Bird Tweet',    emoji: '🐦', key: 'Z', color: 'from-sky-400 to-blue-400'     },
  ],
  instruments: [
    { id: 'drum',       name: 'Kick Drum',   emoji: '🥁', key: 'X', color: 'from-red-400 to-orange-400'   },
    { id: 'piano',      name: 'Piano',       emoji: '🎹', key: 'C', color: 'from-gray-700 to-gray-900'    },
    { id: 'trumpet',    name: 'Trumpet',     emoji: '🎺', key: 'V', color: 'from-yellow-500 to-amber-500' },
    { id: 'violin',     name: 'Violin',      emoji: '🎻', key: 'B', color: 'from-amber-600 to-orange-600' },
    { id: 'guitar',     name: 'Guitar',      emoji: '🎸', key: 'N', color: 'from-orange-500 to-red-500'   },
    { id: 'xylophone',  name: 'Xylophone',   emoji: '🎵', key: 'M', color: 'from-teal-400 to-cyan-500'   },
    { id: 'kazoo',      name: 'Kazoo',       emoji: '🎶', key: ',', color: 'from-pink-400 to-purple-500'  },
    { id: 'airguitar',  name: 'Air Guitar',  emoji: '🤟', key: '.', color: 'from-purple-500 to-pink-500'  },
  ],
  effects: [
    { id: 'laser',     name: 'Laser',       emoji: '⚡',  key: '1', color: 'from-blue-500 to-cyan-500'   },
    { id: 'explosion', name: 'Explosion',   emoji: '💥',  key: '2', color: 'from-red-500 to-orange-500'  },
    { id: 'whoosh',    name: 'Whoosh',      emoji: '💨',  key: '3', color: 'from-sky-400 to-blue-500'    },
    { id: 'alarm',     name: 'Alarm!',      emoji: '🚨',  key: '4', color: 'from-red-600 to-red-500'     },
    { id: 'twinkle',   name: 'Magic',       emoji: '✨',  key: '5', color: 'from-purple-400 to-pink-400' },
    { id: 'coin',      name: 'Coin',        emoji: '🪙',  key: '6', color: 'from-yellow-400 to-amber-500' },
    { id: 'ufo',       name: 'UFO',         emoji: '🛸',  key: '7', color: 'from-green-400 to-teal-500'  },
    { id: 'boing',     name: 'Boing!',      emoji: '🏀',  key: '8', color: 'from-orange-400 to-yellow-400' },
  ],
  reactions: [
    { id: 'applause',   name: 'Applause',    emoji: '👏', key: 'F1', color: 'from-amber-400 to-yellow-400' },
    { id: 'drumroll',   name: 'Drum Roll',   emoji: '🥁', key: 'F2', color: 'from-red-400 to-pink-500'    },
    { id: 'levelup',    name: 'Level Up!',   emoji: '⬆️', key: 'F3', color: 'from-green-500 to-teal-500'  },
    { id: 'gameover',   name: 'Game Over',   emoji: '💀', key: 'F4', color: 'from-gray-700 to-gray-900'   },
    { id: 'tadaa',      name: 'Ta-Daa!',     emoji: '🎉', key: 'F5', color: 'from-purple-500 to-pink-500' },
    { id: 'ohno',       name: 'Oh No!',      emoji: '😱', key: 'F6', color: 'from-red-500 to-rose-600'    },
    { id: 'woo',        name: 'Woo!',        emoji: '🙌', key: 'F7', color: 'from-pink-400 to-purple-400' },
    { id: 'crickets',   name: 'Crickets',    emoji: '🦗', key: 'F8', color: 'from-slate-400 to-gray-500'  },
  ],
};

interface FlyingEmoji { id: number; emoji: string; x: number; y: number; dx: number; dy: number }

export default function SoundBoard() {
  const { incrementSoundEffectsPlayed } = useGameStore();
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [activeCategory, setActiveCategory] = useState<Category>('funny');
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const [chaosMode, setChaosMode] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const emojiIdRef = useRef(0);
  const chaosRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCtx = useCallback((): AudioContext => {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new AC();
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }, []);

  const noise = useCallback((ctx: AudioContext, dur: number, vol: number) => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(ctx.destination);
    src.start();
    return g;
  }, []);

  const playSynthSound = useCallback((id: string) => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const v = volume;

    const osc = (type: OscillatorType, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g).connect(ctx.destination);
      return { o, g };
    };

    switch (id) {
      // ── FUNNY ────────────────────────────────────────────────────────────
      case 'burp': {
        const { o, g } = osc('sawtooth', 90);
        o.frequency.linearRampToValueAtTime(50, t + 0.5);
        g.gain.setValueAtTime(v, t); g.gain.linearRampToValueAtTime(0, t + 0.5);
        o.start(); o.stop(t + 0.5); break;
      }
      case 'fart': {
        const { o, g } = osc('sawtooth', 75);
        o.frequency.linearRampToValueAtTime(45, t + 0.4);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        o.start(); o.stop(t + 0.4); break;
      }
      case 'sneeze': {
        const { o, g } = osc('triangle', 200);
        o.frequency.exponentialRampToValueAtTime(600, t + 0.12);
        g.gain.setValueAtTime(v, t); g.gain.linearRampToValueAtTime(0, t + 0.12);
        o.start(); o.stop(t + 0.12);
        const ng = noise(ctx, 0.25, v * 0.6);
        ng.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        break;
      }
      case 'hiccup': {
        const { o, g } = osc('triangle', 700);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        o.start(); o.stop(t + 0.1); break;
      }
      case 'yawn': {
        const { o, g } = osc('sine', 200);
        o.frequency.linearRampToValueAtTime(500, t + 0.5);
        o.frequency.linearRampToValueAtTime(200, t + 1.2);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * 0.5, t + 0.3);
        g.gain.linearRampToValueAtTime(v * 0.5, t + 0.9);
        g.gain.linearRampToValueAtTime(0, t + 1.3);
        o.start(); o.stop(t + 1.3); break;
      }
      case 'giggle': {
        [0, 0.15, 0.3].forEach(off => {
          const { o, g } = osc('sine', 500);
          o.frequency.linearRampToValueAtTime(700, t + off + 0.1);
          g.gain.setValueAtTime(v * 0.7, t + off);
          g.gain.linearRampToValueAtTime(0, t + off + 0.12);
          o.start(t + off); o.stop(t + off + 0.12);
        }); break;
      }
      case 'sadtrombone': {
        [494, 440, 392, 330].forEach((freq, i) => {
          const { o, g } = osc('sawtooth', freq);
          g.gain.setValueAtTime(0, t + i * 0.18);
          g.gain.linearRampToValueAtTime(v * 0.6, t + i * 0.18 + 0.04);
          g.gain.linearRampToValueAtTime(0, t + i * 0.18 + 0.2);
          o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.22);
        }); break;
      }
      case 'airhorn': {
        const { o, g } = osc('sawtooth', 440);
        const { o: o2, g: g2 } = osc('sawtooth', 554);
        g.gain.setValueAtTime(v * 0.6, t); g.gain.linearRampToValueAtTime(0, t + 0.8);
        g2.gain.setValueAtTime(v * 0.6, t); g2.gain.linearRampToValueAtTime(0, t + 0.8);
        o.start(); o.stop(t + 0.8); o2.start(); o2.stop(t + 0.8); break;
      }

      // ── ANIMALS ──────────────────────────────────────────────────────────
      case 'cat': {
        const { o, g } = osc('triangle', 620);
        o.frequency.linearRampToValueAtTime(820, t + 0.25);
        o.frequency.linearRampToValueAtTime(550, t + 0.6);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.15);
        g.gain.linearRampToValueAtTime(0, t + 0.7);
        o.start(); o.stop(t + 0.7); break;
      }
      case 'dog': {
        [0, 0.22].forEach(off => {
          const { o, g } = osc('sawtooth', 180);
          o.frequency.linearRampToValueAtTime(120, t + off + 0.15);
          g.gain.setValueAtTime(v, t + off); g.gain.exponentialRampToValueAtTime(0.01, t + off + 0.18);
          o.start(t + off); o.stop(t + off + 0.18);
        }); break;
      }
      case 'duck': {
        const { o, g } = osc('square', 400);
        o.frequency.linearRampToValueAtTime(300, t + 0.1);
        o.frequency.linearRampToValueAtTime(400, t + 0.18);
        g.gain.setValueAtTime(v * 0.7, t); g.gain.linearRampToValueAtTime(0, t + 0.22);
        o.start(); o.stop(t + 0.22); break;
      }
      case 'pig': {
        const { o, g } = osc('triangle', 300);
        o.frequency.linearRampToValueAtTime(250, t + 0.15);
        o.frequency.linearRampToValueAtTime(340, t + 0.3);
        g.gain.setValueAtTime(v * 0.8, t); g.gain.linearRampToValueAtTime(0, t + 0.35);
        o.start(); o.stop(t + 0.35); break;
      }
      case 'cow': {
        const { o, g } = osc('sawtooth', 110);
        o.frequency.linearRampToValueAtTime(85, t + 1.0);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 1.1);
        o.start(); o.stop(t + 1.1); break;
      }
      case 'frog': {
        [0, 0.18].forEach(off => {
          const { o, g } = osc('square', 200);
          o.frequency.linearRampToValueAtTime(150, t + off + 0.08);
          g.gain.setValueAtTime(v * 0.7, t + off); g.gain.exponentialRampToValueAtTime(0.01, t + off + 0.12);
          o.start(t + off); o.stop(t + off + 0.12);
        }); break;
      }
      case 'horse': {
        const { o, g } = osc('sawtooth', 500);
        o.frequency.linearRampToValueAtTime(200, t + 0.5);
        o.frequency.linearRampToValueAtTime(350, t + 0.7);
        g.gain.setValueAtTime(v * 0.5, t); g.gain.linearRampToValueAtTime(0, t + 0.8);
        o.start(); o.stop(t + 0.8); break;
      }
      case 'elephant': {
        const { o, g } = osc('sawtooth', 500);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.8);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.9);
        o.start(); o.stop(t + 0.9); break;
      }
      case 'lion': {
        const ng = noise(ctx, 1.2, v * 0.8);
        ng.gain.setValueAtTime(v * 0.8, t); ng.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
        const { o, g } = osc('sawtooth', 80);
        o.frequency.linearRampToValueAtTime(50, t + 1.0);
        g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        o.start(); o.stop(t + 1.0); break;
      }
      case 'monkey': {
        [400, 600, 400, 700, 350].forEach((f, i) => {
          const { o, g } = osc('triangle', f);
          g.gain.setValueAtTime(v * 0.6, t + i * 0.1); g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.09);
          o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.09);
        }); break;
      }
      case 'sheep': {
        const { o, g } = osc('triangle', 350);
        o.frequency.linearRampToValueAtTime(280, t + 0.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.7, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.6);
        o.start(); o.stop(t + 0.6); break;
      }
      case 'bird': {
        [800, 1100, 900, 1300, 950].forEach((f, i) => {
          const { o, g } = osc('sine', f);
          g.gain.setValueAtTime(v * 0.5, t + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.06);
          o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.06);
        }); break;
      }

      // ── INSTRUMENTS ──────────────────────────────────────────────────────
      case 'drum': {
        const ng = noise(ctx, 0.05, v * 0.9);
        ng.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        const { o, g } = osc('sine', 120);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        o.start(); o.stop(t + 0.1); break;
      }
      case 'piano': {
        [440, 554, 659].forEach((f, i) => {
          const { o, g } = osc('triangle', f);
          g.gain.setValueAtTime(v * 0.4, t + i * 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
          o.start(t + i * 0.01); o.stop(t + 1.3);
        }); break;
      }
      case 'trumpet': {
        const { o, g } = osc('sawtooth', 523);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.06);
        g.gain.setValueAtTime(v * 0.8, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 0.5);
        o.start(); o.stop(t + 0.5); break;
      }
      case 'violin': {
        const { o, g } = osc('sawtooth', 659);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.7, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 1.0);
        o.start(); o.stop(t + 1.0); break;
      }
      case 'guitar': {
        const { o, g } = osc('triangle', 330);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        o.start(); o.stop(t + 1.5); break;
      }
      case 'xylophone': {
        [880, 1047, 1319].forEach((f, i) => {
          const { o, g } = osc('sine', f);
          g.gain.setValueAtTime(v * 0.6, t + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
          o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
        }); break;
      }
      case 'kazoo': {
        const { o, g } = osc('square', 220);
        o.frequency.linearRampToValueAtTime(280, t + 0.3); o.frequency.linearRampToValueAtTime(220, t + 0.6);
        g.gain.setValueAtTime(v * 0.3, t); g.gain.linearRampToValueAtTime(0, t + 0.7);
        o.start(); o.stop(t + 0.7); break;
      }
      case 'airguitar': {
        [220, 330, 440, 330, 220].forEach((f, i) => {
          const { o, g } = osc('triangle', f);
          g.gain.setValueAtTime(v * 0.5, t + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.12);
          o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.12);
        }); break;
      }

      // ── EFFECTS ──────────────────────────────────────────────────────────
      case 'laser': {
        const { o, g } = osc('sawtooth', 900);
        o.frequency.exponentialRampToValueAtTime(100, t + 0.25);
        g.gain.setValueAtTime(v * 0.7, t); g.gain.linearRampToValueAtTime(0, t + 0.25);
        o.start(); o.stop(t + 0.25); break;
      }
      case 'explosion': {
        const ng = noise(ctx, 0.6, v);
        ng.gain.setValueAtTime(v, t); ng.gain.exponentialRampToValueAtTime(0.01, t + 0.6); break;
      }
      case 'whoosh': {
        const ng = noise(ctx, 0.5, 0);
        ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(v, t + 0.2);
        ng.gain.linearRampToValueAtTime(0, t + 0.5); break;
      }
      case 'alarm': {
        [0, 0.2, 0.4, 0.6].forEach((off, i) => {
          const { o, g } = osc('square', i % 2 === 0 ? 880 : 1100);
          g.gain.setValueAtTime(v * 0.5, t + off); g.gain.linearRampToValueAtTime(0, t + off + 0.18);
          o.start(t + off); o.stop(t + off + 0.18);
        }); break;
      }
      case 'twinkle': {
        [523, 659, 784, 1047, 784, 659].forEach((f, i) => {
          const { o, g } = osc('sine', f);
          g.gain.setValueAtTime(v * 0.3, t + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.28);
          o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.3);
        }); break;
      }
      case 'coin': {
        [1047, 1319].forEach((f, i) => {
          const { o, g } = osc('sine', f);
          g.gain.setValueAtTime(v * 0.5, t + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.25);
          o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.25);
        }); break;
      }
      case 'ufo': {
        const { o, g } = osc('sine', 300);
        o.frequency.linearRampToValueAtTime(600, t + 0.5);
        o.frequency.linearRampToValueAtTime(300, t + 1.0);
        g.gain.setValueAtTime(v * 0.5, t); g.gain.linearRampToValueAtTime(0, t + 1.1);
        o.start(); o.stop(t + 1.1); break;
      }
      case 'boing': {
        const { o, g } = osc('sine', 150);
        o.frequency.exponentialRampToValueAtTime(600, t + 0.3);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.6);
        g.gain.setValueAtTime(v * 0.8, t); g.gain.linearRampToValueAtTime(0, t + 0.7);
        o.start(); o.stop(t + 0.7); break;
      }

      // ── REACTIONS ────────────────────────────────────────────────────────
      case 'applause': {
        for (let i = 0; i < 8; i++) {
          const ng = noise(ctx, 0.06, v * 0.4);
          ng.gain.setValueAtTime(v * 0.4, t + i * 0.08);
          ng.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.06);
        } break;
      }
      case 'drumroll': {
        for (let i = 0; i < 16; i++) {
          const ng = noise(ctx, 0.03, v * 0.5);
          ng.gain.setValueAtTime(v * 0.5, t + i * 0.05);
          ng.gain.exponentialRampToValueAtTime(0.01, t + i * 0.05 + 0.03);
        } break;
      }
      case 'levelup': {
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          const { o, g } = osc('triangle', f);
          g.gain.setValueAtTime(v * 0.4, t + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.18);
          o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.2);
        }); break;
      }
      case 'gameover': {
        [392, 330, 294, 220].forEach((f, i) => {
          const { o, g } = osc('sawtooth', f);
          g.gain.setValueAtTime(v * 0.5, t + i * 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.3);
          o.start(t + i * 0.2); o.stop(t + i * 0.2 + 0.3);
        }); break;
      }
      case 'tadaa': {
        [[523, 659, 784], [659, 784, 988]].forEach((chord, ci) => {
          chord.forEach(f => {
            const { o, g } = osc('triangle', f);
            g.gain.setValueAtTime(0, t + ci * 0.25);
            g.gain.linearRampToValueAtTime(v * 0.3, t + ci * 0.25 + 0.05);
            g.gain.linearRampToValueAtTime(0, t + ci * 0.25 + 0.4);
            o.start(t + ci * 0.25); o.stop(t + ci * 0.25 + 0.4);
          });
        }); break;
      }
      case 'ohno': {
        const { o, g } = osc('sine', 600);
        o.frequency.linearRampToValueAtTime(200, t + 0.5);
        g.gain.setValueAtTime(v * 0.6, t); g.gain.linearRampToValueAtTime(0, t + 0.6);
        o.start(); o.stop(t + 0.6); break;
      }
      case 'woo': {
        const { o, g } = osc('sine', 400);
        o.frequency.linearRampToValueAtTime(700, t + 0.4);
        g.gain.setValueAtTime(v * 0.7, t); g.gain.linearRampToValueAtTime(0, t + 0.5);
        o.start(); o.stop(t + 0.5); break;
      }
      case 'crickets': {
        for (let i = 0; i < 12; i++) {
          const { o, g } = osc('sine', 3000 + Math.random() * 500);
          g.gain.setValueAtTime(v * 0.15, t + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.06);
          o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.06);
        } break;
      }

      default: {
        const { o, g } = osc('sine', 440);
        g.gain.setValueAtTime(v * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(); o.stop(t + 0.1);
      }
    }
  }, [volume, getCtx, noise]);

  const spawnEmoji = useCallback((emoji: string) => {
    const id = ++emojiIdRef.current;
    const dx = (Math.random() - 0.5) * 400;
    const dy = -(Math.random() * 200 + 100);
    setFlyingEmojis(prev => [...prev, { id, emoji, x: 0, y: 0, dx, dy }]);
    setTimeout(() => setFlyingEmojis(prev => prev.filter(e => e.id !== id)), 900);
  }, []);

  const playSound = useCallback((sound: SoundEffect) => {
    playSynthSound(sound.id);
    setActiveSound(sound.id);
    spawnEmoji(sound.emoji);
    setTimeout(() => setActiveSound(null), 350);
    incrementSoundEffectsPlayed();
  }, [playSynthSound, spawnEmoji, incrementSoundEffectsPlayed]);

  const triggerChaos = () => {
    if (chaosMode) {
      setChaosMode(false);
      if (chaosRef.current) clearInterval(chaosRef.current);
      return;
    }
    setChaosMode(true);
    const allSounds = Object.values(soundCategories).flat();
    let count = 0;
    chaosRef.current = setInterval(() => {
      const s = allSounds[Math.floor(Math.random() * allSounds.length)];
      playSound(s);
      count++;
      if (count >= 18) {
        clearInterval(chaosRef.current!);
        setChaosMode(false);
      }
    }, 180);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const all = Object.values(soundCategories).flat();
      const s = all.find(x => x.key?.toUpperCase() === key);
      if (s) { e.preventDefault(); playSound(s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playSound]);

  useEffect(() => () => { if (chaosRef.current) clearInterval(chaosRef.current); }, []);

  const categoryMeta: { id: Category; label: string; emoji: string }[] = [
    { id: 'funny',      label: 'Funny',       emoji: '😂' },
    { id: 'animals',    label: 'Animals',      emoji: '🐾' },
    { id: 'instruments',label: 'Instruments',  emoji: '🎸' },
    { id: 'effects',    label: 'Effects',      emoji: '⚡' },
    { id: 'reactions',  label: 'Reactions',    emoji: '🎉' },
  ];

  const currentSounds = soundCategories[activeCategory];

  return (
    <div className="space-y-5 relative select-none">

      {/* Flying emoji layer */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
        <AnimatePresence>
          {flyingEmojis.map(fe => (
            <motion.div key={fe.id}
              initial={{ x: 0, y: 0, scale: 0.5, opacity: 1 }}
              animate={{ x: fe.dx, y: fe.dy, scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="absolute text-5xl pointer-events-none">
              {fe.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-fredoka font-bold text-blue-600">🎵 Sound Board 🎵</h3>
        <p className="text-sm text-gray-500 font-nunito">Click any button — use keyboard shortcuts too!</p>
      </div>

      {/* Volume + CHAOS row */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border-2 border-blue-200">
          <span>🔇</span>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-28 accent-blue-500" />
          <span>🔊</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={triggerChaos}
          className={`px-5 py-2 rounded-xl font-fredoka font-bold text-white shadow-lg transition-all ${
            chaosMode
              ? 'bg-red-500 animate-pulse ring-4 ring-red-300'
              : 'bg-gradient-to-r from-orange-500 to-red-500'
          }`}>
          {chaosMode ? '🛑 Stop Chaos' : '🔥 CHAOS MODE'}
        </motion.button>
      </div>

      {/* Category tabs */}
      <div className="flex justify-center gap-2 flex-wrap">
        {categoryMeta.map(cat => (
          <motion.button key={cat.id}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-full font-fredoka font-bold text-sm transition-all ${
              activeCategory === cat.id
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {cat.emoji} {cat.label}
          </motion.button>
        ))}
      </div>

      {/* Sound grid */}
      <motion.div key={activeCategory}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {currentSounds.map((sound, i) => (
          <motion.button key={sound.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ scale: 1.08, rotate: [-1, 1, -1] }}
            whileTap={{ scale: 0.88 }}
            onClick={() => playSound(sound)}
            className={`p-4 rounded-2xl font-fredoka font-bold text-white shadow-lg transition-all duration-150 bg-gradient-to-br ${sound.color} ${
              activeSound === sound.id ? 'ring-4 ring-white ring-opacity-80 scale-110' : ''
            }`}>
            <div className="text-3xl mb-1">{sound.emoji}</div>
            <div className="text-sm leading-tight">{sound.name}</div>
            {sound.key && (
              <div className="text-xs bg-black bg-opacity-20 rounded-md px-1 mt-1 inline-block">[{sound.key}]</div>
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
