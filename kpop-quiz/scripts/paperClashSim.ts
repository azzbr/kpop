import { playNew, playOld, stats } from '../src/components/games/paperClashSim';

const N = Number(process.argv[2] ?? 200);
for (const diff of ['easy', 'normal', 'hard'] as const) {
  const seeds = Array.from({ length: N }, (_, i) => 1000 + i);
  const t0 = Date.now();
  const o = stats(seeds.map(s => playOld(s, diff)));
  const t1 = Date.now();
  const n = stats(seeds.map(s => playNew(s, diff)));
  const t2 = Date.now();
  const f = (x: { median: number; p90: number; over10: number }) => `median ${x.median.toFixed(2)}%  p90 ${x.p90.toFixed(2)}%  ≥10%: ${(x.over10 * 100).toFixed(0)}%`;
  console.log(`${diff.padEnd(6)} old: ${f(o)}  (${t1 - t0} ms)`);
  console.log(`${''.padEnd(6)} new: ${f(n)}  (${t2 - t1} ms)`);
}
