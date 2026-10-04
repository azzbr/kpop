import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import type { GameState } from '../store';
import { SECRETS } from '../data/secrets';
import { playClick } from '../utils/sounds';

// The Secret Club (tap the A in "Arcade" on the welcome screen). Every room's Back button
// returns here (openSecret / leaveSecret).

const ROOMS: { id: GameState; icon: string; title: string; desc: string; color: string }[] = [
  { id: 'doodle_pad', icon: '🎨', title: 'Doodle Pad', desc: 'Draw, paint and stick stickers. Keep a gallery!', color: 'from-pink-500 to-orange-400' },
  { id: 'sticker_board', icon: '🖼️', title: 'Sticker Board', desc: 'One giant board that saves by itself.', color: 'from-sky-500 to-indigo-500' },
  { id: 'pixel_studio', icon: '👾', title: 'Pixel Studio', desc: 'Make pixel art — and wear it in Paper Clash.', color: 'from-lime-500 to-emerald-600' },
  { id: 'agent_hq', icon: '🕵️', title: 'Agent HQ', desc: 'Crack secret codes like a real spy.', color: 'from-slate-500 to-slate-800' },
  { id: 'theme_lab', icon: '🌈', title: 'Theme Lab', desc: 'Change the colours of the whole arcade.', color: 'from-fuchsia-500 to-purple-700' },
  { id: 'my_stats', icon: '📊', title: 'My Stats', desc: 'Everything you have played and won.', color: 'from-amber-400 to-red-500' },
];

export default function SecretMenu() {
  const { setGameState, openSecret, secretsFound } = useGameStore();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="arcade-bg min-h-screen-d text-white px-4"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { playClick(); setGameState('welcome'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
        </div>
        <h1 className="font-fredoka text-4xl md:text-5xl text-center mt-2">🔓 The Secret Club</h1>
        <p className="font-nunito text-lg text-violet-200 text-center mb-6">You found the hidden door. Don't tell anyone… 🤫</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ROOMS.map((r, i) => (
            <motion.button key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.96 }} onClick={() => { playClick(); openSecret(r.id, 'secret_menu'); }}
              className={`rounded-3xl p-5 bg-gradient-to-br ${r.color} text-left shadow-xl min-h-[140px]`}>
              <div className="text-5xl mb-2">{r.icon}</div>
              <div className="font-fredoka text-2xl">{r.title}</div>
              <div className="font-nunito text-base text-white/90">{r.desc}</div>
            </motion.button>
          ))}
        </div>

        <section className="rounded-3xl bg-white/10 p-5" aria-label="Secrets found">
          <h2 className="font-fredoka text-2xl mb-1">🗝️ Secrets found: {secretsFound.filter(id => SECRETS.some(s => s.id === id)).length}/{SECRETS.length}</h2>
          <p className="font-nunito text-base text-violet-200 mb-3">Some secrets are still hiding. Can you find them all?</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECRETS.map(s => {
              const got = secretsFound.includes(s.id);
              return (
                <li key={s.id} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${got ? 'bg-emerald-500/25' : 'bg-black/20'}`}>
                  <span className="text-3xl">{got ? s.icon : '❓'}</span>
                  <span className="font-nunito text-base">
                    {got ? <><b className="font-fredoka text-lg">{s.title}</b> ✓</> : <>💭 {s.hint}</>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
