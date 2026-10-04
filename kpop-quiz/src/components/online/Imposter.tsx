import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import { useGameStore } from '../../store';
import type { RoundResult } from '../../store';
import { useImposter } from '../../online/imposter/useImposter';
import type { ImpSnapshot, ImpSettings, ImpPlayer } from '../../online/imposter/useImposter';
import { IMPOSTER_CATEGORIES, categoryInfo } from '../../online/imposter/words';
import type { ImposterCategory } from '../../online/imposter/words';
import { validateClue, roundWinner, MAX_CLUE, MIN_PLAYERS, MAX_PLAYERS } from '../../online/imposter/imposterLogic';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import { playClick, playCorrect, playPop, playWin, playTick, playUnlock } from '../../utils/sounds';

/** Seconds left, redrawn 4×/s. Uses this device's clock against the host's end time. */
function useSecondsLeft(endsAt: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return endsAt ? left : 0;
}

const btn = 'min-h-[48px] rounded-2xl font-fredoka text-lg active:scale-95 transition-transform select-none';
const primary = `${btn} bg-gradient-to-r from-fuchsia-500 to-orange-400 shadow-lg px-6 disabled:opacity-40`;
const card = 'rounded-3xl bg-indigo-950/80 border-2 border-fuchsia-400/40 p-4 md:p-6 shadow-xl';

export default function Imposter({ room }: { room: RoomApi }) {
  const g = useImposter(room);
  const { snap } = g;
  const { isHost, myId, players: roomPlayers, send } = room;

  const who = useCallback((id: string): { name: string; emoji: string } => {
    const p = snap?.players.find(x => x.id === id) ?? roomPlayers.find(x => x.id === id);
    return p ?? { name: '???', emoji: '👻' };
  }, [snap, roomPlayers]);

  // One reward per game, when the final scores show.
  const [reward, setReward] = useState<RoundResult | null>(null);
  const rewardedGame = useRef(-1);
  useEffect(() => {
    if (snap?.phase !== 'final' || rewardedGame.current === snap.gameNo) return;
    rewardedGame.current = snap.gameNo;
    const me = snap.players.find(p => p.id === myId);
    playWin();
    if (me) setReward(useGameStore.getState().finishRound('imposter', me.score, 0.15));
  }, [snap, myId]);

  // Little sounds on phase changes.
  const lastPhase = useRef('');
  useEffect(() => {
    if (!snap) return;
    const key = `${snap.gameNo}:${snap.round}:${snap.phase}`;
    if (key === lastPhase.current) return;
    lastPhase.current = key;
    if (snap.phase === 'roles') playUnlock();
    else if (snap.phase === 'vote') playPop();
    else if (snap.phase === 'guess') playPop();
    else if (snap.phase === 'result' && snap.result) {
      const imp = snap.result.imposterId === myId;
      const winner = roundWinner(snap.result.caught, snap.result.guessedRight);
      if ((winner === 'imposter') === imp && snap.roundIds.includes(myId)) playWin(); else playCorrect();
    }
  }, [snap, myId]);

  const toLobby = () => { playClick(); send({ t: 'to_lobby' }); };

  return (
    <div className="arcade-bg min-h-screen-d text-white px-4 pb-8"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-3 mb-4">
          <h1 className="flex-1 font-fredoka text-2xl md:text-3xl">🕵️ Imposter</h1>
          {snap && snap.phase !== 'final' && (
            <span className="font-nunito text-base text-violet-200">
              {categoryInfo(snap.settings.category).emoji} {categoryInfo(snap.settings.category).name} · Round {snap.round}/{snap.totalRounds}
            </span>
          )}
          {isHost && (
            <button onClick={toLobby} className={`${btn} bg-white/15 px-4 text-base`}>🏠 Lobby</button>
          )}
        </header>

        {!snap && (isHost
          ? <Setup players={roomPlayers.length} onStart={(s) => { playClick(); g.start(s); }} />
          : <Waiting text="The host is picking a category…" players={roomPlayers.map(p => ({ id: p.id, name: p.name, emoji: p.emoji }))} />)}

        {snap && snap.phase === 'roles' && <RolesPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} />}
        {snap && snap.phase === 'clues' && <CluesPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} />}
        {snap && snap.phase === 'vote' && <VotePhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} />}
        {snap && snap.phase === 'guess' && <GuessPhase snap={snap} g={g} myId={myId} who={who} />}
        {snap && snap.phase === 'result' && <ResultPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} />}
        {snap && snap.phase === 'final' && (
          <FinalPhase snap={snap} myId={myId} isHost={isHost} reward={reward}
            onAgain={() => { playClick(); g.backToSetup(); }} onLobby={toLobby} />
        )}
      </div>
    </div>
  );
}

