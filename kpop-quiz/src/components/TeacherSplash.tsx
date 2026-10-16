import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ConfettiBurst from './ConfettiBurst';
import { playWin } from '../utils/sounds';

/** "{Teacher} has entered the classroom!" — shown when teacher mode turns on. */
export default function TeacherSplash({ name, onDone }: { name: string; onDone: () => void }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    playWin();
    const iv = window.setInterval(() => setCount(c => c - 1), 1000);
    return () => window.clearInterval(iv);
  }, []);
  useEffect(() => { if (count < 0) onDone(); }, [count, onDone]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onDone} role="dialog" aria-label="Teacher mode">
      <ConfettiBurst count={80} durationMs={3000} />
      <motion.div initial={{ scale: 0.5, rotate: -5 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300 }}
        className="text-center p-8 rounded-3xl max-w-sm mx-4"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '4px solid #f59e0b' }}>
        <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8 }} className="text-7xl mb-4">🍎</motion.div>
        <h2 className="font-fredoka font-bold text-yellow-400 text-3xl mb-2">{name.toUpperCase()}<br />HAS ENTERED THE CLASSROOM!</h2>
        <div className="bg-yellow-900/40 border border-yellow-500 rounded-2xl p-3 mb-4">
          <p className="font-fredoka text-yellow-200 text-base leading-relaxed">
            🍎 <span className="font-bold">OFFICIAL NOTICE:</span><br />
            Class is now Fun Quest. 📋<br />
            Students will be graded on how much fun they have.<br />
            Homework = Play more games. 🎮
          </p>
        </div>
        <motion.div key={count} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-fredoka font-bold text-white text-2xl">
          {count > 0 ? `Class starts in ${count}... 🔔` : "Let's GO! 🚀"}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
