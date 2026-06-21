import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import TapRace, { type TapRound } from './TapRace';
import { pickOddSets } from '../../online/oddOneOut';

const OddOneOut: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const level = config?.difficulty === 'expert' ? 'expert' : config?.difficulty === 'hard' ? 'hard' : 'easy';
  return (
    <TapRace
      room={room}
      gp="oo"
      title="Odd One Out"
      icon="🔎"
      themeClass="from-amber-950 via-orange-950 to-rose-950"
      accent="text-amber-300"
      roundMs={15000}
      rounds={10}
      buildRounds={() =>
        pickOddSets(level, 10).map((set): TapRound => {
          const options = [...set.sames, set.odd].sort(() => Math.random() - 0.5);
          return {
            prompt: "Which one doesn't belong? 🤔",
            options,
            correctIndex: options.indexOf(set.odd),
          };
        })
      }
    />
  );
};

export default OddOneOut;
