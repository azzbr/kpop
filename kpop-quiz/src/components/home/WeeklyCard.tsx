// "🌟 Game of the week" — 2× XP and coins in that game until Sunday (utils/weeklyGame.ts, store.finishRound).
import { motion } from 'framer-motion';
import type { HomeTile } from './GameTile';

export default function WeeklyCard({ tile, onOpen }: { tile: HomeTile; onOpen: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      data-testid="weekly-card"
      className="w-full flex items-center gap-4 rounded-2xl p-4 text-left border-2 min-h-[72px] bg-gradient-to-r from-sky-500/30 to-indigo-500/30 border-sky-300"
    >
      <span className="text-4xl">{tile.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-fredoka text-sm uppercase tracking-wider text-sky-200">🌟 Game of the week</span>
        <span className="block font-fredoka text-xl">{tile.title}</span>
        <span className="block font-nunito text-sm text-violet-200">2× XP and coins until Sunday</span>
      </span>
      <span className="font-fredoka text-lg">Go ▶</span>
    </motion.button>
  );
}
