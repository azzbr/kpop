import { motion, AnimatePresence } from 'framer-motion';
import type { RoomPlayer } from '../../online/useRoom';
import type { useClassroom } from '../../online/useClassroom';
import { TEAMS, cupLeaders } from '../../online/classLogic';
import { useCountdown } from '../../online/useHostGame';
import { playClick } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Teacher mode pieces for Friends Arena: the overlays everyone sees (Eyes on me, paused,
// next game, end of lesson), the teacher's in-game control bar and the lobby panel.

type Cls = ReturnType<typeof useClassroom>;

export function CupBoard({ cls }: { cls: Cls }) {
  const { n, cup } = cls.state;
  if (!n) return null;
  const leaders = cupLeaders(cup);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Class Cup">
      {TEAMS.slice(0, n).map((t, i) => (
        <div key={t.name} className={`rounded-2xl p-3 text-center ${leaders.includes(i) ? 'bg-amber-400/30 ring-2 ring-amber-300' : 'bg-black/20'}`}>
          <div className="font-fredoka text-lg">{t.emoji} {t.name}</div>
          <div className="font-fredoka text-3xl">{cup[i] ?? 0}{leaders.includes(i) && ' 🏆'}</div>
        </div>
      ))}
    </div>
  );
}

export function TeamDot({ cls, id }: { cls: Cls; id: string }) {
  const t = cls.state.n ? cls.state.teams[id] : undefined;
  return t === undefined ? null : <span title={TEAMS[t].name} aria-label={TEAMS[t].name}>{TEAMS[t].emoji}</span>;
}

