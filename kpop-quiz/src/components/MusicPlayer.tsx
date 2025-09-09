import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store';

const MusicPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    currentTrack,
    isPlaying,
    volume,
    playlist,
    setIsPlaying,
    setCurrentTrack,
    nextTrack,
    prevTrack,
    setVolume
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
  };

  const handlePrev = () => {
    prevTrack();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleEnded = () => {
    nextTrack();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-purple-600 text-white p-4 shadow-lg z-50">
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={handleEnded}
        preload="metadata"
      />
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrev}
            className="text-2xl hover:text-pink-300 transition-colors"
          >
            ⏮️
          </button>
          <button
            onClick={handlePlayPause}
            className="text-3xl hover:text-pink-300 transition-colors"
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button
            onClick={handleNext}
            className="text-2xl hover:text-pink-300 transition-colors"
          >
            ⏭️
          </button>
        </div>

        <div className="flex-1 mx-4">
          <div className="text-sm font-medium truncate">
            {displayName}
          </div>
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
            className="w-20 h-2 bg-pink-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
