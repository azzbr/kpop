import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playHit, playWrong, playWin, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const HEROES = [
  { id: 'storm',   name: 'STORM',   emoji: '⚡', color: 'from-blue-500 to-cyan-400',     atk: 90, def: 55, sp: 80, maxHp: 100, spec: '🌩️ Thunder Strike' },
  { id: 'blaze',   name: 'BLAZE',   emoji: '🔥', color: 'from-orange-500 to-red-500',    atk: 85, def: 60, sp: 75, maxHp: 110, spec: '🔥 Inferno Combo' },
  { id: 'frost',   name: 'FROST',   emoji: '❄️', color: 'from-sky-400 to-blue-300',      atk: 70, def: 82, sp: 88, maxHp: 95,  spec: '❄️ Ice Shatter' },
  { id: 'phantom', name: 'PHANTOM', emoji: '👻', color: 'from-violet-600 to-purple-500', atk: 95, def: 45, sp: 92, maxHp: 88,  spec: '💀 Soul Crush' },
];
const VILLAINS = [
  { id: 'dusk',   name: 'DUSK',   emoji: '🦹', color: 'from-red-800 to-red-600',     atk: 82, def: 64, sp: 72, maxHp: 100 },
  { id: 'vortex',name: 'VORTEX', emoji: '🌀', color: 'from-gray-700 to-gray-500',    atk: 87, def: 52, sp: 78, maxHp: 98  },
  { id: 'shadow',name: 'SHADOW', emoji: '😈', color: 'from-purple-900 to-purple-700',atk: 92, def: 48, sp: 83, maxHp: 92  },
  { id: 'brute', name: 'BRUTE',  emoji: '🦣', color: 'from-amber-800 to-stone-700',  atk: 76, def: 88, sp: 64, maxHp: 118 },
];

type Move = 'punch' | 'kick' | 'special' | 'guard';

const MOVE_INFO: Record<Move, { label: string; emoji: string; color: string; desc: string }> = {
  punch:   { label: 'PUNCH',   emoji: '👊', color: 'from-yellow-500 to-orange-500', desc: 'Reliable medium damage' },
  kick:    { label: 'KICK',    emoji: '🦵', color: 'from-red-500 to-pink-500',      desc: '20% miss, high damage' },
  special: { label: 'SPECIAL', emoji: '✨', color: 'from-purple-500 to-fuchsia-500', desc: 'Big damage, costs 60 energy' },
  guard:   { label: 'GUARD',   emoji: '🛡️', color: 'from-blue-500 to-cyan-500',     desc: 'Block 65% damage this turn' },
};

const HYPE = [
  "That hit harder than a triple album drop! 💿",
  "The crowd goes WILD! 🎤",
  "DEVASTATING! This battle is insane! 🔥",
  "Incredible combo! The fans are screaming! 🎵",
  "What a move! Pure K-Pop power! ⭐",
  "No way! An absolute BANGER hit! 💥",
  "The arena is SHAKING! 🏟️",
  "He came, he saw, he DEMOLISHED! 💪",
];
const MISS_LINES = ["Woah, they dodged it! 💨", "Missed by a mile! Try again! 😅", "The crowd groans... 😬"];
const GUARD_LINES = ["They blocked it cold! 🛡️", "Not today! Solid defence! 💪", "Blocked! Back to the drawing board! 🧱"];

function calcDamage(atk: number, def: number, move: Move, isGuarding: boolean): { dmg: number; miss: boolean } {
  let base = 0, miss = false;
  if (move === 'guard') return { dmg: 0, miss: false };
  if (move === 'punch') base = atk * 0.38;
  else if (move === 'kick') { if (Math.random() < 0.2) return { dmg: 0, miss: true }; base = atk * 0.58; }
  else if (move === 'special') base = atk * 0.72;
  base *= rnd(0.85, 1.2);
  if (isGuarding) base *= 0.35;
  base *= 1 - def / 380;
  return { dmg: Math.max(2, Math.round(base)), miss };
}
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function cpuMove(energy: number, playerLastMove: Move | null): Move {
  if (energy >= 60 && Math.random() < 0.38) return 'special';
  if (playerLastMove === 'special' && Math.random() < 0.3) return 'guard';
  const r = Math.random();
  if (r < 0.38) return 'punch';
  if (r < 0.66) return 'kick';
  if (r < 0.8 && energy >= 60) return 'special';
  return 'guard';
}

