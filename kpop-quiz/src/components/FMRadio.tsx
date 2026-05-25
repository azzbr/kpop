import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWin } from '../utils/sounds';

const SHOUTOUTS = [
  "Big shoutout to Year 4 for surviving Monday! 📣",
  "This one goes out to everyone who remembered their homework! 🏆",
  "HUNTR/X FM says: drink your water, legends! 💧",
  "Shoutout to the whole class — you're all stars tonight! ⭐",
  "This is your DJ saying: be kind to each other! 🌟",
  "Special dedication to whoever tidied the art supplies last! 🎨",
  "HUNTR/X FM: where every listener is a future idol! 🎤",
  "Sending good vibes to everyone in the back row! 🎵",
  "Mr. Jarvis says this one's for the class champions! 🥇",
  "You're listening to the most awesome school radio ever! 📻",
];

const TRACK_DISPLAY: Record<string, { title: string; artist: string }> = {
  '01. TAKEDOWN (JEONGYEON, JIHYO, CHAEYOUNG).flac': { title: 'TAKEDOWN', artist: 'JEONGYEON, JIHYO, CHAEYOUNG' },
  "02. How It's Done.flac": { title: "How It's Done", artist: 'HUNTR/X' },
  '03. Soda Pop.flac': { title: 'Soda Pop', artist: 'HUNTR/X' },
  '04. Golden.flac': { title: 'Golden', artist: 'HUNTR/X' },
  '05. Strategy.flac': { title: 'Strategy', artist: 'HUNTR/X' },
  '06. Takedown.flac': { title: 'Takedown', artist: 'HUNTR/X' },
  '07. Your Idol.flac': { title: 'Your Idol', artist: 'HUNTR/X' },
  '08. Free.flac': { title: 'Free', artist: 'HUNTR/X' },
};

