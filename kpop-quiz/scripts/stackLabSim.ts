// Tune Stack Lab: how tall do towers get for careful, good and rushed players?
//   npx tsx scripts/stackLabSim.ts [rounds]
// Re-run after changing piece sizes, friction, the crane or the round length, and keep the
// mastery stars (data/mastery.ts) in line: 1★ ≈ a rushed round, 2★ ≈ a good one, 3★ ≈ careful.
import { playStack } from '../src/components/games/stackLabSim';
import type { SimSkill } from '../src/components/games/stackLabSim';

const N = Number(process.argv[2] ?? 40);
const players: [string, SimSkill][] = [
  ['careful', { aim: 6, patient: true, layTallFlat: true }],
  ['good', { aim: 14, patient: true }],
  ['rushed', { aim: 22, patient: false }],
  ['wild', { aim: 45, patient: false }],
];
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
for (const [name, skill] of players) {
  const t0 = Date.now();
  const rs = Array.from({ length: N }, (_, i) => playStack(1000 + i, skill));
  const cm = rs.map(r => r.bestCm);
  const avg = (f: (r: (typeof rs)[number]) => number) => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
  console.log(
    `${name.padEnd(8)} cm p10 ${pct(cm, 0.1)} · median ${pct(cm, 0.5)} · p90 ${pct(cm, 0.9)} · max ${Math.max(...cm)}` +
    ` | dropped ${avg(r => r.dropped)} fallen ${avg(r => r.fallen)} | out of hearts ${rs.filter(r => r.reason === 'hearts').length}/${N}` +
    ` (${((Date.now() - t0) / N).toFixed(0)} ms/round)`,
  );
}
