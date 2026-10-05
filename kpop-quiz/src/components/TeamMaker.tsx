import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import ScreenFrame from './ui/ScreenFrame';
import { playClick, playPop } from '../utils/sounds';

// A tool for grown-ups and teachers: split a list of names into fair teams and pick taggers.
// No rewards — it's not a game round.

const TEAM_COLORS = ['bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];
const TEAM_EMOJIS = ['⚽', '🏀', '🏈', '⚾', '🎾'];

export default function TeamMaker() {
  const {
    teamMembers, numberOfTeams, generatedTeams, numberOfTaggers, selectedTaggers,
    addTeamMember, removeTeamMember, setNumberOfTeams, generateTeams, clearTeams, setNumberOfTaggers, generateTaggers,
  } = useGameStore();

  const [newMemberName, setNewMemberName] = useState('');

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    playPop();
    addTeamMember(newMemberName.trim());
    setNewMemberName('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMember();
    }
  };

  const handleGenerateTeams = () => {
    if (teamMembers.length < numberOfTeams) return;
    playClick();
    generateTeams();
    if (numberOfTaggers > 0) generateTaggers();
  };

  const handleGenerateTaggers = () => {
    if (numberOfTaggers > 0 && teamMembers.length > 0) {
      playClick();
      generateTaggers();
    }
  };

  const chip = (active: boolean, tone: string) =>
    `min-h-[48px] px-4 rounded-2xl font-fredoka text-lg transition-colors ${active ? `${tone} text-white shadow-lg ring-2 ring-white/70` : 'bg-white/10 text-white'}`;

  return (
    <ScreenFrame title="Team Picker" icon="👥">
      <p className="font-nunito text-lg text-violet-200 mb-4">Make fair teams for football, dodgeball, class games and more!</p>

      <section className="rounded-3xl bg-indigo-950/70 border-2 border-white/15 p-5 mb-5">
        <h2 className="font-fredoka text-2xl mb-3">Add players</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a name…"
            maxLength={20}
            enterKeyHint="done"
            autoComplete="off"
            className="flex-1 min-w-0 min-h-[52px] px-4 rounded-2xl bg-white/90 text-slate-900 font-nunito text-lg border-2 border-fuchsia-300 focus:outline-none focus:ring-4 focus:ring-fuchsia-400/60"
          />
          <button type="button" onClick={handleAddMember} disabled={!newMemberName.trim()}
            className="min-h-[52px] px-5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-lg disabled:opacity-40">
            ➕ Add
          </button>
        </div>

        {teamMembers.length > 0 && (
          <div className="mb-4">
            <h3 className="font-fredoka text-lg text-violet-200 mb-2">Players ({teamMembers.length}) — tap ✕ to remove</h3>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((member, index) => (
                <motion.div key={`${member}-${index}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="min-h-[48px] rounded-full bg-white/15 pl-4 pr-1 flex items-center gap-2 font-fredoka text-lg">
                  <span>{member}</span>
                  <button type="button" onClick={() => { playClick(); removeTeamMember(index); }} aria-label={`Remove ${member}`}
                    className="w-11 h-11 rounded-full bg-white/20 active:bg-rose-500 flex items-center justify-center text-lg">
                    ✕
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <h3 className="font-fredoka text-lg text-violet-200 mb-2">Number of teams</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {[2, 3, 4, 5].map(num => (
            <button key={num} type="button" onClick={() => { playClick(); setNumberOfTeams(num); }} className={chip(numberOfTeams === num, 'bg-fuchsia-500')}>
              {num} teams
            </button>
          ))}
        </div>

        <h3 className="font-fredoka text-lg text-violet-200 mb-2">Taggers 👑</h3>
        <div className="flex flex-wrap gap-2 mb-5">
          {[0, 1, 2, 3].map(num => (
            <button key={num} type="button" onClick={() => { playClick(); setNumberOfTaggers(num); }} className={chip(numberOfTaggers === num, 'bg-amber-500')}>
              {num === 0 ? 'None' : `${num} tagger${num > 1 ? 's' : ''}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleGenerateTeams} disabled={teamMembers.length < numberOfTeams}
            className="flex-1 min-h-[56px] rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 font-fredoka text-xl shadow-lg disabled:opacity-40">
            🎲 Make teams!
          </button>
          <button type="button" onClick={() => { playClick(); clearTeams(); }}
            className="min-h-[56px] px-6 rounded-full bg-white/15 font-fredoka text-xl">
            🗑️ Clear all
          </button>
        </div>
        {teamMembers.length < numberOfTeams && (
          <p className="font-nunito text-base text-violet-300 mt-2">Add at least {numberOfTeams} players to make {numberOfTeams} teams.</p>
        )}
      </section>

      {selectedTaggers.length > 0 && (
        <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 mb-5 text-center">
          <h2 className="font-fredoka text-2xl mb-3">👑 Taggers ({selectedTaggers.length})</h2>
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {selectedTaggers.map((tagger, i) => (
              <motion.div key={`${tagger}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}
                className="rounded-2xl bg-indigo-950/60 px-4 py-2 font-fredoka text-xl">
                {tagger}
              </motion.div>
            ))}
          </div>
          <button type="button" onClick={handleGenerateTaggers} className="min-h-[48px] px-5 rounded-full bg-white text-orange-600 font-fredoka text-lg">
            🔄 Shuffle taggers
          </button>
        </motion.section>
      )}

      {generatedTeams.length > 0 && (
        <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-indigo-950/70 border-2 border-white/15 p-5">
          <h2 className="font-fredoka text-2xl mb-4 text-center">🎉 Your teams are ready!</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedTeams.map((team, t) => (
              <motion.div key={t} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: t * 0.1 }}
                className={`${TEAM_COLORS[t % TEAM_COLORS.length]} rounded-2xl p-4 shadow-lg`}>
                <h3 className="font-fredoka text-xl mb-2 flex items-center gap-2">
                  <span className="text-2xl">{TEAM_EMOJIS[t % TEAM_EMOJIS.length]}</span> Team {t + 1}
                </h3>
                <div className="space-y-1">
                  {team.map((member, m) => (
                    <div key={m} className="rounded-lg bg-white/20 px-3 py-1 font-nunito text-base font-semibold">{member}</div>
                  ))}
                </div>
                <div className="mt-2 font-nunito text-base opacity-90">{team.length} player{team.length !== 1 ? 's' : ''}</div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-5">
            <button type="button" onClick={handleGenerateTeams}
              className="min-h-[56px] px-6 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 font-fredoka text-xl shadow-lg">
              🔄 Shuffle teams
            </button>
          </div>
        </motion.section>
      )}
    </ScreenFrame>
  );
}
