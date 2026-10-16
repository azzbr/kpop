import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playPop } from '../../utils/sounds';

// A tiny "while you wait" toy for the lobby: balloons float up, tap to pop them.
// Nothing is saved or scored — it just keeps fingers busy while the host picks a game.

const COLOURS = ['🎈', '🎈', '🎈', '🫧', '⭐'];
interface Balloon { id: number; x: number; e: string; dur: number }

export default function BalloonPop() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [popped, setPopped] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const iv = window.setInterval(() => {
      const id = ++seq.current;
      const dur = 4 + Math.random() * 3;
      setBalloons(b => [...b.slice(-9), { id, x: 5 + Math.random() * 85, e: COLOURS[Math.floor(Math.random() * COLOURS.length)], dur }]);
      window.setTimeout(() => setBalloons(b => b.filter(x => x.id !== id)), dur * 1000);
    }, 900);
    return () => window.clearInterval(iv);
  }, []);

  const pop = (id: number) => {
    playPop();
    setPopped(n => n + 1);
    setBalloons(b => b.filter(x => x.id !== id));
  };

  return (
    <div className="relative h-56 rounded-3xl bg-gradient-to-b from-sky-400/20 to-indigo-500/20 overflow-hidden game-surface" aria-label="Balloon pop while you wait">
      <div className="absolute top-2 left-3 font-fredoka text-lg text-teal-100">🎈 Pop while you wait! <span className="text-amber-300">{popped}</span></div>
      <AnimatePresence>
        {balloons.map(b => (
          <motion.button key={b.id} type="button" aria-label="Pop balloon"
            initial={{ y: 240 }} animate={{ y: -80 }} exit={{ scale: 1.8, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: b.dur, ease: 'linear' }}
            onPointerDown={(e) => { e.preventDefault(); pop(b.id); }}
            className="absolute w-16 h-16 text-5xl leading-none" style={{ left: `${b.x}%` }}>
            {b.e}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
