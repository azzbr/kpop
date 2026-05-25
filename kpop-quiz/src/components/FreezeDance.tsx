import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playPop, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const POSES = [
  { emoji: '🦩', label: 'Stand on one leg!', desc: 'Arms out, balance like a flamingo' },
  { emoji: '🤖', label: 'Robot freeze!', desc: 'Arms at 90°, stiff like a machine' },
  { emoji: '🌊', label: 'Wave freeze!', desc: 'Mid-wave, one arm up, one arm down' },
  { emoji: '🦸', label: 'Superhero pose!', desc: 'Fists on hips, chin up, eyes forward' },
  { emoji: '🧊', label: 'Ice sculpture!', desc: 'Most dramatic pose you can hold' },
  { emoji: '🌸', label: 'Blooming flower!', desc: 'Arms slowly rising like petals opening' },
  { emoji: '🏄', label: 'Surfer!', desc: 'Crouch low, arms out, ride that wave' },
  { emoji: '🤸', label: 'Gymnastics freeze!', desc: 'One arm high, opposite leg out' },
  { emoji: '🦊', label: 'Sneaky fox!', desc: 'Crouch down, tippy toes, ears pricked' },
  { emoji: '🌙', label: 'Moon landing!', desc: 'Slow motion step, totally weightless' },
  { emoji: '💃', label: 'Tango dip!', desc: 'Lean back dramatically, one arm swooping' },
  { emoji: '🗿', label: 'Easter Island statue!', desc: 'Completely, utterly still. Do not blink.' },
];

type Phase = 'setup' | 'playing' | 'frozen' | 'gameover';