type G = ReturnType<typeof useImposter>;
type Who = (id: string) => { name: string; emoji: string };
interface PhaseProps { snap: ImpSnapshot; g: G; myId: string; isHost: boolean; who: Who }

// ------------------------------------------------------------------ setup

function Setup({ players, onStart }: { players: number; onStart: (s: ImpSettings) => void }) {
  const [category, setCategory] = useState<ImposterCategory>('animals');
  const [rounds, setRounds] = useState(3);
  const [laps, setLaps] = useState(1);
  const enough = players >= MIN_PLAYERS;
  const chip = (on: boolean) => `${btn} px-5 ${on ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`;

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-nunito text-lg text-violet-100 mb-1">
          Everyone gets the same secret word… except the <b>Imposter</b>, who has to blend in! 🤫
        </p>
        <p className="font-nunito text-base text-violet-200">Give one-word clues, then vote for who you think is faking it.</p>
      </div>

      <div className={card}>
        <h2 className="font-fredoka text-xl mb-3">Pick a category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {IMPOSTER_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => { playClick(); setCategory(c.id); }}
              className={`${btn} min-h-[72px] flex flex-col items-center justify-center ${category === c.id ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`}>
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-base">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} flex flex-wrap gap-6`}>
        <div>
          <h2 className="font-fredoka text-xl mb-2">Rounds</h2>
          <div className="flex gap-2">
            {[3, 5].map(n => <button key={n} onClick={() => { playClick(); setRounds(n); }} className={chip(rounds === n)}>{n}</button>)}
          </div>
        </div>
        <div>
          <h2 className="font-fredoka text-xl mb-2">Clues each</h2>
          <div className="flex gap-2">
            {[1, 2].map(n => <button key={n} onClick={() => { playClick(); setLaps(n); }} className={chip(laps === n)}>{n === 1 ? '1 clue' : '2 clues'}</button>)}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button disabled={!enough} onClick={() => onStart({ category, rounds, laps })} className={`${primary} min-h-[56px] text-2xl px-10`}>
          ▶ Start Imposter
        </button>
        <p className="font-nunito text-base text-violet-200 mt-2">
          {enough ? `${Math.min(players, MAX_PLAYERS)} players ready` : `Needs at least ${MIN_PLAYERS} players (you have ${players})`}
        </p>
      </div>
    </div>
  );
}

