import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWin, playCorrect, playWrong, playUnlock, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

type Tab = 'quiz' | 'rollcall' | 'stars' | 'noise';

interface QuizQ {
  q: string;
  options: string[];
  correct: number;
  joke?: string;
}

const POP_QUIZ: QuizQ[] = [
  { q: "What does 'K' in K-Pop stand for?", options: ['Korean', 'Kool', 'Karaoke', 'Kimchi'], correct: 0, joke: "Not Kimchi, though that's delicious!" },
  { q: "Which country is the home of K-Pop?", options: ['Japan', 'China', 'South Korea', 'Thailand'], correct: 2, joke: "Seoul-id answer! 🌏" },
  { q: "How many minutes are in 2 hours?", options: ['100', '120', '60', '240'], correct: 1, joke: "Math + music = 🎵🧮" },
  { q: "What language do K-Pop songs often use?", options: ['Spanish', 'Korean', 'French', 'German'], correct: 1, joke: "안녕하세요 (Annyeonghaseyo!)" },
  { q: "An idol practices 8 hours a day. How many in 5 days?", options: ['30', '35', '40', '45'], correct: 2, joke: "That's a LOT of dancing! 💃" },
  { q: "Which of these is NOT a musical instrument?", options: ['Piano', 'Drum', 'Stapler', 'Guitar'], correct: 2, joke: "Unless you play jazz stapler... 🎷" },
  { q: "What do you call a group of K-Pop fans?", options: ['A team', 'A fandom', 'A crew', 'A class'], correct: 1, joke: "Class is also acceptable, Mr. Jarvis!" },
  { q: "What rhymes with 'star'?", options: ['Cloud', 'Far', 'Tree', 'Book'], correct: 1, joke: "Twinkle twinkle little ⭐" },
  { q: "If a song is 3 minutes long, how many seconds is that?", options: ['120', '150', '180', '300'], correct: 2, joke: "Time flies when you're vibing!" },
  { q: "Which color is NOT in a rainbow?", options: ['Red', 'Brown', 'Blue', 'Green'], correct: 1, joke: "Sorry brown — try again next rainbow! 🌈" },
  { q: "Capital of South Korea?", options: ['Tokyo', 'Beijing', 'Seoul', 'Bangkok'], correct: 2, joke: "Where the K-Pop magic happens! ✨" },
  { q: "10 + 7 × 2 = ?", options: ['34', '24', '17', '20'], correct: 1, joke: "Order of operations! Multiply first 🤓" },
];

const CHEER_LINES = [
  '🎉 ROUND OF APPLAUSE!',
  '⭐ GOLD STAR FOR THE CLASS!',
  '🎊 EVERYONE GETS PIZZA! (just kidding) 🍕',
  '🔥 ON FIRE! Keep going!',
  '🎓 You all just LEVELED UP!',
  '🌟 Class average: AWESOME%',
  '👏 Mr. Jarvis is PROUD!',
  '🚀 To the moon! Whoosh!',
];

interface Student { name: string; stars: number; }

