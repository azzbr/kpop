import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import { playClick, playCorrect, playWin, playPop, playTimeOut, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { PlayerChips } from './games/partyNames';
import { AVATARS } from './games/partyNamesLogic';
import {
  actStars, actAverage, cheerFor, dealIdeas, judgesFor, showAwards, showScore,
  MAX_PLAYERS, MIN_PLAYERS, PERFORM_SECS, STAR_LABELS, TOP_AWARD,
} from './games/talentShowLogic';
import type { Act } from './games/talentShowLogic';

type Phase = 'setup' | 'idea' | 'perform' | 'judge' | 'result' | 'awards';

const OWN_IDEA = '✨ My own secret talent';
const rng = () => createRng((Date.now() + Math.floor(Math.random() * 1e6)) % 1e9);

export default function TalentShow() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [show, setShow] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [talent, setTalent] = useState('');
  const [timer, setTimer] = useState(PERFORM_SECS);
  const [running, setRunning] = useState(false);
  const [judgeN, setJudgeN] = useState(0);
  const [stars, setStars] = useState<number[]>([]);
  const [chosen, setChosen] = useState(0);
  const [acts, setActs] = useState<Act[]>([]);
  const [cheer, setCheer] = useState('');

  const judges = judgesFor(players, turn);
  const performer = players[turn];
  const lastAct = acts[acts.length - 1];

  // Pause when she switches apps.
  useEffect(() => {
    const onVis = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Performance timer
  useEffect(() => {
    if (!running || status !== 'playing' || phase !== 'perform') return;
    if (timer <= 0) { playTimeOut(); setRunning(false); return; }
    if (timer <= 5) playTick();
    const t = window.setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, running, status, phase]);

  const start = () => {
    setActs([]);
    setTurn(0);
    setPhase('setup');
    setShow(s => s + 1);
    setStatus('playing');
  };

  const toIdea = (t: number) => {
    setTurn(t);
    setIdeas(dealIdeas(rng()));
    setTalent('');
    setPhase('idea');
  };

  const toPerform = () => {
    playClick();
    setTimer(PERFORM_SECS);
    setRunning(false);
    setPhase('perform');
  };

  const toJudging = () => {
    playClick();
    setRunning(false);
    setJudgeN(0);
    setStars([]);
    setChosen(0);
    setPhase('judge');
  };

  const giveStars = () => {
    if (!chosen) return;
    const all = [...stars, chosen];
    if (judgeN + 1 < judges.length) {
      playClick();
      setStars(all);
      setJudgeN(judgeN + 1);
      setChosen(0);
      return;
    }
    const act: Act = { performer, talent, stars: all };
    setActs(a => [...a, act]);
    setCheer(cheerFor(actAverage(act), rng()));
    playWin();
    setPhase('result');
  };

  const next = () => {
    playClick();
    if (turn + 1 < players.length) toIdea(turn + 1);
    else { playWin(); setPhase('awards'); }
  };

  const awards = showAwards(acts);
  const avatar = (name: string) => AVATARS[Math.max(0, players.indexOf(name)) % AVATARS.length];

  return (
    <GameShell
      celebrateEnd
      gameId="talent_show"
      title="Talent Show"
      icon="🎭"
      xpScale={1}
      status={status}
      score={showScore(acts)}
      round={show}
      formatScore={s => `${s} ⭐`}
      overTitle="What a show! 🎉"
      overStats={[
        { label: '🎤 Acts', value: `${acts.length}` },
        { label: '🏆 Star of the Show', value: awards.filter(a => a.award === TOP_AWARD).map(a => a.performer).join(' & ') || '—' },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-2 font-nunito text-lg text-violet-100">
          <p>Everyone takes a turn on stage! 🎤</p>
          <p>Pick a fun talent, perform for up to {PERFORM_SECS} seconds, then the other players give ⭐ stars.</p>
          <p>Everyone wins an award at the end! 🏆</p>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {(phase === 'result' && lastAct && actAverage(lastAct) >= 3) && <ConfettiBurst count={50} durationMs={2500} />}
        {phase === 'awards' && <ConfettiBurst count={90} durationMs={3500} />}
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {phase !== 'setup' && phase !== 'awards' && (
            <div className="flex justify-between items-center font-fredoka text-lg">
              <span className="rounded-full bg-white/10 px-3 py-1">🎭 Act {turn + 1}/{players.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{avatar(performer)} {performer}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {phase === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <h2 className="font-fredoka text-3xl text-center">Who's in the show? 🎤</h2>
                <PlayerChips players={players} onChange={setPlayers} min={MIN_PLAYERS} max={MAX_PLAYERS} />
                <button type="button" disabled={players.length < MIN_PLAYERS} onClick={() => { playClick(); toIdea(0); }}
                  className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg disabled:opacity-40">
                  {players.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - players.length} more 👆` : `🎬 Start the show! (${players.length} stars)`}
                </button>
              </motion.div>
            )}

            {phase === 'idea' && (
              <motion.div key={`idea-${turn}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/60 p-5 flex flex-col gap-3">
                <div className="text-center text-6xl">{avatar(performer)}</div>
                <h2 className="font-fredoka text-3xl text-center">Up next: {performer}! 🌟</h2>
                <p className="font-nunito text-lg text-violet-200 text-center">Pick your talent:</p>
                <div className="flex flex-col gap-2">
                  {[...ideas, OWN_IDEA].map(idea => (
                    <button key={idea} type="button" onClick={() => { playPop(); setTalent(idea); }}
                      className={`min-h-[56px] rounded-2xl px-4 py-2 font-fredoka text-lg text-left ${talent === idea ? 'bg-fuchsia-500 ring-4 ring-yellow-300' : 'bg-white/10'}`}>
                      {idea}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { playPop(); setIdeas(dealIdeas(rng())); setTalent(''); }}
                    className="min-h-[56px] rounded-full bg-white/15 font-fredoka text-xl">🎲 New ideas</button>
                  <button type="button" disabled={!talent} onClick={toPerform}
                    className="min-h-[56px] rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-fredoka text-xl disabled:opacity-40">
                    🎤 I'm ready!
                  </button>
                </div>
              </motion.div>
            )}

            {phase === 'perform' && (
              <motion.div key={`perform-${turn}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 p-6 text-center flex flex-col gap-3 shadow-2xl">
                <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-6xl">🎤</motion.div>
                <h2 className="font-fredoka text-4xl">{performer}</h2>
                <p className="font-fredoka text-2xl text-yellow-200">{talent}</p>
                <div className={`font-fredoka text-8xl tabular-nums ${timer <= 5 && running ? 'text-amber-300' : ''}`}>{timer}</div>
                <div className="h-4 rounded-full bg-white/20 overflow-hidden">
                  <motion.div className="h-full bg-white rounded-full" animate={{ width: `${(timer / PERFORM_SECS) * 100}%` }} transition={{ duration: 0.5 }} />
                </div>
                {!running && timer === PERFORM_SECS ? (
                  <button type="button" onClick={() => { playCorrect(); setRunning(true); }}
                    className="min-h-[60px] rounded-full bg-white text-indigo-700 font-fredoka text-2xl shadow-lg">▶ Start performing!</button>
                ) : (
                  <p className="font-fredoka text-xl">{timer > 0 ? '🎵 The stage is yours!' : '🎬 Time! Take a bow! 🙇'}</p>
                )}
                <button type="button" onClick={toJudging}
                  className="min-h-[56px] rounded-full bg-black/30 border-2 border-white/40 font-fredoka text-xl">
                  ✅ Done — time for stars!
                </button>
              </motion.div>
            )}

            {phase === 'judge' && (
              <motion.div key={`judge-${turn}-${judgeN}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-yellow-300/70 p-5 flex flex-col gap-4 text-center">
                <div className="text-5xl">{avatar(players[judges[judgeN]])}</div>
                <h2 className="font-fredoka text-3xl">{players[judges[judgeN]]}, how many stars for {performer}?</h2>
                <p className="font-nunito text-lg text-violet-200">Judge {judgeN + 1} of {judges.length} · Pick your stars ⭐</p>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => { playPop(); setChosen(n); }} aria-label={`${n} stars`}
                      className={`min-h-[80px] rounded-2xl flex flex-col items-center justify-center gap-1 font-fredoka transition-transform
                        ${chosen >= n ? 'bg-yellow-400 text-indigo-950 scale-105' : 'bg-white/10'}`}>
                      <span className="text-3xl">⭐</span>
                      <span className="text-lg">{n}</span>
                    </button>
                  ))}
                </div>
                <div className="min-h-[44px] font-fredoka text-3xl text-yellow-300">{chosen ? STAR_LABELS[chosen] : ''}</div>
                <button type="button" disabled={!chosen} onClick={giveStars}
                  className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg disabled:opacity-40">
                  {judgeN + 1 < judges.length ? 'Next judge ➡️' : '🌟 Show the stars!'}
                </button>
              </motion.div>
            )}

            {phase === 'result' && lastAct && (
              <motion.div key={`result-${turn}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-yellow-300/70 p-5 flex flex-col gap-3 text-center">
                <motion.div animate={{ rotate: [-6, 6, -6, 0], scale: [1, 1.12, 1] }} transition={{ duration: 0.7 }} className="text-7xl">🌟</motion.div>
                <h2 className="font-fredoka text-4xl">{cheer}</h2>
                <p className="font-fredoka text-2xl text-yellow-300">{lastAct.performer} collected {actStars(lastAct)} ⭐</p>
                <p className="font-nunito text-lg text-violet-200">"{lastAct.talent}"</p>
                <div className="flex flex-col gap-2">
                  {lastAct.stars.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.2 }}
                      className="rounded-2xl bg-white/10 px-4 py-2 flex items-center justify-between gap-2 font-fredoka text-lg">
                      <span className="truncate">{avatar(players[judges[i]])} {players[judges[i]]}</span>
                      <span>{STAR_LABELS[s]}</span>
                      <span className="shrink-0">{'⭐'.repeat(s)}</span>
                    </motion.div>
                  ))}
                </div>
                <button type="button" onClick={next}
                  className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  {turn + 1 < players.length ? `🎤 Next: ${players[turn + 1]}` : '🏆 Awards time!'}
                </button>
              </motion.div>
            )}

            {phase === 'awards' && (
              <motion.div key="awards" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/60 p-5 flex flex-col gap-3 text-center">
                <h2 className="font-fredoka text-4xl">🏆 Award ceremony!</h2>
                <p className="font-nunito text-lg text-violet-200">Every performer was a star tonight!</p>
                {awards.map((a, i) => (
                  <motion.div key={a.performer} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }}
                    className={`rounded-2xl px-4 py-3 flex items-center gap-3 text-left ${a.award === TOP_AWARD ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-indigo-950' : 'bg-white/10'}`}>
                    <span className="text-4xl">{avatar(a.performer)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-fredoka text-2xl truncate">{a.performer}</div>
                      <div className="font-fredoka text-lg">{a.award}</div>
                    </div>
                    <span className="font-fredoka text-xl shrink-0">{actStars(acts[i])} ⭐</span>
                  </motion.div>
                ))}
                <button type="button" onClick={() => { playClick(); setStatus('over'); }}
                  className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  🎉 Finish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GameShell>
  );
}
