// Under the level badge: 🔥 streak, 🐾 pet, ⭐ star total. Each pill opens the screen behind it.
import { useGameStore } from '../../store';
import type { GameState } from '../../store';
import { getStreak, localDateKey } from '../../utils/dates';
import { totalStars } from '../../data/mastery';

const pill = 'min-h-[44px] px-4 rounded-full bg-white/10 border border-white/15 font-fredoka text-base text-white flex items-center gap-2';

export default function TodayStrip({ onOpen }: { onOpen: (id: GameState) => void }) {
  const datesPlayed = useGameStore(s => s.datesPlayed);
  const pet = useGameStore(s => s.pet);
  const highScores = useGameStore(s => s.highScores);
  const today = localDateKey();
  const streak = getStreak(datesPlayed).current;
  const stars = totalStars(highScores);

  let petLine = '';
  if (pet) {
    if (pet.grewDate === today) petLine = `${pet.name} grew today! 🌱`;
    else if (datesPlayed.includes(today)) petLine = `${pet.name} is ready to grow — say hi!`;
    else petLine = `Finish a game to help ${pet.name} grow`;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4" data-testid="today-strip">
      <button onClick={() => onOpen('achievement_showcase')} className={pill}>
        🔥 {streak > 0 ? `${streak}-day streak` : 'Play today to start a streak'}
      </button>
      {pet && <button onClick={() => onOpen('pet_pal')} className={pill}>🐾 {petLine}</button>}
      <button onClick={() => onOpen('achievement_showcase')} className={pill}>
        ⭐ {stars.have} / {stars.of} stars
      </button>
    </div>
  );
}
