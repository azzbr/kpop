import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import GuessRace from './GuessRace';
import { MEMORY_ROUNDS, makeMemoryRounds, memoryPoints } from './raceRounds';

// Digit-span memory on the GuessRace engine: a number flashes up, you memorise it, then tap it
// back on the number pad from memory. It grows one digit longer every round. One try per round;
// longer numbers score more (speed doesn't matter — remembering does).

const MemoryDigits: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  return (
    <GuessRace<{ len: number }, number[]>
      room={room}
      gp="mem"
      title="Memory Digits"
      icon="🧠"
      themeClass="from-fuchsia-950 via-purple-950 to-indigo-950"
      accent="text-fuchsia-300"
      inputPlaceholder="Tap the numbers…"
      roundMs={12000}
      rounds={MEMORY_ROUNDS}
      answerKind="digits"
      oneTry
      points={({ answer }) => memoryPoints(answer)}
      buildRounds={() => makeMemoryRounds(difficulty)}
      reveal={{
        render: (seq) => (
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {seq.map((d, i) => (
              <span key={i} className="w-12 h-14 md:w-14 md:h-16 rounded-2xl bg-white/90 text-gray-800 font-fredoka font-bold text-3xl md:text-4xl flex items-center justify-center shadow">
                {d}
              </span>
            ))}
          </div>
        ),
      }}
      renderPrompt={({ prompt }) => (
        <div className="text-center">
          <div className="text-5xl mb-2">🤔</div>
          <div className="font-fredoka text-2xl">What was the number?</div>
          <div className="font-nunito text-fuchsia-200 text-lg mt-1">{prompt.len} digits · one try!</div>
        </div>
      )}
    />
  );
};

export default MemoryDigits;
