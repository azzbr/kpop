import React from 'react';
import type { RoomApi } from '../../online/useRoom';
import GuessRace, { type GuessRound } from './GuessRace';
import { pickRiddles } from '../../online/riddles';

const RiddleRush: React.FC<{ room: RoomApi }> = ({ room }) => (
  <GuessRace
    room={room}
    gp="rr"
    title="Riddle Rush"
    icon="🧩"
    themeClass="from-emerald-950 via-teal-950 to-cyan-950"
    accent="text-emerald-300"
    inputPlaceholder="Type your answer…"
    roundMs={35000}
    rounds={8}
    buildRounds={() =>
      pickRiddles(8).map((r): GuessRound => ({ prompt: r.q, answer: r.answer, alts: r.alt, hint: r.hint }))
    }
    renderPrompt={({ prompt, hint, len }) => (
      <div className="text-center">
        <div className="text-4xl mb-3">🧩</div>
        <p className="font-fredoka text-xl md:text-2xl mb-3 leading-snug">{prompt}</p>
        <div className="font-nunito text-emerald-200 text-sm">
          {hint ? `Hint: ${hint} · ` : ''}{len} letters
        </div>
      </div>
    )}
  />
);

export default RiddleRush;
