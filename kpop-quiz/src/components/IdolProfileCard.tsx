import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel } from '../store';
import { localDateKey } from '../utils/dates';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import ScreenFrame from './ui/ScreenFrame';
import PlayerCardView from './PlayerCardView';
import {
  CARD_AVATARS, CARD_COLORS, CARD_GAMES, CARD_MOTTOS, CARD_POWERS, CARD_TITLES,
  defaultCard, loadCard, saveCard, type PlayerCard,
} from '../data/playerCard';

// "Player Card" — screen id idol_profile. Everything is picked by tapping; the name comes from the store.
// Reward: finishRound once, the first time a card is saved (flag below).

const GAME_ID = 'idol_profile';
const REWARD_KEY = 'funquest-idol_profile-rewarded';

type Section = 'avatar' | 'color' | 'title' | 'power' | 'game' | 'motto';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'avatar', label: '😀 Avatar' },
  { id: 'color', label: '🎨 Colour' },
  { id: 'title', label: '🏷️ Title' },
  { id: 'power', label: '⚡ Power' },
  { id: 'game', label: '🕹️ Game' },
  { id: 'motto', label: '💬 Motto' },
];

export default function IdolProfileCard() {
  const userName = useGameStore(s => s.userName);
  const xp = useGameStore(s => s.xp);
  const days = useGameStore(s => s.datesPlayed.length);
  const badges = useGameStore(s => s.gameBadges.length);
  const later = useSafeTimeout();
  const [saved, setSaved] = useState<PlayerCard | null>(() => loadCard());
  const [card, setCard] = useState<PlayerCard>(() => saved ?? defaultCard(localDateKey()));
  const [section, setSection] = useState<Section>('avatar');
  const [confetti, setConfetti] = useState(false);
  const [message, setMessage] = useState('');

  const set = (patch: Partial<PlayerCard>) => { playPop(); setCard(c => ({ ...c, ...patch })); setMessage(''); };
  const changed = !saved || JSON.stringify(saved) !== JSON.stringify(card);

  const save = () => {
    if (!saveCard(card)) { setMessage('Hmm, this iPad could not save right now. Try again in a moment!'); return; }
    setSaved(card);
    playWin();
    setConfetti(true);
    later(() => setConfetti(false), 2500);
    let rewarded = true;
    try { rewarded = localStorage.getItem(REWARD_KEY) === '1'; } catch { /* treat as rewarded */ }
    if (!rewarded) {
      const r = useGameStore.getState().finishRound(GAME_ID, 1, 0.05);
      try { localStorage.setItem(REWARD_KEY, '1'); } catch { /* ignore */ }
      setMessage(`Your first Player Card! +${r.xp} XP · +${r.coins} 🪙`);
    } else {
      setMessage('Card saved! ✨');
    }
  };

  const chip = (active: boolean) =>
    `min-h-[52px] rounded-2xl px-3 font-fredoka text-lg transition-colors ${active ? 'bg-yellow-300 text-stone-900 ring-4 ring-yellow-100' : 'bg-white/15 active:bg-white/25'}`;

  return (
    <ScreenFrame title="Player Card" icon="🎴" width="max-w-5xl">
      {confetti && <ConfettiBurst count={90} durationMs={2500} />}
      <div className="grid md:grid-cols-2 gap-5 items-start">
        <div className="md:sticky md:top-4">
          <motion.div key={card.color + card.avatar} initial={{ scale: 0.97 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}>
            <PlayerCardView card={card} name={userName} stats={{ level: getLevel(xp) + 1, days, badges }} />
          </motion.div>
          <button onClick={() => { playClick(); save(); }} disabled={!changed}
            className="mt-4 w-full min-h-[56px] rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 text-stone-900 font-fredoka text-2xl shadow-lg active:scale-95 disabled:opacity-50">
            {saved ? (changed ? '💾 Save changes' : '✅ Saved') : '💾 Save my card'}
          </button>
          {message && <p className="mt-2 text-center font-fredoka text-xl text-yellow-200" role="status">{message}</p>}
          {!userName.trim() && (
            <p className="mt-2 text-center font-nunito text-base text-violet-100">Your name comes from the start screen.</p>
          )}
        </div>

        <div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => { playClick(); setSection(s.id); }}
                className={`min-h-[48px] rounded-full font-fredoka text-base ${section === s.id ? 'bg-fuchsia-500' : 'bg-white/10 active:bg-white/20'}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/15 p-4">
            {section === 'avatar' && (
              <div className="grid grid-cols-4 gap-2">
                {CARD_AVATARS.map(a => (
                  <button key={a} onClick={() => set({ avatar: a })} aria-label={`Avatar ${a}`}
                    className={`${chip(card.avatar === a)} text-4xl min-h-[64px]`}>{a}</button>
                ))}
              </div>
            )}
            {section === 'color' && (
              <div className="grid grid-cols-2 gap-2">
                {CARD_COLORS.map(c => (
                  <button key={c.id} onClick={() => set({ color: c.id })}
                    className={`min-h-[64px] rounded-2xl bg-gradient-to-br ${c.grad} font-fredoka text-xl ${card.color === c.id ? 'ring-4 ring-yellow-300' : ''}`}>
                    {card.color === c.id ? '✅ ' : ''}{c.name}
                  </button>
                ))}
              </div>
            )}
            {section === 'title' && (
              <div className="grid grid-cols-2 gap-2">
                {CARD_TITLES.map(t => (
                  <button key={t.id} onClick={() => set({ title: t.id })} className={chip(card.title === t.id)}>{t.emoji} {t.label}</button>
                ))}
              </div>
            )}
            {section === 'power' && (
              <div className="grid grid-cols-2 gap-2">
                {CARD_POWERS.map(p => (
                  <button key={p.id} onClick={() => set({ power: p.id })} className={chip(card.power === p.id)}>{p.emoji} {p.label}</button>
                ))}
              </div>
            )}
            {section === 'game' && (
              <div className="grid grid-cols-2 gap-2">
                {CARD_GAMES.map(g => (
                  <button key={g.id} onClick={() => set({ game: g.id })} className={chip(card.game === g.id)}>{g.emoji} {g.label}</button>
                ))}
              </div>
            )}
            {section === 'motto' && (
              <div className="grid gap-2">
                {CARD_MOTTOS.map((m, i) => (
                  <button key={m} onClick={() => set({ motto: i })} className={`${chip(card.motto === i)} text-left px-4`}>“{m}”</button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 font-nunito text-base text-violet-100 text-center">Tap the tabs to change each part of your card.</p>
        </div>
      </div>
    </ScreenFrame>
  );
}
