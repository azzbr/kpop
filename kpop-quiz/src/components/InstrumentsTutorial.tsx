import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface VideoTutorial {
  id: string;
  title: string;
  embedUrl: string;
  description: string;
  instrument: string;
}

const InstrumentsTutorial: React.FC = () => {
  const { setGameState } = useGameStore();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const videoTutorials: VideoTutorial[] = [
    {
      id: '1',
      title: 'K-Pop Piano Tutorial',
      embedUrl: 'https://www.youtube.com/embed/-pr5bAPjsHs',
      description: 'Learn to play K-Pop Demon hunters songs on piano!',
      instrument: '🎹 Piano'
    },
    {
      id: '2',
      title: 'K-Pop Recorder Tutorial',
      embedUrl: 'https://www.youtube.com/embed/q0qG7edP5fk',
      description: 'Fun recorder lessons for K-Pop songs!',
      instrument: '🎵 Recorder'
    },
    {
      id: '3',
      title: 'Piano & Recorder Combo',
      embedUrl: 'https://www.youtube.com/embed/89qG1j2f728',
      description: 'Play along with both instruments!',
      instrument: '🎹🎵 Both'
    },
    {
      id: '4',
      title: 'Advanced K-Pop Tutorial',
      embedUrl: 'https://www.youtube.com/embed/jXpkKSQvoas',
      description: 'Master these amazing K-Pop melodies!',
      instrument: '🎼 Advanced'
    }
  ];

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideo(videoId);
  };

  const handleBackToMenu = () => {
    setSelectedVideo(null);
    setGameState('game_mode');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
    >
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
            🎼 Learn Instruments! 🎵
          </h1>
          <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
            Play K-Pop Demon Hunters Songs
          </p>
        </motion.div>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-6"
        >
          <button
            onClick={handleBackToMenu}
            className="btn-kid-secondary font-fredoka text-lg"
          >
            ← Back to Games
          </button>
        </motion.div>

        {/* Video Selection or Player */}
        {!selectedVideo ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {videoTutorials.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={() => handleVideoSelect(video.id)}
                  className="w-full p-6 bg-gradient-to-r from-yellow-400 to-orange-500 border-3 border-yellow-300 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-left group"
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl md:text-5xl p-3 bg-white rounded-2xl text-yellow-500 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      {video.instrument.split(' ')[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-fredoka font-bold text-white mb-2">
                        {video.title}
                      </h3>
                      <p className="text-sm md:text-base text-yellow-100 leading-relaxed font-nunito mb-2">
                        {video.description}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {video.instrument}
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl shadow-2xl p-6 max-w-4xl mx-auto"
          >
            {(() => {
              const video = videoTutorials.find(v => v.id === selectedVideo);
              return video ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl md:text-3xl font-fredoka font-bold text-purple-600">
                      {video.title}
                    </h2>
                    <button
                      onClick={() => setSelectedVideo(null)}
                      className="btn-kid-secondary text-sm"
                    >
                      ← Back to Videos
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="text-lg text-gray-700 font-nunito">
                      {video.description}
                    </p>
                    <p className="text-sm text-purple-600 font-semibold mt-2">
                      {video.instrument}
                    </p>
                  </div>
                  <div className="aspect-video w-full">
                    <iframe
                      src={video.embedUrl}
                      title={video.title}
                      className="w-full h-full rounded-2xl"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              ) : null;
            })()}
          </motion.div>
        )}

        {/* Footer Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-lg text-gray-600 font-nunito">
            🎵 Have fun learning to play K-Pop songs! 🎵
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default InstrumentsTutorial;
