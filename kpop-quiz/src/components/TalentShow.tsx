import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWin, playPop, playTimeOut, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const JUDGE_COMMENTS: Record<string, string[]> = {
  '1': ["💀 My ears have left the building.", "🫣 I've seen better from my cat.", "📞 Hello, 911? I need help.", "🚪 Please. Use. The. Exit."],
  '2': ["😬 Well... you tried. That counts for something.", "🙉 I didn't NOT hate it.", "👀 I've seen worse. Barely.", "🤔 Interesting choice of... everything."],
  '3': ["🤷 It's giving... something. Not sure what.", "😐 Three stars. I'm being generous.", "🎭 Very bold. Very brave. Very mid.", "👏 Points for showing up!"],
  '4': ["✨ Oh! That actually had moments!", "😮 Wait — that was kind of good?", "💅 I see potential. Deep, deep down.", "🔥 Starting to feel something!"],
  '5': ["🌟 OKAY WE SEE YOU!", "🎤 Drop the mic! Drop it NOW!", "👑 A star has been born today!", "🚀 That just launched my soul into space!"],
};

const TALENT_IDEAS = [
  "🎤 Sing a K-pop chorus in a funny voice",
  "💃 Do a 15-second freestyle dance",
  "🎭 Act out a dramatic K-drama scene",
  "🤸 Do your best physical trick",
  "🎵 Beatbox for 15 seconds",
  "😂 Tell the funniest joke you know",
  "🐒 Do your best animal impression",
  "🤖 Do the robot dance perfectly",
  "🎨 Draw something in 20 seconds and reveal it",
  "🗣️ Say the alphabet backwards as fast as you can",
];

interface Performance {
  performer: string;
  talent: string;
  scores: number[];
  total: number;
  comments: string[];
}

type Phase = 'setup' | 'perform' | 'judging' | 'result' | 'leaderboard';

