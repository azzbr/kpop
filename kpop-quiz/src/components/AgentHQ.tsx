import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getLevel, LEVEL_NAMES } from '../store';
import { playClick, playPop, playWin, playWrong, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

type CipherType = 'number' | 'reverse' | 'shift';

interface Challenge { type: CipherType; plain: string; coded: string; }

const CHALLENGES: Challenge[] = [
  // Number cipher: A=1, B=2, ... Z=26
  { type: 'number', plain: 'KPOP',  coded: '11-16-15-16' },
  { type: 'number', plain: 'DANCE', coded: '4-1-14-3-5' },
  { type: 'number', plain: 'STAR',  coded: '19-20-1-18' },
  { type: 'number', plain: 'SING',  coded: '19-9-14-7' },
  { type: 'number', plain: 'BEAT',  coded: '2-5-1-20' },
  { type: 'number', plain: 'IDOL',  coded: '9-4-15-12' },
  // Reverse cipher: read it backwards
  { type: 'reverse', plain: 'KPOP',   coded: 'POPK' },
  { type: 'reverse', plain: 'DANCE',  coded: 'ECNAD' },
  { type: 'reverse', plain: 'PARTY',  coded: 'YTRAP' },
  { type: 'reverse', plain: 'HEART',  coded: 'TRAEH' },
  { type: 'reverse', plain: 'STAGE',  coded: 'EGATS' },
  { type: 'reverse', plain: 'HUNTRX', coded: 'XRTNUH' },
  // Caesar shift +1: each letter moved forward by 1
  { type: 'shift', plain: 'KPOP',  coded: 'LQPQ' },
  { type: 'shift', plain: 'DANCE', coded: 'EBODF' },
  { type: 'shift', plain: 'BEAT',  coded: 'CFBU' },
  { type: 'shift', plain: 'LOVE',  coded: 'MPWF' },
  { type: 'shift', plain: 'STAR',  coded: 'TUBS' },
  { type: 'shift', plain: 'SING',  coded: 'TJOH' },
];

const CIPHER_INFO: Record<CipherType, { name: string; emoji: string; rule: string; example: string }> = {
  number:  { name: 'NUMBER CIPHER',  emoji: '🔢', rule: 'Each number = a letter. A=1, B=2, C=3... Z=26', example: '8-9 → HI' },
  reverse: { name: 'REVERSE CIPHER', emoji: '🔄', rule: 'Read the letters BACKWARDS to find the word.',   example: 'OLLEH → HELLO' },
  shift:   { name: 'SHIFT CIPHER',   emoji: '➡️', rule: 'Each letter moves FORWARD by 1 in the alphabet.', example: 'IFMMP → HELLO' },
};

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

const AgentHQ: React.FC = () => {
  const { userName, setGameState, addXP, xp } = useGameStore();
  const agentName = userName ? `${userName.toUpperCase()}` : 'ROOKIE';
  const agentID = useMemo(() => Math.floor(10000000 + Math.random() * 90000000).toString(), []);
  const level = getLevel(xp);

  // Cipher state
  const [solvedIds, setSolvedIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('cipher_solved_ids') || '[]'); } catch { return []; }
  });
  const [solvedCount, setSolvedCount] = useState(() => parseInt(localStorage.getItem('ciphers_solved') || '0'));
  const [currentIdx, setCurrentIdx] = useState(() => {
    const tried = JSON.parse(localStorage.getItem('cipher_solved_ids') || '[]');
    const available = CHALLENGES.map((_, i) => i).filter(i => !tried.includes(i));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * CHALLENGES.length);
  });
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'' | 'correct' | 'wrong' | 'hint'>('');
  const [showKey, setShowKey] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [hint, setHint] = useState('');

  const challenge = CHALLENGES[currentIdx];

  const nextChallenge = (justSolvedId?: number) => {
    const next = justSolvedId !== undefined ? [...solvedIds, justSolvedId] : solvedIds;
    const available = CHALLENGES.map((_, i) => i).filter(i => !next.includes(i));
    if (available.length === 0) {
      // Reset cycle, but keep total counter
      setSolvedIds([]);
      localStorage.setItem('cipher_solved_ids', '[]');
      setCurrentIdx(Math.floor(Math.random() * CHALLENGES.length));
    } else {
      setCurrentIdx(available[Math.floor(Math.random() * available.length)]);
    }
    setInput('');
    setFeedback('');
    setHint('');
  };

  const checkAnswer = () => {
    if (!input.trim()) { playPop(); return; }
    if (norm(input) === norm(challenge.plain)) {
      playWin();
      setFeedback('correct');
      setConfetti(true);
      addXP(20);
      const newCount = solvedCount + 1;
      setSolvedCount(newCount);
      localStorage.setItem('ciphers_solved', String(newCount));
      const newSolved = [...solvedIds, currentIdx];
      setSolvedIds(newSolved);
      localStorage.setItem('cipher_solved_ids', JSON.stringify(newSolved));
      setTimeout(() => { setConfetti(false); nextChallenge(currentIdx); }, 1900);
    } else {
      playWrong();
      setFeedback('wrong');
      setTimeout(() => setFeedback(''), 1200);
    }
  };

  const getHint = () => {
    playClick();
    const len = challenge.plain.length;
    const reveal = challenge.plain.slice(0, Math.min(2, len - 1));
    setHint(`Starts with: ${reveal}${'_'.repeat(len - reveal.length)}`);
    setFeedback('hint');
  };

  // Missions tracked from existing localStorage progress
  const missions = useMemo(() => {
    const arenaWins = parseInt(localStorage.getItem('arena_wins') || '0');
    const styleSaves = parseInt(localStorage.getItem('style_saves') || '0');
    const ninjaBest = parseInt(localStorage.getItem('ninja_best') || '0');
    const datesPlayed = (() => {
      try { return JSON.parse(localStorage.getItem('kpop_dates_played') || '[]').length; } catch { return 0; }
    })();
    return [
      { id: 'dec3', emoji: '🔓', label: 'Decode 3 secret ciphers',    done: solvedCount >= 3,   prog: `${Math.min(solvedCount, 3)}/3` },
      { id: 'lvl1', emoji: '⭐', label: `Reach ${LEVEL_NAMES[1]} rank`, done: level >= 1,          prog: `${xp} XP` },
      { id: 'win1', emoji: '🏆', label: 'Win 1 Arena battle',          done: arenaWins >= 1,      prog: `${arenaWins} wins` },
      { id: 'sty1', emoji: '🎨', label: 'Save a Style Studio look',    done: styleSaves >= 1,     prog: `${styleSaves} saved` },
      { id: 'nin1', emoji: '🥷', label: 'Score 100+ in Ninja Slice',   done: ninjaBest >= 100,    prog: `Best: ${ninjaBest}` },
      { id: 'day3', emoji: '🔥', label: 'Play on 3 different days',    done: datesPlayed >= 3,    prog: `${datesPlayed} days` },
    ];
  }, [solvedCount, level, xp]);

  const completeCount = missions.filter(m => m.done).length;

  // Pulse animation when feedback changes
  const [pulse, setPulse] = useState(false);
  useEffect(() => { if (feedback) { setPulse(true); const t = setTimeout(() => setPulse(false), 350); return () => clearTimeout(t); } }, [feedback]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen p-4"
      style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a1f 60%, #000 100%)' }}
    >
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}

      {/* Animated grid background */}
      <div className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,200,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      <div className="max-w-2xl mx-auto relative z-10">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="mb-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-cyan-300 rounded-full font-fredoka text-sm border border-cyan-500/30"
        >
          ← Back to Base
        </button>

        {/* Header */}
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-5">
          <div className="text-5xl mb-1">🕵️</div>
          <h1 className="text-4xl font-fredoka font-bold mb-1"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SECRET HQ
          </h1>
          <p className="font-nunito text-cyan-200/70 text-sm">Top secret agent headquarters</p>
        </motion.div>

        {/* Agent ID Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-indigo-900 to-purple-900 border-2 border-cyan-400/40 rounded-2xl p-4 mb-5 shadow-[0_0_24px_rgba(34,211,238,0.2)]"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center border-2 border-cyan-400/60 flex-shrink-0">
              <span className="text-4xl">🕶️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-nunito text-cyan-300/70 text-xs">CODENAME</p>
              <p className="font-fredoka font-bold text-white text-xl truncate">AGENT {agentName}</p>
              <p className="font-nunito text-cyan-300/70 text-xs mt-1">RANK · {LEVEL_NAMES[level]}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-nunito text-cyan-300/70 text-xs">ID</p>
              <p className="font-mono text-cyan-300 font-bold">{agentID}</p>
            </div>
          </div>
        </motion.div>

        {/* CIPHER DECODER — the main game */}
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900 to-gray-900 border-2 border-pink-500/40 rounded-3xl p-5 mb-5 shadow-[0_0_24px_rgba(236,72,153,0.15)]"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-fredoka font-bold text-pink-300">🔐 CIPHER DECODER</h2>
            <div className="bg-pink-500/20 border border-pink-400/40 rounded-full px-3 py-0.5">
              <span className="font-fredoka text-pink-200 text-sm">Decoded: {solvedCount} 🏆</span>
            </div>
          </div>

          <p className="font-nunito text-pink-200/70 text-sm mb-2">
            Cipher Type: <span className="font-fredoka text-pink-300">{CIPHER_INFO[challenge.type].emoji} {CIPHER_INFO[challenge.type].name}</span>
          </p>

          {/* Coded message display */}
          <motion.div
            animate={pulse && feedback === 'wrong' ? { x: [-8, 8, -6, 6, 0] } : {}}
            transition={{ duration: 0.35 }}
            className={`bg-black/60 border-2 rounded-2xl p-5 mb-3 text-center transition-colors ${
              feedback === 'correct' ? 'border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]' :
              feedback === 'wrong' ? 'border-red-500' :
              'border-pink-500/40'
            }`}
          >
            <p className="font-nunito text-pink-300/60 text-xs uppercase tracking-widest mb-2">⚠️ Encrypted Message ⚠️</p>
            <p className="font-mono font-bold text-cyan-300 break-all" style={{ fontSize: 'clamp(20px, 6vw, 38px)', letterSpacing: challenge.type === 'number' ? '0.05em' : '0.2em' }}>
              {challenge.coded}
            </p>
          </motion.div>

          {/* Show Key toggle */}
          <button
            onClick={() => { playClick(); setShowKey(s => !s); }}
            className="w-full mb-3 py-2 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-400/30 rounded-xl font-fredoka text-pink-200 text-sm"
          >
            {showKey ? '🔒 Hide Decoder Key' : '🔑 Show Decoder Key'}
          </button>

          <AnimatePresence>
            {showKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-yellow-500/10 border-2 border-yellow-400/40 rounded-2xl p-3 mb-3 overflow-hidden"
              >
                <p className="font-fredoka font-bold text-yellow-300 text-sm mb-1">📖 How to decode:</p>
                <p className="font-nunito text-yellow-100 text-sm">{CIPHER_INFO[challenge.type].rule}</p>
                <p className="font-mono text-yellow-200 text-xs mt-2 bg-black/30 rounded px-2 py-1">Example: {CIPHER_INFO[challenge.type].example}</p>
                {challenge.type === 'number' && (
                  <div className="grid grid-cols-9 gap-0.5 mt-2 text-center">
                    {Array.from({ length: 26 }).map((_, i) => (
                      <div key={i} className="bg-black/40 rounded text-yellow-200 font-mono text-[10px] py-0.5">
                        {String.fromCharCode(65 + i)}={i + 1}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <p className="font-nunito text-pink-200/80 text-sm mb-1">Your answer:</p>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setFeedback(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') checkAnswer(); }}
            placeholder="Type the secret word..."
            className="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-pink-500/30 focus:border-pink-400 outline-none text-white font-mono uppercase tracking-widest text-lg mb-2 placeholder:text-white/20 placeholder:font-nunito placeholder:tracking-normal placeholder:normal-case"
            autoComplete="off"
          />

          {/* Feedback message */}
          <AnimatePresence>
            {feedback === 'correct' && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-center font-fredoka font-bold text-green-400 text-lg mb-2">
                🎉 DECODED! +20 XP — loading next message...
              </motion.p>
            )}
            {feedback === 'wrong' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center font-fredoka text-red-400 text-sm mb-2">
                ❌ Not quite! Try again, agent!
              </motion.p>
            )}
            {feedback === 'hint' && hint && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center font-mono text-yellow-300 text-lg mb-2 tracking-widest">
                💡 {hint}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={getHint}
              className="py-3 bg-yellow-500/20 hover:bg-yellow-500/30 border-2 border-yellow-400/40 rounded-xl font-fredoka text-yellow-300 text-sm">
              💡 Hint
            </button>
            <button onClick={checkAnswer}
              className="py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:brightness-110 rounded-xl font-fredoka font-bold text-white text-base shadow-lg col-span-1">
              🔓 Decode!
            </button>
            <button onClick={() => { playClick(); nextChallenge(); }}
              className="py-3 bg-purple-500/20 hover:bg-purple-500/30 border-2 border-purple-400/40 rounded-xl font-fredoka text-purple-300 text-sm">
              ⏭️ Skip
            </button>
          </div>
        </motion.div>

        {/* MISSION BOARD */}
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-slate-900 to-gray-900 border-2 border-cyan-500/40 rounded-3xl p-5 mb-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-fredoka font-bold text-cyan-300">🎯 MISSION BOARD</h2>
            <div className="bg-cyan-500/20 border border-cyan-400/40 rounded-full px-3 py-0.5">
              <span className="font-fredoka text-cyan-200 text-sm">{completeCount}/{missions.length} ✓</span>
            </div>
          </div>

          <div className="space-y-2">
            {missions.map(m => (
              <motion.div
                key={m.id}
                whileHover={{ scale: 1.01 }}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                  m.done
                    ? 'bg-green-500/15 border-green-400/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                    : 'bg-black/30 border-gray-700'
                }`}
              >
                <div className={`text-2xl ${m.done ? '' : 'grayscale opacity-50'}`}>{m.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className={`font-fredoka text-sm ${m.done ? 'text-green-300' : 'text-white/80'}`}>{m.label}</p>
                  <p className="font-nunito text-xs text-white/40">{m.prog}</p>
                </div>
                <div className={`text-xl ${m.done ? 'text-green-400' : 'text-gray-600'}`}>
                  {m.done ? '✅' : '🔒'}
                </div>
              </motion.div>
            ))}
          </div>

          {completeCount === missions.length && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="mt-3 p-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-2 border-yellow-400/60 rounded-xl text-center"
            >
              <p className="font-fredoka font-bold text-yellow-300">👑 MASTER AGENT! All missions complete!</p>
            </motion.div>
          )}
        </motion.div>

        {/* Treasure Shop quick link */}
        <motion.button
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={() => { playUnlock(); setGameState('shop'); }}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:brightness-110 rounded-2xl p-4 mb-4 shadow-lg flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛍️</span>
            <div className="text-left">
              <p className="font-fredoka font-bold text-white text-lg">TREASURE SHOP</p>
              <p className="font-nunito text-green-100 text-xs">Spend your XP on awesome upgrades</p>
            </div>
          </div>
          <span className="text-white text-2xl">▶</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default AgentHQ;
