import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { localDateKey } from '../utils/dates';
import { playClick, playPop, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import ScreenFrame from './ui/ScreenFrame';
import {
  HEROES, HERO_QUESTIONS, TIE_BREAK, emptyScores, addAnswer, leaders, tieBreakAnswers, sidekick, heroById,
  type HeroId, type HeroScores, type HeroAnswer,
} from '../data/heroQuiz';

// "Which Arcade Hero Are You?" — screen id idol_personality_quiz (kept for saves and the router).
// Reward: finishRound once per local day for a completed quiz (key below).

const GAME_ID = 'idol_personality_quiz';
const DAY_KEY = 'funquest-idol_personality_quiz-day';

function rewardedToday(): boolean {
  try { return localStorage.getItem(DAY_KEY) === localDateKey(); } catch { return false; }
}

type Phase = 'intro' | 'quiz' | 'tie' | 'result';

export default function IdolPersonalityQuiz() {
  const later = useSafeTimeout();
  const [phase, setPhase] = useState<Phase>('intro');
  const [qIndex, setQIndex] = useState(0);
  const [scores, setScores] = useState<HeroScores>(emptyScores);
  const [picked, setPicked] = useState<number | null>(null);
  const [tied, setTied] = useState<HeroId[]>([]);
  const [winner, setWinner] = useState<HeroId | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);

  const finish = (final: HeroScores, hero: HeroId) => {
    setScores(final);
    setWinner(hero);
    setPhase('result');
    setConfetti(true);
    playWin();
    later(() => setConfetti(false), 3000);
    if (!rewardedToday()) {
      const r = useGameStore.getState().finishRound(GAME_ID, 1, 0.05);
      try { localStorage.setItem(DAY_KEY, localDateKey()); } catch { /* private mode */ }
      setReward({ xp: r.xp, coins: r.coins });
    } else {
      setReward(null);
    }
  };

  const answer = (a: HeroAnswer, i: number) => {
    if (picked !== null) return;
    playPop();
    setPicked(i);
    const next = addAnswer(scores, a.hero);
    later(() => {
      setPicked(null);
      if (phase === 'tie') {
        finish(next, a.hero);
        return;
      }
      if (qIndex + 1 < HERO_QUESTIONS.length) {
        setScores(next);
        setQIndex(qIndex + 1);
        return;
      }
      const top = leaders(next);
      if (top.length === 1) finish(next, top[0]);
      else { setScores(next); setTied(top); setPhase('tie'); }
    }, 450);
  };

  const restart = () => {
    playClick();
    setPhase('intro');
    setQIndex(0);
    setScores(emptyScores());
    setPicked(null);
    setTied([]);
    setWinner(null);
    setReward(null);
  };

  const question = phase === 'tie' ? TIE_BREAK : HERO_QUESTIONS[qIndex];
  const options = phase === 'tie' ? tieBreakAnswers(tied) : question.answers;
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const hero = winner ? heroById(winner) : null;
  const buddy = winner ? sidekick(scores, winner) : null;

  return (
    <ScreenFrame title="Which Arcade Hero Are You?" icon="🦸" width="max-w-2xl">
      {confetti && <ConfettiBurst count={80} durationMs={3000} />}
      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }} className="text-center">
            <p className="font-nunito text-xl text-violet-100 mb-5">
              Answer {HERO_QUESTIONS.length} quick questions to find your arcade hero. There are no wrong answers!
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {HEROES.map(h => (
                <div key={h.id} className={`rounded-3xl bg-gradient-to-br ${h.grad} p-4 shadow-lg`}>
                  <div className="text-5xl mb-1" aria-hidden>{h.emoji}</div>
                  <p className="font-fredoka text-xl">{h.name}</p>
                  <p className="font-nunito text-base text-white/90">{h.strengths.join(' · ')}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { playClick(); setPhase('quiz'); }}
              className="min-h-[56px] px-10 rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 text-stone-900 font-fredoka text-2xl shadow-lg active:scale-95">
              Start! 🚀
            </button>
          </motion.div>
        )}

        {(phase === 'quiz' || phase === 'tie') && (
          <motion.div key={`${phase}-${qIndex}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}>
            {phase === 'quiz' ? (
              <div className="mb-4">
                <div className="flex justify-between font-nunito text-base text-violet-100 mb-1">
                  <span>Question {qIndex + 1} of {HERO_QUESTIONS.length}</span>
                </div>
                <div className="h-3 rounded-full bg-black/30 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-fuchsia-500"
                    initial={false} animate={{ width: `${((qIndex + 1) / HERO_QUESTIONS.length) * 100}%` }} transition={{ duration: 0.3 }} />
                </div>
              </div>
            ) : (
              <p className="text-center font-fredoka text-xl text-yellow-200 mb-4">
                {tied.map(id => heroById(id).emoji).join(' vs ')} So close!
              </p>
            )}
            <div className="rounded-3xl bg-white/10 border border-white/15 p-5">
              <div className="text-5xl text-center mb-2" aria-hidden>{question.emoji}</div>
              <h2 className="font-fredoka text-2xl md:text-3xl text-center mb-5 leading-snug">{question.text}</h2>
              <div className="grid gap-3">
                {options.map((a, i) => (
                  <button key={a.text} onClick={() => answer(a, i)} disabled={picked !== null}
                    className={`min-h-[60px] w-full text-left px-5 py-3 rounded-2xl font-nunito text-lg font-bold transition-colors ${
                      picked === i ? 'bg-yellow-300 text-stone-900'
                        : picked !== null ? 'bg-white/5 text-white/50'
                        : 'bg-white/15 active:bg-white/25'}`}>
                    {a.text}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'result' && hero && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16 }} className="text-center">
            <div className={`rounded-[2rem] bg-gradient-to-br ${hero.grad} p-6 shadow-2xl border-4 border-white/70 mb-4`}>
              <p className="font-fredoka text-xl text-white/90">You are…</p>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
                className="text-8xl my-2" aria-hidden>{hero.emoji}</motion.div>
              <h2 className="font-fredoka text-4xl md:text-5xl mb-1">{hero.name}!</h2>
              <p className="font-nunito text-lg font-bold text-white/95 mb-3">{hero.tagline}</p>
              <p className="font-nunito text-lg leading-relaxed bg-black/20 rounded-2xl p-4 mb-3">{hero.description}</p>
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {hero.strengths.map(s => (
                  <span key={s} className="bg-white/90 text-stone-900 px-4 py-1 rounded-full font-fredoka text-base">✨ {s}</span>
                ))}
              </div>
              <p className="font-fredoka text-lg">🌟 Hero power: <span className="font-nunito font-bold">{hero.power}</span></p>
              {buddy && (
                <p className="font-nunito text-base mt-2 text-white/90">
                  You’re also a little bit {heroById(buddy).emoji} {heroById(buddy).name}!
                </p>
              )}
            </div>

            {reward ? (
              <p className="font-fredoka text-xl text-yellow-200 mb-4">+{reward.xp} XP · +{reward.coins} 🪙</p>
            ) : (
              <p className="font-nunito text-base text-violet-100 mb-4">You already got today’s quiz reward. Play again just for fun!</p>
            )}

            <div className="rounded-3xl bg-white/10 p-4 mb-5 text-left">
              <h3 className="font-fredoka text-xl mb-3">Your hero mix</h3>
              {HEROES.map((h, i) => {
                const pct = Math.round((scores[h.id] / total) * 100);
                return (
                  <div key={h.id} className="flex items-center gap-3 mb-2">
                    <span className="text-2xl w-8 text-center" aria-hidden>{h.emoji}</span>
                    <span className="font-nunito text-base w-32 shrink-0">{h.name}</span>
                    <div className="flex-1 h-4 rounded-full bg-black/30 overflow-hidden">
                      <motion.div className={`h-full rounded-full ${h.bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }} />
                    </div>
                    <span className="font-fredoka text-base w-12 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>

            <button onClick={restart}
              className="min-h-[52px] px-8 rounded-full bg-white/15 active:bg-white/25 font-fredoka text-xl">
              🔄 Play again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenFrame>
  );
}
