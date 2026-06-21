import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import TapRace, { type TapRound } from './TapRace';
import { makeBuzzerRounds } from '../../online/brainBuzzer';

const BrainBuzzer: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  return (
    <TapRace
      room={room}
      gp="bb"
      title="Brain Buzzer"
      icon="🎯"
      themeClass="from-rose-950 via-red-950 to-orange-950"
      accent="text-rose-300"
      roundMs={9000}
      rounds={12}
      buildRounds={() =>
        makeBuzzerRounds(difficulty, 12).map((b): TapRound => ({
          prompt: b.prompt,
          options: [{ emoji: '✅', label: 'TRUE' }, { emoji: '❌', label: 'FALSE' }],
          correctIndex: b.isTrue ? 0 : 1,
        }))
      }
    />
  );
};

export default BrainBuzzer;
