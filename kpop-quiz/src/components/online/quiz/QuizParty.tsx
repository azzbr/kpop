import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../../online/useRoom';
import { useGameStore } from '../../../store';
import type { RoundResult } from '../../../store';
import { useQuizParty } from '../../../online/quiz/useQuizParty';
import type { QuizSnapshot, QuizSettings } from '../../../online/quiz/useQuizParty';
import { quizSources, pickFrom } from '../../../online/quiz/sources';
import {
  rankPlayers, teamResults, modeScore, MODE_XP_SCALE, TEAMS, UPGRADES, upgradeCost, cashEarn,
} from '../../../online/quiz/quizLogic';
import type { QuizMode, QPlayer, UpgradeKind } from '../../../online/quiz/quizLogic';
import { createRng } from '../../../games/engine/rng';
import AnswerPad from '../../quiz/AnswerPad';
import { TILE_STYLES } from '../../quiz/tileStyles';
import ConfettiBurst from '../../ConfettiBurst';
import { playClick, playCorrect, playWrong, playWin, playTick, playCoin, startQuizMusic } from '../../../utils/sounds';

const MODES: { id: QuizMode; name: string; emoji: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', emoji: '🏆', blurb: 'Fast answers score more. Keep a streak going!' },
  { id: 'gold', name: 'Gold Quest', emoji: '🪙', blurb: 'Right answers open treasure chests — gold, double… or steal!' },
  { id: 'racing', name: 'Racing', emoji: '🏎️', blurb: 'Every right answer moves your car. First to the flag wins!' },
  { id: 'cash', name: 'Cash Climb', emoji: '💵', blurb: 'Earn money and buy upgrades between questions.' },
];

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
const scoreLabel = (mode: QuizMode, p: QPlayer, goal: number) =>
  mode === 'gold' ? `${p.gold.toLocaleString()} 🪙` : mode === 'cash' ? fmtMoney(p.cash) : mode === 'racing' ? `${p.pos}/${goal}` : p.score.toLocaleString();

/** Seconds left, redrawn 4×/s. Uses this device's clock against the host's end time. */
function useSecondsLeft(endsAt: number, active: boolean) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, active]);
  return left;
}

