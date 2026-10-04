import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel, xpToNextLevel, LEVEL_NAMES, LEVEL_THRESHOLDS } from '../../store';
import { GAME_BADGES } from '../../data/gameBadges';
import { SECRETS } from '../../data/secrets';
import { localDateKey } from '../../utils/dates';
import { playClick } from '../../utils/sounds';

/** Friendly names for game ids passed to finishRound (titles match the game grid tiles). */
const NAMES: Record<string, string> = {
  paper_clash: '🗺️ Paper Clash', snake_arena: '🐍 Snake Arena', kpop_rush: '🏃 Rush Runner', ninja_slice: '🥷 Ninja Slice',
  rocket_launch: '🚀 Rocket Launch', tower_defense: '🏰 Tower Defense', battle_arena: '⚔️ Battle Arena',
  word_guess: '🟩 Word Guess', game_2048: '🧮 2048', block_blast: '🧱 Block Blast', mini_sudoku: '🔢 Mini Sudoku',
  zip_game: '🔗 Zip', word_ladder: '🪜 Word Ladder', crossword_mini: '📰 Crossword Mini', word_scramble: '🔤 Word Scramble',
  pattern_memory: '🧠 Pattern Memory', memory_speed: '🃏 Speed Memory', sparkle_match: '💎 Gem Match',
  quiz_arena: '❓ Quiz Arena', real_or_fake: '🤔 Real or Fake?', emoji_guess: '🕵️ Emoji Guess',
  idol_personality_quiz: '🌟 Which Star Are You?', quiz_party: '🎉 Quiz Party', imposter: '🤫 Imposter',
  tug_of_war: '🪢 Tug-of-War', heads_up: '🙆 Heads Up', would_you_rather: '🤷 Would You Rather',
  truth_or_dare: '🎯 Truth or Dare', trivia_battle: '🛎️ Buzzer Battle', reaction_duel: '👆 Reaction Duel',
  talent_show: '🎭 Talent Show', beat_maker: '🎛️ Beat Maker', guess_intro: '🎧 Guess the Intro',
  dance_battle: '💃 Dance Battle', freeze_dance: '❄️ Freeze Dance',
};

