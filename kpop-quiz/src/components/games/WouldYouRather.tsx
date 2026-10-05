import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { WOULD_YOU_RATHER, WYR_REACTIONS } from '../../data/wouldYouRather';
import type { WyrQuestion } from '../../data/wouldYouRather';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import { playClick, playCorrect, playPop, playWin } from '../../utils/sounds';
import { drawFresh } from './drawLogic';
import { ROUND_SIZE, MIN_PLAYERS, MAX_PLAYERS, MAX_NAME, withMajority, pctFor, partySummary, cleanName } from './wouldYouRatherLogic';
import type { Pick } from './wouldYouRatherLogic';

type Phase = 'setup' | 'pass' | 'pick' | 'reveal' | 'summary';

const AVATARS = ['🦊', '🐼', '🦄', '🐯', '🐸', '🐙'];
const QUICK_NAMES = ['Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Sam', 'Lily', 'Noah'];

// Questions seen earlier this session, so a new round brings new ones.
const seenQuestions = new Set<number>();

function Bar({ label, emoji, pct, mine, tone }: { label: string; emoji: string; pct: number; mine: boolean; tone: string }) {
  return (
    <div>
      <div className="flex justify-between font-fredoka text-lg mb-1 gap-2">
        <span className="min-w-0 truncate">{emoji} {label} {mine && '👈'}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-8 rounded-full bg-white/10 overflow-hidden">
        <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

export default function WouldYouRather() {
  const [party, setParty] = useState(false);
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [qs, setQs] = useState<WyrQuestion[]>([]);
  const [n, setN] = useState(0);
  const [phase, setPhase] = useState<Phase>('pick');
  const [players, setPlayers] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const [picks, setPicks] = useState<Pick[][]>([]); // picks[question][player]; solo uses player 0
  const [agree, setAgree] = useState(0);
  const [reaction, setReaction] = useState('');
  const [isParty, setIsParty] = useState(false);

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    setQs(drawFresh(WOULD_YOU_RATHER.length, ROUND_SIZE, seenQuestions, rng).map(i => WOULD_YOU_RATHER[i]));
    setN(0);
    setTurn(0);
    setPicks([]);
    setAgree(0);
    setIsParty(party);
    setPhase(party ? 'setup' : 'pick');
    setRound(r => r + 1);
    setStatus('playing');
  };

  const q = qs[n];
  const roster = isParty ? players : ['You'];

  const addName = useCallback((raw: string) => {
    const name = cleanName(raw);
    if (!name) { setNameMsg('Type a name first ✏️'); return; }
    if (players.length >= MAX_PLAYERS) { setNameMsg(`${MAX_PLAYERS} players max!`); return; }
    if (players.some(p => p.toLowerCase() === name.toLowerCase())) { setNameMsg(`${name} is already playing!`); return; }
    playPop();
    setPlayers(ps => [...ps, name]);
    setTyped('');
    setNameMsg(null);
  }, [players]);

  const onKey = useCallback((l: string) => setTyped(t => (t.length < MAX_NAME ? t + l : t)), []);
  const onBackspace = useCallback(() => setTyped(t => t.slice(0, -1)), []);
  const onEnter = useCallback(() => addName(typed), [addName, typed]);

  const choose = (p: Pick) => {
    if (status !== 'playing' || phase !== 'pick' || !q) return;
    playClick();
    const row = [...(picks[n] ?? [])];
    row[turn] = p;
    const all = [...picks];
    all[n] = row;
    setPicks(all);
    if (isParty && turn + 1 < roster.length) {
      setTurn(turn + 1);
      setPhase('pass');
      return;
    }
    if (!isParty && withMajority(q, p)) setAgree(a => a + 1);
    playCorrect();
    setReaction(WYR_REACTIONS[Math.floor(Math.random() * WYR_REACTIONS.length)]);
    setPhase('reveal');
  };

  const next = () => {
    playClick();
    if (n + 1 >= qs.length) {
      if (isParty) { playWin(); setPhase('summary'); } else setStatus('over');
      return;
    }
    setN(n + 1);
    setTurn(0);
    setPhase(isParty ? 'pass' : 'pick');
  };

  const summary = isParty && players.length ? partySummary(players, qs.slice(0, picks.length), picks) : null;
  const myPick = picks[n]?.[0];

  const half = (p: Pick) => {
    if (!q) return null;
    const text = p === 'a' ? q.a : q.b;
    const emoji = p === 'a' ? q.emojiA : q.emojiB;
    return (
      <motion.button key={`${n}-${turn}-${p}`} onClick={() => choose(p)} whileTap={{ scale: 0.96 }}
        initial={{ opacity: 0, x: p === 'a' ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}
        className={`min-h-[200px] rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-xl text-white
          ${p === 'a' ? 'bg-gradient-to-br from-sky-500 to-indigo-600' : 'bg-gradient-to-br from-orange-400 to-pink-600'}`}>
        <span className="text-7xl">{emoji}</span>
        <span className="font-fredoka text-2xl md:text-3xl leading-tight text-center">{text}</span>
      </motion.button>
    );
  };

  const overStats = isParty && summary
    ? [
      { label: '🤝 Most like the crowd', value: summary.crowd.join(' & ') },
      { label: '🦄 Most unique', value: summary.unique.length ? summary.unique.join(' & ') : 'Everyone tied!' },
    ]
    : [
      { label: '🤝 With the crowd', value: `${agree}/${qs.length}` },
      { label: '🦄 Your own way', value: `${qs.length - agree}/${qs.length}` },
    ];

  return (
    <GameShell
      celebrateEnd={isParty}
      gameId="would_you_rather"
      title="Would You Rather"
      icon="🤷"
      xpScale={0.25}
      status={status}
      score={isParty ? ROUND_SIZE : agree}
      round={round}
      formatScore={s => `${s}`}
      overTitle={isParty ? 'What a party! 🎉' : agree >= 7 ? 'You think like the crowd! 🤝' : agree <= 3 ? 'You are one of a kind! 🦄' : 'A bit of both! 😄'}
      overStats={overStats}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3 text-left">
          <p className="font-nunito text-lg text-violet-100 text-center">Pick one of two silly choices, then see what everyone else picked! {ROUND_SIZE} questions.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setParty(false)} className={`min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg text-left ${!party ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
              <div>🙋 Solo</div>
              <div className="font-nunito text-sm opacity-80">Do you think like the crowd?</div>
            </button>
            <button onClick={() => setParty(true)} className={`min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg text-left ${party ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
              <div>📱 Pass the iPad</div>
              <div className="font-nunito text-sm opacity-80">2–6 players take turns</div>
            </button>
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {phase === 'summary' && <ConfettiBurst count={70} durationMs={3000} />}
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {phase !== 'setup' && phase !== 'summary' && q && (
            <div className="flex justify-between items-center font-fredoka text-lg">
              <span className="rounded-full bg-white/10 px-3 py-1">🤔 {n + 1}/{qs.length}</span>
              {!isParty && <span className="rounded-full bg-white/10 px-3 py-1">🤝 {agree}</span>}
              {isParty && <span className="rounded-full bg-white/10 px-3 py-1">{AVATARS[turn]} {roster[turn]}</span>}
            </div>
          )}

          <AnimatePresence mode="wait">
            {phase === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <h2 className="font-fredoka text-3xl text-center">Who's playing? 👯</h2>
                <div className="flex flex-wrap gap-2 justify-center min-h-[52px]">
                  {players.length === 0 && <p className="font-nunito text-lg text-violet-200 self-center">Add 2 to 6 players</p>}
                  {players.map((p, i) => (
                    <button key={p} onClick={() => { playClick(); setPlayers(ps => ps.filter(x => x !== p)); }}
                      className="min-h-[48px] rounded-full bg-white/15 pl-3 pr-2 font-fredoka text-lg flex items-center gap-2" aria-label={`Remove ${p}`}>
                      {AVATARS[i]} {p} <span className="rounded-full bg-white/20 w-8 h-8 flex items-center justify-center">✕</span>
                    </button>
                  ))}
                </div>
                {players.length < MAX_PLAYERS && (
                  <>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {QUICK_NAMES.filter(nm => !players.includes(nm)).map(nm => (
                        <button key={nm} onClick={() => addName(nm)} className="min-h-[44px] px-4 rounded-full bg-indigo-500/60 font-fredoka text-base">+ {nm}</button>
                      ))}
                    </div>
                    <div className="min-h-[56px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 flex items-center justify-center font-fredoka text-2xl">
                      {typed || <span className="text-white/40 font-nunito text-lg">…or type a name</span>}
                    </div>
                    <div className="min-h-[24px] text-center font-nunito text-base text-yellow-200">{nameMsg}</div>
                    <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Add" disabled={status !== 'playing'} />
                  </>
                )}
                <button disabled={players.length < MIN_PLAYERS} onClick={() => { playClick(); setTurn(0); setPhase('pass'); }}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg disabled:opacity-40">
                  {players.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - players.length} more 👆` : `▶ Start with ${players.length} players`}
                </button>
              </motion.div>
            )}

            {phase === 'pass' && (
              <motion.div key={`pass-${n}-${turn}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/60 p-8 text-center flex flex-col items-center gap-4">
                <div className="text-7xl">{AVATARS[turn]}</div>
                <h2 className="font-fredoka text-4xl">Pass to {roster[turn]} 👉</h2>
                <p className="font-nunito text-lg text-violet-200">No peeking, everyone else! 🙈</p>
                <button onClick={() => { playClick(); setPhase('pick'); }}
                  className="w-full max-w-sm min-h-[56px] rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-fredoka text-2xl">
                  I'm {roster[turn]} — ready!
                </button>
              </motion.div>
            )}

            {phase === 'pick' && q && (
              <motion.div key={`pick-${n}-${turn}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <h2 className="font-fredoka text-3xl text-center">{isParty ? `${roster[turn]}, would you rather…` : 'Would you rather…'}</h2>
                <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {half('a')}
                  {half('b')}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-white text-slate-900 font-fredoka text-2xl w-16 h-16 flex items-center justify-center shadow-xl">OR</span>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 'reveal' && q && (
              <motion.div key={`rev-${n}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-white/20 p-5 flex flex-col gap-4">
                <div className="text-center font-fredoka text-3xl">{reaction}</div>
                {!isParty && myPick && (
                  <div className={`text-center font-fredoka text-xl rounded-2xl py-2 ${withMajority(q, myPick) ? 'bg-green-600' : 'bg-fuchsia-600'}`}>
                    {withMajority(q, myPick) ? `🤝 You're with the crowd — ${pctFor(q, myPick)}% agree!` : `🦄 Only ${pctFor(q, myPick)}% picked that — a true original!`}
                  </div>
                )}
                <Bar label={q.a} emoji={q.emojiA} pct={q.aPct} mine={!isParty && myPick === 'a'} tone="bg-sky-400" />
                <Bar label={q.b} emoji={q.emojiB} pct={100 - q.aPct} mine={!isParty && myPick === 'b'} tone="bg-orange-400" />
                {isParty && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {roster.map((p, i) => {
                      const pk = picks[n]?.[i];
                      return (
                        <motion.div key={p} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.12 }}
                          className={`rounded-2xl p-2 text-center ${pk === 'a' ? 'bg-sky-600' : 'bg-orange-500'}`}>
                          <div className="font-fredoka text-lg">{AVATARS[i]} {p}</div>
                          <div className="text-3xl">{pk === 'a' ? q.emojiA : q.emojiB}</div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                <p className="text-center font-nunito text-sm text-violet-300">Crowd numbers are just for fun 🎈</p>
                <button onClick={next} className="min-h-[56px] rounded-full bg-white text-slate-900 font-fredoka text-2xl shadow-lg active:scale-95 transition-transform">
                  {n + 1 >= qs.length ? '🏁 Finish' : 'Next ➡️'}
                </button>
              </motion.div>
            )}

            {phase === 'summary' && summary && (
              <motion.div key="summary" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/60 p-5 flex flex-col gap-3 text-center">
                <h2 className="font-fredoka text-3xl">Party results! 🎊</h2>
                <div className="rounded-2xl bg-green-600 p-3">
                  <div className="font-fredoka text-xl">🤝 Most like the crowd</div>
                  <div className="font-fredoka text-2xl">{summary.crowd.join(' & ')}</div>
                </div>
                <div className="rounded-2xl bg-fuchsia-600 p-3">
                  <div className="font-fredoka text-xl">🦄 Most unique</div>
                  <div className="font-fredoka text-2xl">{summary.unique.length ? summary.unique.join(' & ') : 'Everyone tied — great minds! 🧠'}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {players.map((p, i) => (
                    <div key={p} className="rounded-xl bg-white/10 py-2 font-fredoka text-lg">
                      {AVATARS[i]} {p}<div className="font-nunito text-base text-violet-200">🤝 {summary.agree[p]}/{picks.length}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { playClick(); setStatus('over'); }}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
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
