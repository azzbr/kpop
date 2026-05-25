import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWin, playCorrect, playWrong, playUnlock, playTick, playTimeOut } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { easyQuestions, normalQuestions } from '../quizData';

type Tab = 'quiz' | 'rollcall' | 'stars' | 'battle' | 'reward' | 'timer' | 'noise' | 'power' | 'science' | 'boss';

interface PowerCard { name: string; emoji: string; desc: string; rarity: 'common' | 'rare' | 'legendary'; }
const POWER_CARDS: PowerCard[] = [
  { name: 'Double Points', emoji: '⭐', desc: 'Next correct answer counts for DOUBLE!', rarity: 'common' },
  { name: 'Score Swap', emoji: '🔄', desc: 'Two teams swap scores. Drama!', rarity: 'rare' },
  { name: 'Freeze', emoji: '❄️', desc: 'One team skips the next round.', rarity: 'common' },
  { name: 'Bonus Round', emoji: '🎁', desc: 'A surprise mini-challenge worth 5 points!', rarity: 'rare' },
  { name: 'Lucky Star', emoji: '🍀', desc: 'Remove one wrong option from next question.', rarity: 'common' },
  { name: 'Steal!', emoji: '🦊', desc: 'Steal 2 points from the leading team.', rarity: 'rare' },
  { name: 'Comeback', emoji: '🚀', desc: 'Last-place team gets +3 free points!', rarity: 'common' },
  { name: 'Silent Round', emoji: '🤫', desc: 'Next question must be answered with no talking.', rarity: 'common' },
  { name: 'Mr. Jarvis Joins', emoji: '👨‍🏫', desc: 'Teacher plays for the losing team next round!', rarity: 'legendary' },
  { name: 'Wildcard', emoji: '🃏', desc: 'Pick any other power card and use it now!', rarity: 'legendary' },
  { name: 'Triple Threat', emoji: '⚡', desc: 'Next 3 answers count as one combo. All right = +6!', rarity: 'rare' },
  { name: 'Sudden Death', emoji: '💥', desc: 'Next question: winner takes 5, loser loses 2.', rarity: 'legendary' },
];

interface Mission { title: string; brief: string; equipment: string; minutes: number; science: string; }
const SCIENCE_MISSIONS: Mission[] = [
  { title: 'Static Hair Training', brief: 'Rub a balloon on your hair, then lift it slowly — your hair follows!', equipment: 'Balloon', minutes: 2, science: 'Static electricity — electrons jump between materials.' },
  { title: 'Lava Lamp Vocal Warmup', brief: 'Drop a fizzy tablet in water + oil. Watch the bubbles rise!', equipment: 'Cup, water, oil, fizzy tablet', minutes: 5, science: 'Gas bubbles carry oil up; oil and water don\'t mix.' },
  { title: 'Idol Heart Rate Check', brief: 'Find your pulse on your wrist. Count beats for 15 sec, multiply by 4.', equipment: 'A clock', minutes: 1, science: 'Your heart pumps blood. Faster pulse = more oxygen needed.' },
  { title: 'Rainbow Skittles Stage', brief: 'Arrange Skittles in a circle on a plate, pour warm water — rainbow!', equipment: 'Plate, Skittles, warm water', minutes: 3, science: 'Sugar dissolves at the same rate; colors don\'t mix instantly.' },
  { title: 'Paper Plane Concert Tour', brief: 'Fold 3 different paper planes. Time which flies longest.', equipment: 'Paper, stopwatch', minutes: 6, science: 'Lift, drag, and weight — same forces as real planes!' },
  { title: 'Salt Water Egg Float', brief: 'Make an egg float by adding salt. How many spoons does it take?', equipment: 'Glass, egg, salt, water', minutes: 4, science: 'Density! Salt water is denser than fresh water.' },
  { title: 'Shadow Stage Lighting', brief: 'Hold a torch close to a toy — shadow is huge. Move it back — shadow shrinks!', equipment: 'Torch, small toy', minutes: 2, science: 'Light travels in straight lines — distance changes shadow size.' },
  { title: 'Mirror Choreography', brief: 'Two students copy each other in a mirror exactly. 60 sec. Pure focus!', equipment: 'Nothing!', minutes: 2, science: 'Mirror neurons — your brain literally copies what you see.' },
  { title: 'Sound Cup Phone', brief: 'Two cups, one tight string. Whisper into one, friend hears the other.', equipment: '2 cups, string', minutes: 4, science: 'Sound = vibrations. String carries them between cups.' },
  { title: 'Volcano Vocalist', brief: 'Bicarb soda + vinegar in a cup. ERUPTION! (Outside, please.)', equipment: 'Vinegar, bicarb, cup', minutes: 3, science: 'Acid + base = CO₂ gas, which makes the fizz.' },
  { title: 'Floating Pencil Trick', brief: 'Hold a pencil loosely, shake your hand — it looks bendy!', equipment: 'A pencil', minutes: 1, science: 'Persistence of vision — your eyes blur fast motion.' },
  { title: 'Idol Reaction Time', brief: 'Drop a ruler — partner catches it. cm = your reaction time!', equipment: '30cm ruler', minutes: 2, science: 'Your brain takes ~0.2 sec to react. Practice = faster!' },
];

interface QuizQ { q: string; options: string[]; correct: number; joke?: string; }

