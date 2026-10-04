import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { setSfxVolume, playClick } from '../utils/sounds';

const TICK_S = 15;
/** A sitting ends after this long away (app closed or in the background). */
const NEW_SITTING_MS = 10 * 60 * 1000;

/**
 * Mounted once in App. Adds play time to the store's daily log (Parent corner), applies the
 * sound-effect volume, and shows a friendly "time for a break" card when a grown-up has set one.
 */
export default function PlayTimeTracker() {
  const gameState = useGameStore(s => s.gameState);
  const breakMinutes = useGameStore(s => s.parent.breakMinutes);
  const sfxVolume = useGameStore(s => s.parent.sfxVolume);
  const [showBreak, setShowBreak] = useState(false);
  const sitting = useRef(0); // seconds played in this sitting
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => { setSfxVolume(sfxVolume); }, [sfxVolume]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > NEW_SITTING_MS) sitting.current = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || gameState === 'welcome') return;
      useGameStore.getState().logPlaySeconds(TICK_S);
      sitting.current += TICK_S;
      if (breakMinutes > 0 && sitting.current >= breakMinutes * 60) setShowBreak(true);
    }, TICK_S * 1000);
    return () => window.clearInterval(id);
  }, [gameState, breakMinutes]);

  const done = () => {
    playClick();
    sitting.current = 0;
    setShowBreak(false);
  };

  return (
    <AnimatePresence>
      {showBreak && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            className="max-w-sm w-full rounded-3xl bg-indigo-950 border-2 border-sky-300 p-6 text-center text-white">
            <div className="text-7xl mb-2">🧘</div>
            <h2 className="font-fredoka text-3xl mb-2">Time for a break!</h2>
            <p className="font-nunito text-lg text-violet-100 mb-5">
              You've been playing for {breakMinutes} minutes. Stretch, grab some water, rest your eyes — your games will be right here. 💧👀
            </p>
            <button onClick={done} className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 font-fredoka text-2xl">
              OK, I had a break ✔
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
