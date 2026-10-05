import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playHit, playPop, playUnlock } from '../utils/sounds';
import {
  HEROES, VILLAINS, MOVES, CHEERS, MISS_LINES, GUARD_LINES, SPECIAL_COST,
  pick, resolveTurn, newFighter, outcome, matchScore, canSpecial,
} from './games/battleArenaLogic';
import type { Fighter, Move, HitResult, Stats } from './games/battleArenaLogic';

// Battle Arena: turn-based duel against a bot. Rules in games/battleArenaLogic.ts.
// Score per match (saved as 'battle_arena'): HP left × 10 on a win, 0 on a loss.

const rng = Math.random;
interface Line { id: number; text: string; who: 'you' | 'bot' | 'info' }

export default function BattleArena() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  const [vilIdx, setVilIdx] = useState(() => Math.floor(Math.random() * VILLAINS.length));
  const hero = HEROES[heroIdx];
  const vil = VILLAINS[vilIdx];

  const [player, setPlayer] = useState<Fighter>(() => newFighter(HEROES[0]));
  const [cpu, setCpu] = useState<Fighter>(() => newFighter(VILLAINS[0]));
  const [log, setLog] = useState<Line[]>([]);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [hitAnim, setHitAnim] = useState<'player' | 'cpu' | null>(null);
  const [result, setResult] = useState({ score: 0, won: false, turns: 0, foe: '' });
  const lineId = useRef(0);
  const matchId = useRef(0);

  const say = (text: string, who: Line['who']) =>
    setLog(prev => [...prev, { id: ++lineId.current, text, who }].slice(-4));

  const startFight = useCallback(() => {
    matchId.current++;
    setPlayer(newFighter(hero));
    setCpu(newFighter(vil));
    setLog([{ id: ++lineId.current, text: `${hero.emoji} ${hero.name} vs ${vil.emoji} ${vil.name} — let's go!`, who: 'info' }]);
    setTurn(1);
    setLastMove(null);
    setBusy(false);
    setRound(r => r + 1);
    setStatus('playing');
    playUnlock();
  }, [hero, vil]);

  const describe = (attacker: Stats, target: Stats, move: Move, hit: HitResult) => {
    const m = MOVES[move];
    if (move === 'guard') return `${m.emoji} ${attacker.name} puts up a Bubble Shield!`;
    if (hit.miss) return `${m.emoji} ${attacker.name}'s ${m.label} missed! ${pick(rng, MISS_LINES)}`;
    if (hit.blocked) return `${m.emoji} ${m.label}: ${target.name} blocked most of it (−${hit.dmg}). ${pick(rng, GUARD_LINES)}`;
    return `${m.emoji} ${attacker.name}'s ${m.label}: −${hit.dmg}! ${pick(rng, CHEERS)}`;
  };

  const execMove = (pMove: Move) => {
    if (busy || status !== 'playing') return;
    const r = resolveTurn(hero, vil, player, cpu, pMove, lastMove, rng);
    if (!r) return;
    const id = matchId.current;
    setBusy(true);
    setLastMove(pMove);
    playClick();

    // Your move lands first…
    say(describe(hero, vil, pMove, r.pHit), 'you');
    setCpu(r.cpu);
    setPlayer(p => ({ ...p, energy: r.player.energy }));
    if (r.pHit.dmg > 0) { setHitAnim('cpu'); playPop(); }

    // …then the bot's.
    later(() => {
      if (id !== matchId.current) return;
      say(describe(vil, hero, r.cMove, r.cHit), 'bot');
      setPlayer(r.player);
      if (r.cHit.dmg > 0) { setHitAnim('player'); playHit(); } else setHitAnim(null);
      setTurn(t => t + 1);

      later(() => {
        if (id !== matchId.current) return;
        setHitAnim(null);
        const end = outcome(r.player, r.cpu);
        if (!end) { setBusy(false); return; }
        const score = matchScore(r.player, end);
        say(end === 'win' ? `🏆 ${vil.name} is knocked out! ${hero.name} wins!` : `😵 ${hero.name} is knocked out… so close!`, 'info');
        setResult({ score, won: end === 'win', turns: turn, foe: vil.name });
        later(() => {
          if (id !== matchId.current) return;
          setVilIdx(v => (v + 1 + Math.floor(Math.random() * (VILLAINS.length - 1))) % VILLAINS.length);
          setStatus('over');
        }, 900);
      }, 450);
    }, 550);
  };

  const bar = (cur: number, max: number, color: string, h = 'h-5') => (
    <div className={`w-full bg-black/40 rounded-full ${h} overflow-hidden`}>
      <motion.div className={`${h} rounded-full bg-gradient-to-r ${color}`}
        animate={{ width: `${Math.max(0, (cur / max) * 100)}%` }} transition={{ duration: 0.35 }} />
    </div>
  );

  const fighterCard = (s: Stats, f: Fighter, side: 'player' | 'cpu') => (
    <motion.div
      animate={hitAnim === side ? { x: [-10, 10, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`flex-1 rounded-3xl bg-black/30 border-2 p-3 md:p-4 ${side === 'player' ? 'border-sky-400/50' : 'border-rose-400/50'}`}
    >
      <div className={`flex items-center gap-3 mb-2 ${side === 'cpu' ? 'flex-row-reverse text-right' : ''}`}>
        <motion.span className="text-5xl md:text-6xl" animate={hitAnim === side ? { rotate: [0, -15, 10, 0] } : {}}>{s.emoji}</motion.span>
        <div className="min-w-0">
          <p className="font-fredoka text-xl md:text-2xl">{s.name}</p>
          <p className="font-nunito text-lg text-violet-100 tabular-nums">❤️ {f.hp}/{f.maxHp}</p>
        </div>
      </div>
      {bar(f.hp, f.maxHp, side === 'player' ? 'from-sky-400 to-cyan-300' : 'from-rose-400 to-orange-300')}
      <p className={`font-nunito text-base text-yellow-200 mt-2 ${side === 'cpu' ? 'text-right' : ''}`}>⚡ Energy {f.energy}</p>
      {bar(f.energy, 100, 'from-yellow-300 to-orange-400', 'h-3')}
    </motion.div>
  );

  return (
    <GameShell
      gameId="battle_arena"
      title="Battle Arena"
      icon="⚔️"
      xpScale={12}
      status={status}
      score={result.score}
      round={round}
      overTitle={result.won ? `${hero.name} wins!` : 'Knocked out — so close!'}
      overStats={[
        { label: 'Result', value: result.won ? '🏆 Win' : '💪 Try again' },
        { label: 'HP left', value: result.won ? `❤️ ${result.score / 10}` : '0' },
        { label: 'Turns', value: String(result.turns) },
        { label: 'Next opponent', value: `${vil.emoji} ${vil.name}` },
      ]}
      startLabel="⚔️ Fight!"
      onStart={() => { if (status === 'over') setStatus('ready'); else startFight(); }}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div>
          <p className="font-fredoka text-xl mb-2">Choose your hero!</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {HEROES.map((h, i) => (
              <button key={h.id} onClick={() => { playClick(); setHeroIdx(i); }}
                className={`bg-gradient-to-br ${h.color} rounded-2xl p-2 border-4 ${heroIdx === i ? 'border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.6)]' : 'border-transparent'}`}>
                <div className="text-4xl">{h.emoji}</div>
                <div className="font-fredoka text-xl">{h.name}</div>
                <div className="font-nunito text-sm">{h.spec}</div>
                <div className="font-nunito text-sm opacity-90">⚔️{h.atk} 🛡️{h.def} ❤️{h.maxHp}</div>
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-white/10 p-2 font-fredoka text-lg">
            Opponent: {vil.emoji} {vil.name} <span className="font-nunito text-base text-violet-200">⚔️{vil.atk} 🛡️{vil.def} ❤️{vil.maxHp}</span>
          </div>
          <p className="font-nunito text-base text-violet-200 mt-2">Win with lots of ❤️ left for a big score!</p>
        </div>
      }
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 md:p-6">
        <div className="w-full max-w-3xl flex flex-col gap-3 md:gap-4">
          <div className="flex gap-3 items-stretch">
            {fighterCard(hero, status === 'ready' ? newFighter(hero) : player, 'player')}
            <div className="self-center font-fredoka text-2xl text-fuchsia-300">VS</div>
            {fighterCard(vil, status === 'ready' ? newFighter(vil) : cpu, 'cpu')}
          </div>

          <div className="rounded-3xl bg-black/40 border border-white/10 p-3 min-h-[148px] flex flex-col justify-end">
            <AnimatePresence initial={false}>
              {log.map(line => (
                <motion.p key={line.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  className={`font-nunito text-lg leading-snug ${line.who === 'you' ? 'text-sky-200' : line.who === 'bot' ? 'text-rose-200' : 'text-yellow-200 font-bold'}`}>
                  {line.text}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(MOVES) as Move[]).map(move => {
              const info = MOVES[move];
              const locked = move === 'special' && !canSpecial(player);
              const disabled = busy || locked || status !== 'playing';
              return (
                <motion.button key={move} whileTap={{ scale: 0.94 }} onClick={() => execMove(move)} disabled={disabled}
                  className={`min-h-[84px] bg-gradient-to-r ${info.color} rounded-3xl px-3 flex items-center gap-3 shadow-lg ${disabled ? 'opacity-40' : ''}`}>
                  <span className="text-4xl">{info.emoji}</span>
                  <span className="text-left">
                    <span className="block font-fredoka text-xl md:text-2xl leading-tight">{info.label}</span>
                    <span className="block font-nunito text-base opacity-90">
                      {move === 'special' && locked ? `⚡ ${player.energy}/${SPECIAL_COST}` : info.desc}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p className="text-center font-nunito text-base text-violet-200">Turn {turn}</p>
        </div>
      </div>
    </GameShell>
  );
}