export default function FMRadio() {
  const { setGameState, userName, playlist, currentTrack, isPlaying, setCurrentTrack, setIsPlaying, setVolume, volume } = useGameStore();
  const [shoutout, setShoutout] = useState<string | null>(null);
  const [shoutIdx, setShoutIdx] = useState(0);
  const [bars, setBars] = useState<number[]>(Array.from({ length: 18 }, () => Math.random()));
  const [spinning, setSpinning] = useState(isPlaying);
  const shoutTimer = useRef<number | null>(null);
  const barTimer = useRef<number | null>(null);

  const trackInfo = TRACK_DISPLAY[playlist[currentTrack]] ?? { title: playlist[currentTrack], artist: 'HUNTR/X' };
  const djName = userName || 'DJ Star';

  // animate visualiser bars
  useEffect(() => {
    if (!isPlaying) { setBars(Array.from({ length: 18 }, () => 0.1)); return; }
    barTimer.current = window.setInterval(() => {
      setBars(Array.from({ length: 18 }, () => 0.15 + Math.random() * 0.85));
    }, 120);
    return () => { if (barTimer.current) clearInterval(barTimer.current); };
  }, [isPlaying]);

  useEffect(() => { setSpinning(isPlaying); }, [isPlaying]);

  const fireShoutout = () => {
    playWin();
    const msg = SHOUTOUTS[shoutIdx % SHOUTOUTS.length];
    setShoutout(msg);
    setShoutIdx(i => i + 1);
    if (shoutTimer.current) clearTimeout(shoutTimer.current);
    shoutTimer.current = window.setTimeout(() => setShoutout(null), 4000);
  };

  const handleToggle = () => { setIsPlaying(!isPlaying); playClick(); };
  const handleTrack = (dir: 1 | -1) => {
    const next = (currentTrack + dir + playlist.length) % playlist.length;
    setCurrentTrack(next);
    playPop();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 50%, #0d1a2e 100%)' }}
    >
      <div className="w-full max-w-sm">
        <button
          onClick={() => setGameState('game_mode')}
          className="btn-kid-secondary mb-4 font-fredoka text-sm"
        >
          ← Back
        </button>

        {/* Radio chassis */}
        <div className="rounded-3xl border-4 border-purple-400 shadow-2xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #1e1e3a 0%, #12122a 100%)', boxShadow: '0 0 40px rgba(167,139,250,0.3)' }}>

          {/* Station header */}
          <div className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-purple-700 px-6 py-3 text-center">
            <div className="font-fredoka text-white text-3xl tracking-widest drop-shadow-lg">HUNTR/X FM</div>
            <div className="font-nunito text-purple-200 text-sm tracking-[0.3em]">96.3 MHz · EST. NOW</div>
          </div>

          {/* Vinyl + visualiser */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-4 mb-5">
              {/* Spinning vinyl */}
              <motion.div
                animate={{ rotate: spinning ? 360 : 0 }}
                transition={{ duration: 3, repeat: spinning ? Infinity : 0, ease: 'linear' }}
                className="w-24 h-24 rounded-full border-4 border-purple-400 flex-shrink-0 relative overflow-hidden shadow-lg"
                style={{ background: 'radial-gradient(circle at 50% 50%, #4a0080 0%, #1a0030 40%, #0d0020 100%)' }}
              >
                {/* Grooves */}
                {[18, 28, 38].map(r => (
                  <div key={r} className="absolute border border-purple-900/60 rounded-full"
                    style={{ inset: `${r}px` }} />
                ))}
                {/* Centre label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-purple-300 flex items-center justify-center shadow-inner">
                    <span className="text-purple-900 text-lg">★</span>
                  </div>
                </div>
              </motion.div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div className="font-nunito text-purple-400 text-xs uppercase tracking-widest mb-1">Now Playing</div>
                <div className="font-fredoka text-white text-xl leading-tight truncate">{trackInfo.title}</div>
                <div className="font-nunito text-purple-300 text-sm truncate">{trackInfo.artist}</div>
                <div className="font-nunito text-purple-500 text-xs mt-1">DJ {djName} · HUNTR/X FM</div>
              </div>
            </div>

            {/* Visualiser */}
            <div className="flex items-end justify-center gap-[3px] h-12 mb-5 px-2">
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  animate={{ height: `${h * 100}%` }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 rounded-full"
                  style={{ background: `hsl(${260 + i * 8}, 80%, 65%)`, minHeight: 3 }}
                />
              ))}
            </div>

            {/* LED display ticker */}
            <div className="rounded-xl px-3 py-2 mb-5 overflow-hidden"
              style={{ background: '#0a0a14', border: '2px solid #2d2d5a' }}>
              <motion.div
                animate={{ x: [200, -600] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="font-mono text-green-400 text-sm whitespace-nowrap"
              >
                ★ HUNTR/X FM 96.3 ★ NOW PLAYING: {trackInfo.title} by {trackInfo.artist} ★ DJ {djName} IN THE MIX ★ STAY TUNED ★
              </motion.div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleTrack(-1)}
                className="w-12 h-12 rounded-full border-2 border-purple-500 text-purple-300 text-xl flex items-center justify-center hover:bg-purple-900/40">
                ⏮
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={handleToggle}
                className="w-16 h-16 rounded-full text-white text-3xl flex items-center justify-center shadow-lg"
                style={{ background: isPlaying ? 'linear-gradient(135deg,#9333ea,#ec4899)' : 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                {isPlaying ? '⏸' : '▶️'}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleTrack(1)}
                className="w-12 h-12 rounded-full border-2 border-purple-500 text-purple-300 text-xl flex items-center justify-center hover:bg-purple-900/40">
                ⏭
              </motion.button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-purple-400 text-sm">🔈</span>
              <input type="range" min={0} max={1} step={0.01} value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="flex-1 h-2 accent-purple-500" />
              <span className="text-purple-400 text-sm">🔊</span>
            </div>

            {/* Shoutout button */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={fireShoutout}
              className="w-full py-3 rounded-2xl font-fredoka text-lg text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
            >
              🎙️ Broadcast a Shoutout!
            </motion.button>
          </div>
        </div>

        {/* Track list */}
        <div className="mt-4 rounded-2xl overflow-hidden border-2 border-purple-800"
          style={{ background: '#0d0d1a' }}>
          {playlist.map((f, i) => {
            const info = TRACK_DISPLAY[f] ?? { title: f, artist: 'HUNTR/X' };
            const active = i === currentTrack;
            return (
              <button key={f} onClick={() => { setCurrentTrack(i); playPop(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-purple-900/40 last:border-0 transition-colors ${active ? 'bg-purple-900/50' : 'hover:bg-purple-900/20'}`}>
                <span className="text-purple-400 font-mono text-xs w-4">{active && isPlaying ? '▶' : i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-nunito text-sm truncate ${active ? 'text-purple-200' : 'text-purple-400'}`}>{info.title}</div>
                  <div className="font-nunito text-xs text-purple-600 truncate">{info.artist}</div>
                </div>
                {active && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-purple-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shoutout overlay */}
      <AnimatePresence>
        {shoutout && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 max-w-xs w-[90%]"
          >
            <div className="rounded-2xl px-5 py-4 text-center shadow-2xl border-2 border-amber-400"
              style={{ background: 'linear-gradient(135deg, #92400e, #78350f)' }}>
              <div className="text-2xl mb-1">📻</div>
              <p className="font-fredoka text-amber-100 text-lg leading-tight">{shoutout}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