export default function QuizParty({ room }: { room: RoomApi }) {
  const qp = useQuizParty(room);
  const { snap } = qp;
  const me = snap?.players.find(p => p.id === room.myId);
  const bigScreen = room.isHost && snap && !snap.settings.hostPlays;
  const setIsPlaying = useGameStore(s => s.setIsPlaying);

  // Quiz music while a question is open; background music pauses for the whole game.
  const secs = useSecondsLeft(snap?.endsAt ?? 0, !!snap && (snap.phase === 'question' || snap.phase === 'countdown'));
  const secsRef = useRef(secs);
  secsRef.current = secs;
  useEffect(() => {
    const wasPlaying = useGameStore.getState().isPlaying;
    setIsPlaying(false);
    return () => { if (wasPlaying) setIsPlaying(true); };
  }, [setIsPlaying]);
  useEffect(() => {
    if (snap?.phase !== 'question') return;
    return startQuizMusic(() => secsRef.current <= 5);
  }, [snap?.phase, snap?.n]);
  useEffect(() => { if (snap?.phase === 'countdown' && secs > 0) playTick(); }, [secs, snap?.phase]);

  // Reveal sounds for players.
  useEffect(() => {
    if (snap?.phase !== 'reveal' || !me) return;
    if (me.lastCorrect === true) playCorrect(); else if (me.lastCorrect === false) playWrong();
  }, [snap?.phase, snap?.n, me?.lastCorrect]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!snap) {
    return room.isHost ? <Setup onStart={qp.start} room={room} /> : <Waiting text="The host is setting up the quiz…" />;
  }

  return (
    <div className="arcade-bg min-h-screen-d text-white px-3 py-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <TopBar snap={snap} secs={secs} />
        {snap.phase === 'countdown' && <Countdown snap={snap} secs={secs} />}
        {snap.phase === 'question' && (
          bigScreen
            ? <BigQuestion snap={snap} secs={secs} onRevealNow={qp.revealNow} />
            : <PlayerQuestion snap={snap} me={me} onAnswer={qp.answer} secs={secs} />
        )}
        {snap.phase === 'reveal' && (
          <>
            {bigScreen ? <BigReveal snap={snap} /> : <PlayerReveal snap={snap} me={me} myId={room.myId} onChest={qp.pickChest} onTarget={qp.pickTarget} onBuy={qp.buy} />}
            {room.isHost && (
              <div className="flex justify-center mt-4">
                <button onClick={() => { playClick(); qp.next(); }}
                  className="min-h-[56px] px-10 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  {snap.n >= snap.total || (snap.settings.mode === 'racing' && snap.players.some(p => p.finishedAt)) ? '🏁 Results' : 'Next ▶'}
                </button>
              </div>
            )}
          </>
        )}
        {snap.phase === 'question' && room.isHost && !bigScreen && (
          <div className="flex justify-center mt-3">
            <button onClick={qp.revealNow} className="min-h-[44px] px-5 rounded-full bg-white/15 font-fredoka">⏭ Reveal now (host)</button>
          </div>
        )}
        {snap.phase === 'podium' && <Podium snap={snap} myId={room.myId} isHost={room.isHost} onAgain={qp.backToSetup} onLobby={() => room.send({ t: 'to_lobby' })} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ setup (host)

function Setup({ onStart, room }: { onStart: (qs: ReturnType<typeof pickFrom>, s: QuizSettings) => void; room: RoomApi }) {
  const myQuizzes = useGameStore(s => s.myQuizzes);
  const sources = useMemo(() => quizSources(myQuizzes), [myQuizzes]);
  const [sourceId, setSourceId] = useState(sources[0].id);
  const [mode, setMode] = useState<QuizMode>('classic');
  const [count, setCount] = useState(10);
  const [secs, setSecs] = useState(20);
  const [teams, setTeams] = useState(0);
  const [hostPlays, setHostPlays] = useState(false);
  const source = sources.find(s => s.id === sourceId) ?? sources[0];
  const players = room.players.length - (hostPlays ? 0 : 1);
  const groups = ['Topics', 'My quizzes', 'School', 'Music'] as const;

  const go = () => {
    playClick();
    const qs = pickFrom(source, count, createRng(Date.now() % 1e9));
    onStart(qs, { mode, secs, teams, hostPlays, sourceTitle: `${source.emoji} ${source.title}` });
  };

  const chip = (active: boolean) => `min-h-[48px] px-4 rounded-xl font-fredoka text-base ${active ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white'}`;

  return (
    <div className="arcade-bg min-h-screen-d text-white px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { playClick(); room.send({ t: 'to_lobby' }); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Lobby</button>
          <h1 className="font-fredoka text-4xl flex-1 text-center pr-20">🎉 Quiz Party</h1>
        </div>

        <section>
          <h2 className="font-fredoka text-xl mb-2">Who's the host?</h2>
          <div className="grid grid-cols-2 gap-2">
            <button className={chip(!hostPlays)} onClick={() => setHostPlays(false)}>📺 Big screen (I just run it)</button>
            <button className={chip(hostPlays)} onClick={() => setHostPlays(true)}>🙋 I'm playing too</button>
          </div>
        </section>

        <section>
          <h2 className="font-fredoka text-xl mb-2">Game mode</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} className={`text-left rounded-2xl p-3 min-h-[72px] ${mode === m.id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                <div className="font-fredoka text-xl">{m.emoji} {m.name}</div>
                <div className="font-nunito text-base text-violet-100">{m.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-fredoka text-xl mb-2">Questions</h2>
          {groups.map(g => {
            const list = sources.filter(s => s.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mb-2">
                <div className="font-nunito text-sm text-violet-300 mb-1">{g}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map(s => (
                    <button key={s.id} className={chip(sourceId === s.id)} onClick={() => setSourceId(s.id)}>
                      {s.emoji} {s.title} <span className="opacity-60">({s.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid sm:grid-cols-3 gap-4">
          <div>
            <h2 className="font-fredoka text-lg mb-1">How many?</h2>
            <div className="flex gap-2">{[5, 10, 15, 20].map(n => <button key={n} className={chip(count === n)} onClick={() => setCount(n)}>{n}</button>)}</div>
          </div>
          <div>
            <h2 className="font-fredoka text-lg mb-1">Seconds each</h2>
            <div className="flex gap-2">{[10, 20, 30].map(n => <button key={n} className={chip(secs === n)} onClick={() => setSecs(n)}>{n}</button>)}</div>
          </div>
          <div>
            <h2 className="font-fredoka text-lg mb-1">Teams</h2>
            <div className="flex gap-2">{[0, 2, 3, 4].map(n => <button key={n} className={chip(teams === n)} onClick={() => setTeams(n)}>{n === 0 ? 'Off' : n}</button>)}</div>
          </div>
        </section>

        <button onClick={go} disabled={players < 1 || source.count === 0}
          className="w-full min-h-[64px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-3xl shadow-xl disabled:opacity-40">
          ▶ Start ({Math.max(0, players)} {players === 1 ? 'player' : 'players'})
        </button>
        {players < 1 && <p className="text-center font-nunito text-violet-200">Waiting for someone to join with code <b>{room.code}</b>…</p>}
      </div>
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="arcade-bg min-h-screen-d flex flex-col items-center justify-center text-white text-center px-6">
      <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-7xl mb-4">🎉</motion.div>
      <p className="font-fredoka text-2xl">{text}</p>
      <p className="font-nunito text-violet-200 mt-2">Eyes on the big screen!</p>
    </div>
  );
}

// ------------------------------------------------------------------ shared bits

function TopBar({ snap, secs }: { snap: QuizSnapshot; secs: number }) {
  const mode = MODES.find(m => m.id === snap.settings.mode)!;
  return (
    <div className="flex items-center justify-between font-fredoka text-lg mb-3 gap-2">
      <span className="rounded-full bg-white/10 px-3 py-1 truncate">{mode.emoji} {mode.name} · {snap.settings.sourceTitle}</span>
      {snap.phase !== 'podium' && <span className="rounded-full bg-white/10 px-3 py-1 shrink-0">Q {snap.n}/{snap.total}</span>}
      {snap.phase === 'question' && (
        <span className={`rounded-full px-3 py-1 shrink-0 ${secs <= 5 ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>⏱️ {secs}</span>
      )}
    </div>
  );
}

function Countdown({ snap, secs }: { snap: QuizSnapshot; secs: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-fredoka text-2xl text-violet-200 mb-2">Question {snap.n} of {snap.total}</p>
      <AnimatePresence mode="wait">
        <motion.div key={secs} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
          className="font-fredoka text-9xl text-yellow-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
          {secs > 0 ? secs : 'GO!'}
        </motion.div>
      </AnimatePresence>
      {snap.settings.mode === 'cash' && <p className="font-nunito text-violet-200 mt-4">Last chance to buy upgrades! 💵</p>}
    </div>
  );
}

function QuestionHeader({ snap, big }: { snap: QuizSnapshot; big?: boolean }) {
  const q = snap.question!;
  const hint = q.type === 'order' ? 'Tap them in the right order' : q.type === 'type' ? 'Type the answer' : q.type === 'poll' ? 'Poll — no wrong answers!' : q.type === 'truefalse' ? 'True or false?' : null;
  return (
    <div className="rounded-3xl bg-white text-slate-900 px-5 py-5 mb-4 text-center shadow-xl">
      {q.emoji && <div className={`${big ? 'text-7xl' : 'text-5xl'} mb-2`}>{q.emoji}</div>}
      <h2 className={`font-fredoka ${big ? 'text-3xl md:text-5xl' : 'text-2xl md:text-3xl'} leading-tight`}>{q.text}</h2>
      {hint && <p className="font-nunito text-base text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ big screen (host not playing)

function BigQuestion({ snap, secs, onRevealNow }: { snap: QuizSnapshot; secs: number; onRevealNow: () => void }) {
  const total = snap.players.length;
  const q = snap.question!;
  return (
    <div>
      <QuestionHeader snap={snap} big />
      <div className="flex items-center justify-center gap-8 mb-5 font-fredoka">
        <div className="w-24 h-24 rounded-full bg-fuchsia-600 flex items-center justify-center text-5xl shadow-xl">{secs}</div>
        <div className="text-center"><div className="text-5xl">{snap.answeredIds.length}</div><div className="text-lg text-violet-200">of {total} answered</div></div>
      </div>
      {q.options && q.type !== 'order' && (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((o, i) => (
            <div key={i} className={`rounded-2xl bg-gradient-to-br ${(q.type === 'truefalse' ? (i === 0 ? 'from-emerald-500 to-green-600' : 'from-red-500 to-rose-600') : TILE_STYLES[i % 4].bg)} px-5 py-5 font-fredoka text-2xl md:text-3xl flex items-center gap-3`}>
              <span className="text-4xl">{q.type === 'truefalse' ? (i === 0 ? '✔' : '✖') : TILE_STYLES[i % 4].shape}</span>{o}
            </div>
          ))}
        </div>
      )}
      {q.type === 'order' && <div className="grid gap-2">{q.options!.map(o => <div key={o} className="rounded-2xl bg-white/15 px-5 py-3 font-fredoka text-2xl">{o}</div>)}</div>}
      <div className="flex justify-center mt-4">
        <button onClick={onRevealNow} className="min-h-[48px] px-6 rounded-full bg-white/15 font-fredoka text-lg">⏭ Reveal now</button>
      </div>
    </div>
  );
}

function BigReveal({ snap }: { snap: QuizSnapshot }) {
  const r = snap.reveal!;
  const q = snap.question!;
  const max = Math.max(1, ...r.counts);
  return (
    <div>
      <QuestionHeader snap={snap} big />
      {q.type === 'poll' || (q.options && q.type !== 'order') ? (
        <div className="flex items-end justify-center gap-4 h-48 mb-4">
          {r.counts.map((c, i) => (
            <div key={i} className="flex flex-col items-center justify-end h-full w-20">
              <div className="font-fredoka text-2xl mb-1">{c}</div>
              <motion.div initial={{ height: 0 }} animate={{ height: `${(c / max) * 100}%` }}
                className={`w-full rounded-t-xl bg-gradient-to-t ${TILE_STYLES[i % 4].bg} ${r.correctDisplay !== null && r.correctDisplay !== i ? 'opacity-30' : ''}`} style={{ minHeight: 6 }} />
              <div className="text-3xl mt-1">{q.type === 'truefalse' ? (i === 0 ? '✔' : '✖') : TILE_STYLES[i % 4].shape}</div>
            </div>
          ))}
        </div>
      ) : null}
      {r.correctText && <p className="text-center font-fredoka text-3xl text-green-300 mb-2">✅ {r.correctText}</p>}
      {r.fact && <p className="text-center font-nunito text-xl text-violet-100 mb-3">💡 {r.fact}</p>}
      <Standings snap={snap} limit={5} />
    </div>
  );
}

// ------------------------------------------------------------------ player view

function PlayerQuestion({ snap, me, onAnswer, secs }: { snap: QuizSnapshot; me?: QPlayer; onAnswer: (a: { choice?: number; order?: number[]; text?: string }) => void; secs: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = !!me && snap.answeredIds.includes(me.id);
  useEffect(() => setPicked(null), [snap.n]);
  if (!me) return <Waiting text="You'll join in on the next question!" />;
  return (
    <div>
      <QuestionHeader snap={snap} />
      {answered ? (
        <div className="text-center py-10">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-7xl mb-3">🤞</motion.div>
          <p className="font-fredoka text-3xl">Answer locked in!</p>
          <p className="font-nunito text-violet-200 text-lg mt-1">{secs > 0 ? `Waiting for the others… ${secs}s` : 'Time!'}</p>
        </div>
      ) : (
        <AnswerPad question={snap.question!} picked={picked}
          onAnswer={a => { playClick(); if (a.choice !== undefined) setPicked(a.choice); onAnswer(a); }} />
      )}
    </div>
  );
}

function PlayerReveal({ snap, me, myId, onChest, onTarget, onBuy }: {
  snap: QuizSnapshot; me?: QPlayer; myId: string;
  onChest: (i: number) => void; onTarget: (id: string) => void; onBuy: (k: UpgradeKind) => void;
}) {
  const r = snap.reveal!;
  if (!me) return <Waiting text="You'll join in on the next question!" />;
  const mode = snap.settings.mode;
  const rank = rankPlayers(mode, snap.players).findIndex(p => p.id === myId) + 1;
  const isPoll = me.lastCorrect === null;
  return (
    <div className="space-y-4">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className={`rounded-3xl p-5 text-center shadow-xl ${isPoll ? 'bg-indigo-600' : me.lastCorrect ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
        <div className="text-6xl">{isPoll ? '🗳️' : me.lastCorrect ? '🎉' : '💪'}</div>
        <div className="font-fredoka text-3xl">{isPoll ? 'Thanks for voting!' : me.lastCorrect ? 'Correct!' : 'Not this time!'}</div>
        {!me.lastCorrect && !isPoll && r.correctText && <div className="font-nunito text-lg mt-1">The answer was <b>{r.correctText}</b></div>}
        {me.lastCorrect && me.streak >= 2 && <div className="font-fredoka text-xl mt-1">🔥 {me.streak} in a row!</div>}
        {mode === 'classic' && me.lastGain > 0 && <div className="font-fredoka text-2xl mt-1">+{me.lastGain.toLocaleString()}</div>}
        {mode === 'racing' && me.lastGain > 0 && <div className="font-fredoka text-2xl mt-1">🏎️ +{me.lastGain} {me.lastGain > 1 ? 'spaces (speedy!)' : 'space'}</div>}
        {mode === 'cash' && me.lastGain !== 0 && <div className="font-fredoka text-2xl mt-1">{me.lastGain > 0 ? '+' : '−'}{fmtMoney(Math.abs(me.lastGain))}</div>}
        <div className="font-nunito text-lg mt-2">You're <b>#{rank}</b> · {scoreLabel(mode, me, snap.raceGoal)}</div>
      </motion.div>
      {r.fact && <p className="text-center font-nunito text-lg text-violet-100">💡 {r.fact}</p>}
      {mode === 'gold' && snap.chests[myId] && <ChestPicker view={snap.chests[myId]} players={snap.players} myId={myId} onChest={onChest} onTarget={onTarget} />}
      {mode === 'cash' && <UpgradeShop me={me} onBuy={onBuy} />}
      {mode === 'racing' && <RaceTrack snap={snap} myId={myId} />}
      {mode !== 'racing' && <Standings snap={snap} limit={5} myId={myId} />}
    </div>
  );
}

function ChestPicker({ view, players, myId, onChest, onTarget }: { view: QuizSnapshot['chests'][string]; players: QPlayer[]; myId: string; onChest: (i: number) => void; onTarget: (id: string) => void }) {
  if (view.picked === undefined) {
    return (
      <div className="rounded-3xl bg-amber-500/20 border-2 border-amber-400 p-4 text-center">
        <p className="font-fredoka text-2xl mb-3">Pick a chest! 🗝️</p>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <motion.button key={i} whileTap={{ scale: 0.9 }} whileHover={{ rotate: [0, -4, 4, 0] }}
              onClick={() => { playClick(); onChest(i); }}
              className="min-h-[96px] rounded-2xl bg-gradient-to-b from-amber-400 to-amber-700 text-6xl shadow-lg" aria-label={`Chest ${i + 1}`}>🧰</motion.button>
          ))}
        </div>
      </div>
    );
  }
  if (view.needsTarget) {
    return (
      <div className="rounded-3xl bg-amber-500/20 border-2 border-amber-400 p-4 text-center">
        <p className="font-fredoka text-2xl mb-1">{view.opened?.emoji} {view.opened?.label}</p>
        <p className="font-nunito text-lg mb-3">Who do you pick?</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {players.filter(p => p.id !== myId).sort((a, b) => b.gold - a.gold).map(p => (
            <button key={p.id} onClick={() => { playCoin(); onTarget(p.id); }} className="min-h-[52px] rounded-xl bg-white/15 font-fredoka text-lg">
              {p.emoji} {p.name} · {p.gold} 🪙
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="rounded-3xl bg-amber-500/20 border-2 border-amber-400 p-4 text-center">
      <div className="text-6xl">{view.opened?.emoji}</div>
      <p className="font-fredoka text-2xl">{view.opened?.label}</p>
    </motion.div>
  );
}

function UpgradeShop({ me, onBuy }: { me: QPlayer; onBuy: (k: UpgradeKind) => void }) {
  return (
    <div className="rounded-3xl bg-emerald-500/15 border-2 border-emerald-400 p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="font-fredoka text-2xl">🛒 Upgrades</p>
        <p className="font-fredoka text-2xl text-emerald-300">{fmtMoney(me.cash)}</p>
      </div>
      <p className="font-nunito text-base text-emerald-100 mb-3">Next right answer earns {fmtMoney(cashEarn({ ...me, streak: me.streak + 1 }))}</p>
      <div className="grid gap-2">
        {(Object.keys(UPGRADES) as UpgradeKind[]).map(k => {
          const u = UPGRADES[k];
          const cost = upgradeCost(me, k);
          const lvl = me.upgrades[k];
          return (
            <button key={k} disabled={cost === null || me.cash < cost} onClick={() => { playCoin(); onBuy(k); }}
              className="min-h-[60px] rounded-2xl bg-white/10 px-4 text-left flex items-center gap-3 disabled:opacity-50">
              <span className="text-3xl">{u.emoji}</span>
              <span className="flex-1">
                <span className="block font-fredoka text-lg">{u.name} <span className="text-sm opacity-70">Lv {lvl + 1}/{u.levels.length}</span></span>
                <span className="block font-nunito text-sm text-emerald-100">
                  {cost === null ? `MAX — ${u.describe(u.levels[lvl])}` : `Next: ${u.describe(u.levels[lvl + 1])}`}
                </span>
              </span>
              {cost !== null && <span className="font-fredoka text-lg">{fmtMoney(cost)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RaceTrack({ snap, myId }: { snap: QuizSnapshot; myId?: string }) {
  const ranked = rankPlayers('racing', snap.players).slice(0, 10);
  return (
    <div className="rounded-3xl bg-black/30 p-4 space-y-2">
      <p className="font-fredoka text-xl">🏁 The race</p>
      {ranked.map(p => (
        <div key={p.id} className="flex items-center gap-2">
          <span className={`w-28 truncate font-nunito text-base ${p.id === myId ? 'text-yellow-300 font-bold' : ''}`}>{p.emoji} {p.name}</span>
          <div className="relative flex-1 h-9 rounded-full bg-white/10 overflow-hidden border border-white/10">
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xl">🏁</div>
            <motion.div className="absolute top-1/2 -translate-y-1/2 text-2xl" initial={false}
              animate={{ left: `calc(${(p.pos / snap.raceGoal) * 88}% )` }} transition={{ type: 'spring', stiffness: 80, damping: 14 }}>🏎️</motion.div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Standings({ snap, limit, myId }: { snap: QuizSnapshot; limit: number; myId?: string }) {
  const mode = snap.settings.mode;
  if (mode === 'racing') return <RaceTrack snap={snap} myId={myId} />;
  if (snap.settings.teams > 0) {
    return (
      <div className="rounded-3xl bg-black/30 p-4 space-y-2">
        {teamResults(mode, snap.players).map((t, i) => (
          <div key={t.team} className="flex items-center gap-3 font-fredoka text-xl">
            <span className="w-8">{i + 1}.</span>
            <span className="w-4 h-4 rounded" style={{ background: TEAMS[t.team].color }} />
            <span className="flex-1">{TEAMS[t.team].emoji} {TEAMS[t.team].name} <span className="text-sm opacity-70">({t.members})</span></span>
            <span>{mode === 'cash' ? fmtMoney(t.avg) : t.avg.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-black/30 p-4 space-y-1">
      {rankPlayers(mode, snap.players).slice(0, limit).map((p, i) => (
        <motion.div layout key={p.id} className={`flex items-center gap-3 font-fredoka text-xl ${p.id === myId ? 'text-yellow-300' : ''}`}>
          <span className="w-8">{i + 1}.</span>
          <span className="flex-1 truncate">{p.emoji} {p.name} {p.streak >= 3 && <span className="text-base">🔥{p.streak}</span>}</span>
          <span>{scoreLabel(mode, p, snap.raceGoal)}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ podium + recap

function Podium({ snap, myId, isHost, onAgain, onLobby }: { snap: QuizSnapshot; myId: string; isHost: boolean; onAgain: () => void; onLobby: () => void }) {
  const mode = snap.settings.mode;
  const ranked = rankPlayers(mode, snap.players);
  const me = snap.players.find(p => p.id === myId);
  const [reward, setReward] = useState<RoundResult | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    playWin();
    const st = useGameStore.getState();
    if (me) setReward(st.finishRound('quiz_party', modeScore(mode, me), MODE_XP_SCALE[mode]));
    else if (isHost) st.addXP(20);
  }, [me, mode, isHost]);

  const top3 = [ranked[1], ranked[0], ranked[2]];
  const heights = ['h-28', 'h-40', 'h-20'];
  const teams = snap.settings.teams > 0 ? teamResults(mode, snap.players) : [];

  return (
    <div className="text-center">
      <ConfettiBurst count={90} durationMs={3500} />
      <h2 className="font-fredoka text-4xl mb-4">🏆 Final results</h2>
      {teams.length > 0 && (
        <p className="font-fredoka text-3xl mb-4" style={{ color: TEAMS[teams[0].team].color }}>
          {TEAMS[teams[0].team].emoji} {TEAMS[teams[0].team].name} win!
        </p>
      )}
      <div className="flex items-end justify-center gap-3 mb-6">
        {top3.map((p, i) => p ? (
          <motion.div key={p.id} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: [0.6, 1.2, 0.2][i] }} className="w-28 md:w-36">
            <div className="text-5xl">{p.emoji}</div>
            <div className="font-fredoka text-lg truncate">{p.name}</div>
            <div className="font-nunito text-sm mb-1">{scoreLabel(mode, p, snap.raceGoal)}</div>
            <div className={`${heights[i]} rounded-t-2xl flex items-start justify-center pt-2 font-fredoka text-4xl ${['bg-slate-300 text-slate-800', 'bg-yellow-400 text-yellow-900', 'bg-amber-600 text-amber-100'][i]}`}>
              {[2, 1, 3][i]}
            </div>
          </motion.div>
        ) : <div key={i} className="w-28 md:w-36" />)}
      </div>

      {me && (
        <div className="rounded-3xl bg-white/10 p-4 mb-4 text-left max-w-md mx-auto">
          <p className="font-fredoka text-2xl mb-2 text-center">Your game</p>
          <div className="grid grid-cols-2 gap-2 font-nunito text-lg">
            <div className="rounded-xl bg-black/20 p-2">✅ <b>{me.correct}</b>/{snap.n} right</div>
            <div className="rounded-xl bg-black/20 p-2">🔥 Best streak <b>{me.bestStreak}</b></div>
            <div className="rounded-xl bg-black/20 p-2">⚡ Fastest <b>{Number.isFinite(me.fastestMs) ? `${(me.fastestMs / 1000).toFixed(1)}s` : '—'}</b></div>
            <div className="rounded-xl bg-black/20 p-2">🏅 Place <b>#{ranked.findIndex(p => p.id === myId) + 1}</b></div>
          </div>
          {reward && <p className="text-center font-fredoka text-xl text-fuchsia-300 mt-3">+{reward.xp} XP · +{reward.coins} 🪙{reward.dailyDone ? ' · Daily challenge done! 🎯' : ''}</p>}
        </div>
      )}

      <div className="max-w-md mx-auto"><Standings snap={snap} limit={10} myId={myId} /></div>
      {isHost && (
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <button onClick={() => { playClick(); onAgain(); }} className="min-h-[56px] px-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl">
            🔁 Another quiz
          </button>
          <button onClick={() => { playClick(); onLobby(); }} className="min-h-[56px] px-8 rounded-full bg-white/15 font-fredoka text-2xl">
            🏠 Back to lobby
          </button>
        </div>
      )}
    </div>
  );
}
