import React, { useRef, useEffect } from 'react';
import { useGameStore, trackInfo } from '../store';
import { initAudio } from '../utils/sounds';

interface MusicPlayerProps {
  /** Keep the audio running but hide the bar (e.g. FM Radio draws its own controls). */
  hidden?: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ hidden = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
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
    <div
      className={hidden ? 'hidden' : 'fixed bottom-0 left-0 right-0 bg-violet-950/95 backdrop-blur text-white px-4 pt-2 shadow-lg z-50 border-t border-white/10'}
      style={hidden ? undefined : { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <audio ref={audioRef} src={`/musickpop/${file}`} onEnded={nextTrack} preload="none" />
      <div className="flex items-center justify-between max-w-4xl mx-auto gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => skip(prevTrack)} className="text-2xl w-11 h-11" aria-label="Previous song">⏮️</button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="text-3xl w-12 h-12" aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button onClick={() => skip(nextTrack)} className="text-2xl w-11 h-11" aria-label="Next song">⏭️</button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-fredoka truncate">{info.title}</div>
          <div className="text-xs text-violet-300 truncate">{info.artist}</div>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-sm" aria-hidden>🔊</span>
          <input
            type="range" min="0" max="1" step="0.1" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-2 accent-fuchsia-400"
            aria-label="Volume"
          />
        </label>
      </div>
    </div>
  );
};

export default MusicPlayer;
