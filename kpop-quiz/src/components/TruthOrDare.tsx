import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playPop, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const TRUTHS = [
  "What's the most embarrassing song you secretly love?",
  "If you could swap lives with a K-pop idol for one day, who would you pick and why?",
  "What's the silliest thing you've ever done in public?",
  "Have you ever laughed so hard something came out of your nose?",
  "What's a talent you have that nobody knows about?",
  "If your life had a theme song, what would it be?",
  "What's the weirdest food combination you've actually enjoyed?",
  "Have you ever talked to yourself in a mirror pretending to be famous?",
  "What's the last thing you Googled that you'd be embarrassed about?",
  "If animals could talk, which one do you think would be the rudest?",
  "What's your most useless hidden talent?",
  "If you had to eat one food for the rest of your life, what would it be?",
  "Have you ever blamed someone else for something you did?",
  "What's the strangest dream you've ever had?",
  "If you were a K-pop idol, what would your fanbase be called?",
  "What's a word you always spell wrong no matter how many times you look it up?",
  "Have you ever walked into a glass door or wall?",
  "If you could only speak in song lyrics for one day, which artist would you choose?",
  "What's the most dramatic thing you've ever done over something tiny?",
  "If you were a villain in a K-pop music video, what would your evil plan be?",
  "What noise does your stomach make when you're hungry in a quiet room?",
  "Have you ever pretended not to be home when someone rang the doorbell?",
  "What's a nickname someone gave you that you secretly hate?",
  "If you could uninvent one thing, what would it be?",
  "What's the last lie you told — even a tiny one?",
];

const DARES = [
  { text: "Do your best K-pop idol bow and hold it for 10 full seconds.", emoji: "🙇" },
  { text: "Sing the first 10 seconds of any K-pop song in the voice of a robot.", emoji: "🤖" },
  { text: "Do 15 jumping jacks while yelling 'FIGHTING!' on each one.", emoji: "✊" },
  { text: "Strike a dramatic music video pose and freeze for 15 seconds.", emoji: "💅" },
  { text: "Narrate everything you do for the next 30 seconds like a nature documentary.", emoji: "🎙️" },
  { text: "Do your best impression of a melting ice cream cone.", emoji: "🍦" },
  { text: "Speak in a British accent for the next 2 rounds.", emoji: "🎩" },
  { text: "Do a slow-motion action replay of the last thing you did.", emoji: "🎬" },
  { text: "Moonwalk across the room — or try your hardest to.", emoji: "🕺" },
  { text: "Do your best dramatic K-drama crying scene for 15 seconds.", emoji: "😭" },
  { text: "Pretend you're a news reporter and announce what's happening in the room right now.", emoji: "📺" },
  { text: "Do your best worm — or at least attempt it.", emoji: "🐛" },
  { text: "Compliment everyone in the group using only food words.", emoji: "🍕" },
  { text: "Try to lick your elbow. (Nobody can do it!)", emoji: "😜" },
  { text: "Do 10 push-ups while singing happy birthday.", emoji: "💪" },
  { text: "Talk without closing your mouth for 20 seconds straight.", emoji: "😬" },
  { text: "Pretend to be a K-pop star accepting an award. Give a 20-second speech.", emoji: "🏆" },
  { text: "Do your best impression of the person to your left.", emoji: "🎭" },
  { text: "Freestyle rap for 15 seconds about whatever's in the room.", emoji: "🎤" },
  { text: "Do the most dramatic hair flip you can, three times in a row.", emoji: "💁" },
  { text: "Speak only in questions for the next 2 minutes.", emoji: "❓" },
  { text: "Do your best chicken dance for 10 seconds.", emoji: "🐔" },
  { text: "Make the funniest face you can and hold it for 10 seconds while everyone watches.", emoji: "😵" },
  { text: "Describe your last dream as dramatically as possible in 30 seconds.", emoji: "💭" },
  { text: "Try to juggle 3 random objects from the room.", emoji: "🤹" },
];

type CardType = 'truth' | 'dare';
type Phase = 'setup' | 'spin' | 'card' | 'vote' | 'scores';

interface Player { name: string; score: number; }

function pickCard(type: CardType) {
  if (type === 'truth') return TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
  return DARES[Math.floor(Math.random() * DARES.length)];
}

const PLAYER_COLORS = [
  'from-pink-400 to-rose-500',
  'from-purple-400 to-indigo-500',
  'from-blue-400 to-cyan-500',
  'from-green-400 to-emerald-500',
];

