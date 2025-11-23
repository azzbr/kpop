import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

const AgentHQ: React.FC = () => {
  const { userName, setGameState } = useGameStore();
  const agentCodeName = userName ? `${userName} Agent` : 'Anonymous Agent';
  
  // Memoize the random ID so it doesn't change on re-renders
  const agentID = React.useMemo(() => Math.random().toString().substr(2, 8), []);

  const [missions, setMissions] = useState([
    { id: '1', lockMessage: 'Find the hidden treasure in the cold box', isComplete: false },
    { id: '2', lockMessage: 'Hunt for the secret diary under the soft throne', isComplete: true },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 text-center"
        >
          <h1 className="text-5xl font-fredoka font-bold text-pink-400 mb-4">🚀 SECRET BASE HQ</h1>
          <p className="text-xl text-gray-300">Your Top Secret Agent Headquarters</p>
        </motion.div>

        {/* Agent ID Card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-3xl shadow-2xl mb-8 border-4 border-yellow-400"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-fredoka font-bold text-white mb-2">AGENT PROFILE</h2>
              <p className="text-xl mb-2">Code Name: {agentCodeName}</p>
              <p className="text-lg text-yellow-200">Rank: K-Pop Commander</p>
            </div>
            <div className="ml-4">
              <div className="w-24 h-24 bg-black rounded-lg p-2 border-2 border-white">
                {/* Placeholder for QR Code */}
                <div className="w-full h-full bg-white grid grid-cols-4 grid-rows-4 gap-px">
                  {/* Simple QR placeholder */}
                  {Array.from({length: 16}, (_, i) => (
                    <div key={i} className="bg-black"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white/10 rounded-xl">
            <p className="text-sm">🆔 ID Card: {agentID}</p>
          </div>
        </motion.div>

        {/* Mission Control */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800 p-6 rounded-3xl shadow-xl mb-8"
        >
          <h3 className="text-2xl font-fredoka font-bold text-cyan-400 mb-4">🎯 MISSION CONTROL</h3>
          <ul className="space-y-4">
            {missions.map((mission) => (
              <li key={mission.id} className="flex items-center justify-between bg-gray-700 p-4 rounded-xl">
                <span className={mission.isComplete ? "text-green-400" : "text-white"}>
                  {mission.isComplete ? "✅ COMPLETED" : "🔒 ACTIVE"} - {mission.lockMessage}
                </span>
                {mission.isComplete && (
                  <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                    View Evidence
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button className="mt-4 bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-cyan-600 w-full">
            + Add New Dead Drop
          </button>
        </motion.div>

        {/* Cipher Decoder & Shop */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-gray-800 p-6 rounded-3xl shadow-xl"
          >
            <h3 className="text-2xl font-fredoka font-bold text-red-400 mb-4">🔐 CIPHER DECODER</h3>
            <p className="text-gray-300 mb-4">Enter your coded message:</p>
            <input
              type="text"
              placeholder="Type the scrambled code..."
              className="w-full p-3 rounded-lg bg-gray-700 text-white mb-4"
            />
            <button className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 w-full">
              Decode Message
            </button>
          </motion.div>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-gray-800 p-6 rounded-3xl shadow-xl flex flex-col justify-center items-center"
          >
            <h3 className="text-2xl font-fredoka font-bold text-green-400 mb-4">🛍️ TREASURE SHOP</h3>
            <p className="text-gray-300 mb-4 text-center">Spend your hard-earned treasures on amazing upgrades!</p>
            <button
              onClick={() => setGameState('shop')}
              className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
            >
              Enter Shop
            </button>
          </motion.div>
        </div>

        {/* Back Button */}
        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={() => setGameState('welcome')}
          className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white px-8 py-4 rounded-3xl font-bold font-fredoka text-lg hover:scale-105 transition-transform shadow-xl"
        >
          ◀ Return to Base
        </motion.button>
      </div>
    </div>
  );
};

export default AgentHQ;
