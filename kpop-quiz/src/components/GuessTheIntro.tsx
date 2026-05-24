import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playWin, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Track {
  file: string;
  title: string;
  startSec: number;
}

const TRACKS: Track[] = [
  { file: '01. TAKEDOWN (JEONGYEON, JIHYO, CHAEYOUNG).flac', title: 'TAKEDOWN (TWICE Version)', startSec: 12 },
  { file: "02. How It's Done.flac", title: "How It's Done", startSec: 8 },
  { file: '03. Soda Pop.flac', title: 'Soda Pop', startSec: 15 },
  { file: '04. Golden.flac', title: 'Golden', startSec: 6 },
  { file: '05. Strategy.flac', title: 'Strategy', startSec: 18 },
  { file: '06. Takedown.flac', title: 'Takedown', startSec: 10 },
  { file: '07. Your Idol.flac', title: 'Your Idol', startSec: 14 },
  { file: '08. Free.flac', title: 'Free', startSec: 9 },
];

const CLIP_LENGTHS = [1.5, 2.5, 4]; // progressively easier
const CLIP_LABELS = ['🔥 SUPER SHORT', '⚡ SHORT', '🎵 LONGER'];

function pickOptions(correct: Track): Track[] {
  const others = TRACKS.filter((t) => t.file !== correct.file);
  const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
  return [...shuffled, correct].sort(() => Math.random() - 0.5);
}