const TruthOrDare: React.FC = () => {
  const { setGameState } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState<Player[]>([
    { name: '', score: 0 }, { name: '', score: 0 },
  ]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [cardType, setCardType] = useState<CardType>('truth');
  const [card, setCard] = useState<string | { text: string; emoji: string } | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const [round, setRound] = useState(1);
  const MAX_ROUNDS = 8;

  const addPlayer = () => {
    if (players.length < 4) setPlayers(p => [...p, { name: '', score: 0 }]);
  };
  const removePlayer = (i: number) => {
    if (players.length > 2) setPlayers(p => p.filter((_, j) => j !== i));
  };
  const updateName = (i: number, name: string) => {
    setPlayers(p => p.map((pl, j) => j === i ? { ...pl, name } : pl));
  };

  const startGame = () => {
    if (players.some(p => !p.name.trim())) return;
    playUnlock();
    setPhase('spin');
    setRound(1);
  };

  const spinWheel = () => {
    if (spinning) return;
    playClick();
    setSpinning(true);
    const extra = 1440 + Math.random() * 720;
    setSpinAngle(a => a + extra);
    setTimeout(() => {
      setSpinning(false);
      const next = Math.floor(Math.random() * players.length);
      setCurrentPlayerIdx(next);
      setPhase('card');
      setCard(null);
      setVotes({ yes: 0, no: 0 });
    }, 1200);
  };

  const chooseCard = (type: CardType) => {
    playPop();
    setCardType(type);
    const picked = pickCard(type);
    setCard(picked);
  };

  const submitVote = (pass: boolean) => {
    playClick();
    if (pass) {
      setVotes(v => ({ ...v, yes: v.yes + 1 }));
    } else {
      setVotes(v => ({ ...v, no: v.no + 1 }));
    }
  };

  const resolveRound = () => {
    const passed = votes.yes > votes.no;
    if (passed) {
      playCorrect();
      setPlayers(p => p.map((pl, i) =>
        i === currentPlayerIdx ? { ...pl, score: pl.score + 10 } : pl
      ));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1500);
    } else {
      playWrong();
    }
    if (round >= MAX_ROUNDS) {
      setTimeout(() => setPhase('scores'), 800);
    } else {
      setRound(r => r + 1);
      setPhase('spin');
      setCard(null);
    }
  };

  const restart = () => {
    playClick();
    setPhase('setup');
    setPlayers(p => p.map(pl => ({ ...pl, score: 0 })));
    setRound(1);
    setCard(null);
  };

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={40} durationMs={1500} />}

      <div className="max-w-lg w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🎯</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Truth or Dare!</h1>
          <p className="font-nunito text-gray-500 text-sm mt-1">K-pop edition • {MAX_ROUNDS} rounds</p>
        </div>

        <AnimatePresence mode="wait">

          {/* SETUP */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-4">
                <h2 className="font-fredoka font-bold text-xl text-gray-800 mb-4 text-center">👥 Who's Playing?</h2>
                {players.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${PLAYER_COLORS[i]} flex items-center justify-center text-white font-fredoka font-bold text-sm flex-shrink-0`}>
                      {i + 1}
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => updateName(i, e.target.value)}
                      placeholder={`Player ${i + 1} name`}
                      maxLength={12}
                      className="flex-1 border-2 border-purple-200 rounded-xl px-3 py-2 font-nunito text-base focus:outline-none focus:border-purple-400"
                    />
                    {players.length > 2 && (
                      <button onClick={() => removePlayer(i)} className="text-red-400 hover:text-red-600 text-xl font-bold">✕</button>
                    )}
                  </div>
                ))}
                {players.length < 4 && (
                  <button onClick={addPlayer} className="w-full border-2 border-dashed border-purple-300 rounded-xl py-2 font-fredoka text-purple-500 hover:bg-purple-50 transition-colors">
                    + Add Player (max 4)
                  </button>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={startGame}
                disabled={players.some(p => !p.name.trim())}
                className="w-full btn-kid font-fredoka text-xl py-4"
              >
                🎯 Start Truth or Dare!
              </motion.button>
            </motion.div>
          )}

          {/* SPIN */}
          {phase === 'spin' && (
            <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-4 text-center">
                <div className="flex justify-between text-sm font-nunito text-gray-400 mb-4">
                  <span>Round {round}/{MAX_ROUNDS}</span>
                  {players.map((p, i) => (
                    <span key={i} className="font-fredoka font-bold text-purple-600">{p.name}: {p.score}</span>
                  ))}
                </div>
                <p className="font-fredoka text-xl text-gray-700 mb-6">Spin to see who goes next!</p>
                <motion.div
                  animate={{ rotate: spinAngle }}
                  transition={{ duration: 1.2, ease: [0.2, 0.8, 0.6, 1] }}
                  className="text-8xl mx-auto mb-6 cursor-pointer select-none"
                  style={{ display: 'inline-block' }}
                  onClick={spinWheel}
                >
                  🎡
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={spinWheel}
                  disabled={spinning}
                  className="btn-kid font-fredoka text-xl px-10"
                >
                  {spinning ? '🌀 Spinning...' : '🎡 Spin!'}
                </motion.button>
              </div>
              {/* Scoreboard */}
              <div className="flex gap-2 flex-wrap justify-center">
                {players.map((p, i) => (
                  <div key={i} className={`bg-gradient-to-r ${PLAYER_COLORS[i]} text-white px-4 py-2 rounded-full font-fredoka font-bold shadow`}>
                    {p.name}: ⭐{p.score}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* CARD */}
          {phase === 'card' && (
            <motion.div key="card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className={`bg-gradient-to-r ${PLAYER_COLORS[currentPlayerIdx]} rounded-3xl p-4 text-center text-white mb-4 shadow-xl`}>
                <p className="font-fredoka text-2xl font-bold">
                  {players[currentPlayerIdx].name}'s Turn! 🎉
                </p>
              </div>

              {!card ? (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -4 }} whileTap={{ scale: 0.95 }}
                    onClick={() => chooseCard('truth')}
                    className="bg-blue-50 border-4 border-blue-300 rounded-3xl p-8 text-center shadow-lg"
                  >
                    <div className="text-5xl mb-2">💬</div>
                    <p className="font-fredoka font-bold text-2xl text-blue-700">TRUTH</p>
                    <p className="font-nunito text-sm text-blue-500 mt-1">Answer honestly!</p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, y: -4 }} whileTap={{ scale: 0.95 }}
                    onClick={() => chooseCard('dare')}
                    className="bg-orange-50 border-4 border-orange-300 rounded-3xl p-8 text-center shadow-lg"
                  >
                    <div className="text-5xl mb-2">🔥</div>
                    <p className="font-fredoka font-bold text-2xl text-orange-700">DARE</p>
                    <p className="font-nunito text-sm text-orange-500 mt-1">Be brave!</p>
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className={`rounded-3xl p-6 shadow-2xl border-4 mb-4 text-center ${cardType === 'truth' ? 'bg-blue-50 border-blue-300' : 'bg-orange-50 border-orange-300'}`}>
                    <div className="text-4xl mb-3">
                      {cardType === 'truth' ? '💬' : (card as { emoji: string; text: string }).emoji}
                    </div>
                    <p className={`font-fredoka font-bold text-lg mb-4 ${cardType === 'truth' ? 'text-blue-700' : 'text-orange-700'}`}>
                      {cardType === 'truth' ? String(card) : (card as { text: string }).text}
                    </p>
                    <div className="border-t-2 border-dashed border-gray-200 pt-4">
                      <p className="font-fredoka text-gray-600 mb-3">Everyone votes — did they do it?</p>
                      <div className="flex gap-3 justify-center mb-3">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => submitVote(true)}
                          className="bg-green-400 text-white px-6 py-3 rounded-full font-fredoka text-lg font-bold shadow hover:bg-green-500 flex items-center gap-2">
                          👍 Yes! +{votes.yes}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => submitVote(false)}
                          className="bg-red-400 text-white px-6 py-3 rounded-full font-fredoka text-lg font-bold shadow hover:bg-red-500 flex items-center gap-2">
                          👎 Nope! +{votes.no}
                        </motion.button>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={resolveRound}
                        className="btn-kid font-fredoka text-lg w-full"
                      >
                        Next Round →
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* SCORES */}
          {phase === 'scores' && (
            <motion.div key="scores" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              {showConfetti && <ConfettiBurst count={80} durationMs={3000} />}
              <div className="bg-white rounded-3xl p-6 shadow-2xl border-2 border-purple-200 mb-4 text-center">
                <div className="text-6xl mb-3">🏆</div>
                <h2 className="text-4xl font-fredoka font-bold text-purple-600 mb-6">Final Scores!</h2>
                {sorted.map((p, i) => (
                  <motion.div
                    key={p.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl mb-3 ${i === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50 border-2 border-gray-200'}`}
                  >
                    <span className="text-3xl">{['🥇', '🥈', '🥉', '4️⃣'][i]}</span>
                    <span className="font-fredoka font-bold text-xl text-gray-800 flex-1 text-left">{p.name}</span>
                    <span className="font-fredoka font-bold text-2xl text-purple-600">{p.score} pts</span>
                  </motion.div>
                ))}
                <p className="font-fredoka text-2xl text-yellow-600 mt-4">
                  🎉 {sorted[0].name} wins!
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={restart} className="btn-kid font-fredoka text-lg">🔄 Play Again</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary font-fredoka text-lg">🏠 Menu</motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TruthOrDare;