interface Fighter { hp: number; maxHp: number; energy: number; guarding: boolean; }

const BattleArena: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [phase, setPhase] = useState<'pick' | 'fight' | 'result'>('pick');
  const [heroIdx, setHeroIdx] = useState(0);
  const [vilIdx] = useState(() => Math.floor(Math.random() * VILLAINS.length));
  const hero = HEROES[heroIdx];
  const vil = VILLAINS[vilIdx];

  const [player, setPlayer] = useState<Fighter>({ hp: 0, maxHp: 0, energy: 0, guarding: false });
  const [cpu, setCpu] = useState<Fighter>({ hp: 0, maxHp: 0, energy: 0, guarding: false });
  const [log, setLog] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [hitAnim, setHitAnim] = useState<'player' | 'cpu' | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [wins, setWins] = useState(() => parseInt(localStorage.getItem('arena_wins') || '0'));

  const startFight = () => {
    setPlayer({ hp: hero.maxHp, maxHp: hero.maxHp, energy: 0, guarding: false });
    setCpu({ hp: vil.maxHp, maxHp: vil.maxHp, energy: 0, guarding: false });
    setLog([`⚔️ ${hero.name} vs ${vil.name} — FIGHT!`]);
    setRound(1);
    setLastMove(null);
    setPhase('fight');
    playUnlock();
  };

  const execMove = useCallback(async (pMove: Move) => {
    if (busy) return;
    setBusy(true);
    setLastMove(pMove);

    // deduct energy for special
    let pEnergy = player.energy + 25;
    if (pMove === 'special') { if (pEnergy < 60) { setBusy(false); return; } pEnergy -= 60; }
    let cEnergy = cpu.energy + 25;
    const cMove = cpuMove(cEnergy, lastMove);
    if (cMove === 'special') cEnergy -= 60;

    const lines: string[] = [];
    let pHp = player.hp, cHp = cpu.hp;
    const pGuard = pMove === 'guard', cGuard = cMove === 'guard';

    // player attacks cpu
    if (pMove !== 'guard') {
      const { dmg, miss } = calcDamage(hero.atk, vil.def, pMove, cGuard);
      if (miss) { lines.push(`${MOVE_INFO[pMove].emoji} ${hero.name} missed! ${MISS_LINES[Math.floor(Math.random() * MISS_LINES.length)]}`); }
      else if (cGuard) { lines.push(`${MOVE_INFO[pMove].emoji} ${vil.name} blocked! ${GUARD_LINES[Math.floor(Math.random() * GUARD_LINES.length)]}`); cHp -= dmg; }
      else { cHp -= dmg; lines.push(`${MOVE_INFO[pMove].emoji} ${hero.name} hits ${vil.name} for ${dmg} damage! ${HYPE[Math.floor(Math.random() * HYPE.length)]}`); setHitAnim('cpu'); }
    } else { lines.push(`🛡️ ${hero.name} braces for impact!`); }

    // cpu attacks player (slight delay)
    await new Promise(r => setTimeout(r, 320));
    if (cMove !== 'guard') {
      const { dmg, miss } = calcDamage(vil.atk, hero.def, cMove, pGuard);
      if (miss) { lines.push(`${MOVE_INFO[cMove].emoji} ${vil.name} missed! Lucky break! 😅`); playClick(); }
      else if (pGuard) { pHp -= dmg; lines.push(`${MOVE_INFO[cMove].emoji} ${vil.name} hits — partially blocked! (-${dmg} HP) 🛡️`); playHit(); }
      else { pHp -= dmg; lines.push(`${MOVE_INFO[cMove].emoji} ${vil.name} hits ${hero.name} for ${dmg}! ${HYPE[Math.floor(Math.random() * HYPE.length)]}`); setHitAnim('player'); playHit(); }
    } else { lines.push(`🛡️ ${vil.name} guards!`); }

    pHp = Math.max(0, pHp); cHp = Math.max(0, cHp);

    setPlayer(f => ({ ...f, hp: pHp, energy: Math.min(100, pEnergy), guarding: pGuard }));
    setCpu(f => ({ ...f, hp: cHp, energy: Math.min(100, cEnergy), guarding: cGuard }));
    setLog(prev => [...prev, ...lines].slice(-12));
    setRound(r => r + 1);

    await new Promise(r => setTimeout(r, 180));
    setHitAnim(null);

    if (pHp <= 0 || cHp <= 0) {
      await new Promise(r => setTimeout(r, 400));
      if (cHp <= 0) {
        const newWins = wins + 1;
        setWins(newWins);
        localStorage.setItem('arena_wins', String(newWins));
        addXP(60);
        setConfetti(true);
        setTimeout(() => setConfetti(false), 3000);
        playWin();
        setLog(prev => [...prev, `🏆 ${hero.name} WINS! The arena erupts! 🎊`]);
      } else {
        playWrong();
        addXP(15);
        setLog(prev => [...prev, `💀 ${vil.name} wins this round... but you'll come back stronger! 💪`]);
      }
      setPhase('result');
    }
    setBusy(false);
  }, [busy, player, cpu, hero, vil, lastMove, wins, addXP]);

  const hpBar = (cur: number, max: number, color: string) => (
    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
      <motion.div
        className={`h-4 rounded-full bg-gradient-to-r ${color}`}
        animate={{ width: `${Math.max(0, (cur / max) * 100)}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
  const energyBar = (e: number) => (
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"
        animate={{ width: `${e}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a4e 50%, #0d1b3e 100%)' }}
    >
      {confetti && <ConfettiBurst count={80} durationMs={3000} />}
      <div className="max-w-2xl w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('boys_zone'); }}
          className="mb-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-fredoka text-sm border border-white/20">
          ← Boys Zone
        </button>

        <div className="text-center mb-4">
          <h1 className="text-4xl font-fredoka font-bold text-white">⚡ Battle Arena</h1>
          <p className="font-nunito text-blue-300 text-sm">Wins: {wins} 🏆</p>
        </div>

        {/* HERO PICK */}
        {phase === 'pick' && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <h2 className="font-fredoka font-bold text-white text-xl text-center mb-3">Choose your warrior!</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {HEROES.map((h, i) => (
                <motion.button
                  key={h.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); setHeroIdx(i); }}
                  className={`bg-gradient-to-br ${h.color} rounded-2xl p-4 text-white border-4 transition-all ${heroIdx === i ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'border-transparent'}`}
                >
                  <div className="text-5xl mb-1">{h.emoji}</div>
                  <div className="font-fredoka font-bold text-xl">{h.name}</div>
                  <div className="font-nunito text-xs opacity-80 mt-1">{h.spec}</div>
                  <div className="flex justify-between mt-2 text-xs font-fredoka">
                    <span>ATK {h.atk}</span><span>DEF {h.def}</span><span>SP {h.sp}</span>
                  </div>
                  <div className="font-nunito text-xs opacity-70 mt-1">HP {h.maxHp}</div>
                </motion.button>
              ))}
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-4 text-center backdrop-blur">
              <p className="text-2xl">{vil.emoji}</p>
              <p className="font-fredoka font-bold text-red-300 text-lg">Your opponent: {vil.name}</p>
              <div className="flex justify-center gap-4 mt-1 text-xs font-fredoka text-white/60">
                <span>ATK {vil.atk}</span><span>DEF {vil.def}</span><span>HP {vil.maxHp}</span>
              </div>
            </div>
            <button onClick={startFight} className="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-fredoka font-bold text-xl rounded-2xl shadow-lg hover:brightness-110 transition-all">
              ⚔️ FIGHT!
            </button>
          </motion.div>
        )}

        {/* FIGHT PHASE */}
        {phase === 'fight' && (
          <div>
            {/* HP Bars */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <motion.div
                animate={hitAnim === 'player' ? { x: [-8, 8, -6, 6, 0] } : {}}
                transition={{ duration: 0.35 }}
                className="bg-white/10 border border-blue-400/40 rounded-2xl p-3 backdrop-blur"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-3xl">{hero.emoji}</span>
                  <div>
                    <p className="font-fredoka font-bold text-white">{hero.name}</p>
                    <p className="font-nunito text-xs text-blue-200">{player.hp}/{hero.maxHp} HP</p>
                  </div>
                </div>
                {hpBar(player.hp, hero.maxHp, 'from-blue-400 to-cyan-300')}
                <p className="font-nunito text-xs text-yellow-300 mt-1">⚡ Energy</p>
                {energyBar(player.energy)}
              </motion.div>

              <motion.div
                animate={hitAnim === 'cpu' ? { x: [-8, 8, -6, 6, 0] } : {}}
                transition={{ duration: 0.35 }}
                className="bg-white/10 border border-red-400/40 rounded-2xl p-3 backdrop-blur"
              >
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <div className="text-right">
                    <p className="font-fredoka font-bold text-white">{vil.name}</p>
                    <p className="font-nunito text-xs text-red-200">{cpu.hp}/{vil.maxHp} HP</p>
                  </div>
                  <span className="text-3xl">{vil.emoji}</span>
                </div>
                {hpBar(cpu.hp, vil.maxHp, 'from-red-400 to-orange-300')}
                <p className="font-nunito text-xs text-yellow-300 mt-1 text-right">⚡ Energy</p>
                {energyBar(cpu.energy)}
              </motion.div>
            </div>

            {/* Battle log */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-3 mb-4 h-36 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {log.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-nunito text-sm text-white/80 mb-0.5"
                >
                  {line}
                </motion.p>
              ))}
            </div>

            {/* Move buttons */}
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(MOVE_INFO) as Move[]).map(move => {
                const info = MOVE_INFO[move];
                const disabled = busy || (move === 'special' && player.energy < 60);
                return (
                  <motion.button
                    key={move}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => execMove(move)}
                    disabled={disabled}
                    className={`bg-gradient-to-r ${info.color} rounded-2xl p-3 text-white flex items-center gap-3 transition-all
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110 shadow-lg'}`}
                  >
                    <span className="text-3xl">{info.emoji}</span>
                    <div className="text-left">
                      <p className="font-fredoka font-bold text-lg">{info.label}</p>
                      <p className="font-nunito text-xs opacity-80">{info.desc}</p>
                      {move === 'special' && <p className="font-nunito text-xs text-yellow-200">Energy: {player.energy}/60</p>}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <p className="text-center font-nunito text-white/30 text-xs mt-2">Round {round}</p>
          </div>
        )}

        {/* RESULT */}
        <AnimatePresence>
          {phase === 'result' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/10 border-2 border-yellow-400/50 rounded-3xl p-8 text-center backdrop-blur"
            >
              <div className="text-6xl mb-2">{cpu.hp <= 0 ? '🏆' : '💀'}</div>
              <h2 className="text-3xl font-fredoka font-bold text-white mb-1">
                {cpu.hp <= 0 ? `${hero.name} WINS!` : `${vil.name} wins...`}
              </h2>
              <p className="font-nunito text-white/70 mb-1">{cpu.hp <= 0 ? '+60 XP earned!' : '+15 XP for trying!'}</p>
              <p className="font-nunito text-yellow-300 mb-4">Total arena wins: {wins} 🏆</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => { setPhase('pick'); playClick(); }} className="btn-kid">🔄 Rematch</button>
                <button onClick={() => setGameState('boys_zone')} className="btn-kid-secondary">← Zone</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default BattleArena;
