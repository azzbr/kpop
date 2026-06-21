import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import GuessRace, { type GuessRound } from './GuessRace';

// Mental-maths race. Reuses the GuessRace engine: each round is a problem to
// solve, fastest correct answer scores most. Host picks the difficulty.

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function makeProblem(difficulty: string): { prompt: string; answer: string } {
  let op: string;
  let a: number;
  let b: number;
  let ans: number;

  if (difficulty === 'easy') {
    op = ['+', '−', '×'][randInt(0, 2)];
    if (op === '×') { a = randInt(2, 5); b = randInt(2, 5); ans = a * b; }
    else if (op === '+') { a = randInt(2, 20); b = randInt(2, 20); ans = a + b; }
    else { a = randInt(5, 20); b = randInt(1, a); ans = a - b; }
  } else if (difficulty === 'hard') {
    op = ['+', '−', '×', '÷'][randInt(0, 3)];
    if (op === '×') { a = randInt(6, 12); b = randInt(6, 12); ans = a * b; }
    else if (op === '÷') { b = randInt(3, 12); ans = randInt(3, 12); a = b * ans; }
    else if (op === '+') { a = randInt(25, 500); b = randInt(25, 500); ans = a + b; }
    else { a = randInt(50, 500); b = randInt(10, a); ans = a - b; }
  } else if (difficulty === 'expert') {
    const kind = randInt(0, 4);
    if (kind === 4) {
      const x = randInt(10, 25);
      return { prompt: `${x}²`, answer: String(x * x) };
    }
    op = ['+', '−', '×', '÷'][kind];
    if (op === '×') { a = randInt(11, 25); b = randInt(6, 15); ans = a * b; }
    else if (op === '÷') { b = randInt(6, 15); ans = randInt(6, 20); a = b * ans; }
    else if (op === '+') { a = randInt(100, 1500); b = randInt(100, 1500); ans = a + b; }
    else { a = randInt(300, 2000); b = randInt(50, a); ans = a - b; }
  } else {
    // medium
    op = ['+', '−', '×', '÷'][randInt(0, 3)];
    if (op === '×') { a = randInt(2, 12); b = randInt(2, 12); ans = a * b; }
    else if (op === '÷') { b = randInt(2, 10); ans = randInt(2, 10); a = b * ans; }
    else if (op === '+') { a = randInt(10, 100); b = randInt(10, 100); ans = a + b; }
    else { a = randInt(20, 100); b = randInt(1, a); ans = a - b; }
  }
  return { prompt: `${a} ${op} ${b}`, answer: String(ans) };
}

function makeMathRounds(difficulty: string, n: number): GuessRound[] {
  const seen = new Set<string>();
  const rounds: GuessRound[] = [];
  let guard = 0;
  while (rounds.length < n && guard < n * 25) {
    guard++;
    const p = makeProblem(difficulty);
    if (seen.has(p.prompt)) continue;
    seen.add(p.prompt);
    rounds.push({ prompt: p.prompt, answer: p.answer });
  }
  return rounds;
}

const MathSprint: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const difficulty = config?.difficulty || 'medium';
  return (
    <GuessRace
      room={room}
      gp="ms"
      title="Math Sprint"
      icon="➗"
      themeClass="from-blue-950 via-indigo-950 to-violet-950"
      accent="text-cyan-300"
      inputPlaceholder="Type the answer…"
      roundMs={20000}
      rounds={12}
      buildRounds={() => makeMathRounds(difficulty, 12)}
      renderPrompt={({ prompt }) => (
        <div className="text-center">
          <div className="font-fredoka font-bold text-4xl md:text-6xl tracking-wide">{prompt} = ?</div>
        </div>
      )}
    />
  );
};

export default MathSprint;
