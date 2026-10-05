import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, TRACKS } from '../store';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import { playClick, playCorrect, playWrong } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import {
  songsFrom, pickRounds, pickOptions, isRight, clipStart, verdict, LEVELS,
} from './guessIntroLogic';
import type { IntroRound, LevelId, Song } from './guessIntroLogic';

// Guess the Intro: hear a short clip from the soundtrack and pick the song.
// Score = songs guessed right (out of 5); GameShell gives the reward via finishRound('guess_intro', …).

const SONGS = songsFrom(TRACKS);

interface Feedback { ok: boolean; picked: string }

export default function GuessTheIntro() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [game, setGame] = useState(0);
  const [level, setLevel] = useState<LevelId>('medium');
  const [rounds, setRounds] = useState<IntroRound[]>([]);
  const [options, setOptions] = useState<Song[][]>([]);
  const [n, setN] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [listening, setListening] = useState(false);

  const lv = LEVELS.find(l => l.id === level) ?? LEVELS[1];
  const round = rounds[n];

  // A plain <audio> element (not decodeAudioData) so only the needed bytes stream in, and so
  // it works on iPad Safari, which requires play() to be called directly inside the tap.
  const clipRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const onPlayingRef = useRef<(() => void) | null>(null);
  const setIsPlaying = useGameStore(s => s.setIsPlaying);

  const stopClip = useCallback(() => {
    const el = clipRef.current;
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (el && onPlayingRef.current) el.removeEventListener('playing', onPlayingRef.current);
    onPlayingRef.current = null;
    el?.pause();
    setListening(false);
  }, []);

  // Pause the background music while guessing (Safari ignores volume changes, so no fading),
  // and put it back the way it was when leaving.
  useEffect(() => {
    const wasPlaying = useGameStore.getState().isPlaying;
    setIsPlaying(false);
    const el = new Audio();
    el.preload = 'auto';
    clipRef.current = el;
    return () => {
      if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
      el.pause();
      el.removeAttribute('src');
      clipRef.current = null;
      if (wasPlaying) setIsPlaying(true);
    };
  }, [setIsPlaying]);

  const loadFile = (file: string) => {
    const el = clipRef.current;
    if (!el) return;
    const url = `/musickpop/${file}`;
    if (el.getAttribute('src') !== url) { el.src = url; el.load(); }
  };

  /** Call from a tap. The clip length is timed from when sound actually starts. */
  const playClip = (file: string, seconds: number) => {
    const el = clipRef.current;
    if (!el) return;
    stopClip();
    loadFile(file);
    const seek = () => { try { el.currentTime = clipStart(file); } catch { /* not seekable yet */ } };
    if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
    const onPlaying = () => {
      onPlayingRef.current = null;
      stopTimerRef.current = window.setTimeout(() => { el.pause(); setListening(false); }, seconds * 1000);
    };
    onPlayingRef.current = onPlaying;
    el.addEventListener('playing', onPlaying, { once: true });
    setListening(true);
    el.play().catch(() => setListening(false));
  };

  // Pause when she switches apps.
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) return;
      stopClip();
      setStatus(s => (s === 'playing' ? 'paused' : s));
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stopClip]);

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    const rs = pickRounds(SONGS, rng);
    setRounds(rs);
    setOptions(rs.map(r => pickOptions(r.song, SONGS, rng)));
    setN(0);
    setCorrect(0);
    setFeedback(null);
    setGame(g => g + 1);
    setStatus('playing');
    if (rs[0]) playClip(rs[0].file, lv.clip);
  };

  const answer = (song: Song) => {
    if (!round || feedback) return;
    stopClip();
    const ok = isRight(song, round);
    if (ok) { playCorrect(); setCorrect(c => c + 1); } else playWrong();
    setFeedback({ ok, picked: song.key });
    const nextRound = rounds[n + 1];
    if (nextRound) loadFile(nextRound.file);
  };

  const next = () => {
    if (n + 1 >= rounds.length) {
      stopClip();
      setStatus('over');
      return;
    }
    setFeedback(null);
    setN(n + 1);
    playClip(rounds[n + 1].file, lv.clip);
  };

  const total = rounds.length || 5;

  const readyContent = (
    <div className="space-y-3">
      <p className="font-nunito text-lg text-violet-100">Listen to a tiny clip — which HUNTR/X song is it?</p>
      <p className="font-fredoka text-lg text-violet-200">How long is the clip?</p>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map(l => (
          <button key={l.id} onClick={() => { playClick(); setLevel(l.id); }}
            aria-pressed={level === l.id}
            className={`min-h-[64px] rounded-2xl font-fredoka text-lg leading-tight border-2 ${level === l.id ? 'bg-fuchsia-500 border-yellow-300' : 'bg-white/10 border-white/15'}`}>
            {l.label}
            <span className="block font-nunito text-base">{l.clip} {l.clip === 1 ? 'second' : 'seconds'}</span>
          </button>
        ))}
      </div>
      <p className="font-nunito text-base text-violet-200">{total} songs · tap the big button to hear a clip again</p>
    </div>
  );

  return (
    <GameShell
      gameId="guess_intro"
      title="Guess the Intro"
      icon="🎧"
      xpScale={lv.xpScale}
      status={status}
      score={correct}
      round={game}
      formatScore={s => `${s} right`}
      overTitle={verdict(correct, total)}
      overStats={[
        { label: 'Level', value: lv.label },
        { label: 'Songs right', value: `${correct} / ${total}` },
      ]}
      readyContent={readyContent}
      onStart={start}
      onPause={() => { stopClip(); setStatus('paused'); }}
      onResume={() => setStatus('playing')}
    >
      {status === 'over' && correct === total && total > 0 && <ConfettiBurst count={90} durationMs={3000} />}
      {round && (
        <div className="absolute inset-0 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 py-4 flex flex-col items-center gap-4">
            <div className="flex w-full justify-between font-fredoka text-xl">
              <span>🎵 Song {n + 1} / {total}</span>
              <span className="text-yellow-300">✅ {correct}</span>
            </div>

            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => { playClick(); playClip(round.file, lv.clip); }}
              disabled={listening}
              aria-label="Play the clip"
              className={`w-40 h-40 rounded-full text-7xl shadow-2xl border-4 border-white/30 ${listening
                ? 'bg-gradient-to-br from-pink-500 to-rose-600 animate-pulse'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-600'}`}>
              {listening ? '🔊' : '▶️'}
            </motion.button>
            <p className="font-nunito text-lg text-violet-200 -mt-1">
              {listening ? 'Listen…' : `Tap to hear it again (${lv.clip} s)`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {(options[n] ?? []).map(opt => {
                const right = !!feedback && opt.key === round.song.key;
                const wrongPick = !!feedback && !feedback.ok && opt.key === feedback.picked;
                return (
                  <motion.button key={opt.key} whileTap={{ scale: feedback ? 1 : 0.96 }}
                    onClick={() => answer(opt)} disabled={!!feedback}
                    className={`min-h-[72px] px-4 rounded-2xl font-fredoka text-xl border-2 shadow-md transition-colors ${right
                      ? 'bg-green-500 border-green-200'
                      : wrongPick
                        ? 'bg-rose-500/70 border-rose-200'
                        : feedback ? 'bg-white/10 border-white/10 opacity-60' : 'bg-white/15 border-white/25'}`}>
                    {right && '✅ '}{opt.title}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="w-full rounded-3xl bg-white/10 p-4 text-center">
                  <p className="font-fredoka text-2xl mb-1">{feedback.ok ? '🎉 That’s it!' : '🙈 So close!'}</p>
                  {!feedback.ok && <p className="font-nunito text-lg text-violet-100">It was <b className="text-yellow-300">{round.song.title}</b></p>}
                  <button onClick={() => { playClick(); next(); }}
                    className="mt-3 w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl">
                    {n + 1 >= total ? 'See my score 🏆' : 'Next song →'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </GameShell>
  );
}