const POP_QUIZ: QuizQ[] = [
  // UK History & Geography
  { q: "What is the capital city of England?", options: ['Manchester', 'Birmingham', 'London', 'Leeds'], correct: 2, joke: "Home of Big Ben, red buses, and too much rain! ☂️" },
  { q: "Which river flows through London?", options: ['River Severn', 'River Thames', 'River Trent', 'River Avon'], correct: 1, joke: "Not the Avon — that's Shakespeare's turf! 🎭" },
  { q: "In what year did the Great Fire of London start?", options: ['1566', '1666', '1766', '1866'], correct: 1, joke: "Started in a bakery on Pudding Lane. A baker did THAT. 🔥" },
  { q: "Which London landmark is also called Elizabeth Tower?", options: ['The Shard', 'Buckingham Palace', 'Big Ben', 'St Paul\'s Cathedral'], correct: 2, joke: "Big Ben is actually the BELL, not the tower! 🔔" },
  { q: "What is the longest river in the UK?", options: ['River Thames', 'River Trent', 'River Severn', 'River Clyde'], correct: 2, joke: "The Severn stretches 354 km — longer than the Thames! 🌊" },
  { q: "The Tower of London was originally built by which king?", options: ['King Henry VIII', 'King Richard I', 'King William I', 'King George III'], correct: 2, joke: "William the Conqueror built it in 1066 after a very busy year!" },
  { q: "Which underground railway system is the oldest in the world?", options: ['Paris Métro', 'New York Subway', 'London Underground', 'Tokyo Metro'], correct: 2, joke: "Opened in 1863 — passengers wore top hats! 🎩" },
  { q: "What is the name of the Queen's official London residence?", options: ['Windsor Castle', 'Kensington Palace', 'Buckingham Palace', 'Hampton Court'], correct: 2, joke: "Over 775 rooms — still Mr. Jarvis couldn't find the TV remote. 📺" },
  { q: "In which English city was the Titanic built?", options: ['London', 'Liverpool', 'Southampton', 'Belfast'], correct: 3, joke: "Technically Belfast, which was in the UK at the time! Sneaky! 🚢" },
  { q: "Which famous clock is found at the Royal Observatory in London?", options: ['The Big Ben Clock', 'The Shepherd Gate Clock', 'The Waterloo Clock', 'The Meridian Clock'], correct: 1, joke: "It marks Greenwich Mean Time — the UK says it's OUR time zone! 🕐" },
  // Science
  { q: "What is the largest organ in the human body?", options: ['Brain', 'Heart', 'Liver', 'Skin'], correct: 3, joke: "You're literally wearing it right now! 🙌" },
  { q: "What gas do plants absorb during photosynthesis?", options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 2, joke: "Plants breathe in what we breathe out. Teamwork! 🌿" },
  { q: "How many bones are in the adult human body?", options: ['106', '206', '306', '406'], correct: 1, joke: "Babies have around 300 — they fuse over time! 🦴" },
  { q: "At what temperature does water boil (°C)?", options: ['90°C', '95°C', '100°C', '110°C'], correct: 2, joke: "The kettle in the staffroom knows this answer! ☕" },
  { q: "What does DNA stand for?", options: ['Digital Network Array', 'Deoxyribonucleic Acid', 'Dynamic Nucleic Agent', 'Direct Nerve Alignment'], correct: 1, joke: "Every cell in your body has 2 metres of it. Impossible but true! 🧬" },
  { q: "Which force pulls objects toward the Earth?", options: ['Magnetism', 'Friction', 'Gravity', 'Tension'], correct: 2, joke: "Same one that keeps Mr. Jarvis's feet on the ground! 🌍" },
  { q: "What is H₂O more commonly known as?", options: ['Oxygen', 'Water', 'Carbon dioxide', 'Salt'], correct: 1, joke: "Two Hydrogens walk into a bar with Oxygen… 💧" },
  { q: "How many chambers does a human heart have?", options: ['2', '3', '4', '5'], correct: 2, joke: "Two atria, two ventricles. It works hard for you! ❤️" },
  { q: "What is the chemical symbol for gold?", options: ['Go', 'Gd', 'Gl', 'Au'], correct: 3, joke: "From the Latin 'Aurum' — Romans loved the stuff 🏅" },
  { q: "What type of energy does the Sun produce?", options: ['Chemical energy', 'Nuclear fusion energy', 'Electrical energy', 'Wind energy'], correct: 1, joke: "Hydrogen smashes into helium and BOOM — sunlight! ☀️" },
  { q: "How many sides does a hexagon have?", options: ['5', '6', '7', '8'], correct: 1, joke: "Bees know this — check a honeycomb! 🐝" },
  { q: "How many degrees are in a right angle?", options: ['45°', '90°', '180°', '360°'], correct: 1, joke: "Corners of this screen — all 90°! 📐" },
  // Space
  { q: "Which planet is closest to the Sun?", options: ['Venus', 'Earth', 'Mars', 'Mercury'], correct: 3, joke: "Mercury! Very hot, no atmosphere, 0/10 holiday destination 🌡️" },
  { q: "How many planets are in our Solar System?", options: ['7', '8', '9', '10'], correct: 1, joke: "Poor Pluto was downgraded in 2006. Heartbreaking. 💔" },
  { q: "What is the largest planet in our Solar System?", options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'], correct: 2, joke: "Jupiter is so big, 1,300 Earths fit inside it! 🌍×1300" },
  { q: "Which country launched the first human into space?", options: ['USA', 'China', 'UK', 'Soviet Union'], correct: 3, joke: "Yuri Gagarin, 1961 — and no, Mr. Jarvis wasn't there yet." },
  { q: "What is the name of the first human to walk on the Moon?", options: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'Tim Peake'], correct: 1, joke: "\"One small step for man\" — in 1969, on a live TV signal more people watched than anything EVER. 🚀" },
  { q: "Which British astronaut spent 6 months on the ISS in 2015?", options: ['Helen Sharman', 'Tim Peake', 'Piers Sellers', 'Michael Foale'], correct: 1, joke: "Tim Peake even ran the London Marathon — from SPACE! 🏃" },
  { q: "How long does light from the Sun take to reach Earth?", options: ['8 seconds', '8 minutes', '8 hours', '8 days'], correct: 1, joke: "8 minutes 20 seconds — so if the Sun vanished you'd enjoy 8 more minutes of sunshine. Cheery! ☀️" },
  { q: "What is a group of stars forming a pattern called?", options: ['Galaxy', 'Nebula', 'Constellation', 'Cluster'], correct: 2, joke: "Orion, the Great Bear, the Southern Cross — all dot-to-dot for adults! ⭐" },
  // UK scientists & inventors
  { q: "Which scientist discovered gravity (inspired by an apple)?", options: ['Charles Darwin', 'Isaac Newton', 'Stephen Hawking', 'Albert Einstein'], correct: 1, joke: "Born in Lincolnshire! UK represent! 🍎" },
  { q: "Who wrote 'A Brief History of Time' and studied black holes?", options: ['Brian Cox', 'Stephen Hawking', 'Richard Dawkins', 'James Clerk Maxwell'], correct: 1, joke: "Stephen Hawking — Cambridge professor, absolute legend. 🌌" },
  { q: "Who wrote Romeo and Juliet?", options: ['Charles Dickens', 'Jane Austen', 'William Shakespeare', 'Geoffrey Chaucer'], correct: 2, joke: "Born in Stratford-upon-Avon — that IS the Avon! 🎭" },
  { q: "Which UK scientist co-discovered the structure of DNA?", options: ['Alexander Fleming', 'Francis Crick', 'Joseph Lister', 'Edward Jenner'], correct: 1, joke: "Francis Crick and James Watson in Cambridge, 1953. Watson's now very famous; Crick wrote a letter to his son about it. 🧬" },
  { q: "Who invented the telephone?", options: ['Thomas Edison', 'Nikola Tesla', 'Alexander Graham Bell', 'Guglielmo Marconi'], correct: 2, joke: "Bell was Scottish! UK again! 📞" },
  { q: "Which English doctor created the first smallpox vaccine?", options: ['Alexander Fleming', 'Joseph Lister', 'Edward Jenner', 'John Snow'], correct: 2, joke: "Jenner tested it on an 8-year-old in 1796. Health & safety would have words today. 💉" },
  // Fun & tricky
  { q: "How many sides does a 20p coin have?", options: ['5', '6', '7', '8'], correct: 2, joke: "Seven sides — it's an equilateral curve heptagon. Try saying THAT three times fast!" },
  { q: "What colour is the circle on the Japanese flag?", options: ['White', 'Red', 'Blue', 'Gold'], correct: 1, joke: "Red — called Hinomaru, meaning 'circle of the sun'. Very dramatic. ☀️" },
  { q: "How many stomachs does a cow have?", options: ['1', '2', '3', '4'], correct: 3, joke: "Four stomachs! The most hardworking digestive system in the field. 🐄" },
  { q: "What is the speed of light (approximately)?", options: ['30,000 km/s', '300,000 km/s', '3,000,000 km/s', '30 km/s'], correct: 1, joke: "300,000 km per second — fast enough to go around Earth 7½ times in one second! ⚡" },
  { q: "Which layer of the Earth do we live on?", options: ['Inner core', 'Outer core', 'Mantle', 'Crust'], correct: 3, joke: "The crust! About 30 km thick under land — like the skin on a custard. 🥧" },
];

