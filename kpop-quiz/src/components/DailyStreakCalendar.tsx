import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick } from '../utils/sounds';

function getDatesPlayed(): Set<string> {
  try {
    const raw = localStorage.getItem('kpop_dates_played');
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set<string>(); }
}

function recordToday() {
  const today = new Date().toISOString().slice(0, 10);
  const dates = getDatesPlayed();
  dates.add(today);
  localStorage.setItem('kpop_dates_played', JSON.stringify([...dates]));
}

function getStreak(dates: Set<string>): { current: number; longest: number } {
  if (dates.size === 0) return { current: 0, longest: 0 };
  const sorted = [...dates].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { run++; longest = Math.max(longest, run); }
    else if (diff > 1) { run = 1; }
  }
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let current = 0;
  if (dates.has(today) || dates.has(yesterday)) {
    let check = dates.has(today) ? today : yesterday;
    while (dates.has(check)) {
      current++;
      check = new Date(new Date(check).getTime() - 86400000).toISOString().slice(0, 10);
    }
  }
  return { current, longest };
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DailyStreakCalendar: React.FC = () => {
  const { setGameState } = useGameStore();

  useMemo(() => recordToday(), []);

  const dates = useMemo(() => getDatesPlayed(), []);
  const { current, longest } = useMemo(() => getStreak(dates), [dates]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().slice(0, 10);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }),
  ];

  const totalPlayed = dates.size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-1">🔥</div>
          <h1 className="text-4xl font-fredoka font-bold text-orange-500 text-kid-glow">Daily Streak</h1>
          <p className="font-nunito text-gray-500 text-sm">Play every day to keep your streak alive!</p>
        </div>

        {/* Streak stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Current Streak', value: current, icon: '🔥', color: 'text-orange-500' },
            { label: 'Longest Streak', value: longest, icon: '🏆', color: 'text-yellow-500' },
            { label: 'Days Played', value: totalPlayed, icon: '⭐', color: 'text-purple-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-3 shadow border-2 border-purple-100 text-center">
              <div className="text-2xl">{stat.icon}</div>
              <div className={`text-2xl font-fredoka font-bold ${stat.color}`}>{stat.value}</div>
              <div className="font-nunito text-gray-400 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-3xl p-4 shadow-xl border-2 border-purple-200 mb-4">
          <h2 className="font-fredoka font-bold text-gray-700 text-center mb-3 text-lg">
            {MONTH_NAMES[month]} {year}
          </h2>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center font-fredoka text-gray-400 text-sm py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const day = parseInt(dateStr.slice(8));
              const played = dates.has(dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              return (
                <motion.div
                  key={dateStr}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className={`aspect-square rounded-xl flex items-center justify-center text-sm font-fredoka font-bold relative
                    ${played ? 'bg-orange-400 text-white shadow' : ''}
                    ${isToday && !played ? 'bg-purple-100 border-2 border-purple-400 text-purple-600' : ''}
                    ${!played && !isToday ? 'text-gray-300' : ''}
                    ${isFuture ? 'opacity-30' : ''}
                  `}
                >
                  {played && <span className="absolute -top-1 -right-1 text-xs">🔥</span>}
                  {day}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Streak message */}
        <div className={`rounded-2xl p-4 text-center border-2 ${
          current >= 7 ? 'bg-yellow-50 border-yellow-400' :
          current >= 3 ? 'bg-orange-50 border-orange-300' :
          'bg-blue-50 border-blue-200'
        }`}>
          {current === 0 && <p className="font-nunito text-blue-700">Play today to start your streak! 🌟</p>}
          {current === 1 && <p className="font-nunito text-orange-600">Great start! Come back tomorrow! 🔥</p>}
          {current >= 2 && current < 7 && <p className="font-nunito text-orange-600 font-bold">{current} days in a row! Keep it up! 🔥🔥</p>}
          {current >= 7 && current < 14 && <p className="font-nunito text-yellow-700 font-bold">AMAZING! {current}-day streak! You're on fire! 🔥🏆</p>}
          {current >= 14 && <p className="font-nunito text-yellow-700 font-bold">LEGENDARY! {current} DAYS! You're a true K-Pop master! 👑🔥</p>}
        </div>
      </div>
    </motion.div>
  );
};

export default DailyStreakCalendar;