export default function GuessTheIntro() {
  const { setGameState, addXP } = useGameStore();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [clipIdx, setClipIdx] = useState(0);
  const [target, setTarget] = useState<Track>(() => TRACKS[Math.floor(Math.random() * TRACKS.length)]);
  const [options, setOptions] = useState<Track[]>(() => pickOptions(target));
  const [feedback, setFeedback] = useState<null | { ok: boolean; answer: string }>(null);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); } catch { /* ignore */ }
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const ensureCtx = async () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const loadBuffer = async (file: string): Promise<AudioBuffer> => {
    const cached = bufferCache.current.get(file);
    if (cached) return cached;
    const ctx = await ensureCtx();
    const res = await fetch(`/musickpop/${file}`);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.current.set(file, buf);
    return buf;
  };

  const playClip = async () => {
    if (playing || feedback) return;
    playClick();
    setPlaying(true);
    try {
      const ctx = await ensureCtx();
      const buf = await loadBuffer(target.file);
      try { sourceRef.current?.stop(); } catch { /* ignore */ }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(ctx.destination);
      const dur = CLIP_LENGTHS[clipIdx];
      const start = Math.min(target.startSec, Math.max(0, buf.duration - dur - 0.5));
      src.start(0, start, dur + 0.2);
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.8, ctx.currentTime + dur - 0.15);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      sourceRef.current = src;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        try { src.stop(); } catch { /* ignore */ }
        setPlaying(false);
      }, dur * 1000 + 80);
    } catch (e) {
      console.error(e);
      setPlaying(false);
    }
  };

  const giveHint = () => {
    if (clipIdx < CLIP_LENGTHS.length - 1) {
      setClipIdx(clipIdx + 1);
      playPop();
    }
  };

  const answer = (t: Track) => {
    if (feedback) return;
    const ok = t.file === target.file;
    if (ok) {
      const points = clipIdx === 0 ? 30 : clipIdx === 1 ? 20 : 10;
      setScore((s) => s + points);
      addXP(points);
      playCorrect();
    } else {
      playWrong();
    }
    setFeedback({ ok, answer: target.title });
  };

  const next = () => {
    try { sourceRef.current?.stop(); } catch { /* ignore */ }
    setPlaying(false);
    if (round >= 4) {
      setDone(true);
      setConfetti(true);
      playWin();
      setTimeout(() => setConfetti(false), 3000);
      return;
    }
    const nextTarget = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    setTarget(nextTarget);
    setOptions(pickOptions(nextTarget));
    setRound((r) => r + 1);
    setClipIdx(0);
    setFeedback(null);
  };

  const restart = () => {
    const t = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    setTarget(t);
    setOptions(pickOptions(t));
    setRound(0);
    setScore(0);
    setClipIdx(0);
    setFeedback(null);
    setDone(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {confetti && <ConfettiBurst count={80} durationMs={3000} />}

      <div className="w-full max-w-2xl">
        <button
          onClick={() => setGameState('game_mode')}
          className="btn-kid-secondary mb-4 font-fredoka"
        >
          ← Back
        </button>

        <div className="card-kid bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white mb-4">
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-center mb-1">
            🎧 Guess the Intro
          </h1>
          <p className="text-center font-nunito text-violet-100">
            Listen to a tiny snippet — which HUNTR/X song is it?
          </p>
          <div className="flex justify-around mt-3 text-center">
            <div>
              <div className="text-xs uppercase text-violet-200">Round</div>
              <div className="font-fredoka text-2xl">{round + 1} / 5</div>
            </div>
            <div>
              <div className="text-xs uppercase text-violet-200">Score</div>
              <div className="font-fredoka text-2xl">{score}</div>
            </div>
          </div>
        </div>

        {!done && (
          <>
            <div className="card-kid bg-white mb-4 text-center">
              <p className="font-nunito text-sm text-gray-600 mb-2">Clip length</p>
              <div className="font-fredoka text-lg text-purple-700 mb-3">
                {CLIP_LABELS[clipIdx]} · {CLIP_LENGTHS[clipIdx]}s
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={playClip}
                disabled={playing || !!feedback}
                className={`w-32 h-32 rounded-full text-6xl shadow-xl mx-auto block ${
                  playing
                    ? 'bg-gradient-to-br from-pink-500 to-rose-600 animate-pulse'
                    : 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
                } text-white disabled:opacity-50`}
              >
                {playing ? '🔊' : '▶️'}
              </motion.button>

              <p className="font-nunito text-xs text-gray-500 mt-3">
                Tap the big button to hear the clip
              </p>

              {clipIdx < CLIP_LENGTHS.length - 1 && !feedback && (
                <button
                  onClick={giveHint}
                  className="mt-3 px-4 py-2 rounded-full bg-amber-100 text-amber-700 font-fredoka text-sm border-2 border-amber-300 hover:bg-amber-200"
                >
                  💡 Need a hint? Make the clip longer (less XP)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {options.map((opt) => {
                const isCorrect = feedback && opt.file === target.file;
                const isWrongPick = feedback && !feedback.ok && opt.file !== target.file;
                return (
                  <motion.button
                    key={opt.file}
                    whileHover={{ scale: feedback ? 1 : 1.03 }}
                    whileTap={{ scale: feedback ? 1 : 0.97 }}
                    onClick={() => answer(opt)}
                    disabled={!!feedback}
                    className={`p-4 rounded-2xl border-3 font-fredoka text-base text-left shadow-md transition-colors ${
                      isCorrect
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : isWrongPick
                        ? 'bg-white border-gray-300 text-gray-500 opacity-60'
                        : 'bg-white border-purple-300 hover:border-purple-500 text-purple-800'
                    }`}
                  >
                    {opt.title}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`card-kid text-center mb-4 ${
                    feedback.ok ? 'bg-green-50 border-green-300' : 'bg-rose-50 border-rose-300'
                  }`}
                >
                  <div className="text-5xl mb-2">{feedback.ok ? '🎉' : '🙈'}</div>
                  <p className="font-fredoka text-xl mb-1">
                    {feedback.ok ? "That's it!" : 'Almost!'}
                  </p>
                  <p className="font-nunito text-gray-700">
                    The song was <span className="font-bold text-purple-700">{feedback.answer}</span>
                  </p>
                  <button
                    onClick={next}
                    className="btn-kid mt-3 font-fredoka"
                  >
                    {round >= 4 ? 'See Final Score 🏆' : 'Next Song →'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {done && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card-kid bg-gradient-to-br from-yellow-300 to-orange-400 text-center"
          >
            <div className="text-6xl mb-2">🏆</div>
            <h2 className="font-fredoka text-3xl font-bold text-orange-900 mb-1">All Done!</h2>
            <p className="font-nunito text-orange-800 mb-2">You scored</p>
            <div className="font-fredoka text-5xl text-orange-900 mb-3">{score}</div>
            <p className="font-nunito text-sm text-orange-800 mb-4">
              {score >= 120 ? '🌟 Golden Ear! Pitch-perfect!' :
               score >= 80 ? '🎵 Great listening!' :
               score >= 40 ? '🎶 Nice try — play again!' :
               '👂 Train those ears — give it another go!'}
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={restart} className="btn-kid font-fredoka">Play Again 🔁</button>
              <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary font-fredoka">Done</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