export default function FreezeDance() {
  const { setGameState, playlist, currentTrack, setIsPlaying, setCurrentTrack } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [pose, setPose] = useState(POSES[0]);
  const [poseCountdown, setPoseCountdown] = useState(5);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  const freezeTimer = useRef<number | null>(null);
  const poseCdTimer = useRef<number | null>(null);

  // load roster from Jarvis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jarvis_students');
      if (raw) {
        const list: { name: string }[] = JSON.parse(raw);
        setRoster(list.map(s => s.name).filter(Boolean));
      }
    } catch { /* ignore */ }
  }, []);

  const clearTimers = () => {
    if (freezeTimer.current) clearTimeout(freezeTimer.current);
    if (poseCdTimer.current) clearInterval(poseCdTimer.current);
  };

  const scheduleFreeze = useCallback(() => {
    const delay = 10000 + Math.random() * 30000; // 10–40 seconds
    freezeTimer.current = window.setTimeout(() => {
      // freeze!
      const p = POSES[Math.floor(Math.random() * POSES.length)];
      setPose(p);
      setPhase('frozen');
      setIsPlaying(false);
      playTick();
      let cd = 5;
      setPoseCountdown(cd);
      poseCdTimer.current = window.setInterval(() => {
        cd--;
        setPoseCountdown(cd);
        if (cd <= 0) {
          if (poseCdTimer.current) clearInterval(poseCdTimer.current);
        }
      }, 1000);
    }, delay);
  }, [setIsPlaying]);

  const startGame = () => {
    setPhase('playing');
    setRound(r => r + 1);
    setIsPlaying(true);
    playWin();
    scheduleFreeze();
  };

  const resumeDancing = () => {
    clearTimers();
    setPhase('playing');
    setRound(r => r + 1);
    setIsPlaying(true);
    playPop();
    scheduleFreeze();
  };

  const eliminatePlayer = (name: string) => {
    const next = eliminated.concat(name);
    setEliminated(next);
    playClick();
    const active = roster.filter(n => !next.includes(n));
    if (active.length === 1) {
      setWinner(active[0]);
      setPhase('gameover');
      setConfetti(true);
      playWin();
      setTimeout(() => setConfetti(false), 4000);
      setIsPlaying(false);
      clearTimers();
    }
  };

  const reset = () => {
    clearTimers();
    setPhase('setup');
    setEliminated([]);
    setWinner(null);
    setRound(0);
    setIsPlaying(false);
  };

  const activePlayers = roster.filter(n => !eliminated.includes(n));
  const trackName = playlist[currentTrack]?.replace(/\.flac$/, '').replace(/^\d+\.\s*/, '') ?? 'HUNTR/X Track';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {confetti && <ConfettiBurst count={120} durationMs={4000} />}

      <div className="w-full max-w-lg">
        <button onClick={() => { clearTimers(); setIsPlaying(false); setGameState('game_mode'); }}
          className="btn-kid-secondary mb-4 font-fredoka">
          ← Back
        </button>

        <div className="card-kid bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white text-center mb-4">
          <h1 className="font-fredoka text-4xl mb-1">💃 Freeze Dance!</h1>
          <p className="font-nunito text-purple-100 text-sm">Music plays → everyone dances → FREEZE when it stops!</p>
        </div>

        {/* Setup */}
        {phase === 'setup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="card-kid bg-white">
              <h3 className="font-fredoka text-purple-700 text-xl mb-2">🎵 Now Playing</h3>
              <p className="font-nunito text-gray-600 truncate">{trackName}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { const n = (currentTrack - 1 + playlist.length) % playlist.length; setCurrentTrack(n); playPop(); }}
                  className="px-3 py-2 rounded-xl bg-purple-100 text-purple-700 font-fredoka">⏮</button>
                <button onClick={() => { const n = (currentTrack + 1) % playlist.length; setCurrentTrack(n); playPop(); }}
                  className="px-3 py-2 rounded-xl bg-purple-100 text-purple-700 font-fredoka flex-1">Next track ⏭</button>
              </div>
            </div>

            {roster.length > 0 && (
              <div className="card-kid bg-white">
                <h3 className="font-fredoka text-purple-700 text-xl mb-2">
                  👥 Players ({roster.length} from Mr. Jarvis's roll)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roster.map(n => (
                    <span key={n} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-nunito text-sm">{n}</span>
                  ))}
                </div>
                <p className="font-nunito text-xs text-gray-400 mt-2">You can eliminate players during the freeze round.</p>
              </div>
            )}

            {roster.length === 0 && (
              <div className="card-kid bg-amber-50 border-amber-300">
                <p className="font-nunito text-amber-800 text-sm">
                  💡 Add students in <strong>Mr. Jarvis's Lounge → Roll Call</strong> to enable player elimination. Or just dance!
                </p>
              </div>
            )}

            <div className="card-kid bg-white">
              <h3 className="font-fredoka text-purple-700 text-xl mb-2">📋 How to play</h3>
              <ul className="font-nunito text-gray-700 text-sm space-y-1 list-none">
                <li>🎵 Music plays → everyone dances their best moves</li>
                <li>❄️ Music stops randomly → a POSE appears on screen</li>
                <li>🗿 Everyone holds the pose until you tap Resume</li>
                <li>👆 Tap a player's name to eliminate them (optional)</li>
                <li>🏆 Last player standing wins!</li>
              </ul>
            </div>

            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="w-full btn-kid font-fredoka text-2xl py-5">
              🎵 Start Dancing!
            </motion.button>
          </motion.div>
        )}

        {/* Playing */}
        {phase === 'playing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="card-kid bg-gradient-to-br from-green-400 to-emerald-500 text-white text-center py-8"
            >
              <div className="text-7xl mb-3">🕺</div>
              <div className="font-fredoka text-3xl mb-1">DANCE!</div>
              <div className="font-nunito text-green-100">Round {round} — music will freeze at any moment...</div>
            </motion.div>

            <div className="card-kid bg-white text-center">
              <p className="font-nunito text-gray-500 text-sm">🎵 {trackName}</p>
              <p className="font-nunito text-gray-400 text-xs mt-1">Freeze will happen between 10–40 seconds</p>
            </div>

            {activePlayers.length > 0 && (
              <div className="card-kid bg-white">
                <h3 className="font-fredoka text-gray-700 mb-2">Still dancing ({activePlayers.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {activePlayers.map(n => (
                    <span key={n} className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-nunito text-sm">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Frozen */}
        {phase === 'frozen' && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            <div className="card-kid bg-gradient-to-br from-blue-400 to-cyan-500 text-white text-center py-8 border-4 border-blue-300">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: [-10, 10, -10] }}
                transition={{ duration: 0.3, repeat: 3 }}
                className="text-8xl mb-3"
              >
                ❄️
              </motion.div>
              <div className="font-fredoka text-4xl mb-2">FREEZE!</div>
              <div className="text-6xl mb-2">{pose.emoji}</div>
              <div className="font-fredoka text-2xl mb-1">{pose.label}</div>
              <div className="font-nunito text-blue-100">{pose.desc}</div>
              {poseCountdown > 0 && (
                <div className="mt-3 font-fredoka text-5xl text-yellow-300">{poseCountdown}</div>
              )}
            </div>

            {activePlayers.length > 0 && (
              <div className="card-kid bg-white">
                <h3 className="font-fredoka text-red-600 mb-2">👆 Tap to eliminate who broke the pose</h3>
                <div className="flex flex-wrap gap-2">
                  {activePlayers.map(n => (
                    <motion.button
                      key={n}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => eliminatePlayer(n)}
                      className="px-4 py-2 bg-red-50 border-2 border-red-300 text-red-700 rounded-2xl font-nunito hover:bg-red-100"
                    >
                      {n} ✗
                    </motion.button>
                  ))}
                </div>
                {eliminated.length > 0 && (
                  <div className="mt-3">
                    <p className="font-nunito text-xs text-gray-500 mb-1">Eliminated:</p>
                    <div className="flex flex-wrap gap-1">
                      {eliminated.map(n => (
                        <span key={n} className="px-2 py-1 bg-gray-100 text-gray-400 rounded-full font-nunito text-xs line-through">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={resumeDancing}
              className="w-full btn-kid font-fredoka text-xl py-4"
            >
              🎵 Resume Dancing!
            </motion.button>
          </motion.div>
        )}

        {/* Game over */}
        {phase === 'gameover' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card-kid bg-gradient-to-br from-yellow-300 to-orange-400 text-center py-10"
          >
            <div className="text-7xl mb-3">🏆</div>
            <div className="font-fredoka text-3xl text-orange-900 mb-2">Winner!</div>
            <div className="font-fredoka text-5xl text-orange-900 mb-4">{winner}</div>
            <p className="font-nunito text-orange-800 mb-6">🎉 The last one standing! Amazing freeze skills!</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={reset} className="btn-kid font-fredoka">Play Again 🔁</button>
              <button onClick={() => { clearTimers(); setGameState('game_mode'); }} className="btn-kid-secondary font-fredoka">Done</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
