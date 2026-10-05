import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import TapRace from './TapRace';
import { MISSING_ROUNDS, MISSING_ROUND_MS, makeMissingRounds, type TrayItem } from './raceRounds';

// Memory game on the TapRace engine: a tray of objects appears, you memorise it, then it comes
// back with one object gone — tap which one vanished.

const Tray: React.FC<{ items: (TrayItem | null)[]; answer?: { emoji?: string } | null }> = ({ items, answer }) => (
  <div className="bg-white/5 rounded-3xl p-4 mb-4 border border-white/10">
    <div className="flex flex-wrap justify-center gap-3">
      {items.map((it, i) => (
        <div
          key={i}
          className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-4xl md:text-5xl ${
            it ? 'bg-white/10' : 'bg-rose-500/20 border-2 border-dashed border-rose-300'
          }`}
        >
          {it ? it.emoji : answer ? answer.emoji : '❓'}
        </div>
      ))}
    </div>
  </div>
);

const WhatsMissing: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  return (
    <TapRace<(TrayItem | null)[], TrayItem[]>
      room={room}
      gp="wm"
      title="What’s Missing?"
      icon="🧠"
      themeClass="from-teal-950 via-cyan-950 to-sky-950"
      accent="text-cyan-300"
      roundMs={MISSING_ROUND_MS}
      rounds={MISSING_ROUNDS}
      answerMs={3200}
      buildRounds={() => makeMissingRounds(difficulty)}
      study={{ render: (tray) => <Tray items={tray} /> }}
      renderPrompt={({ prompt, phase, options, correctIndex }) => (
        <>
          <Tray items={prompt} answer={phase === 'answer' && correctIndex !== null ? options[correctIndex] : null} />
          <div className="text-center font-fredoka text-xl mb-3 text-cyan-100">Tap the one that’s gone:</div>
        </>
      )}
    />
  );
};

export default WhatsMissing;
