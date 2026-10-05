import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel, xpToNextLevel, LEVEL_NAMES } from '../store';
import { GAME_BADGES } from '../data/gameBadges';
import { getStreak, localDateKey } from '../utils/dates';
import { playClick } from '../utils/sounds';
import ScreenFrame from './ui/ScreenFrame';
import { badgeGroups, bestScoreRows, monthCells, monthsBack, shiftMonth, streakMessage } from './trophyRoomLogic';

// Trophy Room: level card on top, then three tabs — every per-game badge, every best score,
// and the daily-streak calendar (this used to be its own "Daily Streak" screen).

const TABS = ['🏅 Badges', '🏆 Best scores', '📅 Streak'] as const;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const LEVEL_COLORS = [
  'from-gray-400 to-gray-500',
  'from-green-400 to-emerald-500',
  'from-blue-400 to-cyan-500',
  'from-purple-400 to-violet-500',
  'from-yellow-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-yellow-300 to-yellow-500',
];

function LevelCard() {
  const xp = useGameStore(s => s.xp);
  const superstar = useGameStore(s => s.huntrxUnlocked);
  const coins = useGameStore(s => s.userCurrency);
  const level = getLevel(xp);
  const { current, needed } = xpToNextLevel(xp);
  const isMax = level >= LEVEL_NAMES.length - 1;
  const pct = isMax ? 100 : Math.min((current / needed) * 100, 100);
  return (
    <div className={`rounded-3xl p-4 mb-4 bg-white/10 border-2 ${superstar ? 'border-yellow-300' : 'border-white/15'} flex items-center gap-4`}>
      <div className={`relative bg-gradient-to-r ${LEVEL_COLORS[level]} rounded-2xl w-16 h-16 shrink-0 flex items-center justify-center font-fredoka text-3xl shadow-lg`}>
        {level}
        {superstar && <span className="absolute -top-3 -right-2 text-2xl" aria-label="Superstar">👑</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-fredoka text-xl truncate">
          {LEVEL_NAMES[level]}
          {superstar && <span className="text-yellow-300 text-base"> · ✨ Superstar</span>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-white/15 rounded-full h-3 overflow-hidden">
            <motion.div className={`h-3 rounded-full bg-gradient-to-r ${LEVEL_COLORS[level]}`}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1 }} />
          </div>
        </div>
        <p className="font-nunito text-base text-violet-200 mt-1">
          ⚡ {xp.toLocaleString()} XP{isMax ? ' · ⭐ MAX level' : ` · ${needed - current} XP to ${LEVEL_NAMES[level + 1]}`} · 🪙 {coins.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function BadgesTab() {
  const earnedIds = useGameStore(s => s.gameBadges);
  const classic = useGameStore(s => s.badges);
  const classicEarned = useGameStore(s => s.earnedBadges);
  const groups = useMemo(() => badgeGroups(GAME_BADGES, earnedIds), [earnedIds]);
  const total = GAME_BADGES.length;
  const have = groups.reduce((n, g) => n + g.earned, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/10 p-4 text-center">
        <p className="font-fredoka text-3xl text-yellow-300">{have} / {total}</p>
        <p className="font-nunito text-base text-violet-200">badges earned · each new badge gives +10 🪙</p>
        <div className="mt-2 bg-white/15 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full bg-gradient-to-r from-yellow-300 to-orange-400" style={{ width: `${(have / total) * 100}%` }} />
        </div>
      </div>

      {groups.map(g => (
        <section key={g.game} className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <h3 className="font-fredoka text-xl mb-2 flex items-center gap-2">
            <span>{g.icon} {g.name}</span>
            <span className="ml-auto font-nunito text-base text-violet-200">{g.earned} / {g.badges.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.badges.map(({ badge, earned }) => (
              <div key={badge.id}
                className={`flex items-center gap-3 rounded-xl p-3 min-h-[64px] ${earned
                  ? 'bg-gradient-to-r from-yellow-400/30 to-fuchsia-500/30 border-2 border-yellow-300/70'
                  : 'bg-black/25 border-2 border-white/10'}`}>
                <span className={`text-3xl ${earned ? '' : 'grayscale opacity-40'}`}>{earned ? badge.icon : '🔒'}</span>
                <div className="min-w-0">
                  <p className={`font-fredoka text-lg leading-tight ${earned ? 'text-white' : 'text-white/60'}`}>{badge.name}</p>
                  <p className={`font-nunito text-base leading-snug ${earned ? 'text-yellow-100' : 'text-violet-200/80'}`}>
                    {earned ? `✅ ${badge.description}` : `How: ${badge.description}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {classic.length > 0 && (
        <section className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <h3 className="font-fredoka text-xl mb-2 flex items-center gap-2">
            <span>🎖️ Classic badges</span>
            <span className="ml-auto font-nunito text-base text-violet-200">
              {classic.filter(b => classicEarned.includes(b.id)).length} / {classic.length}
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {classic.map(b => {
              const earned = classicEarned.includes(b.id);
              return (
                <div key={b.id} className={`rounded-xl p-2 text-center ${earned ? 'bg-yellow-400/25 border-2 border-yellow-300/60' : 'bg-black/25 border-2 border-white/10'}`}>
                  <div className={`text-2xl ${earned ? '' : 'grayscale opacity-40'}`}>{b.icon}</div>
                  <p className={`font-fredoka text-base leading-tight ${earned ? '' : 'text-white/60'}`}>{b.name}</p>
                  {!earned && <p className="font-nunito text-sm text-violet-200/80 leading-snug mt-0.5">{b.description}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoresTab() {
  const highScores = useGameStore(s => s.highScores);
  const rows = useMemo(() => bestScoreRows(highScores), [highScores]);
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-center">
        <div className="text-5xl mb-2">🎮</div>
        <p className="font-fredoka text-xl">No records yet</p>
        <p className="font-nunito text-lg text-violet-200">Play some games to set your first best scores!</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white/10 p-2">
      {rows.map(r => (
        <div key={r.id} className="flex items-center gap-3 px-3 py-3 border-b border-white/10 last:border-0">
          <span className="text-2xl">{r.icon}</span>
          <span className="flex-1 font-fredoka text-lg">{r.name}</span>
          <span className="font-fredoka text-lg text-yellow-300 text-right">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

function StreakTab() {
  const datesPlayed = useGameStore(s => s.datesPlayed);
  const dates = useMemo(() => new Set(datesPlayed), [datesPlayed]);
  const { current, longest } = useMemo(() => getStreak(datesPlayed), [datesPlayed]);
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const today = localDateKey(now);
  const back = monthsBack(datesPlayed, now);
  const { year, month } = shiftMonth(now, offset);
  const cells = monthCells(year, month);
  const playedThisMonth = cells.filter(c => c && dates.has(c)).length;

  const go = (d: number) => { playClick(); setOffset(o => Math.min(0, Math.max(-back, o + d))); };
  const navBtn = 'min-h-[48px] min-w-[48px] rounded-full bg-white/15 font-fredoka text-2xl disabled:opacity-30';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Current streak', value: current, icon: '🔥', color: 'text-orange-300' },
          { label: 'Best streak', value: longest, icon: '🏆', color: 'text-yellow-300' },
          { label: 'Days played', value: dates.size, icon: '⭐', color: 'text-fuchsia-300' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white/10 p-3 text-center">
            <div className="text-2xl">{s.icon}</div>
            <div className={`font-fredoka text-3xl ${s.color}`}>{s.value}</div>
            <div className="font-nunito text-base text-violet-200 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => go(-1)} disabled={offset <= -back} className={navBtn} aria-label="Previous month">‹</button>
          <h2 className="flex-1 text-center font-fredoka text-2xl">
            {MONTH_NAMES[month]} {year}
            <span className="block font-nunito text-base text-violet-200">{playedThisMonth} {playedThisMonth === 1 ? 'day' : 'days'} played</span>
          </h2>
          <button onClick={() => go(1)} disabled={offset >= 0} className={navBtn} aria-label="Next month">›</button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => <div key={i} className="text-center font-fredoka text-violet-200 text-base py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`b${i}`} />;
            const played = dates.has(dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            return (
              <div key={dateStr}
                className={`relative aspect-square rounded-xl flex items-center justify-center font-fredoka text-lg
                  ${played ? 'bg-gradient-to-br from-orange-400 to-pink-500 shadow' : 'bg-white/5 text-white/50'}
                  ${isToday ? 'ring-2 ring-yellow-300 text-white' : ''}
                  ${isFuture ? 'opacity-30' : ''}`}>
                {played && <span className="absolute -top-1 -right-1 text-sm">🔥</span>}
                {Number(dateStr.slice(8))}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rounded-2xl p-4 text-center border-2 ${current >= 7 ? 'bg-yellow-400/15 border-yellow-300' : current >= 3 ? 'bg-orange-400/15 border-orange-300' : 'bg-white/10 border-white/15'}`}>
        <p className="font-fredoka text-xl">{streakMessage(current)}</p>
      </div>
    </div>
  );
}

export default function AchievementShowcase() {
  const [tab, setTab] = useState(0);
  return (
    <ScreenFrame title="Trophy Room" icon="🏆" width="max-w-3xl">
      <LevelCard />
      <div role="tablist" className="grid grid-cols-3 gap-2 mb-4 rounded-2xl bg-black/25 p-1">
        {TABS.map((t, i) => (
          <button key={t} role="tab" aria-selected={tab === i}
            onClick={() => { playClick(); setTab(i); }}
            className={`min-h-[52px] rounded-xl font-fredoka text-lg transition-colors ${tab === i ? 'bg-gradient-to-r from-fuchsia-500 to-orange-400 shadow' : 'text-violet-100'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <BadgesTab />}
      {tab === 1 && <ScoresTab />}
      {tab === 2 && <StreakTab />}
    </ScreenFrame>
  );
}
