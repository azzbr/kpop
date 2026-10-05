import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import TapRace from './TapRace';
import { COLOUR_DIFF, COLOUR_ROUNDS, makeColourRounds, type ColourPrompt } from './raceRounds';

// Stroop test on the TapRace engine: a colour WORD is printed in a different ink colour — tap
// the INK colour, not the word you read. Brain-bending and fast.

const ColourClash: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  const spec = COLOUR_DIFF[difficulty] || COLOUR_DIFF.medium;
  return (
    <TapRace<ColourPrompt>
      room={room}
      gp="clr"
      title="Colour Clash"
      icon="🌈"
      subtitle="Tap the colour of the ink — not the word!"
      themeClass="from-slate-950 via-gray-900 to-neutral-950"
      accent="text-white/80"
      roundMs={spec.ms}
      rounds={COLOUR_ROUNDS}
      answerMs={2400}
      tenths
      buildRounds={() => makeColourRounds(difficulty)}
      renderPrompt={({ prompt }) => (
        <div className="bg-white/5 rounded-3xl p-8 mb-5 flex items-center justify-center min-h-[7rem]">
          <span className="font-fredoka font-black text-5xl md:text-7xl tracking-wider" style={{ color: prompt.inkHex }}>
            {prompt.word}
          </span>
        </div>
      )}
    />
  );
};

export default ColourClash;
