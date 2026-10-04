import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { localDateKey } from '../utils/dates';
import { playClick } from '../utils/sounds';

// Friendly names for the play log (fall back to the id).
const NAMES: Record<string, string> = {
  paper_clash: '🗺️ Paper Clash', snake_arena: '🐍 Snake Arena', kpop_rush: '🏃 Rush Runner', ninja_slice: '🥷 Ninja Slice',
  rocket_launch: '🚀 Rocket Launch', battle_arena: '⚔️ Battle Arena', game_2048: '🧮 2048', block_blast: '🧱 Block Blast',
  word_guess: '🟩 Word Guess', quiz_arena: '❓ Quiz Arena', quiz_party: '🎉 Quiz Party', real_or_fake: '🤔 Real or Fake',
  emoji_guess: '🕵️ Emoji Guess', would_you_rather: '🤷 Would You Rather', pattern_memory: '🧠 Pattern Memory',
  sparkle_match: '💎 Gem Match', tower_defense: '🏰 Tower Defense', heads_up: '🙆 Heads Up', imposter: '🤫 Imposter',
  battle_arena_losses: '⚔️ Battle Arena',
};
const BREAKS = [0, 20, 30, 45, 60];

function GrownUpCheck({ onPass }: { onPass: () => void }) {
  const [q] = useState(() => {
    const a = 12 + Math.floor(Math.random() * 8);
    const b = 6 + Math.floor(Math.random() * 4);
    return { a, b };
  });
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const press = (d: string) => { playClick(); setWrong(false); setTyped(t => (t.length < 4 ? t + d : t)); };
  const check = () => {
    if (Number(typed) === q.a * q.b) onPass();
    else { setWrong(true); setTyped(''); }
  };
  return (
    <div className="max-w-sm mx-auto text-center">
      <p className="font-nunito text-lg text-violet-100 mb-2">This part is for grown-ups. To continue, answer:</p>
      <p className="font-fredoka text-5xl mb-3">{q.a} × {q.b} = ?</p>
      <div className="min-h-[56px] rounded-2xl bg-white/10 font-fredoka text-4xl py-2 mb-3">{typed || ' '}</div>
      {wrong && <p className="font-nunito text-amber-300 mb-2">Not quite — try again.</p>}
      <div className="grid grid-cols-3 gap-2">
        {'123456789'.split('').map(d => <button key={d} onClick={() => press(d)} className="min-h-[56px] rounded-xl bg-white/15 font-fredoka text-2xl">{d}</button>)}
        <button onClick={() => setTyped('')} className="min-h-[56px] rounded-xl bg-white/10 font-fredoka text-lg">Clear</button>
        <button onClick={() => press('0')} className="min-h-[56px] rounded-xl bg-white/15 font-fredoka text-2xl">0</button>
        <button onClick={check} className="min-h-[56px] rounded-xl bg-fuchsia-500 font-fredoka text-lg">OK</button>
      </div>
    </div>
  );
}

