import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useGameStore } from '../../store';
import type { RoundResult } from '../../store';
import { useImposter } from '../../online/imposter/useImposter';
import type { ImpSnapshot, ImpSettings } from '../../online/imposter/useImposter';
import { IMPOSTER_CATEGORIES, EMOJI_CLUES, categoryInfo } from '../../online/imposter/words';
import type { ImposterCategory } from '../../online/imposter/words';
import {
  validateClue, validateEmojiClue, roundWinner, thinStroke, modeInfo, isMode, imposterCount,
  IMP_MODES, MAX_CLUE, MAX_EMOJI, MIN_PLAYERS, MAX_PLAYERS, PLAYER_COLORS, REVEAL_STEP_MS, REVEAL_LEAD_MS, REVEAL_DRUM_MS,
} from '../../online/imposter/imposterLogic';
import type { ImpMode, ImpCountSetting, StrokePt } from '../../online/imposter/imposterLogic';
import { finishArenaGame } from '../../online/arenaRewards';
import { rankByScore } from '../../online/helloGate';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import DrawCanvas from './DrawCanvas';
import type { DrawCanvasHandle, DrawPt } from './DrawCanvas';
import { FinalCard } from './RaceParts';
import { toRungs } from './arenaHelpers';
import { playClick, playCorrect, playPop, playWin, playTick, playUnlock } from '../../utils/sounds';

// 🕵️ Imposter 2.0 — four modes (🤫 Classic, 🎭 Undercover, ✏️ Doodle clues, 😀 Emoji clues),
// 1–2 imposters, sealed private cards, a drumroll vote reveal, teacher pause/skip and a
// big-screen board mode. Networking + host rules: online/imposter/useImposter.ts.

/** Seconds left on this device's clock; frozen while paused. */
function useSecondsLeft(snap: ImpSnapshot, paused: boolean) {
  const { endsAt, ms } = snap;
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt || paused) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, paused]);
  if (!endsAt) return 0;
  return paused ? Math.ceil(ms / 1000) : left;
}

const btn = 'min-h-[48px] rounded-2xl font-fredoka text-lg active:scale-95 transition-transform select-none';
const primary = `${btn} bg-gradient-to-r from-fuchsia-500 to-orange-400 shadow-lg px-6 disabled:opacity-40`;
const card = 'rounded-3xl bg-indigo-950/80 border-2 border-fuchsia-400/40 p-4 md:p-6 shadow-xl';
const chipCls = (on: boolean) => `${btn} px-4 ${on ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`;

