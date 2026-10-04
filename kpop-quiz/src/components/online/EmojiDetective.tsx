import React from 'react';
import type { RoomApi } from '../../online/useRoom';
import GuessRace, { type GuessRound } from './GuessRace';
import { pickEmojiPuzzles } from '../../online/emojiPuzzles';

const EmojiDetective: React.FC<{ room: RoomApi }> = ({ room }) => (
  <GuessRace
    room={room}
    gp="ed"
    title="Emoji Detective"
    icon="🕵️"
    themeClass="from-indigo-950 via-purple-950 to-fuchsia-950"
    accent="text-fuchsia-300"
    inputPlaceholder="What do the emojis mean?"
    roundMs={30000}
    rounds={10}
    buildRounds={() =>
      pickEmojiPuzzles(10).map((p): GuessRound => ({ prompt: p.emoji, answer: p.answer, alts: p.alt, hint: p.hint }))
    }
    renderPrompt={({ prompt, hint, len }) => (
      <div className="text-center">
        <div className="text-6xl md:text-7xl mb-3 tracking-wide leading-tight">{prompt}</div>
        <div className="font-nunito text-fuchsia-200 text-sm">
          {hint ? `Hint: ${hint} · ` : ''}{len} letters
        </div>
      </div>
    )}
  />
);

export default EmojiDetective;
