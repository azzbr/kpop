import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store';

const MusicPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);
  const {
    currentTrack,
    isPlaying,
    volume,
    playlist,
    setIsPlaying,
    nextTrack,
    prevTrack,
    setVolume,
    incrementSongsListened
  } = useGameStore();

  const currentTrackName = playlist[currentTrack];
  const displayName = currentTrackName.replace('.flac', '');
  const audioSrc = `/musickpop/${currentTrackName}`;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    nextTrack();
    incrementSongsListened();
  };

  const handlePrev = () => {
    prevTrack();
    incrementSongsListened();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleEnded = () => {
    nextTrack();
  };

  return (
    <div className="fixed right-2 top-1/2 -translate-y-1/2 z-50">
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={handleEnded}
        preload="metadata"
      />
      {expanded ? (
        <div className="w-60 bg-purple-700/95 backdrop-blur text-white rounded-2xl p-3 shadow-2xl border border-purple-400/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold truncate pr-2" title={displayName}>
              🎵 {displayName}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-purple-200 hover:text-white text-sm shrink-0"
              title="Minimise player"
            >
              ✖
            </button>
          </div>
          <div className="flex items-center justify-center space-x-4 mb-2">
            <button onClick={handlePrev} className="text-xl hover:text-pink-300 transition-colors">
              ⏮️
            </button>
            <button onClick={handlePlayPause} className="text-2xl hover:text-pink-300 transition-colors">
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button onClick={handleNext} className="text-xl hover:text-pink-300 transition-colors">
              ⏭️
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-pink-300 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          title={`Music: ${displayName}`}
          className={`w-12 h-12 rounded-full bg-purple-600/90 backdrop-blur text-white text-2xl shadow-2xl border border-purple-400/50 flex items-center justify-center hover:scale-110 transition-transform ${
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
