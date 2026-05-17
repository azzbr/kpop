import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playPop, playCorrect, playWrong, playClick } from '../utils/sounds';

interface Joke {
  setup: string;
  punchline: string;
  emoji: string;
}

const JOKES: Joke[] = [
  { setup: 'Why did the K-pop idol bring a ladder to the concert?', punchline: 'Because they wanted to reach the HIGH notes! 🎵', emoji: '🎤' },
  { setup: 'What do you call a K-pop group made of vegetables?', punchline: 'BEETS! They really turnip the volume! 🥕', emoji: '🥦' },
  { setup: 'Why did the music teacher go to jail?', punchline: 'Because she got caught with too many noteworthy crimes! 🎼', emoji: '👮' },
  { setup: 'What\'s a K-pop idol\'s favourite type of maths?', punchline: 'Mu-LTI-plication! (multiply the fans!)', emoji: '✖️' },
  { setup: 'Why don\'t K-pop stars ever get lost?', punchline: 'Because they always follow the beat! 🥁', emoji: '🗺️' },
  { setup: 'What do you call a sleeping K-pop idol?', punchline: 'A REST-ar! 💤', emoji: '😴' },
  { setup: 'Why did the chicken join a K-pop group?', punchline: 'Because it had egg-cellent dance moves! 💃', emoji: '🐔' },
  { setup: 'What\'s a ghost\'s favourite K-pop song?', punchline: 'Boo! (I Like It)! 👻', emoji: '👻' },
  { setup: 'Why did the K-pop fan bring string to the concert?', punchline: 'To tie up the loose ends of their lightstick! 🪄', emoji: '🎀' },
  { setup: 'What do you call a fish who loves K-pop?', punchline: 'A FINatic! 🐟', emoji: '🐠' },
  { setup: 'Why was the music note always happy?', punchline: 'Because it lived in a major key! 😄', emoji: '🎵' },
  { setup: 'What did the drummer say to the singer?', punchline: '"I\'ve got the beat and you\'ve got the… everything else!" 🥁', emoji: '🎤' },
  { setup: 'Why did the K-pop group bring glue to practice?', punchline: 'So they could stick to the choreography! 💃', emoji: '🖌️' },
  { setup: 'What\'s a K-pop idol\'s favourite dessert?', punchline: 'Key-LimePIEts of course! 🥧', emoji: '🍰' },
  { setup: 'Why can\'t cats become K-pop stars?', punchline: 'Because they only know one scale — the CAT-alog! 🐱', emoji: '🐈' },
  { setup: 'Why did the music go to school?', punchline: 'To improve its notes! 📚', emoji: '🎼' },
  { setup: 'What do you call a K-pop idol who tells jokes?', punchline: 'A com-EEDian! Get it? Like Eedi… nevermind 😂', emoji: '🎭' },
  { setup: 'Why did the band play in the dark?', punchline: 'Because they lost their SHEET music! 😱', emoji: '🌑' },
  { setup: 'What\'s a robot\'s favourite K-pop group?', punchline: 'BTS — Bot, Transistor, Server! 🤖', emoji: '🤖' },
  { setup: 'Why did the fangirl bring scissors to the concert?', punchline: 'She wanted to cut in line for the fan meet! ✂️', emoji: '🎫' },
];

export default function JokeMachine() {
  const [jokeIndex, setJokeIndex] = useState(() => Math.floor(Math.random() * JOKES.length));
  const [showPunchline, setShowPunchline] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [jokeCount, setJokeCount] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);

  const currentJoke = JOKES[jokeIndex];

  const revealPunchline = () => {
    if (showPunchline) return;
    setShowPunchline(true);
    playPop();
  };

  const nextJoke = () => {
    playClick();
    let next = Math.floor(Math.random() * JOKES.length);
    if (next === jokeIndex) next = (next + 1) % JOKES.length;
    setJokeIndex(next);
    setShowPunchline(false);
    setLiked(null);
    setReaction(null);
    setJokeCount(c => c + 1);
  };

  const handleReact = (thumbs: boolean) => {
    setLiked(thumbs);
    const funnyReactions = ['😂', '🤣', '💀', '😹'];
    const badReactions = ['😐', '🙄', '💤', '🥱'];
    setReaction((thumbs ? funnyReactions : badReactions)[Math.floor(Math.random() * 4)]);
    if (thumbs) playCorrect(); else playWrong();
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="text-center">
        <h3 className="text-2xl font-fredoka font-bold text-yellow-600">😂 Joke Machine 😂</h3>
        <p className="text-sm text-gray-500 font-nunito">
          {jokeCount > 0 ? `${jokeCount} joke${jokeCount > 1 ? 's' : ''} heard — keep going!` : 'Tap to get a joke!'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={jokeIndex}
          initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-4 border-yellow-300 p-6 shadow-lg">

          {/* Setup */}
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">{currentJoke.emoji}</div>
            <p className="text-xl font-fredoka font-bold text-gray-800 leading-snug">
              {currentJoke.setup}
            </p>
          </div>

          {/* Punchline reveal */}
          {!showPunchline ? (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
              onClick={revealPunchline}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-fredoka font-bold text-lg rounded-2xl shadow-md">
              🥁 Drum roll... reveal! 🥁
            </motion.button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="bg-white rounded-2xl p-4 border-2 border-yellow-400 text-center">
                <p className="text-xl font-fredoka font-bold text-orange-600 leading-snug">
                  {currentJoke.punchline}
                </p>
              </motion.div>
            </AnimatePresence>
          )}

          {/* React buttons */}
          {showPunchline && liked === null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center gap-4 mt-4">
              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
                onClick={() => handleReact(true)}
                className="text-4xl hover:drop-shadow-lg transition-all">👍</motion.button>
              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
                onClick={() => handleReact(false)}
                className="text-4xl hover:drop-shadow-lg transition-all">👎</motion.button>
            </motion.div>
          )}

          {/* Reaction display */}
          {reaction && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              className="text-center mt-3">
              <div className="text-5xl">{reaction}</div>
              <p className="text-sm font-fredoka text-gray-500 mt-1">
                {liked ? 'Haha, so funny!' : 'Tough crowd 😅'}
              </p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Next joke button */}
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
        onClick={nextJoke}
        className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-fredoka font-bold text-lg rounded-2xl shadow-md">
        🎲 Next Joke!
      </motion.button>
    </div>
  );
}
