import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import DrawingCanvas from './DrawingCanvas';
import PatternMaker from './PatternMaker';
import AppStatsDashboard from './AppStatsDashboard';
import ThemeSwitcher from './ThemeSwitcher';

type Tab = 'create' | 'hidden' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: '🎨 Create' },
  { id: 'hidden', label: '🕵️ Hidden Places' },
  { id: 'settings', label: '⚙️ Themes & Stats' },
];

const SecretMenu: React.FC = () => {
  const { setGameState } = useGameStore();
  const [tab, setTab] = useState<Tab>('create');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="arcade-bg min-h-screen-d px-4 py-6"
    >
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl p-5 md:p-8 border-4 border-yellow-400 text-center">
        <h1 className="text-4xl md:text-5xl font-fredoka text-purple-600 mb-1">🔓 Secret Zone</h1>
        <p className="text-lg font-nunito text-gray-600 mb-6">You found the hidden menu. Don't tell anyone. 🤫</p>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 rounded-full font-fredoka text-lg min-h-[48px] ${
                tab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {tab === 'create' && (
              <>
                <DrawingCanvas />
                <div className="border-t-4 border-pink-200 pt-6"><PatternMaker /></div>
              </>
            )}
            {tab === 'hidden' && (
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { id: 'living_mural' as const, icon: '🖼️', title: 'Living Mural', desc: 'A giant canvas to draw on together.' },
                  { id: 'agent_hq' as const, icon: '🕵️', title: 'Agent HQ', desc: 'Crack ciphers and run secret missions.' },
                  { id: 'locker' as const, icon: '🎒', title: 'Locker', desc: 'Spend your coins on avatars, colours and trails.' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setGameState(p.id)}
                    className="rounded-2xl p-5 bg-purple-50 border-2 border-purple-200 hover:border-purple-400 text-left"
                  >
                    <div className="text-4xl mb-2">{p.icon}</div>
                    <div className="font-fredoka text-xl text-purple-700">{p.title}</div>
                    <div className="font-nunito text-base text-gray-600">{p.desc}</div>
                  </button>
                ))}
              </div>
            )}
            {tab === 'settings' && (
              <>
                <ThemeSwitcher />
                <div className="border-t-4 border-green-200 pt-6"><AppStatsDashboard /></div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <button onClick={() => setGameState('welcome')} className="btn-kid-secondary font-fredoka text-lg mt-8">
          ← Back
        </button>
      </div>
    </motion.div>
  );
};

export default SecretMenu;