const CHEER_LINES = [
  '🎉 ROUND OF APPLAUSE!', '⭐ GOLD STAR FOR THE CLASS!', '🎊 EVERYONE GETS PIZZA! (just kidding) 🍕',
  '🔥 ON FIRE! Keep going!', '🎓 You all just LEVELED UP!', '🌟 Class average: AWESOME%',
  '👏 Mr. Jarvis is PROUD!', '🚀 To the moon! Whoosh!',
];

interface Challenge { category: string; emoji: string; text: string; }
const CHALLENGES: Challenge[] = [
  // Brain
  { category: 'Brain', emoji: '🧠', text: 'Spell K-POP backwards out loud!' },
  { category: 'Brain', emoji: '🧠', text: 'Name 3 K-Pop groups in 10 seconds!' },
  { category: 'Brain', emoji: '🧠', text: 'Count to 20 by 2s as fast as you can!' },
  { category: 'Brain', emoji: '🧠', text: 'Math relay: 7+5, 12+8, 20+15 — go!' },
  { category: 'Brain', emoji: '🧠', text: 'Name 5 countries that start with "S"!' },
  { category: 'Brain', emoji: '🧠', text: 'List the rainbow colors in order!' },
  // Body
  { category: 'Body', emoji: '🏃', text: '30-second plank challenge — GO!' },
  { category: 'Body', emoji: '🏃', text: '20 jumping jacks — let\'s see!' },
  { category: 'Body', emoji: '🏃', text: 'Spin in a circle 5 times without falling!' },
  { category: 'Body', emoji: '🏃', text: 'Hop on one foot for 15 seconds!' },
  { category: 'Body', emoji: '🏃', text: 'Touch your toes 10 times!' },
  { category: 'Body', emoji: '🏃', text: 'Wall sit for 20 seconds!' },
  // Voice
  { category: 'Voice', emoji: '🎤', text: 'Hum a K-Pop song — class guesses!' },
  { category: 'Voice', emoji: '🎤', text: 'Sing the alphabet — but only in whispers!' },
  { category: 'Voice', emoji: '🎤', text: 'Tongue twister: "She sells seashells…" x3!' },
  { category: 'Voice', emoji: '🎤', text: 'Make up a 4-word K-Pop song title!' },
  // Silly
  { category: 'Silly', emoji: '🤪', text: 'Make the silliest face — others vote!' },
  { category: 'Silly', emoji: '🤪', text: 'Dance for 10 seconds without smiling!' },
  { category: 'Silly', emoji: '🤪', text: 'Animal noise contest — pick a farm animal!' },
  { category: 'Silly', emoji: '🤪', text: 'Walk like a penguin across the room!' },
  { category: 'Silly', emoji: '🤪', text: 'Talk in your robot voice for 30 seconds!' },
  // Team
  { category: 'Team', emoji: '🤝', text: 'Form a human spelling of your team name!' },
  { category: 'Team', emoji: '🤝', text: 'Invent a 5-second team cheer — perform it!' },
  { category: 'Team', emoji: '🤝', text: 'Mirror game — one leads, others copy!' },
  { category: 'Team', emoji: '🤝', text: 'Pass a clap around the team — no breaks!' },
];

const REWARDS = [
  { emoji: '🏃', text: '10 minutes of PE!' },
  { emoji: '💃', text: '5-minute dance party!' },
  { emoji: '✏️', text: 'Free draw time!' },
  { emoji: '🍪', text: 'Class picks tomorrow\'s snack!' },
  { emoji: '🎮', text: '10 mins extra recess!' },
  { emoji: '🎵', text: 'Pick the next K-Pop game!' },
  { emoji: '🎬', text: 'Short movie clip (5 min)!' },
  { emoji: '🏐', text: 'Silent ball game!' },
  { emoji: '🪑', text: 'Sit anywhere day!' },
  { emoji: '🎩', text: 'Wear a hat in class!' },
  { emoji: '📚', text: 'Storytime — student picks!' },
  { emoji: '⏰', text: 'Free 5 minutes — your choice!' },
  { emoji: '🎨', text: 'Whiteboard graffiti time!' },
  { emoji: '🐾', text: 'Show & tell — bring a toy tomorrow!' },
];

