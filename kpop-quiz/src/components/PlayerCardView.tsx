import { CARD_MOTTOS, colorOf, gameOf, powerOf, titleOf, type PlayerCard } from '../data/playerCard';

// The Player Card itself (used by the Player Card screen and, small, by My Stats).

interface Props {
  card: PlayerCard;
  name: string;
  /** Live numbers shown on the card (level, days, badges). */
  stats?: { level: number; days: number; badges: number };
  small?: boolean;
}

export default function PlayerCardView({ card, name, stats, small = false }: Props) {
  const color = colorOf(card.color);
  const title = titleOf(card.title);
  const power = powerOf(card.power);
  const game = gameOf(card.game);
  const motto = CARD_MOTTOS[card.motto] ?? CARD_MOTTOS[0];
  const displayName = name.trim() || 'Player';

  if (small) {
    return (
      <div className={`rounded-3xl bg-gradient-to-br ${color.grad} border-4 border-white/70 shadow-xl p-4 flex items-center gap-4 text-white`}
        data-testid="player-card-small">
        <div className="text-5xl w-20 h-20 shrink-0 rounded-2xl bg-white/25 flex items-center justify-center" aria-hidden>{card.avatar}</div>
        <div className="min-w-0 flex-1">
          <p className="font-fredoka text-2xl leading-tight truncate">{displayName}</p>
          <p className="font-fredoka text-lg text-yellow-100">{title.emoji} {title.label}</p>
          <p className="font-nunito text-base text-white/90 truncate">{power.emoji} {power.label} · {game.emoji} {game.label}</p>
          <p className="font-nunito text-base italic text-white/90 truncate">“{motto}”</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-[2rem] bg-gradient-to-br ${color.grad} border-[6px] border-white/80 shadow-2xl p-5 text-white overflow-hidden`}
      data-testid="player-card">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" aria-hidden />
      <div className="flex justify-between items-center gap-2 font-fredoka text-base uppercase tracking-wide text-white/90 mb-3 whitespace-nowrap">
        <span>🎮 Fun Quest</span>
        <span>★ Player Card</span>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-7xl w-28 h-28 shrink-0 rounded-3xl bg-white/25 flex items-center justify-center shadow-inner" aria-hidden>
          {card.avatar}
        </div>
        <div className="min-w-0">
          <p className="font-fredoka text-3xl md:text-4xl leading-tight break-words">{displayName}</p>
          <p className="inline-block mt-1 px-3 py-1 rounded-full bg-black/25 font-fredoka text-lg">{title.emoji} {title.label}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-2xl bg-white/20 p-3">
          <p className="font-nunito text-base text-white/85">Superpower</p>
          <p className="font-fredoka text-xl">{power.emoji} {power.label}</p>
        </div>
        <div className="rounded-2xl bg-white/20 p-3">
          <p className="font-nunito text-base text-white/85">Favourite game</p>
          <p className="font-fredoka text-xl">{game.emoji} {game.label}</p>
        </div>
      </div>
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { icon: '⭐', label: 'Level', value: stats.level },
            { icon: '📅', label: 'Days', value: stats.days },
            { icon: '🏅', label: 'Badges', value: stats.badges },
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-black/25 p-2 text-center">
              <p className="font-fredoka text-2xl">{s.icon} {s.value}</p>
              <p className="font-nunito text-base text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-2xl bg-white/90 text-stone-900 p-3 text-center">
        <p className="font-nunito text-base text-stone-600">My motto</p>
        <p className="font-fredoka text-xl">“{motto}”</p>
      </div>
    </div>
  );
}