export default function ParentCorner() {
  const { setGameState, playLog, parent, setParent, volume, setVolume, resetProgress, xp, datesPlayed, gameBadges, userName } = useGameStore();
  const [unlocked, setUnlocked] = useState(false);
  const [confirmReset, setConfirmReset] = useState(0);

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = localDateKey(d);
      return { key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), minutes: Math.round((playLog[key]?.seconds ?? 0) / 60) };
    });
    const games: Record<string, number> = {};
    for (const d of days) for (const [g, n] of Object.entries(playLog[d.key]?.games ?? {})) {
      const name = NAMES[g] ?? g;
      games[name] = (games[name] ?? 0) + n;
    }
    const top = Object.entries(games).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { days, total: days.reduce((s, d) => s + d.minutes, 0), top };
  }, [playLog]);
  const maxMin = Math.max(30, ...week.days.map(d => d.minutes));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="arcade-bg min-h-screen-d text-white px-4 py-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { playClick(); setGameState('game_mode'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
          <h1 className="font-fredoka text-3xl">👪 Parent corner</h1>
        </div>

        {!unlocked ? <GrownUpCheck onPass={() => setUnlocked(true)} /> : (
          <div className="space-y-5">
            <section className="rounded-3xl bg-white/10 p-5">
              <h2 className="font-fredoka text-2xl mb-1">This week</h2>
              <p className="font-nunito text-violet-200 mb-4">{userName || 'Your player'} played <b>{week.total} minutes</b> in the last 7 days · {datesPlayed.length} days played in total · {gameBadges.length} badges · {xp.toLocaleString()} XP</p>
              <div className="flex items-end gap-2 h-40">
                {week.days.map(d => (
                  <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="font-nunito text-sm mb-1">{d.minutes || ''}</div>
                    <div className={`w-full rounded-t-lg ${d.key === localDateKey() ? 'bg-fuchsia-400' : 'bg-sky-400'}`} style={{ height: `${(d.minutes / maxMin) * 100}%`, minHeight: 4 }} />
                    <div className="font-nunito text-sm mt-1 text-violet-200">{d.label}</div>
                  </div>
                ))}
              </div>
              <p className="font-nunito text-sm text-violet-300 mt-2">Minutes with the app open (not counting the welcome screen).</p>
              {week.top.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-fredoka text-lg mb-1">Favourite games this week</h3>
                  {week.top.map(([name, n]) => (
                    <div key={name} className="flex justify-between font-nunito text-lg py-0.5"><span>{name}</span><span className="text-violet-200">{n} {n === 1 ? 'round' : 'rounds'}</span></div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white/10 p-5">
              <h2 className="font-fredoka text-2xl mb-1">Break reminder</h2>
              <p className="font-nunito text-violet-200 mb-3">Shows a friendly "time for a break" card after this much play in one sitting.</p>
              <div className="flex flex-wrap gap-2">
                {BREAKS.map(m => (
                  <button key={m} onClick={() => { playClick(); setParent({ breakMinutes: m }); }}
                    className={`min-h-[48px] px-4 rounded-xl font-fredoka text-lg ${parent.breakMinutes === m ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                    {m === 0 ? 'Off' : `${m} min`}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white/10 p-5 space-y-4">
              <h2 className="font-fredoka text-2xl">Sound</h2>
              <label className="flex items-center gap-4">
                <span className="w-36 font-nunito text-lg">🔔 Sound effects</span>
                <input type="range" min={0} max={1} step={0.1} value={parent.sfxVolume} onChange={e => setParent({ sfxVolume: Number(e.target.value) })} className="flex-1 accent-fuchsia-400 h-2" />
                <span className="w-12 text-right font-nunito">{Math.round(parent.sfxVolume * 100)}%</span>
              </label>
              <label className="flex items-center gap-4">
                <span className="w-36 font-nunito text-lg">🎵 Music</span>
                <input type="range" min={0} max={1} step={0.1} value={volume} onChange={e => setVolume(Number(e.target.value))} className="flex-1 accent-fuchsia-400 h-2" />
                <span className="w-12 text-right font-nunito">{Math.round(volume * 100)}%</span>
              </label>
              <p className="font-nunito text-sm text-violet-300">On iPad the music volume follows the device buttons; the slider here works on computers.</p>
            </section>

            <section className="rounded-3xl bg-white/10 p-5">
              <h2 className="font-fredoka text-2xl mb-2">Privacy &amp; saving</h2>
              <ul className="font-nunito text-base text-violet-100 space-y-1 list-disc pl-5">
                <li>All progress is saved only on this device. There are no accounts and nothing is uploaded.</li>
                <li>Friends Arena sends the chosen player name and game moves to the other devices in the same 4-letter room while playing. Nothing is stored online.</li>
                <li>On iPad, add the site to the Home Screen (Share → Add to Home Screen) so Safari never clears the saved progress.</li>
              </ul>
            </section>

            <section className="rounded-3xl bg-red-500/15 border border-red-400/40 p-5">
              <h2 className="font-fredoka text-2xl mb-2">Start over</h2>
              <p className="font-nunito text-violet-100 mb-3">Deletes all progress on this device: XP, coins, best scores, badges, Locker items, pet and saved quizzes.</p>
              <button onClick={() => { if (confirmReset >= 1) resetProgress(); else setConfirmReset(1); }}
                className="min-h-[52px] px-6 rounded-full bg-red-600 font-fredoka text-lg">
                {confirmReset ? 'Tap again to really delete everything' : '🗑️ Reset all progress'}
              </button>
            </section>
          </div>
        )}
      </div>
    </motion.div>
  );
}
