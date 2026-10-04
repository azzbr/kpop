import React, { useRef, useEffect, useState } from 'react';
import { useGameStore, trackInfo } from '../store';
import { initAudio } from '../utils/sounds';

interface MusicPlayerProps {
  /** Keep the audio running but hide the controls (e.g. FM Radio draws its own). */
  hidden?: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ hidden = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);
  const {
    currentTrack, isPlaying, volume, playlist,
    setIsPlaying, nextTrack, prevTrack, setVolume, incrementSongsListened,
  } = useGameStore();

  const file = playlist[currentTrack];
  const info = trackInfo(file);

  // iPad Safari only allows audio after a user gesture. On the first tap anywhere, start the
  // Web Audio context for sound effects and "bless" the <audio> element so later play() calls
  // made from effects (not directly inside a tap handler) are allowed.
  useEffect(() => {
    const unlock = () => {
      initAudio();
      const el = audioRef.current;
      if (el && el.paused && !useGameStore.getState().isPlaying) {
        el.muted = true;
        el.play().then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; });
      }
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, currentTrack, setIsPlaying]);

  const skip = (fn: () => void) => { fn(); incrementSongsListened(); };

  return (
    <div className={hidden ? 'hidden' : 'fixed right-2 top-1/2 -translate-y-1/2 z-50'} style={{ marginRight: 'env(safe-area-inset-right)' }}>
      <audio ref={audioRef} src={`/musickpop/${file}`} onEnded={nextTrack} preload="none" />
      {expanded ? (
        <div className="w-64 bg-violet-950/95 backdrop-blur text-white rounded-2xl p-3 shadow-2xl border border-white/15">
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="min-w-0">
              <div className="font-fredoka text-base truncate">🎵 {info.title}</div>
              <div className="text-xs text-violet-300 truncate">{info.artist}</div>
            </div>
            <button onClick={() => setExpanded(false)} className="w-11 h-11 -mt-2 -mr-2 text-violet-200 shrink-0" aria-label="Minimise player">✖</button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={() => skip(prevTrack)} className="text-2xl w-12 h-12" aria-label="Previous song">⏮️</button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="text-3xl w-14 h-12" aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button onClick={() => skip(nextTrack)} className="text-2xl w-12 h-12" aria-label="Next song">⏭️</button>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-sm" aria-hidden>🔊</span>
            <input
              type="range" min="0" max="1" step="0.1" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-2 accent-fuchsia-400"
              aria-label="Volume"
            />
          </label>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          aria-label={`Music: ${info.title}`}
          className={`w-12 h-12 rounded-full bg-violet-700/90 backdrop-blur text-white text-2xl shadow-2xl border border-white/30 flex items-center justify-center ${
            isPlaying ? 'animate-pulse' : 'opacity-80'
          }`}
        >
          {isPlaying ? '🎵' : '🎧'}
        </button>
      )}
    </div>
  );
};

export default MusicPlayer;