interface Student { name: string; stars: number; }

const JarvisHQ: React.FC = () => {
  const { setGameState } = useGameStore();
  const [tab, setTab] = useState<Tab>('quiz');

  // ---- INTRO MODAL ----
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem('jarvis_seen_intro') !== '1');
  const closeIntro = () => { localStorage.setItem('jarvis_seen_intro', '1'); setShowIntro(false); playUnlock(); };

  // ---- CLASS WINS overlay (fires on Pop Quiz wrong answer) ----
  const [classWins, setClassWins] = useState<string | null>(null);

  // ---- POP QUIZ ----
  const [shuffled] = useState<QuizQ[]>(() => [...POP_QUIZ].sort(() => Math.random() - 0.5));
  const [qIdx, setQIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [classScore, setClassScore] = useState(0);
  const [classMisses, setClassMisses] = useState(0);
  const q = shuffled[qIdx];

  const answer = (i: number) => {
    if (revealed) return;
    playClick();
    setPick(i);
    setRevealed(true);
    if (i === q.correct) { playCorrect(); setClassScore(s => s + 1); }
    else {
      playWrong(); setClassMisses(m => m + 1);
      const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];
      setClassWins(`${reward.emoji} ${reward.text}`);
      setTimeout(() => playWin(), 600);
    }
  };
  const nextQ = () => { playPop(); setRevealed(false); setPick(null); setQIdx(i => (i + 1) % shuffled.length); };
  const resetQuiz = () => { setClassScore(0); setClassMisses(0); setQIdx(0); setRevealed(false); setPick(null); playClick(); };

  // ---- ROSTER ----
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
    setStudents([...students, { name: n, stars: 0 }]); setStudentInput(''); playPop();
  };
  const removeStudent = (name: string) => { setStudents(students.filter(s => s.name !== name)); playClick(); };

  const spinPick = () => {
    if (students.length < 2 || spinning) return;
    setSpinning(true); setChosen(null); setTeams(null);
    let count = 0;
    const total = 20 + Math.floor(Math.random() * 10);
    const tick = () => {
      setChosen(students[Math.floor(Math.random() * students.length)].name);
      playTick(); count++;
      if (count < total) setTimeout(tick, 80 + count * 12);
      else { setSpinning(false); playWin(); setConfetti(true); setTimeout(() => setConfetti(false), 2000); }
    };
    tick();
  };

  const makeTeams = () => {
    if (students.length < teamCount) return;
    playUnlock();
    const shuffled = [...students].sort(() => Math.random() - 0.5).map(s => s.name);
    const t: string[][] = Array.from({ length: teamCount }, () => []);
    shuffled.forEach((n, i) => t[i % teamCount].push(n));
    setTeams(t); setChosen(null);
  };

  // ---- GOLD STARS ----
  const awardStar = (name: string) => {
    setStudents(students.map(s => s.name === name ? { ...s, stars: s.stars + 1 } : s));
    playCorrect(); setConfetti(true); setTimeout(() => setConfetti(false), 1200);
  };
  const removeStar = (name: string) => {
    setStudents(students.map(s => s.name === name ? { ...s, stars: Math.max(0, s.stars - 1) } : s));
    playClick();
  };
  const sortedByStars = [...students].sort((a, b) => b.stars - a.stars);

  // ---- CLASS BATTLE (1v1 + challenge) ----
  const [battlePair, setBattlePair] = useState<[string, string] | null>(null);
  const [battleChallenge, setBattleChallenge] = useState<Challenge | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('Any');

  const rollBattle = () => {
    playUnlock();
    if (students.length >= 2) {
      const a = Math.floor(Math.random() * students.length);
      let b = Math.floor(Math.random() * students.length);
      while (b === a) b = Math.floor(Math.random() * students.length);
      setBattlePair([students[a].name, students[b].name]);
    } else {
      setBattlePair(null);
    }
    const pool = filterCategory === 'Any' ? CHALLENGES : CHALLENGES.filter(c => c.category === filterCategory);
    setBattleChallenge(pool[Math.floor(Math.random() * pool.length)]);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1500);
  };

  // ---- REWARD ROULETTE ----
  const [rewardSpin, setRewardSpin] = useState(false);
  const [rewardIdx, setRewardIdx] = useState<number | null>(null);
  const rollReward = () => {
    if (rewardSpin) return;
    setRewardSpin(true);
    let count = 0;
    const total = 18 + Math.floor(Math.random() * 8);
    const tick = () => {
      setRewardIdx(Math.floor(Math.random() * REWARDS.length));
      playTick(); count++;
      if (count < total) setTimeout(tick, 70 + count * 14);
      else {
        setRewardSpin(false); playWin(); setConfetti(true);
        setTimeout(() => setConfetti(false), 2500);
      }
    };
    tick();
  };

  // ---- TIMER ----
  const [timerSec, setTimerSec] = useState(60);
  const [timerLeft, setTimerLeft] = useState(60);
  const [timerRun, setTimerRun] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  const startTimer = () => {
    if (timerRun) return;
    setTimerRun(true); playClick();
    timerRef.current = window.setInterval(() => {
      setTimerLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerRun(false); playTimeOut(); setConfetti(true);
          setTimeout(() => setConfetti(false), 3000);
          return 0;
        }
        if (t <= 4) playTick();
        return t - 1;
      });
    }, 1000);
  };
  const pauseTimer = () => { if (timerRef.current) clearInterval(timerRef.current); setTimerRun(false); playClick(); };
  const resetTimer = (s: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRun(false); setTimerSec(s); setTimerLeft(s); playPop();
  };
  const timerPct = timerSec > 0 ? (timerLeft / timerSec) * 100 : 0;
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ---- BOSS BATTLE ----
  const BOSS_HP_MAX = 20;
  const BOSS_POOL = [...easyQuestions, ...normalQuestions].sort(() => Math.random() - 0.5).slice(0, 40);
  const [bossActive, setBossActive] = useState(false);
  const [bossHP, setBossHP] = useState(BOSS_HP_MAX);
  const [bossQIdx, setBossQIdx] = useState(0);
  const [bossRevealed, setBossRevealed] = useState(false);
  const [bossPick, setBossPick] = useState<number | null>(null);
  const [bossWon, setBossWon] = useState(false);
  const [bossLost, setBossLost] = useState(false);

  const bossQ = BOSS_POOL[bossQIdx % BOSS_POOL.length];
  const bossCorrectIdx = bossQ?.answers.findIndex(a => a.isCorrect) ?? 0;

  const answerBoss = (i: number) => {
    if (bossRevealed) return;
    playClick();
    setBossPick(i);
    setBossRevealed(true);
    if (i === bossCorrectIdx) {
      playCorrect();
      const next = bossHP - 1;
      setBossHP(next);
      if (next <= 0) { setBossWon(true); setBossActive(false); setConfetti(true); playUnlock(); setTimeout(() => setConfetti(false), 4000); }
    } else {
      playWrong();
      const next = Math.min(bossHP + 1, BOSS_HP_MAX);
      setBossHP(next);
      if (next >= BOSS_HP_MAX && bossQIdx > 3) { setBossLost(true); setBossActive(false); }
    }
  };
  const nextBossQ = () => { setBossRevealed(false); setBossPick(null); setBossQIdx(i => i + 1); playPop(); };
  const startBoss = () => { setBossHP(BOSS_HP_MAX); setBossQIdx(0); setBossRevealed(false); setBossPick(null); setBossWon(false); setBossLost(false); setBossActive(true); playWin(); };
  const resetBoss = () => { setBossActive(false); setBossWon(false); setBossLost(false); setBossHP(BOSS_HP_MAX); };

  // ---- POWER CARDS ----
  const [drawnCard, setDrawnCard] = useState<PowerCard | null>(null);
  const [drawing, setDrawing] = useState(false);
  const drawPowerCard = () => {
    if (drawing) return;
    playClick();
    setDrawing(true);
    setDrawnCard(null);
    setTimeout(() => {
      const r = Math.random();
      const pool = r < 0.1
        ? POWER_CARDS.filter(c => c.rarity === 'legendary')
        : r < 0.4
        ? POWER_CARDS.filter(c => c.rarity === 'rare')
        : POWER_CARDS.filter(c => c.rarity === 'common');
      const card = pool[Math.floor(Math.random() * pool.length)];
      setDrawnCard(card);
      setDrawing(false);
      if (card.rarity === 'legendary') { playUnlock(); setConfetti(true); setTimeout(() => setConfetti(false), 2500); }
      else playPop();
    }, 900);
  };

  // ---- SCIENCE MISSIONS ----
  const [mission, setMission] = useState<Mission | null>(null);
  const drawMission = () => {
    playClick();
    const m = SCIENCE_MISSIONS[Math.floor(Math.random() * SCIENCE_MISSIONS.length)];
    setMission(m);
    playPop();
  };

  // ---- NOISE ----
  const [cheer, setCheer] = useState<string | null>(null);
  const cheerTimer = useRef<number | null>(null);
  const fireCheer = () => {
    const line = CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)];
    setCheer(line); setConfetti(true); playWin();
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => { setCheer(null); setConfetti(false); }, 2500);
  };

  const TABS: { id: Tab; emoji: string; label: string }[] = [
    { id: 'quiz', emoji: '🍎', label: 'Quiz' },
    { id: 'rollcall', emoji: '📋', label: 'Roll' },
    { id: 'stars', emoji: '⭐', label: 'Stars' },
    { id: 'battle', emoji: '🏆', label: 'Battle' },
    { id: 'reward', emoji: '🎁', label: 'Reward' },
    { id: 'timer', emoji: '⏱️', label: 'Timer' },
    { id: 'noise', emoji: '🔔', label: 'Cheer' },
    { id: 'power', emoji: '🃏', label: 'Power' },
    { id: 'science', emoji: '🧪', label: 'Science' },
    { id: 'boss', emoji: '👹', label: 'Boss' },
  ];

  const PANEL_BG = { background: 'linear-gradient(135deg, #2d3a2e 0%, #1e2a1f 100%)' };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen p-4 flex flex-col items-center"
      style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}
    >
      {confetti && <ConfettiBurst count={50} durationMs={2000} />}

      {/* INTRO MODAL */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              className="rounded-3xl border-4 border-amber-500 p-6 max-w-md w-full text-center"
              style={PANEL_BG}>
              <div className="text-6xl mb-2">👨‍🏫</div>
              <h2 className="font-fredoka font-bold text-amber-300 text-2xl mb-2">Hello, Mr. Jarvis!</h2>
              <p className="font-nunito text-amber-100 text-base mb-3 leading-relaxed">
                This is <span className="font-bold text-amber-300">YOUR</span> teacher's secret menu. The class doesn't know it exists. 🤫
              </p>
              <div className="bg-amber-100 text-stone-900 rounded-2xl p-4 mb-3 text-left font-nunito text-sm leading-relaxed border-2 border-amber-700">
                <p className="font-fredoka font-bold text-amber-700 text-base mb-2">📜 The Pact:</p>
                <p>• If <span className="font-bold">YOU</span> get a Pop Quiz answer wrong, the class wins a <span className="font-bold">10-minute fun reward</span>.</p>
                <p>• They choose: 🏃 PE · 💃 dance · ✏️ free draw · or anything else from the Reward Roulette.</p>
                <p>• Roll 1v1 Battles · Spin Class Rewards · Big classroom Timer · Cheer Cannon.</p>
                <p className="mt-2 text-xs italic text-stone-600">Sign here: <span className="font-bold">Mr. Jarvis ✍️</span></p>
              </div>
              <button onClick={closeIntro}
                className="w-full py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-900 font-fredoka font-bold text-lg">
                🍎 Accept &amp; Enter the Lounge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CLASS WINS overlay */}
      <AnimatePresence>
        {classWins && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-4"
            onClick={() => setClassWins(null)}>
            <ConfettiBurst count={80} durationMs={3000} />
            <motion.div
              initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
              className="bg-amber-400 text-stone-900 rounded-3xl p-6 max-w-sm w-full text-center border-8 border-red-500">
              <div className="text-5xl mb-2">🎉</div>
              <p className="font-fredoka font-bold text-2xl mb-2">CLASS WINS!</p>
              <p className="font-nunito text-sm mb-3">Mr. Jarvis got that one wrong! 😂<br/>Your reward:</p>
              <div className="bg-stone-900 text-amber-300 rounded-2xl p-4 font-fredoka text-xl mb-3">{classWins}</div>
              <button onClick={() => setClassWins(null)}
                className="px-6 py-2 rounded-full bg-stone-900 text-amber-300 font-fredoka">Tap to claim 🎊</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHEER overlay */}
      <AnimatePresence>
        {cheer && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-amber-400 text-stone-900 font-fredoka font-bold text-4xl md:text-6xl px-8 py-6 rounded-3xl shadow-2xl border-8 border-amber-600 text-center">
              {cheer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl w-full mx-auto">
        <div className="flex gap-2 mb-3">
          <button onClick={() => { playClick(); setGameState('game_mode'); }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-full font-fredoka text-sm">← Back</button>
          <button onClick={() => setShowIntro(true)}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-full font-fredoka text-xs border border-amber-700">📜 Pact</button>
        </div>

        {/* Header */}
        <div className="text-center mb-4 p-5 rounded-3xl border-4 border-amber-700" style={PANEL_BG}>
          <div className="text-5xl mb-1">👨‍🏫</div>
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-amber-200">Mr. Jarvis's Lounge</h1>
          <p className="font-nunito text-amber-100/80 text-sm">Class is in session 🍎📋⭐</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1 mb-4 bg-stone-800 rounded-2xl p-1 border-2 border-amber-700">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { playClick(); setTab(t.id); }}
              className={`py-2 px-1 rounded-xl font-fredoka text-xs transition-colors ${tab === t.id ? 'bg-amber-500 text-stone-900' : 'text-amber-200 hover:bg-stone-700'}`}>
              <div className="text-lg">{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>

        {/* POP QUIZ */}
        {tab === 'quiz' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700" style={PANEL_BG}>
            <div className="flex justify-between items-center mb-2 text-amber-100 font-fredoka text-sm">
              <span>Question {qIdx + 1} / {POP_QUIZ.length}</span>
              <span>✅ {classScore} · ❌ {classMisses}</span>
            </div>
            <p className="text-amber-300/80 font-nunito text-xs mb-2 text-center italic">
              ⚠️ Get this wrong → Class wins a reward!
            </p>
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
                  <motion.button key={i} whileTap={{ scale: 0.96 }} onClick={() => answer(i)} disabled={revealed}
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
                className="flex-1 py-2 rounded-full font-fredoka text-sm bg-amber-500 text-stone-900 disabled:opacity-40 hover:bg-amber-400">🔍 Reveal</button>
              <button onClick={nextQ}
                className="flex-1 py-2 rounded-full font-fredoka text-sm bg-stone-700 text-amber-100 hover:bg-stone-600">➡️ Next</button>
              <button onClick={resetQuiz}
                className="px-3 py-2 rounded-full font-fredoka text-xs bg-red-700 text-white hover:bg-red-600">Reset</button>
            </div>
          </div>
        )}

        {/* ROLL CALL */}
        {tab === 'rollcall' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 space-y-3" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-lg">📋 Roster ({students.length})</h3>
            <div className="flex gap-2">
              <input value={studentInput} onChange={e => setStudentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStudent(); }}
                placeholder="Add student name…"
                className="flex-1 px-3 py-2 rounded-full bg-stone-900 text-amber-100 placeholder-stone-500 border-2 border-amber-700 focus:outline-none focus:border-amber-400 font-nunito text-sm"/>
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
                  <motion.div key={chosen} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
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
                    className={`w-8 h-8 rounded-full font-fredoka text-sm ${teamCount === n ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-amber-100'}`}>{n}</button>
                ))}
                <button onClick={makeTeams} disabled={students.length < teamCount}
                  className="flex-1 py-2 px-3 bg-stone-700 hover:bg-stone-600 text-amber-100 rounded-full font-fredoka text-sm disabled:opacity-40">Split into teams!</button>
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
          <div className="rounded-3xl p-5 border-4 border-amber-700" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-lg mb-2">⭐ Gold Star Awards</h3>
            {students.length === 0 ? (
              <p className="text-amber-100/70 font-nunito text-sm text-center py-3">Add students in the Roll Call tab first!</p>
            ) : (
              <div className="space-y-2">
                {sortedByStars.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 bg-stone-900 rounded-xl p-2 border border-amber-700">
                    <span className="font-fredoka text-amber-300 w-6 text-center">{i === 0 && s.stars > 0 ? '👑' : `#${i + 1}`}</span>
                    <span className="flex-1 font-fredoka text-amber-100 text-sm">{s.name}</span>
                    <span className="font-fredoka text-amber-300 text-sm min-w-[2rem] text-right">{s.stars}⭐</span>
                    <button onClick={() => removeStar(s.name)} className="w-7 h-7 bg-stone-700 text-amber-100 rounded-full text-sm">−</button>
                    <button onClick={() => awardStar(s.name)} className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-full font-bold">+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLASS BATTLE */}
        {tab === 'battle' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-lg mb-2">🏆 Class Battle</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-3">
              Pick 2 students + a random challenge. Whoever wins gets a Gold Star! ⭐
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {['Any', 'Brain', 'Body', 'Voice', 'Silly', 'Team'].map(c => (
                <button key={c} onClick={() => { setFilterCategory(c); playClick(); }}
                  className={`px-3 py-1 rounded-full font-fredoka text-xs ${filterCategory === c ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-amber-100'}`}>{c}</button>
              ))}
            </div>
            <button onClick={rollBattle}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white font-fredoka text-lg shadow-lg mb-3">
              🎲 ROLL BATTLE!
            </button>
            <AnimatePresence mode="wait">
              {battleChallenge && (
                <motion.div key={(battlePair?.join('') || '') + battleChallenge.text}
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-3">
                  {battlePair ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="flex-1 bg-blue-600 text-white rounded-2xl p-3 font-fredoka text-center text-lg">{battlePair[0]}</div>
                      <div className="text-amber-300 font-fredoka text-2xl">VS</div>
                      <div className="flex-1 bg-red-600 text-white rounded-2xl p-3 font-fredoka text-center text-lg">{battlePair[1]}</div>
                    </div>
                  ) : (
                    <p className="text-center text-amber-200 font-nunito text-sm italic">
                      (Add 2+ students in Roll Call to pick fighters!)
                    </p>
                  )}
                  <div className="bg-amber-100 text-stone-900 rounded-2xl p-4 border-4 border-amber-400">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-3xl">{battleChallenge.emoji}</span>
                      <span className="font-fredoka text-amber-700 font-bold">{battleChallenge.category} Challenge</span>
                    </div>
                    <p className="font-fredoka text-lg leading-snug">{battleChallenge.text}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* REWARD ROULETTE */}
        {tab === 'reward' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 text-center" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-2">🎁 Reward Roulette</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-3">
              Class earned a treat? Spin the wheel of fun!
            </p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={rollReward} disabled={rewardSpin}
              className="w-full py-4 rounded-2xl bg-gradient-to-br from-pink-500 via-amber-500 to-yellow-400 text-white font-fredoka text-2xl shadow-xl mb-4 disabled:opacity-60">
              🎰 SPIN THE WHEEL!
            </motion.button>
            {rewardIdx !== null && (
              <motion.div
                key={rewardIdx + (rewardSpin ? 'spin' : 'done')}
                initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: rewardSpin ? 1 : 1.05, opacity: 1 }}
                className={`rounded-3xl p-6 border-4 ${rewardSpin ? 'border-amber-400 bg-stone-900' : 'border-amber-300 bg-amber-100'}`}>
                <div className="text-6xl mb-2">{REWARDS[rewardIdx].emoji}</div>
                <p className={`font-fredoka text-2xl ${rewardSpin ? 'text-amber-200' : 'text-stone-900'}`}>
                  {REWARDS[rewardIdx].text}
                </p>
                {!rewardSpin && <p className="font-nunito text-stone-700 text-xs mt-2 italic">🎉 Class winners — enjoy!</p>}
              </motion.div>
            )}
          </div>
        )}

        {/* TIMER */}
        {tab === 'timer' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 text-center" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-2">⏱️ Big Class Timer</h3>
            <div className="bg-stone-900 rounded-3xl p-6 border-4 border-amber-500 mb-3">
              <div className={`font-fredoka font-bold text-7xl md:text-8xl ${timerLeft <= 5 && timerRun ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                {fmtTime(timerLeft)}
              </div>
              <div className="bg-stone-700 rounded-full h-3 mt-3 overflow-hidden">
                <motion.div
                  className="h-3 bg-gradient-to-r from-green-400 via-amber-400 to-red-500"
                  animate={{ width: `${timerPct}%` }} transition={{ duration: 0.3 }}/>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1 mb-3">
              {[30, 60, 120, 300, 600].map(s => (
                <button key={s} onClick={() => resetTimer(s)}
                  className={`py-2 rounded-xl font-fredoka text-xs ${timerSec === s ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-amber-100'}`}>
                  {s < 60 ? `${s}s` : `${s / 60}m`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {timerRun ? (
                <button onClick={pauseTimer} className="flex-1 py-3 rounded-full bg-stone-700 text-amber-100 font-fredoka">⏸ Pause</button>
              ) : (
                <button onClick={startTimer} disabled={timerLeft === 0}
                  className="flex-1 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-fredoka disabled:opacity-40">▶ Start</button>
              )}
              <button onClick={() => resetTimer(timerSec)} className="px-4 py-3 rounded-full bg-amber-500 text-stone-900 font-fredoka">↺ Reset</button>
            </div>
          </div>
        )}

        {/* CHEER */}
        {tab === 'noise' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700 text-center" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-2">🔔 Class Cheer Cannon</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-4">Hit it whenever the class earns a celebration!</p>
            <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} onClick={fireCheer}
              className="w-full py-6 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white font-fredoka text-3xl shadow-xl">
              🎉 FIRE THE CONFETTI! 🎉
            </motion.button>
          </div>
        )}

        {tab === 'power' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-1 text-center">🃏 Power Cards</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-4 text-center">
              Flip a card mid-game to keep teams close. Mr. Jarvis decides when to play one!
            </p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={drawPowerCard} disabled={drawing}
              className="w-full py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-700 text-white font-fredoka text-2xl shadow-xl mb-4 disabled:opacity-60">
              {drawing ? '🔀 Shuffling...' : '🎴 Draw a Power Card'}
            </motion.button>
            <AnimatePresence mode="wait">
              {drawnCard && !drawing && (
                <motion.div
                  key={drawnCard.name}
                  initial={{ rotateY: 180, scale: 0.6, opacity: 0 }}
                  animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`rounded-2xl p-5 border-4 text-center shadow-2xl ${
                    drawnCard.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-300 to-amber-500 border-yellow-200 text-stone-900' :
                    drawnCard.rarity === 'rare' ? 'bg-gradient-to-br from-purple-400 to-violet-600 border-purple-200 text-white' :
                    'bg-gradient-to-br from-blue-400 to-cyan-500 border-blue-200 text-white'
                  }`}
                >
                  <div className="text-xs font-nunito uppercase tracking-widest opacity-80 mb-1">
                    {drawnCard.rarity === 'legendary' ? '★ LEGENDARY ★' : drawnCard.rarity === 'rare' ? '◆ RARE ◆' : '● COMMON ●'}
                  </div>
                  <div className="text-6xl mb-2">{drawnCard.emoji}</div>
                  <div className="font-fredoka text-2xl mb-2">{drawnCard.name}</div>
                  <div className="font-nunito text-base">{drawnCard.desc}</div>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="font-nunito text-amber-100/60 text-xs mt-4 text-center">
              💡 Save legendaries for the closest matches.
            </p>
          </div>
        )}

        {tab === 'boss' && (
          <div className="rounded-3xl p-5 border-4 border-red-700" style={PANEL_BG}>
            <h3 className="font-fredoka text-red-300 text-xl mb-1 text-center">👹 Boss Battle</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-4 text-center">
              Class vs the Anti-Fan Boss! Correct answers deal damage — wrong answers heal the Boss.
            </p>

            {!bossActive && !bossWon && !bossLost && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={startBoss}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-red-600 to-rose-800 text-white font-fredoka text-2xl shadow-xl">
                👹 Summon the Anti-Fan Boss!
              </motion.button>
            )}

            {(bossActive || bossWon || bossLost) && (
              <>
                {/* Boss health bar */}
                <div className="mb-4">
                  <div className="flex justify-between font-nunito text-sm text-amber-200 mb-1">
                    <span>👹 Anti-Fan Boss HP</span>
                    <span className="font-bold">{bossHP} / {BOSS_HP_MAX}</span>
                  </div>
                  <div className="h-6 bg-stone-900 rounded-full overflow-hidden border-2 border-red-700">
                    <motion.div
                      animate={{ width: `${(bossHP / BOSS_HP_MAX) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ background: bossHP <= 5 ? 'linear-gradient(90deg,#16a34a,#15803d)' : bossHP <= 10 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#ef4444,#b91c1c)' }}
                    />
                  </div>
                  <div className="flex gap-1 mt-1 justify-center">
                    {Array.from({ length: BOSS_HP_MAX }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < bossHP ? 'bg-red-500' : 'bg-stone-700'}`} />
                    ))}
                  </div>
                </div>

                {bossWon && (
                  <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                    className="text-center py-6">
                    <div className="text-6xl mb-2">🏆</div>
                    <div className="font-fredoka text-3xl text-yellow-300 mb-2">CLASS WINS!</div>
                    <div className="font-nunito text-amber-100 mb-4">The Anti-Fan Boss is defeated! 🎉</div>
                    <button onClick={resetBoss} className="px-6 py-3 rounded-2xl bg-amber-500 text-stone-900 font-fredoka text-lg">Play Again</button>
                  </motion.div>
                )}

                {bossLost && (
                  <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                    className="text-center py-6">
                    <div className="text-6xl mb-2">💀</div>
                    <div className="font-fredoka text-3xl text-red-400 mb-2">BOSS WINS... THIS TIME!</div>
                    <div className="font-nunito text-amber-100 mb-4">The class needs more training! Try again 💪</div>
                    <button onClick={resetBoss} className="px-6 py-3 rounded-2xl bg-red-700 text-white font-fredoka text-lg">Rematch!</button>
                  </motion.div>
                )}

                {bossActive && bossQ && (
                  <>
                    <div className="bg-stone-900 rounded-2xl p-4 mb-3 border border-stone-700">
                      <div className="font-nunito text-xs text-amber-400 uppercase mb-2">Question {bossQIdx + 1}</div>
                      <div className="font-fredoka text-amber-100 text-lg leading-snug">{bossQ.questionText}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 mb-3">
                      {bossQ.answers.map((ans, i) => {
                        const isRight = bossRevealed && i === bossCorrectIdx;
                        const isWrong = bossRevealed && bossPick === i && i !== bossCorrectIdx;
                        return (
                          <motion.button
                            key={i}
                            whileTap={{ scale: bossRevealed ? 1 : 0.96 }}
                            onClick={() => answerBoss(i)}
                            disabled={bossRevealed}
                            className={`p-3 rounded-xl font-nunito text-sm text-left border-2 transition-colors ${
                              isRight ? 'bg-green-800 border-green-400 text-green-100' :
                              isWrong ? 'bg-red-900 border-red-500 text-red-200' :
                              'bg-stone-800 border-stone-600 text-amber-100 hover:border-amber-500'
                            }`}
                          >
                            {ans.answerText}
                          </motion.button>
                        );
                      })}
                    </div>
                    {bossRevealed && (
                      <motion.button
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={nextBossQ}
                        className="w-full py-3 rounded-2xl bg-amber-500 text-stone-900 font-fredoka text-lg">
                        Next Question →
                      </motion.button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'science' && (
          <div className="rounded-3xl p-5 border-4 border-amber-700" style={PANEL_BG}>
            <h3 className="font-fredoka text-amber-200 text-xl mb-1 text-center">🧪 Idol Training Missions</h3>
            <p className="font-nunito text-amber-100/80 text-sm mb-4 text-center">
              Real science experiments — reframed as K-Pop idol training. Pick one for class!
            </p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={drawMission}
              className="w-full py-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-fredoka text-2xl shadow-xl mb-4">
              🎲 Draw a Mission
            </motion.button>
            <AnimatePresence mode="wait">
              {mission && (
                <motion.div
                  key={mission.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-amber-50 text-stone-900 rounded-2xl p-5 border-4 border-amber-400 shadow-xl"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs font-nunito uppercase tracking-wider text-amber-700">Mission Card</div>
                    <div className="text-xs font-fredoka text-amber-700">⏱️ {mission.minutes} min</div>
                  </div>
                  <h4 className="font-fredoka text-2xl text-stone-900 mb-2">🎯 {mission.title}</h4>
                  <div className="bg-white rounded-xl p-3 mb-3 border-2 border-amber-200">
                    <div className="font-nunito text-base">{mission.brief}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="bg-stone-100 rounded-xl p-2">
                      <div className="text-xs uppercase text-stone-500 font-nunito">Equipment</div>
                      <div className="font-fredoka">{mission.equipment}</div>
                    </div>
                    <div className="bg-stone-100 rounded-xl p-2">
                      <div className="text-xs uppercase text-stone-500 font-nunito">Duration</div>
                      <div className="font-fredoka">{mission.minutes} minutes</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-3">
                    <div className="text-xs uppercase text-blue-700 font-nunito font-bold mb-1">🔬 The Science</div>
                    <div className="font-nunito text-sm text-stone-700">{mission.science}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default JarvisHQ;