/** Unknown ids still read nicely: "guess_race" → "🎮 Guess Race". */
const gameName = (id: string) =>
  NAMES[id] ?? `🎮 ${id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;

const isRealGame = (id: string) => !id.endsWith('_losses');

interface Tile { icon: string; label: string; value: string; tint: string }

export default function MyStats() {
  const leaveSecret = useGameStore(s => s.leaveSecret);
  const rounds = useGameStore(s => s.rounds);
  const gameBadges = useGameStore(s => s.gameBadges);
  const playLog = useGameStore(s => s.playLog);
  const highScores = useGameStore(s => s.highScores);
  const datesPlayed = useGameStore(s => s.datesPlayed);
  const xp = useGameStore(s => s.xp);
  const coins = useGameStore(s => s.userCurrency);
  const secretStats = useGameStore(s => s.secretStats);
  const secretsFound = useGameStore(s => s.secretsFound);

  const stats = useMemo(() => {
    const games = Object.entries(rounds).filter(([id, n]) => isRealGame(id) && n > 0);
    const totalRounds = games.reduce((s, [, n]) => s + n, 0);
    const top = [...games].sort((a, b) => b[1] - a[1]).slice(0, 5);
    let seconds = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      seconds += playLog[localDateKey(d)]?.seconds ?? 0;
    }
    const badgeIds = new Set(GAME_BADGES.map(b => b.id));
    const badges = gameBadges.filter(id => badgeIds.has(id)).length;
    const secretIds = new Set(SECRETS.map(s => s.id));
    const secrets = secretsFound.filter(id => secretIds.has(id)).length;
    return { totalRounds, different: games.length, top, minutes: Math.round(seconds / 60), badges, secrets };
  }, [rounds, playLog, gameBadges, secretsFound]);

  const level = getLevel(xp);
  const next = xpToNextLevel(xp);
  const maxed = level >= LEVEL_THRESHOLDS.length - 1;
  const pct = maxed ? 100 : Math.min(100, Math.round((next.current / next.needed) * 100));

  const tiles: Tile[] = [
    { icon: '🎮', label: 'Rounds played', value: stats.totalRounds.toLocaleString(), tint: 'from-fuchsia-500/40 to-purple-600/40' },
    { icon: '🧭', label: 'Different games', value: String(stats.different), tint: 'from-sky-500/40 to-indigo-600/40' },
    { icon: '🏅', label: 'Badges', value: `${stats.badges} / ${GAME_BADGES.length}`, tint: 'from-amber-400/40 to-orange-600/40' },
    { icon: '📅', label: 'Days played', value: String(datesPlayed.length), tint: 'from-emerald-500/40 to-teal-600/40' },
    { icon: '⏱️', label: 'Minutes this week', value: String(stats.minutes), tint: 'from-cyan-500/40 to-sky-600/40' },
    { icon: '🔍', label: 'Secrets found', value: `${stats.secrets} / ${SECRETS.length}`, tint: 'from-violet-500/40 to-fuchsia-600/40' },
    { icon: '🖍️', label: 'Drawings', value: String(secretStats?.drawingsCreated ?? 0), tint: 'from-rose-500/40 to-pink-600/40' },
    { icon: '👾', label: 'Pixel arts', value: String(secretStats?.patternsCreated ?? 0), tint: 'from-lime-500/40 to-emerald-600/40' },
  ];

  return (
    <div
      className="arcade-bg min-h-screen-d text-white px-4"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { playClick(); leaveSecret(); }}
            className="min-h-[48px] min-w-[48px] px-4 rounded-full bg-white/15 active:bg-white/25 font-fredoka text-lg"
          >
            ← Back
          </button>
          <h1 className="font-fredoka text-3xl md:text-4xl">📊 My Stats</h1>
        </div>

        {/* Level progress */}
        <section className="rounded-3xl bg-white/10 p-5 mb-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-fredoka text-2xl">⭐ Level {level + 1} · {LEVEL_NAMES[level]}</h2>
            <span className="font-nunito text-lg text-violet-100">{xp.toLocaleString()} XP · 🪙 {coins.toLocaleString()}</span>
          </div>
          <div className="mt-3 h-6 rounded-full bg-black/30 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-fuchsia-500"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <p className="font-nunito text-base text-violet-100 mt-2">
            {maxed
              ? '👑 Top level reached — you are a Grand Master!'
              : `${next.needed - next.current} XP to level ${level + 2} (${LEVEL_NAMES[level + 1]})`}
          </p>
        </section>

        {/* Big stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {tiles.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className={`rounded-3xl bg-gradient-to-br ${t.tint} border border-white/15 p-4 min-h-[128px] flex flex-col justify-between`}
            >
              <span className="text-3xl" aria-hidden>{t.icon}</span>
              <span className="font-fredoka text-3xl leading-tight">{t.value}</span>
              <span className="font-nunito text-base text-violet-100">{t.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Top 5 games */}
        <section className="rounded-3xl bg-white/10 p-5">
          <h2 className="font-fredoka text-2xl mb-3">🏆 Top 5 games</h2>
          {stats.top.length === 0 ? (
            <p className="font-nunito text-lg text-violet-100">Play a few rounds and your favourite games will show up here! 🎮</p>
          ) : (
            <ol className="space-y-2">
              {stats.top.map(([id, n], i) => (
                <li key={id} className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 min-h-[56px]">
                  <span className="font-fredoka text-2xl w-8 text-center">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
                  <span className="font-nunito text-lg flex-1">{gameName(id)}</span>
                  <span className="font-nunito text-base text-violet-100 text-right">
                    {n} {n === 1 ? 'round' : 'rounds'}
                    {highScores[id] ? <><br />best {highScores[id].toLocaleString()}</> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