const TalentShow: React.FC = () => {
  const { setGameState } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [judgeNames, setJudgeNames] = useState(['', '', '']);
  const [performerName, setPerformerName] = useState('');
  const [talent, setTalent] = useState('');
  const [customTalent, setCustomTalent] = useState('');
  const [timer, setTimer] = useState(20);
  const [timerRunning, setTimerRunning] = useState(false);
  const [judgeScores, setJudgeScores] = useState<number[]>([0, 0, 0]);
  const [currentJudge, setCurrentJudge] = useState(0);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [lastPerf, setLastPerf] = useState<Performance | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const timerRef = useRef<number | null>(null);

  const activeJudges = judgeNames.filter(j => j.trim()).length;

  useEffect(() => {
    if (!timerRunning) return;
    if (timer <= 0) {
      playTimeOut();
      setTimerRunning(false);
      return;
    }
    if (timer <= 5) playTick();
    timerRef.current = window.setTimeout(() => setTimer(t => t - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timer, timerRunning]);

  const startPerformance = () => {
    const t = customTalent.trim() || talent;
    if (!performerName.trim() || !t) return;
    playClick();
    setTimer(20);
    setTimerRunning(false);
    setJudgeScores(Array(activeJudges).fill(0));
    setCurrentJudge(0);
    setPhase('perform');
  };

  const startTimer = () => { playClick(); setTimerRunning(true); };

  const goToJudging = () => {
    playClick();
    setTimerRunning(false);
    setPhase('judging');
  };

  const setScore = (score: number) => {
    playPop();
    setJudgeScores(prev => prev.map((s, i) => i === currentJudge ? score : s));
  };

  const nextJudge = () => {
    if (judgeScores[currentJudge] === 0) return;
    playClick();
    if (currentJudge + 1 < activeJudges) {
      setCurrentJudge(j => j + 1);
    } else {
      // Calculate result
      const filled = judgeScores.filter((_, i) => i < activeJudges);
      const total = Math.round(filled.reduce((a, b) => a + b, 0) / filled.length);
      const bucket = String(Math.min(Math.max(total, 1), 5));
      const pool = JUDGE_COMMENTS[bucket];
      const comments = filled.map(() => pool[Math.floor(Math.random() * pool.length)]);
      const perf: Performance = {
        performer: performerName,
        talent: customTalent.trim() || talent,
        scores: filled,
        total,
        comments,
      };
      setLastPerf(perf);
      setPerformances(prev => [...prev, perf].sort((a, b) => b.total - a.total));
      if (total >= 4) { setShowConfetti(true); playWin(); setTimeout(() => setShowConfetti(false), 2500); }
      else playCorrect();
      setPhase('result');
    }
  };

  const newPerformer = () => {
    playClick();
    setPerformerName('');
    setTalent('');
    setCustomTalent('');
    setPhase('perform');
  };

  const randomTalent = () => {
    playPop();
    setTalent(TALENT_IDEAS[Math.floor(Math.random() * TALENT_IDEAS.length)]);
    setCustomTalent('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={60} durationMs={2500} />}

      <div className="max-w-lg w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-5">
          <div className="text-5xl mb-1">🎭</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Talent Show!</h1>
          <p className="font-nunito text-gray-500 text-sm">Perform • Get Judged • Become a Star</p>
        </div>

        <AnimatePresence mode="wait">

          {/* SETUP */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-4">
                <h2 className="font-fredoka font-bold text-xl text-center text-gray-800 mb-4">🎤 Set Up Your Show</h2>
                <label className="block font-fredoka font-bold text-purple-600 mb-1">Performer Name</label>
                <input type="text" value={performerName} onChange={e => setPerformerName(e.target.value)}
                  placeholder="Who's performing?" maxLength={16}
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 font-nunito mb-4 focus:outline-none focus:border-purple-400" />

                <label className="block font-fredoka font-bold text-purple-600 mb-2">Judge Names (2–3 judges)</label>
                {[0, 1, 2].map(i => (
                  <input key={i} type="text" value={judgeNames[i]}
                    onChange={e => setJudgeNames(n => n.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Judge ${i + 1}${i === 2 ? ' (optional)' : ''}`} maxLength={12}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-nunito mb-2 focus:outline-none focus:border-purple-400" />
                ))}

                <label className="block font-fredoka font-bold text-purple-600 mb-2 mt-2">Choose a Talent</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  <button onClick={randomTalent} className="px-3 py-1.5 bg-pink-100 border-2 border-pink-300 rounded-full font-fredoka text-sm text-pink-700 hover:bg-pink-200 transition-colors">
                    🎲 Random Idea
                  </button>
                </div>
                {talent && !customTalent && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 mb-2 font-nunito text-gray-700 text-sm">{talent}</div>
                )}
                <input type="text" value={customTalent} onChange={e => setCustomTalent(e.target.value)}
                  placeholder="Or type your own talent..." maxLength={60}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-nunito focus:outline-none focus:border-purple-400" />
              </div>

              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={startPerformance}
                disabled={!performerName.trim() || (!talent && !customTalent.trim()) || activeJudges < 2}
                className="w-full btn-kid font-fredoka text-xl py-4">
                🎬 Let the Show Begin!
              </motion.button>
              {activeJudges < 2 && <p className="text-center font-nunito text-red-400 text-sm mt-2">Need at least 2 judge names!</p>}
            </motion.div>
          )}

          {/* PERFORM */}
          {phase === 'perform' && (
            <motion.div key="perform" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-6 text-white text-center shadow-2xl mb-4">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-6xl mb-3">🎤</motion.div>
                <h2 className="text-3xl font-fredoka font-bold mb-1">{performerName}</h2>
                <p className="font-nunito text-purple-100 mb-4 text-sm">{customTalent.trim() || talent}</p>

                {/* Timer display */}
                <motion.div
                  key={timer}
                  animate={timer <= 5 ? { scale: [1, 1.3, 1], color: ['#fff', '#fca5a5', '#fff'] } : {}}
                  transition={{ duration: 0.4 }}
                  className="text-7xl font-fredoka font-bold mb-4"
                >
                  {timerRunning || timer < 20 ? timer : '20'}
                </motion.div>

                <div className="w-full bg-white bg-opacity-30 rounded-full h-4 mb-4 overflow-hidden">
                  <motion.div
                    className="h-4 bg-white rounded-full"
                    animate={{ width: `${(timer / 20) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {!timerRunning && timer === 20 && (
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={startTimer}
                    className="bg-white text-purple-600 font-fredoka font-bold text-xl px-10 py-3 rounded-full shadow-lg hover:shadow-xl mb-3 w-full">
                    ▶ Start Performance!
                  </motion.button>
                )}
                {(timerRunning || timer < 20) && (
                  <p className="font-fredoka text-purple-100 text-lg animate-pulse mb-3">
                    {timer > 0 ? '🎵 Performing...' : '🎬 Time\'s up!'}
                  </p>
                )}
              </div>

              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={goToJudging}
                className="w-full btn-kid-secondary font-fredoka text-xl py-4">
                ✅ Done! Let the Judges Decide!
              </motion.button>
            </motion.div>
          )}

          {/* JUDGING */}
          {phase === 'judging' && (
            <motion.div key={`judge-${currentJudge}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-yellow-300 mb-4 text-center">
                <div className="text-4xl mb-2">⭐</div>
                <h2 className="text-2xl font-fredoka font-bold text-gray-800 mb-1">
                  {judgeNames.filter(j => j.trim())[currentJudge]}'s Score
                </h2>
                <p className="font-nunito text-gray-500 text-sm mb-5">
                  Judge {currentJudge + 1} of {activeJudges} — be honest!
                </p>

                <div className="flex justify-center gap-3 mb-6 flex-wrap">
                  {[1, 2, 3, 4, 5].map(score => (
                    <motion.button
                      key={score}
                      whileHover={{ scale: 1.15, y: -4 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setScore(score)}
                      className={`w-14 h-14 rounded-2xl border-3 font-fredoka font-bold text-2xl transition-all duration-200 shadow ${
                        judgeScores[currentJudge] === score
                          ? 'bg-yellow-400 border-yellow-600 text-white shadow-lg scale-110'
                          : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-yellow-100 hover:border-yellow-400'
                      }`}
                    >
                      {score}
                    </motion.button>
                  ))}
                </div>

                <div className="text-4xl mb-4">
                  {judgeScores[currentJudge] >= 5 ? '🤩🤩🤩' :
                   judgeScores[currentJudge] >= 4 ? '🔥🔥' :
                   judgeScores[currentJudge] >= 3 ? '😊' :
                   judgeScores[currentJudge] >= 2 ? '😬' :
                   judgeScores[currentJudge] === 1 ? '💀' : '❓'}
                </div>

                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={nextJudge}
                  disabled={judgeScores[currentJudge] === 0}
                  className="w-full btn-kid font-fredoka text-lg">
                  {currentJudge + 1 < activeJudges ? `Next Judge →` : '🏁 See Results!'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* RESULT */}
          {phase === 'result' && lastPerf && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 150 }}>
              <div className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-yellow-400 text-center mb-4">
                <motion.div animate={{ rotate: [-5, 5, -5, 0], scale: [1, 1.1, 1] }} transition={{ duration: 0.6 }} className="text-6xl mb-3">
                  {lastPerf.total >= 5 ? '👑' : lastPerf.total >= 4 ? '🌟' : lastPerf.total >= 3 ? '👏' : lastPerf.total >= 2 ? '😅' : '💀'}
                </motion.div>
                <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">{lastPerf.performer}</h2>
                <p className="font-nunito text-gray-500 text-sm mb-4 italic">"{lastPerf.talent}"</p>

                <div className="text-6xl font-fredoka font-bold text-yellow-500 mb-2">
                  {lastPerf.total} / 5
                </div>
                <p className="font-fredoka text-lg text-gray-600 mb-4">
                  {'⭐'.repeat(lastPerf.total)}{'🌑'.repeat(5 - lastPerf.total)}
                </p>

                {/* Judge comments */}
                <div className="space-y-2 mb-5">
                  {lastPerf.comments.map((comment, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                      className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 text-left">
                      <span className="font-fredoka font-bold text-purple-600 text-sm flex-shrink-0">
                        {judgeNames.filter(j => j.trim())[i]}:
                      </span>
                      <span className="font-nunito text-gray-700 text-sm italic">"{comment}"</span>
                      <span className="ml-auto font-fredoka font-bold text-orange-500">{lastPerf.scores[i]}/5</span>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-3 flex-wrap justify-center">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newPerformer} className="btn-kid font-fredoka">
                    🎤 Next Performer
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { playClick(); setPhase('leaderboard'); }} className="btn-kid-secondary font-fredoka">
                    🏆 Leaderboard
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* LEADERBOARD */}
          {phase === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              {performances[0]?.total >= 5 && <ConfettiBurst count={80} durationMs={3000} />}
              <div className="bg-white rounded-3xl p-6 shadow-2xl border-2 border-purple-200 mb-4">
                <h2 className="text-3xl font-fredoka font-bold text-center text-purple-600 mb-5">🏆 Hall of Fame</h2>
                {performances.length === 0 ? (
                  <p className="text-center font-nunito text-gray-400">No performances yet!</p>
                ) : performances.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-3 p-4 rounded-2xl mb-3 ${i === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50 border-2 border-gray-200'}`}>
                    <span className="text-2xl">{['👑', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                    <div className="flex-1 text-left">
                      <p className="font-fredoka font-bold text-gray-800">{p.performer}</p>
                      <p className="font-nunito text-xs text-gray-500 italic">{p.talent}</p>
                    </div>
                    <span className="font-fredoka font-bold text-2xl text-yellow-500">{p.total}/5</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex gap-3 justify-center">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newPerformer} className="btn-kid font-fredoka">
                  🎤 New Performance
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary font-fredoka">
                  🏠 Menu
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TalentShow;
