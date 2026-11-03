// One game on the grid: tap to play, ☆ to keep it in "My favourites", mastery stars from the best
// score (data/mastery.ts), a 2× XP chip on the game of the week, and a gold card at 3★.
import { motion } from 'framer-motion';
import type { GameState } from '../../store';
import { MASTERY, starsFor, starString } from '../../data/mastery';

export interface HomeTile {
  id: GameState;
  /** High-score key in the store, when it differs from `id`. */
  scoreKey?: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: 'arcade' | 'puzzle' | 'quiz' | 'party' | 'create' | 'me' | 'teacher';
  isNew?: boolean;
}

interface Props {
  tile: HomeTile;
  best?: number;
  fav: boolean;
  weekly: boolean;
  delay?: number;
  onOpen: () => void;
  onToggleFav: () => void;
}

export default function GameTile({ tile, best, fav, weekly, delay = 0, onOpen, onToggleFav }: Props) {
  const key = tile.scoreKey ?? tile.id;
  const hasStars = key in MASTERY;
  const stars = hasStars ? starsFor(key, best ?? 0) : 0;
  const mastered = hasStars && stars === 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}
      className="relative" data-mastered={mastered ? 'true' : undefined}
    >
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onOpen}
        className={`relative w-full text-left rounded-2xl p-4 pr-12 backdrop-blur-sm shadow-lg flex items-center gap-4 min-h-[88px] ${
          mastered ? 'bg-amber-400/15 border-2 border-amber-300 shadow-amber-500/30' : 'bg-white/10 hover:bg-white/15 border border-white/15'
        }`}
      >
        <div className={`relative text-4xl w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${tile.color} flex items-center justify-center shadow-md`}>
          {tile.icon}
          {mastered && <span className="absolute -top-2 -left-2 text-2xl" aria-hidden>🏆</span>}
        </div>
        <div className="min-w-0">
          <h3 className="font-fredoka text-xl text-white leading-tight">{tile.title}</h3>
          <p className="font-nunito text-base text-violet-200 leading-snug">{tile.description}</p>
          {(hasStars || best || weekly) && (
            <p className="font-nunito text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {hasStars && (
                <span className={best ? '' : 'opacity-60'} aria-label={`${stars} of 3 stars`}>{starString(stars)}</span>
              )}
              {best ? <span className="text-yellow-300">🏅 Best: {best.toLocaleString()}</span> : null}
              {weekly && <span className="bg-sky-400 text-stone-900 font-fredoka text-xs px-2 py-0.5 rounded-full">🌟 2× XP</span>}
            </p>
          )}
        </div>
        {tile.isNew && (
          <span className="absolute top-2 right-2 bg-yellow-400 text-stone-900 font-fredoka text-xs px-2 py-0.5 rounded-full">NEW</span>
        )}
      </motion.button>
      <button
        type="button"
        onClick={onToggleFav}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${tile.title} from favourites` : `Add ${tile.title} to favourites`}
        className={`absolute bottom-1 right-1 w-11 h-11 rounded-full flex items-center justify-center text-2xl ${fav ? '' : 'text-violet-200/80'}`}
      >
        {fav ? '⭐' : '☆'}
      </button>
    </motion.div>
  );
}

/** Small card for the "Jump back in" row. */
export function RecentCard({ tile, best, onOpen }: { tile: HomeTile; best?: number; onOpen: () => void }) {
  const key = tile.scoreKey ?? tile.id;
  const hasStars = key in MASTERY;
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-3 bg-white/10 border border-white/15 flex items-center gap-3 min-h-[64px]"
    >
      <span className={`text-2xl w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center`}>{tile.icon}</span>
      <span className="min-w-0">
        <h3 className="font-fredoka text-base sm:text-lg text-white leading-tight line-clamp-2">{tile.title}</h3>
        {hasStars && <span className="block font-nunito text-sm" aria-label={`${starsFor(key, best ?? 0)} of 3 stars`}>{starString(starsFor(key, best ?? 0))}</span>}
      </span>
    </motion.button>
  );
}
