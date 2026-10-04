import React from 'react';
import type { RoomApi } from '../../online/useRoom';
import GuessRace, { type GuessRound } from './GuessRace';
import { pickScrambleWords, scramble } from '../../online/doodleWords';

const WordScramble: React.FC<{ room: RoomApi }> = ({ room }) => (
  <GuessRace
    room={room}
    gp="ws"
    title="Word Scramble"
    icon="🔤"
    themeClass="from-sky-950 via-blue-950 to-indigo-950"
    accent="text-sky-300"
    inputPlaceholder="Unscramble the word…"
    roundMs={30000}
    rounds={10}
    buildRounds={() =>
      pickScrambleWords(10).map((w): GuessRound => ({
        prompt: { scrambled: scramble(w.word), category: w.category },
        answer: w.word,
      }))
    }
    renderPrompt={({ prompt, len }) => (
      <div className="text-center">
        <div className="flex justify-center gap-1.5 flex-wrap mb-3">
          {String(prompt.scrambled).split('').map((ch: string, i: number) => (
            <span
              key={i}
              className="inline-flex items-center justify-center w-10 h-12 md:w-12 md:h-14 rounded-xl bg-white/90 text-gray-800 font-fredoka font-bold text-2xl md:text-3xl uppercase shadow"
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="font-nunito text-sky-200 text-sm">
          Category: {prompt.category} · {len} letters
        </div>
      </div>
    )}
  />
);

export default WordScramble;