export default function Imposter({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const g = useImposter(room);
  const { snap } = g;
  const { isHost, myId, players: roomPlayers, send } = room;

  const who = useCallback((id: string): { name: string; emoji: string } => {
    const p = snap?.players.find(x => x.id === id) ?? roomPlayers.find(x => x.id === id);
    return p ?? { name: 'A friend', emoji: '🙂' };
  }, [snap, roomPlayers]);
  const colorOf = useCallback((id: string) => {
    const i = snap ? snap.roundIds.indexOf(id) : -1;
    return PLAYER_COLORS[(i < 0 ? 0 : i) % PLAYER_COLORS.length];
  }, [snap]);

  // One reward per game, when the final scores show. finishArenaGame gives the Arena reward
  // (and the host reports the ranking); 'imposter' still counts a round for the im_* badges.
  const [reward, setReward] = useState<RoundResult | null>(null);
  const rewardedGame = useRef(-1);
  const ranked = useMemo(() => (snap ? rankByScore(Object.fromEntries(snap.players.map(p => [p.id, p.score])), snap.players.map(p => p.id)) : []), [snap]);
  useEffect(() => {
    if (snap?.phase !== 'final' || rewardedGame.current === snap.gameNo) return;
    rewardedGame.current = snap.gameNo;
    playWin();
    const me = snap.players.find(p => p.id === myId);
    if (!me) { if (isHost) room.reportResult(ranked); return; } // the big screen doesn't play
    const arena = finishArenaGame(room, ranked);
    const store = useGameStore.getState();
    store.submitScore('imposter', me.score);
    const im = store.finishRound('imposter', 0, 1);
    setReward({ ...arena, xp: arena.xp + im.xp, coins: arena.coins + im.coins, newBadges: [...(arena.newBadges ?? []), ...(im.newBadges ?? [])] });
  }, [snap, myId, isHost, room, ranked]);
  if (snap && snap.phase !== 'final' && reward && rewardedGame.current !== snap.gameNo) setReward(null);

  // Little sounds on phase changes.
  const lastPhase = useRef('');
  useEffect(() => {
    if (!snap) return;
    const key = `${snap.gameNo}:${snap.round}:${snap.phase}`;
    if (key === lastPhase.current) return;
    lastPhase.current = key;
    if (snap.phase === 'roles') playUnlock();
    else if (snap.phase === 'vote' || snap.phase === 'guess') playPop();
  }, [snap]);

  const toLobby = () => { playClick(); send({ t: 'to_lobby' }); };
  const board = g.isBoard;
  const mode = snap ? modeInfo(snap.settings.mode) : null;

  return (
    <div className="arcade-bg min-h-screen-d text-white px-4 pb-8"
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className={`${board ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
        <header className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className={`flex-1 font-fredoka ${board ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}>🕵️ Imposter</h1>
          {snap && snap.phase !== 'final' && mode && (
            <span className={`font-nunito ${board ? 'text-xl' : 'text-base'} text-violet-200`} data-testid="imp-header">
              {mode.emoji} {mode.name}
              {snap.settings.mode !== 'undercover' && <> · {categoryInfo(snap.settings.category).emoji} {categoryInfo(snap.settings.category).name}</>}
              {' '}· Round {snap.round}/{snap.totalRounds}{snap.imposters > 1 ? ' · 2 imposters!' : ''}
            </span>
          )}
          {isHost && (
            <button onClick={toLobby} className={`${btn} bg-white/15 px-4 text-base`}>🏠 Lobby</button>
          )}
        </header>

        {!snap && (isHost
          ? <Setup players={roomPlayers.length} config={config} onStart={(s) => { playClick(); g.start(s); }} />
          : <Waiting text="The host is picking a category…" players={roomPlayers.map(p => ({ id: p.id, name: p.name, emoji: p.emoji }))} />)}

        {snap && snap.phase === 'roles' && <RolesPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} />}
        {snap && snap.phase === 'clues' && <CluesPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} room={room} colorOf={colorOf} />}
        {snap && snap.phase === 'vote' && <VotePhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} room={room} colorOf={colorOf} />}
        {snap && snap.phase === 'reveal' && <RevealPhase key={`${snap.gameNo}:${snap.round}`} snap={snap} myId={myId} who={who} big={board} />}
        {snap && snap.phase === 'guess' && <GuessPhase snap={snap} g={g} myId={myId} who={who} />}
        {snap && snap.phase === 'result' && <ResultPhase snap={snap} g={g} myId={myId} isHost={isHost} who={who} room={room} colorOf={colorOf} />}
        {snap && snap.phase === 'final' && (
          <>
            <ScoreboardCard snap={snap} myId={myId} />
            <FinalCard room={room} ranked={toRungs(ranked)} scores={Object.fromEntries(snap.players.map(p => [p.id, p.score]))} reward={reward} />
            {isHost && (
              <div className="fixed inset-x-0 z-40 flex justify-center" style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button onClick={() => { playClick(); g.backToSetup(); }} className={`${primary} min-h-[56px] text-xl`}>🔁 Play again</button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {g.paused && snap && snap.phase !== 'final' && (
          <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 pointer-events-none" data-testid="imp-paused">
            <div className="rounded-3xl bg-indigo-950 border-4 border-amber-300 px-8 py-6 text-center shadow-2xl">
              <div className="text-6xl mb-2">⏸️</div>
              <p className="font-fredoka text-3xl">Paused</p>
              <p className="font-nunito text-lg text-violet-200">The host will start again soon!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type G = ReturnType<typeof useImposter>;
type Who = (id: string) => { name: string; emoji: string };
interface PhaseProps { snap: ImpSnapshot; g: G; myId: string; isHost: boolean; who: Who }
interface CanvasProps { room: RoomApi; colorOf: (id: string) => string }

// ------------------------------------------------------------------ setup

const COUNT_CHOICES: { value: ImpCountSetting; label: string }[] = [
  { value: 'auto', label: '🤖 Auto' }, { value: '1', label: '1 imposter' }, { value: '2', label: '2 imposters' },
];

function Setup({ players, config, onStart }: { players: number; config?: GameConfig; onStart: (s: ImpSettings) => void }) {
  const [category, setCategory] = useState<ImposterCategory>('animals');
  const [rounds, setRounds] = useState(3);
  const [laps, setLaps] = useState(1);
  const [mode, setMode] = useState<ImpMode>(isMode(config?.mode) ? config!.mode as ImpMode : 'classic');
  const [count, setCount] = useState<ImpCountSetting>(config?.imposters === '1' || config?.imposters === '2' ? config.imposters : 'auto');
  const board = config?.board === '1';
  const seats = Math.min(players - (board ? 1 : 0), MAX_PLAYERS);
  const enough = seats >= MIN_PLAYERS;
  const n = imposterCount(count, seats);

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-nunito text-lg text-violet-100 mb-1">
          Everyone gets the same secret word… except the <b>Imposter</b>, who has to blend in! 🤫
        </p>
        <p className="font-nunito text-base text-violet-200">Give clues, then vote for who you think is faking it.</p>
      </div>

      <div className={card}>
        <h2 className="font-fredoka text-xl mb-3">Mode</h2>
        <div className="grid grid-cols-2 gap-2">
          {IMP_MODES.map(m => (
            <button key={m.id} onClick={() => { playClick(); setMode(m.id); }}
              className={`${btn} min-h-[88px] px-3 py-2 text-left flex flex-col justify-center ${mode === m.id ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`}>
              <span className="text-xl">{m.emoji} {m.name}</span>
              <span className="font-nunito text-base text-violet-100 leading-snug">{m.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {mode !== 'undercover' ? (
        <div className={card}>
          <h2 className="font-fredoka text-xl mb-3">Pick a category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {IMPOSTER_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { playClick(); setCategory(c.id); }}
                className={`${btn} min-h-[72px] flex flex-col items-center justify-center ${category === c.id ? 'bg-fuchsia-500 ring-4 ring-fuchsia-300/50' : 'bg-white/10'}`}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-base">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`${card} font-nunito text-lg text-violet-100`}>
          🎭 Undercover uses its own word pairs (like <b>cat</b> and <b>dog</b>). The imposter gets the other word — and might not know!
        </div>
      )}

      <div className={`${card} flex flex-wrap gap-6`}>
        <div>
          <h2 className="font-fredoka text-xl mb-2">Rounds</h2>
          <div className="flex gap-2">
            {[3, 5].map(r => <button key={r} onClick={() => { playClick(); setRounds(r); }} className={chipCls(rounds === r)}>{r}</button>)}
          </div>
        </div>
        <div>
          <h2 className="font-fredoka text-xl mb-2">Clues each</h2>
          <div className="flex gap-2">
            {[1, 2].map(l => <button key={l} onClick={() => { playClick(); setLaps(l); }} className={chipCls(laps === l)}>{l === 1 ? '1 clue' : '2 clues'}</button>)}
          </div>
        </div>
        <div>
          <h2 className="font-fredoka text-xl mb-2">Imposters</h2>
          <div className="flex flex-wrap gap-2">
            {COUNT_CHOICES.map(c => <button key={c.value} onClick={() => { playClick(); setCount(c.value); }} className={chipCls(count === c.value)}>{c.label}</button>)}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button disabled={!enough} onClick={() => onStart({ category, rounds, laps, mode, imposters: count, board })} className={`${primary} min-h-[56px] text-2xl px-10`}>
          ▶ Start Imposter
        </button>
        <p className="font-nunito text-base text-violet-200 mt-2">
          {enough
            ? `${seats} players · ${n} imposter${n > 1 ? 's' : ''}${board ? ' · 📺 this screen is the big board' : ''}`
            : `Needs at least ${MIN_PLAYERS} players${board ? ' (not counting the big screen)' : ''} — you have ${Math.max(0, seats)}`}
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
  const undercover = snap.settings.mode === 'undercover';
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
        data-testid="imp-hold"
      >
        {!held && (
          <span className="font-fredoka text-2xl md:text-3xl">{compact ? '👆 Hold to peek at your secret' : '👆 Press and hold to see your secret'}</span>
        )}
        {held && role.word && (
          <span className="block" data-testid="imp-secret">
            <span className="block font-nunito text-lg text-emerald-100">{undercover ? '🎭 Your secret word is' : `${cat.emoji} ${cat.name} · the secret word is`}</span>
            <span className={`block font-fredoka ${compact ? 'text-3xl' : 'text-5xl md:text-6xl'} mt-1`}>{role.word}</span>
            {undercover && !compact && <span className="block font-nunito text-lg text-emerald-100 mt-2">Someone has a different word… could it be you? 🤔</span>}
          </span>
        )}
        {held && !role.word && (
          <span className="block" data-testid="imp-secret">
            <span className={`block font-fredoka ${compact ? 'text-2xl' : 'text-4xl md:text-5xl'}`}>You're the IMPOSTER 🤫 — blend in!</span>
            <span className="block font-nunito text-xl text-rose-100 mt-2">
              The category is {cat.emoji} {cat.name}{snap.imposters > 1 ? ' · 1 other imposter is hiding too!' : ''}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}

function BoardNote({ text }: { text: string }) {
  return (
    <div className={`${card} text-center`} data-testid="imp-board">
      <div className="text-6xl mb-2">📺</div>
      <p className="font-fredoka text-3xl md:text-4xl">{text}</p>
    </div>
  );
}

function RolesPhase({ snap, g, myId, isHost, who }: PhaseProps) {
  const playing = snap.roundIds.includes(myId);
  const iAmReady = snap.readyIds.includes(myId);
  return (
    <div className="space-y-4">
      <p className={`text-center font-fredoka ${g.isBoard ? 'text-4xl' : 'text-2xl'}`}>🔐 Check your secret — don't let anyone see!</p>
      {g.isBoard ? <BoardNote text="Everyone is checking their secret on their own device…" /> : <HoldReveal snap={snap} role={g.role} />}
      {playing && (
        <div className="text-center">
          <button disabled={iAmReady || !g.role} onClick={() => { playClick(); g.ready(); }} className={`${primary} min-h-[56px] text-2xl px-10`}>
            {iAmReady ? '✅ Ready!' : "I've seen it ✅"}
          </button>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {snap.roundIds.map(id => (
          <span key={id} className={`rounded-full px-3 py-1 font-nunito ${g.isBoard ? 'text-xl' : 'text-base'} ${snap.readyIds.includes(id) ? 'bg-emerald-600/70' : 'bg-white/10'}`}>
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

function ClueList({ snap, who, highlight, colorOf, big }: { snap: ImpSnapshot; who: Who; highlight?: number; colorOf: (id: string) => string; big?: boolean }) {
  const doodle = snap.settings.mode === 'doodle';
  const emoji = snap.settings.mode === 'emoji';
  return (
    <div className={card}>
      <h2 className={`font-fredoka ${big ? 'text-2xl' : 'text-xl'} mb-2`}>💬 Clues</h2>
      <ol className={`grid gap-1.5 ${big ? 'md:grid-cols-2' : ''}`}>
        {snap.order.map((id, i) => {
          const clue = snap.clues[i];
          const now = i === highlight;
          return (
            <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${now ? 'bg-fuchsia-500/40 ring-2 ring-fuchsia-300' : 'bg-white/5'}`}>
              <span className="text-2xl">{who(id).emoji}</span>
              {doodle && <span className="w-5 h-5 rounded-full shrink-0 border-2 border-white/60" style={{ background: colorOf(id) }} />}
              <span className={`font-nunito ${big ? 'text-xl' : 'text-lg'} flex-1 truncate`}>{who(id).name}</span>
              <span className={`font-fredoka ${emoji && clue?.text ? 'text-3xl' : big ? 'text-2xl' : 'text-xl'} ${clue?.skipped ? 'text-violet-300' : 'text-yellow-200'}`}>
                {clue ? (clue.skipped ? '(skipped)' : clue.stroke ? 'drew a line ✏️' : clue.text) : now ? 'thinking… 🤔' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** ✏️ The shared doodle: everyone's committed lines in their colour, plus the live line. */
function SharedCanvas({ snap, room, colorOf, drawing, onStroke }: CanvasProps & {
  snap: ImpSnapshot; drawing?: boolean; onStroke?: (s: StrokePt[]) => void;
}) {
  const ref = useRef<DrawCanvasHandle>(null);
  const live = useRef<StrokePt[]>([]);
  const pending = useRef<DrawPt[]>([]);
  const flushT = useRef(0);
  const [done, setDone] = useState(false);
  const turnKey = `${snap.gameNo}:${snap.round}:${snap.turn}`;
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) { setSeenTurn(turnKey); setDone(false); }

  const strokes = snap.clues.filter(c => c.stroke);
  const sig = `${snap.gameNo}:${snap.round}:${strokes.length}`;
  const latest = useRef({ snap, colorOf });
  latest.current = { snap, colorOf };
  const redraw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    c.clear();
    for (const cl of latest.current.snap.clues) if (cl.stroke) c.drawPoints(cl.stroke, latest.current.colorOf(cl.id), 6);
  }, []);
  useEffect(() => { redraw(); live.current = []; }, [sig, redraw]);
  useEffect(() => { live.current = []; pending.current = []; }, [turnKey]);

  // Watch the drawer's line appear as they draw it.
  useEffect(() => room.onMessage(m => {
    if (m.t !== 'imp_pts' || m.from === room.myId) return;
    const s = latest.current.snap;
    if (m.round !== s.round || m.turn !== s.turn || m.from !== s.order[s.turn] || !Array.isArray(m.pts)) return;
    ref.current?.drawPoints(m.pts as DrawPt[], latest.current.colorOf(m.from), 6);
  }), [room]);
  useEffect(() => () => window.clearTimeout(flushT.current), []);

  const flush = () => {
    window.clearTimeout(flushT.current);
    flushT.current = 0;
    if (!pending.current.length) return;
    room.send({ t: 'imp_pts', round: snap.round, turn: snap.turn, pts: pending.current });
    pending.current = [];
  };
  const canDraw = !!drawing && !done;
  const onPoints = (pt: DrawPt) => {
    if (!canDraw) return;
    live.current.push(pt);
    pending.current.push(pt);
    if (!flushT.current) flushT.current = window.setTimeout(flush, 60);
  };
  const lift = () => {
    if (!canDraw || !live.current.length) return;
    flush();
    const pts = live.current.length === 1 ? [live.current[0], [live.current[0][0], live.current[0][1], 0] as StrokePt] : live.current;
    setDone(true);
    onStroke?.(thinStroke(pts));
  };

  return (
    <div onPointerUp={lift} onPointerCancel={lift} data-testid="imp-canvas">
      {/* One line per clue in my own colour: no colour row, sizes, fill, eraser, undo or clear. */}
      <DrawCanvas ref={ref} disabled={!canDraw} onPoints={onPoints} onClear={redraw} color={colorOf(room.myId)}
        tools={{ sizes: false, fill: false, eraser: false, undo: false, clear: false }} />
    </div>
  );
}

function EmojiPicker({ onSend }: { onSend: (picks: string[]) => string | null }) {
  const [picks, setPicks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="min-h-[72px] rounded-2xl bg-white text-indigo-950 flex items-center justify-center gap-2 text-5xl" data-testid="imp-emoji-pick">
        {picks.length ? picks.join(' ') : <span className="font-fredoka text-2xl text-slate-400">pick 1 or 2 emoji…</span>}
      </div>
      {err && <p className="text-center font-nunito text-lg text-orange-200">{err}</p>}
      <div className="grid grid-cols-8 gap-1.5 game-surface">
        {EMOJI_CLUES.map(e => (
          <button key={e} type="button" aria-label={`emoji ${e}`}
            onPointerDown={(ev) => { ev.preventDefault(); setErr(null); if (picks.length < MAX_EMOJI) { playTick(); setPicks([...picks, e]); } }}
            className="min-h-[48px] aspect-square rounded-xl bg-white/10 text-3xl active:scale-90 transition-transform">{e}</button>
        ))}
      </div>
      <div className="flex justify-center gap-3">
        <button onClick={() => { playClick(); setPicks(p => p.slice(0, -1)); }} className={`${btn} bg-white/15 px-6`} aria-label="Undo emoji">⌫ Undo</button>
        <button onClick={() => { const e = onSend(picks); if (e) setErr(e); }} disabled={!picks.length} className={`${primary} px-8`}>Send ✅</button>
      </div>
    </div>
  );
}

function CluesPhase({ snap, g, myId, isHost, who, room, colorOf }: PhaseProps & CanvasProps) {
  const current = snap.order[snap.turn];
  const myTurn = current === myId;
  const secs = useSecondsLeft(snap, g.paused);
  const mode = snap.settings.mode;
  const [draft, setDraft] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const turnKey = `${snap.round}:${snap.turn}`;
  const [draftKey, setDraftKey] = useState(turnKey);
  if (draftKey !== turnKey) { setDraftKey(turnKey); setDraft(''); setLocalErr(null); }

  // Tick-tock in the last 5 seconds, for the player whose turn it is (and the big screen).
  useEffect(() => {
    if ((myTurn || g.isBoard) && !g.paused && secs > 0 && secs <= 5) playTick();
  }, [secs, myTurn, g.isBoard, g.paused]);

  const { setClueError, giveClue, role } = g;
  const earlier = snap.clues.filter(c => !c.skipped && c.text).map(c => c.text!);
  const onKey = useCallback((l: string) => { setLocalErr(null); setClueError(null); setDraft(d => (d.length < MAX_CLUE ? d + l : d)); }, [setClueError]);
  const onBack = useCallback(() => setDraft(d => d.slice(0, -1)), []);
  const onEnter = () => {
    const check = validateClue(draft, role?.word ?? null, earlier);
    if (!check.ok) { setLocalErr(check.reason); return; }
    playClick();
    giveClue({ text: check.clue });
  };
  const sendEmoji = (picks: string[]) => {
    const check = validateEmojiClue(picks, earlier);
    if (!check.ok) return check.reason;
    playClick();
    giveClue({ emoji: picks });
    return null;
  };

  const err = localErr ?? g.clueError;
  const big = g.isBoard;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className={`font-fredoka ${big ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`} data-testid="imp-turn">
          {myTurn
            ? mode === 'doodle' ? '✏️ Your turn! Draw ONE line' : mode === 'emoji' ? '😀 Your turn! Pick 1–2 emoji' : '✨ Your turn! Give ONE clue word'
            : `${who(current).emoji} ${who(current).name} is ${mode === 'doodle' ? 'drawing' : 'thinking of'} a clue…`}
        </p>
        <p className={`font-fredoka ${big ? 'text-3xl' : 'text-xl'} ${secs <= 5 ? 'text-amber-300' : 'text-violet-200'}`}>⏱️ {secs}s</p>
      </div>

      {myTurn && mode !== 'doodle' && (
        <div className={`${card} space-y-3`}>
          {mode === 'emoji' ? <EmojiPicker key={turnKey} onSend={sendEmoji} /> : (
            <>
              <div className="min-h-[64px] rounded-2xl bg-white text-indigo-950 font-fredoka text-4xl flex items-center justify-center tracking-widest px-3">
                {draft || <span className="text-slate-400 text-2xl tracking-normal">type a clue…</span>}
              </div>
              <OnScreenKeyboard onKey={onKey} onBackspace={onBack} onEnter={onEnter} enterLabel="Send" />
            </>
          )}
          {err && <p className="text-center font-nunito text-lg text-orange-200">{err}</p>}
        </div>
      )}

      {mode === 'doodle' && (
        <div className={card}>
          <SharedCanvas snap={snap} room={room} colorOf={colorOf} drawing={myTurn && !g.paused} onStroke={(stroke) => { playClick(); giveClue({ stroke }); }} />
          {myTurn && <p className="text-center font-nunito text-lg text-violet-200 mt-2">Lift your finger and your line is sent! {err ? `· ${err}` : ''}</p>}
        </div>
      )}

      {!big && <HoldReveal snap={snap} role={g.role} compact />}
      <ClueList snap={snap} who={who} highlight={snap.turn} colorOf={colorOf} big={big} />
      {isHost && !myTurn && (
        <div className="text-center">
          <button onClick={() => { playClick(); g.skipTurn(); }} className={`${btn} bg-white/15 px-5`}>Skip this turn ⏭</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ vote

function VotePhase({ snap, g, myId, isHost, who, room, colorOf }: PhaseProps & CanvasProps) {
  const secs = useSecondsLeft(snap, g.paused);
  const playing = snap.roundIds.includes(myId);
  const voted = snap.votedIds.includes(myId);
  const [picked, setPicked] = useState<string | null>(null);
  const big = g.isBoard;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className={`font-fredoka ${big ? 'text-5xl' : 'text-3xl'}`}>🗳️ Who is {snap.imposters > 1 ? 'an' : 'the'} Imposter?</p>
        <p className={`font-nunito ${big ? 'text-2xl' : 'text-lg'} text-violet-200`}>⏱️ {secs}s · {snap.votedIds.length}/{snap.roundIds.length} voted</p>
      </div>
      {playing && !voted && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {snap.roundIds.filter(id => id !== myId).map(id => (
            <button key={id} onClick={() => { playClick(); setPicked(id); g.vote(id); }} disabled={g.paused}
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
      {!playing && (
        <div className="flex flex-wrap justify-center gap-2">
          {snap.roundIds.map(id => (
            <span key={id} className={`rounded-full px-4 py-2 font-nunito ${big ? 'text-2xl' : 'text-lg'} ${snap.votedIds.includes(id) ? 'bg-emerald-600/70' : 'bg-white/10'}`}>
              {who(id).emoji} {who(id).name} {snap.votedIds.includes(id) ? '🗳️' : '🤔'}
            </span>
          ))}
        </div>
      )}
      {snap.settings.mode === 'doodle' && <div className={card}><SharedCanvas snap={snap} room={room} colorOf={colorOf} /></div>}
      <ClueList snap={snap} who={who} colorOf={colorOf} big={big} />
      {isHost && (
        <div className="text-center">
          <button onClick={() => { playClick(); g.endVoteNow(); }} className={`${btn} bg-white/15 px-5`}>End vote now ⏭</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ drumroll reveal

function RevealPhase({ snap, myId, who, big }: { snap: ImpSnapshot; myId: string; who: Who; big: boolean }) {
  const r = snap.reveal!;
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<'flip' | 'drum' | 'big'>('flip');

  useEffect(() => {
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));
    r.order.forEach((_, i) => at(REVEAL_LEAD_MS + i * REVEAL_STEP_MS, () => { setStep(i + 1); playTick(); }));
    const drumAt = REVEAL_LEAD_MS + r.order.length * REVEAL_STEP_MS;
    at(drumAt, () => setStage('drum'));
    for (let t = 0; t < REVEAL_DRUM_MS - 200; t += 110) at(drumAt + t, () => playTick());
    at(drumAt + REVEAL_DRUM_MS, () => {
      setStage('big');
      if (r.caught) playWin(); else playCorrect();
    });
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [r]);

  const counts: Record<string, number> = {};
  r.order.slice(0, step).forEach(v => { const t = r.votes[v]; counts[t] = (counts[t] ?? 0) + 1; });
  const out = r.out ? who(r.out) : null;
  const iWasOut = r.out === myId;

  return (
    <div className="space-y-4" data-testid="imp-reveal">
      <p className={`text-center font-fredoka ${big ? 'text-5xl' : 'text-3xl'}`}>🥁 The votes are in…</p>
      <div className={`grid gap-2 ${big ? 'md:grid-cols-2' : ''}`}>
        {r.order.map((v, i) => {
          const shown = i < step;
          const t = r.votes[v];
          return (
            <motion.div key={v} initial={false} animate={{ rotateX: shown ? 0 : 90, opacity: shown ? 1 : 0.35 }} transition={{ duration: 0.3 }}
              className={`rounded-2xl px-4 py-2 flex items-center gap-3 font-nunito ${big ? 'text-2xl' : 'text-lg'} ${v === myId ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-white/10'}`}>
              <span className="flex-1 truncate">{who(v).emoji} {who(v).name}</span>
              <span className="text-violet-200">voted</span>
              <span className="font-fredoka truncate">{shown ? `${who(t).emoji} ${who(t).name}` : '❓'}</span>
            </motion.div>
          );
        })}
        {r.order.length === 0 && <div className={`${card} text-center font-fredoka text-2xl`}>Nobody voted! 🙈</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {snap.roundIds.filter(id => counts[id]).map(id => (
          <motion.span key={id} layout className={`rounded-full bg-fuchsia-600/70 px-4 py-1 font-fredoka ${big ? 'text-2xl' : 'text-xl'}`}>
            {who(id).emoji} {who(id).name}: {counts[id]}
          </motion.span>
        ))}
      </div>

      <AnimatePresence>
        {stage === 'drum' && (
          <motion.p key="drum" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [1, 1.15, 1], opacity: 1 }} transition={{ repeat: Infinity, duration: 0.5 }}
            className={`text-center font-fredoka ${big ? 'text-6xl' : 'text-4xl'}`}>🥁 🥁 🥁</motion.p>
        )}
        {stage === 'big' && (
          <motion.div key="big" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240 }}
            className={`${card} text-center ${r.caught ? 'border-emerald-300' : 'border-amber-300'}`} data-testid="imp-bigreveal">
            {r.caught && <ConfettiBurst count={50} durationMs={2200} />}
            {out ? (
              <>
                <div className={big ? 'text-8xl' : 'text-6xl'}>{out.emoji}</div>
                <p className={`font-fredoka ${big ? 'text-5xl' : 'text-3xl'} mt-2`}>{iWasOut ? 'You were' : `${out.name} was`} voted out…</p>
                <p className={`font-fredoka ${big ? 'text-5xl' : 'text-3xl'} mt-1 ${r.caught ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {r.caught ? `…and ${iWasOut ? 'you WERE' : 'WAS'} an imposter! 🎯` : `…but ${iWasOut ? 'you were' : 'was'} NOT the imposter! 😮`}
                </p>
              </>
            ) : (
              <p className={`font-fredoka ${big ? 'text-5xl' : 'text-3xl'}`}>{r.order.length ? "It's a tie — nobody is voted out! 🤝" : 'No votes — the imposter slips away! 🤫'}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ last-chance guess

function GuessPhase({ snap, g, myId, who }: Omit<PhaseProps, 'isHost'>) {
  const secs = useSecondsLeft(snap, g.paused);
  const imp = snap.caughtId ?? '';
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-4 text-center">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={card}>
        <div className="text-6xl mb-2">🎯</div>
        <p className="font-fredoka text-3xl">Caught! {who(imp).emoji} {who(imp).name} {snap.imposters > 1 ? 'is an' : 'was the'} Imposter!</p>
        <p className="font-nunito text-xl text-violet-200 mt-2">
          {imp === myId ? 'One last chance — which word was it?' : `${who(imp).name} gets one guess at the secret word…`} ⏱️ {secs}s
        </p>
      </motion.div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(snap.options ?? []).map(w => (
          <button key={w} disabled={imp !== myId || picked !== null || g.paused}
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

function ResultPhase({ snap, g, myId, isHost, who, room, colorOf }: PhaseProps & CanvasProps) {
  const r = snap.result!;
  const winner = roundWinner(r.caught, r.guessedRight, r.imposterIds.length);
  const imps = r.imposterIds.map(id => ({ id, ...who(id) }));
  const impNames = imps.map(p => `${p.emoji} ${p.name}`).join(' & ');
  const amImp = r.imposterIds.includes(myId);
  const playing = snap.roundIds.includes(myId);
  const caughtP = r.caught && r.out ? who(r.out) : null;
  const iWon = playing && (winner === 'split' ? (amImp ? r.out !== myId : true) : (winner === 'imposter') === amImp);
  const two = r.imposterIds.length > 1;
  const headline = winner === 'split'
    ? `The crew caught ${caughtP?.emoji} ${caughtP?.name}… but ${imps.filter(p => p.id !== r.out).map(p => `${p.emoji} ${p.name}`).join('')} got away! 🤫`
    : !r.caught
      ? `${impNames} ${two ? 'escaped! The imposters win' : 'escaped! The Imposter wins'} 🤫`
      : r.guessedRight
        ? `${caughtP?.emoji} ${caughtP?.name} was caught… but guessed the word! Sneaky! 🦊`
        : `The crew caught ${impNames}! 🎉`;
  const mine = r.deltas[myId] ?? 0;
  const big = g.isBoard;

  useEffect(() => { if (iWon) playWin(); else if (playing) playCorrect(); }, [iWon, playing]);

  return (
    <div className="space-y-4" data-testid="imp-result">
      {(iWon || big) && <ConfettiBurst count={60} durationMs={2500} />}
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className={`${card} text-center`}>
        {r.impWord ? (
          <div className="flex flex-wrap justify-center gap-6">
            <div><p className="font-nunito text-lg text-violet-200">The crew's word</p><p className={`font-fredoka ${big ? 'text-6xl' : 'text-5xl'} text-yellow-300 my-1`}>{r.word}</p></div>
            <div><p className="font-nunito text-lg text-violet-200">The undercover word</p><p className={`font-fredoka ${big ? 'text-6xl' : 'text-5xl'} text-rose-300 my-1`}>{r.impWord}</p></div>
          </div>
        ) : (
          <>
            <p className="font-nunito text-lg text-violet-200">The secret word was</p>
            <p className={`font-fredoka ${big ? 'text-7xl' : 'text-5xl md:text-6xl'} text-yellow-300 my-2`}>{r.word}</p>
          </>
        )}
        <p className="font-fredoka text-xl text-violet-100 mt-1">🤫 {two ? 'The imposters were' : 'The imposter was'} {impNames}{amImp ? ' (you!)' : ''}</p>
        <p className={`font-fredoka ${big ? 'text-3xl' : 'text-2xl'} mt-2`}>{headline}</p>
        {r.out && !r.caught && <p className="font-nunito text-lg text-violet-200 mt-1">{who(r.out).name} was voted out, but was part of the crew.</p>}
        {r.caught && r.guess && !r.guessedRight && <p className="font-nunito text-lg text-violet-200 mt-1">{caughtP?.name} guessed “{r.guess}”. Nice try!</p>}
        {r.caught && !r.guess && !r.impWord && <p className="font-nunito text-lg text-violet-200 mt-1">Time ran out for the guess.</p>}
        {playing && (
          <p className="font-fredoka text-xl text-fuchsia-300 mt-2">{mine > 0 ? `You got +${mine} points! ⭐` : 'No points this time — you’ll get them next round! 💪'}</p>
        )}
      </motion.div>

      {snap.settings.mode === 'doodle' && <div className={card}><SharedCanvas snap={snap} room={room} colorOf={colorOf} /></div>}

      <div className={card}>
        <h2 className="font-fredoka text-xl mb-2">🗳️ Votes</h2>
        <div className="space-y-1.5">
          {snap.roundIds.map(id => {
            const target = r.votes[id];
            return (
              <div key={id} className={`flex items-center gap-2 font-nunito ${big ? 'text-xl' : 'text-lg'}`}>
                <span className="flex-1 truncate">{who(id).emoji} {who(id).name}{r.imposterIds.includes(id) ? ' 🤫' : ''}</span>
                <span className="text-violet-200 truncate">→ {target ? `${who(target).emoji} ${who(target).name}` : 'no vote'}</span>
                <span className="w-12 text-right font-fredoka text-yellow-200">{r.deltas[id] ? `+${r.deltas[id]}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ScoreboardCard snap={snap} myId={myId} />

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

function ScoreboardCard({ snap, myId }: { snap: ImpSnapshot; myId: string }) {
  return (
    <div className={card}>
      <h2 className="font-fredoka text-xl mb-2">⭐ Scores</h2>
      {snap.players.map((p, i) => (
        <div key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 font-nunito text-lg ${p.id === myId ? 'bg-fuchsia-500/25' : ''}`}>
          <span className="w-8 font-fredoka">#{i + 1}</span>
          <span className="flex-1 truncate">{p.emoji} {p.name}</span>
          <span className="font-fredoka text-yellow-300">{p.score}</span>
        </div>
      ))}
    </div>
  );
}
