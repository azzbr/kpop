import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store';
import { playClick } from '../../utils/sounds';

// The standard frame for screens that aren't round-based games (tools, collections, toys):
// arcade backdrop (follows Theme Lab and seasonal events), safe areas, a 48px Back button,
// a title, and an optional slot on the right. Round-based games use games/engine/GameShell.

interface Props {
  title: string;
  icon: string;
  children: ReactNode;
  /** Back goes to the game grid unless this is given. */
  onBack?: () => void;
  /** Buttons or badges on the right of the header. */
  right?: ReactNode;
  /** Max content width (Tailwind class). */
  width?: string;
}

export default function ScreenFrame({ title, icon, children, onBack, right, width = 'max-w-4xl' }: Props) {
  const setGameState = useGameStore(s => s.setGameState);
  const back = () => {
    playClick();
    if (onBack) onBack(); else setGameState('game_mode');
  };
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="arcade-bg min-h-screen-d text-white px-4"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className={`${width} mx-auto`}>
        <header className="flex items-center gap-3 py-2 mb-3">
          <button onClick={back} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg shrink-0">← Back</button>
          <h1 className="flex-1 min-w-0 font-fredoka text-2xl md:text-3xl truncate">{icon} {title}</h1>
          {right}
        </header>
        {children}
      </div>
    </motion.div>
  );
}