/** Shown on every device (in the lobby and during games). */
export function ClassOverlays({ cls, teacherName, gameTitle, session, players }: {
  cls: Cls; teacherName: string; gameTitle: (id?: string) => string | undefined;
  session: Record<string, { pts: number }>; players: RoomPlayer[];
}) {
  const s = cls.state;
  const nextIn = useCountdown(s.next?.ms, s.next?.game);
  const top = Object.entries(session).sort((a, b) => b[1].pts - a[1].pts).slice(0, 3)
    .map(([id]) => players.find(p => p.id === id)).filter(Boolean) as RoomPlayer[];
  const leaders = cupLeaders(s.cup);
  return (
    <>
      <AnimatePresence>
        {s.eyes && !cls.isTeacherHost && (
          <motion.div key="eyes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-indigo-950/95 flex flex-col items-center justify-center text-white text-center px-6 game-surface" role="alertdialog" aria-label="Eyes on me">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-9xl mb-6">👀</motion.div>
            <div className="font-fredoka text-5xl md:text-7xl mb-3">Eyes on {teacherName}!</div>
            <div className="font-nunito text-2xl text-indigo-200">Hands off the screen and listen 🙂</div>
          </motion.div>
        )}
        {s.eyes && cls.isTeacherHost && (
          <motion.div key="eyes-t" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} className="fixed bottom-20 inset-x-0 z-[90] flex justify-center">
            <button type="button" onClick={() => { playClick(); cls.setEyes(false); }} className="min-h-[56px] px-6 rounded-full bg-amber-400 text-stone-900 font-fredoka text-xl shadow-2xl">
              👀 Everyone is looking — tap to release
            </button>
          </motion.div>
        )}
        {s.paused && !s.eyes && (
          <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-14 z-[80] flex justify-center pointer-events-none">
            <div className="rounded-full bg-sky-500 text-white font-fredoka text-xl px-6 py-2 shadow-xl" role="status">⏸️ Paused by {teacherName}</div>
          </motion.div>
        )}
        {s.next && (
          <motion.div key="next" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 bottom-20 z-[80] flex justify-center pointer-events-none">
            <div className="rounded-full bg-fuchsia-600 text-white font-fredoka text-xl px-6 py-2 shadow-xl" role="status">
              ▶ Next up: {gameTitle(s.next.game) ?? 'another game'}{nextIn > 0 ? ` in ${nextIn}s` : '!'}
            </div>
          </motion.div>
        )}
        {s.ended && (
          <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/85 flex items-center justify-center px-4" role="dialog" aria-label="Well done, class">
            <ConfettiBurst count={120} durationMs={5000} />
            <div className="rounded-3xl bg-gradient-to-br from-indigo-900 to-fuchsia-900 border-4 border-amber-400 p-6 max-w-md w-full text-center text-white">
              <div className="text-7xl mb-2">🎓</div>
              <h2 className="font-fredoka text-4xl text-amber-300 mb-3">Well done, class!</h2>
              {s.n > 0 && leaders.length > 0 && (
                <p className="font-fredoka text-2xl mb-3">🏆 Class Cup: {leaders.map(t => `${TEAMS[t].emoji} ${TEAMS[t].name}`).join(' & ')}!</p>
              )}
              {top.length > 0 && (
                <div className="rounded-2xl bg-black/25 p-3 mb-3 font-fredoka text-xl">
                  {top.map((p, i) => <div key={p.id}>{['🥇', '🥈', '🥉'][i]} {p.emoji} {p.name}</div>)}
                </div>
              )}
              <p className="font-nunito text-lg text-indigo-100 mb-4">Thanks for playing together, from {teacherName} 🍎</p>
              <button type="button" onClick={() => { playClick(); cls.closeEnd(); }} className="min-h-[52px] px-8 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 font-fredoka text-xl">OK</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** The teacher's floating controls during a game. */
export function TeacherBar({ cls }: { cls: Cls }) {
  if (!cls.isTeacherHost) return null;
  const s = cls.state;
  const btn = 'w-14 h-14 rounded-full bg-black/60 text-2xl text-white shadow-lg';
  return (
    <div className="fixed z-[85] flex gap-2" style={{ right: 'max(8px, env(safe-area-inset-right))', bottom: 'max(8px, env(safe-area-inset-bottom))' }} role="group" aria-label="Teacher controls">
      <button type="button" className={btn} aria-label={s.paused ? 'Resume' : 'Pause'} onClick={() => { playClick(); if (s.paused) cls.resume(); else cls.pause(); }}>{s.paused ? '▶️' : '⏸️'}</button>
      <button type="button" className={btn} aria-label="Skip" onClick={() => { playClick(); cls.skip(); }}>⏭️</button>
      <button type="button" className={`${btn} ${s.eyes ? 'ring-4 ring-amber-400' : ''}`} aria-label="Eyes on me" onClick={() => { playClick(); cls.setEyes(!s.eyes); }}>👀</button>
    </div>
  );
}

/** The teacher's lobby panel: Eyes on me, teams, Class Cup, playlist, end lesson. */
export function TeacherPanel({ cls, gameTitle, onQueueSelected, selectedTitle }: {
  cls: Cls; gameTitle: (id?: string) => string | undefined; onQueueSelected: () => void; selectedTitle: string;
}) {
  const s = cls.state;
  const chip = (on: boolean) => `min-h-[48px] px-4 rounded-full font-fredoka text-lg ${on ? 'bg-amber-400 text-stone-900' : 'bg-white/15'}`;
  return (
    <div className="rounded-3xl bg-amber-400/10 border-2 border-amber-400/50 p-5 mb-6 space-y-4" aria-label="Teacher panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-fredoka text-xl mr-2">🍎 Teacher</span>
        <button type="button" className={chip(s.eyes)} onClick={() => { playClick(); cls.setEyes(!s.eyes); }}>👀 Eyes on me</button>
        <button type="button" className={chip(false)} onClick={() => { playClick(); cls.endLesson(); }}>🎓 End lesson</button>
      </div>
      <div>
        <div className="font-fredoka text-lg mb-2">🏆 Class Cup teams</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[0, 2, 3, 4].map(n => (
            <button key={n} type="button" className={chip(s.n === n)} onClick={() => { playClick(); cls.setTeams(n); }}>{n ? `${n} teams` : 'No teams'}</button>
          ))}
        </div>
        <CupBoard cls={cls} />
      </div>
      <div>
        <div className="font-fredoka text-lg mb-2">📋 Lesson playlist {cls.running && <span className="text-amber-300">(running)</span>}</div>
        {cls.playlist.length === 0 && <p className="font-nunito text-lg text-amber-100 mb-2">Queue up to 5 games — the next one starts by itself when a game ends.</p>}
        <ol className="space-y-1 mb-2">
          {cls.playlist.map((it, i) => (
            <li key={i} className="flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-1">
              <span className="font-fredoka text-lg flex-1">{i + 1}. {gameTitle(it.game)}</span>
              <button type="button" aria-label={`Remove ${gameTitle(it.game)}`} onClick={() => cls.unqueue(i)} className="w-12 h-12 rounded-full bg-white/10">✖</button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(false)} disabled={cls.playlist.length >= 5} onClick={() => { playClick(); onQueueSelected(); }}>➕ Add {selectedTitle}</button>
          {cls.playlist.length > 0 && !cls.running && <button type="button" className="min-h-[48px] px-4 rounded-full font-fredoka text-lg bg-emerald-500" onClick={() => { playClick(); cls.startPlaylist(); }}>▶ Start playlist</button>}
          {cls.running && <button type="button" className={chip(false)} onClick={() => { playClick(); cls.stopPlaylist(); }}>⏹ Stop playlist</button>}
        </div>
      </div>
    </div>
  );
}
