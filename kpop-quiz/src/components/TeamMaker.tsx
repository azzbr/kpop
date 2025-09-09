import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

const TeamMaker: React.FC = () => {
  const {
    setGameState,
    teamMembers,
    numberOfTeams,
    generatedTeams,
    numberOfTaggers,
    selectedTaggers,
    addTeamMember,
    removeTeamMember,
    setNumberOfTeams,
    generateTeams,
    clearTeams,
    setNumberOfTaggers,
    generateTaggers
  } = useGameStore();

  const [newMemberName, setNewMemberName] = useState('');

  const teamColors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500'
  ];

  const teamEmojis = ['⚽', '🏀', '🏈', '⚾', '🎾'];

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      addTeamMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddMember();
    }
  };

  const handleGenerateTeams = () => {
    if (teamMembers.length >= numberOfTeams) {
      generateTeams();
      // Also generate taggers if needed
      if (numberOfTaggers > 0) {
        generateTaggers();
      }
    }
  };

  const handleGenerateTaggers = () => {
    if (numberOfTaggers > 0 && teamMembers.length > 0) {
      generateTaggers();
    }
  };

  const handleBackToMenu = () => {
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
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
            👥 Team Maker! 🎯
          </h1>
          <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
            Create Fair Teams for Any Game
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

        {/* Add Members Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-white rounded-3xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-4">
            Add Team Members
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a name..."
              className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-2xl focus:border-purple-500 focus:outline-none text-lg"
            />
            <button
              onClick={handleAddMember}
              disabled={!newMemberName.trim()}
              className="btn-kid-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ➕ Add
            </button>
          </div>

          {/* Members List */}
          {teamMembers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Team Members ({teamMembers.length}):
              </h3>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member, index) => (
                  <motion.div
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="bg-purple-100 px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    <span className="text-purple-700">{member}</span>
                    <button
                      onClick={() => removeTeamMember(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Team Count Selector */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Number of Teams:
            </h3>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setNumberOfTeams(num)}
                  className={`px-4 py-2 rounded-2xl font-bold text-lg transition-all ${
                    numberOfTeams === num
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {num} Teams
                </button>
              ))}
            </div>
          </div>

          {/* Tagger Selector */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Number of Taggers: 👑
            </h3>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => setNumberOfTaggers(num)}
                  className={`px-4 py-2 rounded-2xl font-bold text-lg transition-all ${
                    numberOfTaggers === num
                      ? 'bg-yellow-500 text-white shadow-lg'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  {num === 0 ? 'None' : `${num} Tagger${num > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleGenerateTeams}
              disabled={teamMembers.length < numberOfTeams}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-600 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎲 Generate Teams!
            </button>
            <button
              onClick={clearTeams}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600"
            >
              🗑️ Clear All
            </button>
          </div>
        </motion.div>

        {/* Selected Taggers Display */}
        {selectedTaggers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl shadow-lg p-6 mb-6 text-white"
          >
            <h2 className="text-2xl font-fredoka font-bold mb-4 text-center flex items-center justify-center gap-2">
              <span className="text-3xl">👑</span>
              Taggers ({selectedTaggers.length})
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {selectedTaggers.map((tagger, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className="bg-white bg-opacity-20 px-4 py-2 rounded-2xl font-bold text-lg shadow-lg"
                >
                  {tagger}
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-4">
              <button
                onClick={handleGenerateTaggers}
                className="bg-white text-yellow-600 px-4 py-2 rounded-xl font-bold hover:bg-yellow-50 transition-colors"
              >
                🔄 Shuffle Taggers
              </button>
            </div>
          </motion.div>
        )}

        {/* Generated Teams Display */}
        {generatedTeams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-6 text-center">
              🎉 Your Teams Are Ready!
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedTeams.map((team, teamIndex) => (
                <motion.div
                  key={teamIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: teamIndex * 0.1, duration: 0.5 }}
                  className={`${teamColors[teamIndex % teamColors.length]} rounded-2xl p-4 text-white shadow-lg`}
                >
                  <h3 className="text-xl font-fredoka font-bold mb-3 flex items-center gap-2">
                    <span className="text-2xl">{teamEmojis[teamIndex % teamEmojis.length]}</span>
                    Team {teamIndex + 1}
                  </h3>
                  <div className="space-y-1">
                    {team.map((member, memberIndex) => (
                      <div
                        key={memberIndex}
                        className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-sm font-medium"
                      >
                        {member}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm opacity-80">
                    {team.length} player{team.length !== 1 ? 's' : ''}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={handleGenerateTeams}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-600"
              >
                🔄 Shuffle Teams
              </button>
            </div>
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
            👥 Make fair teams for football, basketball, dodgeball, and more! 👥
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TeamMaker;