const JarvisHQ: React.FC = () => {
  const { setGameState } = useGameStore();
  const [tab, setTab] = useState<Tab>('quiz');

  // ---- POP QUIZ ----
  const [qIdx, setQIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [classScore, setClassScore] = useState(0);
  const [classMisses, setClassMisses] = useState(0);
  const q = POP_QUIZ[qIdx];

  const answer = (i: number) => {
    if (revealed) return;
    playClick();
    setPick(i);
    setRevealed(true);
    if (i === q.correct) { playCorrect(); setClassScore(s => s + 1); }
    else { playWrong(); setClassMisses(m => m + 1); }
  };
  const nextQ = () => {
    playPop();
    setRevealed(false);
    setPick(null);
    setQIdx(i => (i + 1) % POP_QUIZ.length);
  };
  const resetQuiz = () => { setClassScore(0); setClassMisses(0); setQIdx(0); setRevealed(false); setPick(null); playClick(); };

  // ---- ROLL CALL ----
  const [students, setStudents] = useState<Student[]>(() => {
    try { return JSON.parse(localStorage.getItem('jarvis_students') || '[]'); } catch { return []; }
  });
  const [studentInput, setStudentInput] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => { localStorage.setItem('jarvis_students', JSON.stringify(students)); }, [students]);

  const addStudent = () => {
    const n = studentInput.trim();
    if (!n || students.find(s => s.name.toLowerCase() === n.toLowerCase())) return;
    setStudents([...students, { name: n, stars: 0 }]);
    setStudentInput('');
    playPop();
  };
  const removeStudent = (name: string) => { setStudents(students.filter(s => s.name !== name)); playClick(); };

  const spinPick = () => {
    if (students.length < 2 || spinning) return;
    setSpinning(true);
    setChosen(null);
    setTeams(null);
    let count = 0;
    const totalTicks = 20 + Math.floor(Math.random() * 10);
    const tick = () => {
      const r = students[Math.floor(Math.random() * students.length)];
      setChosen(r.name);
      playTick();
      count++;
      if (count < totalTicks) {
        setTimeout(tick, 80 + count * 12);
      } else {
        setSpinning(false);
        playWin();
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2000);
      }
    };
    tick();
  };

  const makeTeams = () => {
    if (students.length < teamCount) return;
    playUnlock();
    const shuffled = [...students].sort(() => Math.random() - 0.5).map(s => s.name);
    const t: string[][] = Array.from({ length: teamCount }, () => []);
    shuffled.forEach((n, i) => t[i % teamCount].push(n));
    setTeams(t);
    setChosen(null);
  };

  // ---- GOLD STARS ----
  const awardStar = (name: string) => {
    setStudents(students.map(s => s.name === name ? { ...s, stars: s.stars + 1 } : s));
    playCorrect();
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1200);
  };
  const removeStar = (name: string) => {
    setStudents(students.map(s => s.name === name ? { ...s, stars: Math.max(0, s.stars - 1) } : s));
    playClick();
  };
  const sortedByStars = [...students].sort((a, b) => b.stars - a.stars);

  // ---- NOISE ----
  const [cheer, setCheer] = useState<string | null>(null);
  const cheerTimer = useRef<number | null>(null);
  const fireCheer = () => {
    const line = CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)];
    setCheer(line);
    setConfetti(true);
    playWin();
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => { setCheer(null); setConfetti(false); }, 2500);
  };

  const TABS: { id: Tab; emoji: string; label: string }[] = [
    { id: 'quiz', emoji: '🍎', label: 'Pop Quiz' },
    { id: 'rollcall', emoji: '📋', label: 'Roll Call' },
    { id: 'stars', emoji: '⭐', label: 'Gold Stars' },
    { id: 'noise', emoji: '🔔', label: 'Cheer!' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen p-4 flex flex-col items-center"
      style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}
    >
      {confetti && <ConfettiBurst count={50} durationMs={2000} />}

      {/* Cheer overlay */}
      <AnimatePresence>
        {cheer && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="bg-amber-400 text-stone-900 font-fredoka font-bold text-4xl md:text-6xl px-8 py-6 rounded-3xl shadow-2xl border-8 border-amber-600 text-center">
              {cheer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }}
          className="mb-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-full font-fredoka text-sm">
          ← Back
        </button>

        {/* Header — chalkboard look */}
        <div className="text-center mb-4 p-5 rounded-3xl border-4 border-amber-700"
             style={{ background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' }}>
          <div className="text-5xl mb-1">👨‍🏫</div>
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-amber-200">Mr. Jarvis's Lounge</h1>
          <p className="font-nunito text-amber-100/80 text-sm">Class is in session 🍎📋⭐</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 mb-4 bg-stone-800 rounded-2xl p-1 border-2 border-amber-700">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { playClick(); setTab(t.id); }}
              className={`py-2 px-1 rounded-xl font-fredoka text-xs md:text-sm transition-colors ${tab === t.id ? 'bg-amber-500 text-stone-900' : 'text-amber-200 hover:bg-stone-700'}`}>
              <div className="text-lg">{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>

        {/* POP QUIZ */}
        {tab === 'quiz' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700"
               style={{ background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' }}>
            <div className="flex justify-between items-center mb-2 text-amber-100 font-fredoka text-sm">
              <span>Question {qIdx + 1} / {POP_QUIZ.length}</span>
              <span>✅ {classScore} · ❌ {classMisses}</span>
            </div>
            <div className="bg-stone-900/60 border-2 border-dashed border-amber-300 rounded-2xl p-4 mb-4">
              <p className="font-fredoka text-amber-100 text-lg md:text-xl leading-snug text-center">{q.q}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correct;
                const isPicked = pick === i;
                let style = 'bg-stone-700 hover:bg-stone-600 text-amber-100';
                if (revealed) {
                  if (isCorrect) style = 'bg-green-600 text-white ring-2 ring-green-300';
                  else if (isPicked) style = 'bg-red-600 text-white ring-2 ring-red-300';
                  else style = 'bg-stone-700 text-stone-400';
                }
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => answer(i)}
                    disabled={revealed}
                    className={`py-3 px-3 rounded-xl font-fredoka text-sm md:text-base transition-colors ${style}`}>
                    <span className="font-bold mr-1">{['A','B','C','D'][i]}.</span> {opt}
                  </motion.button>
                );
              })}
            </div>
            {revealed && q.joke && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="bg-amber-100 text-stone-800 font-nunito text-sm rounded-xl p-3 mb-3 text-center">
                💬 Mr. Jarvis says: <span className="font-bold">{q.joke}</span>
              </motion.div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setRevealed(true); playUnlock(); }} disabled={revealed}
                className="flex-1 py-2 rounded-full font-fredoka text-sm bg-amber-500 text-stone-900 disabled:opacity-40 hover:bg-amber-400">
                🔍 Reveal
              </button>
              <button onClick={nextQ}
                className="flex-1 py-2 rounded-full font-fredoka text-sm bg-stone-700 text-amber-100 hover:bg-stone-600">
                ➡️ Next
              </button>
              <button onClick={resetQuiz}
                className="px-3 py-2 rounded-full font-fredoka text-xs bg-red-700 text-white hover:bg-red-600">
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ROLL CALL */}
        {tab === 'rollcall' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 space-y-3"
               style={{ background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' }}>
            <h3 className="font-fredoka text-amber-200 text-lg">📋 Roster ({students.length})</h3>

            <div className="flex gap-2">
              <input
                value={studentInput}
                onChange={e => setStudentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStudent(); }}
                placeholder="Add student name…"
                className="flex-1 px-3 py-2 rounded-full bg-stone-900 text-amber-100 placeholder-stone-500 border-2 border-amber-700 focus:outline-none focus:border-amber-400 font-nunito text-sm"
              />
              <button onClick={addStudent}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-full font-fredoka text-sm">+ Add</button>
            </div>

            {students.length === 0 ? (
              <p className="text-amber-100/70 font-nunito text-sm text-center py-3">Add a few students to start!</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {students.map(s => (
                  <span key={s.name} className="bg-stone-900 text-amber-100 rounded-full pl-3 pr-1 py-1 font-nunito text-sm border border-amber-700 flex items-center gap-1">
                    {s.name}
                    <button onClick={() => removeStudent(s.name)} className="text-red-400 hover:text-red-300 px-1">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="border-t border-amber-700/50 pt-3">
              <button onClick={spinPick} disabled={students.length < 2 || spinning}
                className="w-full py-3 rounded-2xl font-fredoka text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-stone-900 disabled:opacity-40 hover:from-amber-400">
                🎯 Pick a Student!
              </button>
              <AnimatePresence mode="wait">
                {chosen && (
                  <motion.div
                    key={chosen}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className="mt-3 text-center bg-amber-100 text-stone-900 rounded-2xl p-4 font-fredoka text-2xl border-4 border-amber-400">
                    {spinning ? '🎰' : '⭐'} {chosen}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-amber-700/50 pt-3">
              <div className="flex gap-2 items-center mb-2">
                <span className="font-fredoka text-amber-200 text-sm">Teams of</span>
                {[2, 3, 4].map(n => (
                  <button key={n} onClick={() => setTeamCount(n)}
                    className={`w-8 h-8 rounded-full font-fredoka text-sm ${teamCount === n ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-amber-100'}`}>
                    {n}
                  </button>
                ))}
                <button onClick={makeTeams} disabled={students.length < teamCount}
                  className="flex-1 py-2 px-3 bg-stone-700 hover:bg-stone-600 text-amber-100 rounded-full font-fredoka text-sm disabled:opacity-40">
                  Split into teams!
                </button>
              </div>
              {teams && (
                <div className="grid grid-cols-2 gap-2">
                  {teams.map((t, i) => (
                    <motion.div key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
                      className="bg-stone-900 border-2 border-amber-700 rounded-xl p-2">
                      <p className="font-fredoka text-amber-300 text-xs mb-1">Team {i + 1}</p>
                      <div className="text-amber-100 font-nunito text-sm">{t.join(', ')}</div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GOLD STARS */}
        {tab === 'stars' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700"
               style={{ background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' }}>
            <h3 className="font-fredoka text-amber-200 text-lg mb-2">⭐ Gold Star Awards</h3>
            {students.length === 0 ? (
              <p className="text-amber-100/70 font-nunito text-sm text-center py-3">
                Add students in the Roll Call tab first!
              </p>
            ) : (
              <div className="space-y-2">
                {sortedByStars.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 bg-stone-900 rounded-xl p-2 border border-amber-700">
                    <span className="font-fredoka text-amber-300 w-6 text-center">{i === 0 && s.stars > 0 ? '👑' : `#${i + 1}`}</span>
                    <span className="flex-1 font-fredoka text-amber-100 text-sm">{s.name}</span>
                    <span className="font-fredoka text-amber-300 text-sm min-w-[2rem] text-right">{s.stars}⭐</span>
                    <button onClick={() => removeStar(s.name)}
                      className="w-7 h-7 bg-stone-700 text-amber-100 rounded-full text-sm">−</button>
                    <button onClick={() => awardStar(s.name)}
                      className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-full font-bold">+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOISE */}
        {tab === 'noise' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 text-center"
               style={{ background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' }}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-2">🔔 Class Cheer Cannon</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-4">Hit it whenever the class earns a celebration!</p>
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              onClick={fireCheer}
              className="w-full py-6 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white font-fredoka text-3xl shadow-xl"
            >
              🎉 FIRE THE CONFETTI! 🎉
            </motion.button>
            <p className="font-nunito text-amber-100/60 text-xs mt-3">
              Tip: Use this when a kid answers the Pop Quiz right!
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default JarvisHQ;