function Waiting({ text, players }: { text: string; players: { id: string; name: string; emoji: string }[] }) {
  return (
    <div className={`${card} text-center`}>
      <div className="text-6xl mb-3 animate-bounce">🕵️</div>
      <p className="font-fredoka text-2xl mb-4">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {players.map(p => <span key={p.id} className="rounded-full bg-white/10 px-3 py-1 font-nunito text-base">{p.emoji} {p.name}</span>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ role card

/** Tap-and-hold to see your secret, so the person next to you can't peek. */
function HoldReveal({ snap, role, compact }: { snap: ImpSnapshot; role: G['role']; compact?: boolean }) {
  const [held, setHeld] = useState(false);
  const cat = categoryInfo(snap.settings.category);
  if (!role) return <div className={`${card} text-center font-nunito text-lg`}>Getting your secret… 🔐</div>;
  if (role.spectator) {
    return (
      <div className={`${card} text-center`}>
        <div className="text-5xl mb-2">👀</div>
        <p className="font-fredoka text-2xl">You're watching this round</p>
        <p className="font-nunito text-lg text-violet-200">You'll get a secret next round!</p>
      </div>
    );
  }
  const hide = () => setHeld(false);
  return (
    <div className="game-surface">
      <button
        onPointerDown={(e) => { e.preventDefault(); setHeld(true); playTick(); }}
        onPointerUp={hide} onPointerLeave={hide} onPointerCancel={hide}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setHeld(true); }}
        onKeyUp={hide} onBlur={hide}
        className={`w-full rounded-3xl border-4 select-none transition-colors ${compact ? 'min-h-[72px] p-3' : 'min-h-[220px] p-6'} ${
          held ? (role.word ? 'bg-emerald-700/80 border-emerald-300' : 'bg-rose-700/80 border-rose-300') : 'bg-indigo-900/80 border-fuchsia-400/60'}`}
        aria-label="Hold to see your secret"
      >
        {!held && (
          <span className="font-fredoka text-2xl md:text-3xl">{compact ? '👆 Hold to peek at your secret' : '👆 Press and hold to see your secret'}</span>
        )}
        {held && role.word && (
          <span className="block">
            <span className="block font-nunito text-lg text-emerald-100">{cat.emoji} {cat.name} · the secret word is</span>
            <span className={`block font-fredoka ${compact ? 'text-3xl' : 'text-5xl md:text-6xl'} mt-1`}>{role.word}</span>
          </span>
        )}
        {held && !role.word && (
          <span className="block">
            <span className={`block font-fredoka ${compact ? 'text-2xl' : 'text-4xl md:text-5xl'}`}>You're the IMPOSTER 🤫 — blend in!</span>
            <span className="block font-nunito text-xl text-rose-100 mt-2">The category is {cat.emoji} {cat.name}</span>
          </span>
        )}
      </button>
    </div>
  );
}

function RolesPhase({ snap, g, myId, isHost, who }: PhaseProps) {
  const playing = snap.roundIds.includes(myId);
  const iAmReady = snap.readyIds.includes(myId);
  return (
    <div className="space-y-4">
      <p className="text-center font-fredoka text-2xl">🔐 Check your secret — don't let anyone see!</p>
      <HoldReveal snap={snap} role={g.role} />
      {playing && (
        <div className="text-center">
          <button disabled={iAmReady || !g.role} onClick={() => { playClick(); g.ready(); }} className={`${primary} min-h-[56px] text-2xl px-10`}>
            {iAmReady ? '✅ Ready!' : "I've seen it ✅"}
          </button>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {snap.roundIds.map(id => (
          <span key={id} className={`rounded-full px-3 py-1 font-nunito text-base ${snap.readyIds.includes(id) ? 'bg-emerald-600/70' : 'bg-white/10'}`}>
            {who(id).emoji} {who(id).name} {snap.readyIds.includes(id) ? '✅' : '…'}
          </span>
        ))}
      </div>
      {isHost && (
        <div className="text-center">
          <button onClick={() => { playClick(); g.startClues(); }} className={`${btn} bg-white/15 px-5`}>Start clues now ▶</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ clues

function ClueList({ snap, who, highlight }: { snap: ImpSnapshot; who: Who; highlight?: number }) {
  return (
    <div className={card}>
      <h2 className="font-fredoka text-xl mb-2">💬 Clues</h2>
      <ol className="space-y-1.5">
        {snap.order.map((id, i) => {
          const clue = snap.clues[i];
          const now = i === highlight;
          return (
            <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${now ? 'bg-fuchsia-500/40 ring-2 ring-fuchsia-300' : 'bg-white/5'}`}>
              <span className="text-2xl">{who(id).emoji}</span>
              <span className="font-nunito text-lg flex-1 truncate">{who(id).name}</span>
              <span className={`font-fredoka text-xl ${clue?.skipped ? 'text-violet-300' : 'text-yellow-200'}`}>
                {clue ? (clue.skipped ? '(skipped)' : clue.text) : now ? 'thinking… 🤔' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CluesPhase({ snap, g, myId, isHost, who }: PhaseProps) {
  const current = snap.order[snap.turn];
  const myTurn = current === myId;
  const secs = useSecondsLeft(snap.endsAt);
  const [draft, setDraft] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const turnKey = `${snap.round}:${snap.turn}`;
  const [draftKey, setDraftKey] = useState(turnKey);
  if (draftKey !== turnKey) { setDraftKey(turnKey); setDraft(''); setLocalErr(null); }

  const { setClueError, giveClue, role } = g;
  const onKey = useCallback((l: string) => { setLocalErr(null); setClueError(null); setDraft(d => (d.length < MAX_CLUE ? d + l : d)); }, [setClueError]);
  const onBack = useCallback(() => setDraft(d => d.slice(0, -1)), []);
  const onEnter = useCallback(() => {
    const earlier = snap.clues.filter(c => !c.skipped).map(c => c.text);
    const check = validateClue(draft, role?.word ?? null, earlier);
    if (!check.ok) { setLocalErr(check.reason); return; }
    playClick();
    giveClue(check.clue);
  }, [draft, role, snap.clues, giveClue]);

  const err = localErr ?? g.clueError;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-fredoka text-2xl md:text-3xl">
          {myTurn ? '✨ Your turn! Give ONE clue word' : `${who(current).emoji} ${who(current).name} is thinking of a clue…`}
        </p>
        <p className="font-nunito text-lg text-violet-200">⏱️ {secs}s</p>
      </div>

      {myTurn && (
        <div className={`${card} space-y-3`}>
          <div className="min-h-[64px] rounded-2xl bg-white text-indigo-950 font-fredoka text-4xl flex items-center justify-center tracking-widest px-3">
            {draft || <span className="text-slate-400 text-2xl tracking-normal">type a clue…</span>}
          </div>
          {err && <p className="text-center font-nunito text-lg text-orange-200">{err}</p>}
          <OnScreenKeyboard onKey={onKey} onBackspace={onBack} onEnter={onEnter} enterLabel="Send" />
        </div>
      )}

      <HoldReveal snap={snap} role={g.role} compact />
      <ClueList snap={snap} who={who} highlight={snap.turn} />
      {isHost && !myTurn && (
        <div className="text-center">
          <button onClick={() => { playClick(); g.skipTurn(); }} className={`${btn} bg-white/15 px-5`}>Skip this turn ⏭</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ vote

function VotePhase({ snap, g, myId, isHost, who }: PhaseProps) {
  const secs = useSecondsLeft(snap.endsAt);
  const playing = snap.roundIds.includes(myId);
  const voted = snap.votedIds.includes(myId);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-fredoka text-3xl">🗳️ Who is the Imposter?</p>
        <p className="font-nunito text-lg text-violet-200">⏱️ {secs}s · {snap.votedIds.length}/{snap.roundIds.length} voted</p>
      </div>
      {playing && !voted && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {snap.roundIds.filter(id => id !== myId).map(id => (
            <button key={id} onClick={() => { playClick(); setPicked(id); g.vote(id); }}
              className={`${btn} min-h-[88px] flex flex-col items-center justify-center ${picked === id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
              <span className="text-4xl">{who(id).emoji}</span>
              <span className="text-lg truncate max-w-full px-2">{who(id).name}</span>
            </button>
          ))}
        </div>
      )}
      {playing && voted && (
        <div className={`${card} text-center font-fredoka text-2xl`}>
          ✅ Vote in{picked ? ` for ${who(picked).emoji} ${who(picked).name}` : ''}! Waiting for the others…
        </div>
      )}
      {!playing && <div className={`${card} text-center font-fredoka text-2xl`}>👀 Everyone is voting…</div>}
      <ClueList snap={snap} who={who} />
      {isHost && (
        <div className="text-center">
          <button onClick={() => { playClick(); g.endVoteNow(); }} className={`${btn} bg-white/15 px-5`}>End vote now ⏭</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ last-chance guess

function GuessPhase({ snap, g, myId, who }: Omit<PhaseProps, 'isHost'>) {
  const secs = useSecondsLeft(snap.endsAt);
  const imp = snap.imposterId ?? '';
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-4 text-center">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={card}>
        <div className="text-6xl mb-2">🎯</div>
        <p className="font-fredoka text-3xl">Caught! {who(imp).emoji} {who(imp).name} was the Imposter!</p>
        <p className="font-nunito text-xl text-violet-200 mt-2">
          {imp === myId ? 'One last chance — which word was it?' : `${who(imp).name} gets one guess at the secret word…`} ⏱️ {secs}s
        </p>
      </motion.div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(snap.options ?? []).map(w => (
          <button key={w} disabled={imp !== myId || picked !== null}
            onClick={() => { playClick(); setPicked(w); g.guess(w); }}
            className={`${btn} min-h-[72px] text-2xl ${picked === w ? 'bg-fuchsia-500' : 'bg-white/10'} disabled:opacity-80`}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ result

function ResultPhase({ snap, g, myId, isHost, who }: PhaseProps) {
  const r = snap.result!;
  const winner = roundWinner(r.caught, r.guessedRight);
  const imp = who(r.imposterId);
  const iWon = snap.roundIds.includes(myId) && (winner === 'imposter') === (r.imposterId === myId);
  const headline = !r.caught
    ? `${imp.emoji} ${imp.name} escaped! The Imposter wins 🤫`
    : r.guessedRight
      ? `${imp.emoji} ${imp.name} was caught… but guessed the word! Sneaky! 🦊`
      : `The crew caught ${imp.emoji} ${imp.name}! 🎉`;
  const mine = r.deltas[myId] ?? 0;

  return (
    <div className="space-y-4">
      {iWon && <ConfettiBurst count={60} durationMs={2500} />}
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className={`${card} text-center`}>
        <p className="font-nunito text-lg text-violet-200">The secret word was</p>
        <p className="font-fredoka text-5xl md:text-6xl text-yellow-300 my-2">{r.word}</p>
        <p className="font-fredoka text-2xl">{headline}</p>
        {r.caught && r.guess && !r.guessedRight && <p className="font-nunito text-lg text-violet-200 mt-1">{imp.name} guessed “{r.guess}”. Nice try!</p>}
        {r.caught && !r.guess && <p className="font-nunito text-lg text-violet-200 mt-1">Time ran out for the guess.</p>}
        {snap.roundIds.includes(myId) && (
          <p className="font-fredoka text-xl text-fuchsia-300 mt-2">{mine > 0 ? `You got +${mine} points! ⭐` : 'No points this time — you’ll get them next round! 💪'}</p>
        )}
      </motion.div>

      <div className={card}>
        <h2 className="font-fredoka text-xl mb-2">🗳️ Votes</h2>
        <div className="space-y-1.5">
          {snap.roundIds.map(id => {
            const target = r.votes[id];
            return (
              <div key={id} className="flex items-center gap-2 font-nunito text-lg">
                <span className="flex-1 truncate">{who(id).emoji} {who(id).name}{id === r.imposterId ? ' 🤫' : ''}</span>
                <span className="text-violet-200">→ {target ? `${who(target).emoji} ${who(target).name}` : 'no vote'}</span>
                <span className="w-12 text-right font-fredoka text-yellow-200">{r.deltas[id] ? `+${r.deltas[id]}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Scoreboard players={snap.players} myId={myId} />

      <div className="text-center">
        {isHost
          ? <button onClick={() => { playClick(); g.next(); }} className={`${primary} min-h-[56px] text-2xl px-10`}>
              {snap.round >= snap.totalRounds ? '🏆 Final scores' : 'Next round ▶'}
            </button>
          : <p className="font-nunito text-lg text-violet-200">Waiting for the host…</p>}
      </div>
    </div>
  );
}

function Scoreboard({ players, myId }: { players: ImpPlayer[]; myId: string }) {
  return (
    <div className={card}>
      <h2 className="font-fredoka text-xl mb-2">⭐ Scores</h2>
      {players.map((p, i) => (
        <div key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 font-nunito text-lg ${p.id === myId ? 'bg-fuchsia-500/25' : ''}`}>
          <span className="w-8 font-fredoka">#{i + 1}</span>
          <span className="flex-1 truncate">{p.emoji} {p.name}</span>
          <span className="font-fredoka text-yellow-300">{p.score}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ final

function FinalPhase({ snap, myId, isHost, reward, onAgain, onLobby }: {
  snap: ImpSnapshot; myId: string; isHost: boolean; reward: RoundResult | null; onAgain: () => void; onLobby: () => void;
}) {
  const top = snap.players[0];
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="space-y-4">
      <ConfettiBurst count={90} durationMs={4500} />
      <AnimatePresence>
        <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className={`${card} text-center`}>
          <div className="text-7xl mb-2">🏆</div>
          <p className="font-fredoka text-3xl text-yellow-300">{top ? `${top.emoji} ${top.name} wins!` : 'Game over!'}</p>
          <p className="font-nunito text-lg text-violet-200">Great detective work, everyone! 🕵️</p>
        </motion.div>
      </AnimatePresence>
      <div className={card}>
        {snap.players.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 font-nunito text-xl ${p.id === myId ? 'bg-fuchsia-500/25' : ''}`}>
            <span className="w-10 text-2xl">{medals[i] ?? `#${i + 1}`}</span>
            <span className="flex-1 truncate">{p.emoji} {p.name}</span>
            <span className="font-fredoka text-yellow-300">{p.score}</span>
          </div>
        ))}
      </div>
      {reward && <p className="text-center font-fredoka text-xl text-fuchsia-300">+{reward.xp} XP · +{reward.coins} 🪙</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {isHost ? (
          <>
            <button onClick={onAgain} className={`${primary} min-h-[56px] text-xl`}>🔁 Play again</button>
            <button onClick={onLobby} className={`${btn} min-h-[56px] bg-white/15 px-6 text-xl`}>Back to lobby 🏠</button>
          </>
        ) : <p className="font-nunito text-lg text-violet-200">Waiting for the host…</p>}
      </div>
    </div>
  );
}
