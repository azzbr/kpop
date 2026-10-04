import { describe, it, expect } from 'vitest';
import { traceOutlines, chaikin, loopArea, dropStraight, smoothLoop } from './paperClashOutline';

const grid = (rows: string[]) => {
  const size = rows.length;
  const o = new Uint8Array(size * size);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { o[y * size + x] = ch === '.' ? 0 : Number(ch); }));
  return { o, size };
};

describe('outline tracing', () => {
  it('a square gives one clockwise loop with 4 corners and the right area', () => {
    const { o, size } = grid(['....', '.11.', '.11.', '....']);
    const loops = traceOutlines(o, size, [1]).get(1)!;
    expect(loops).toHaveLength(1);
    expect(dropStraight(loops[0])).toHaveLength(8);
    expect(loopArea(loops[0])).toBe(4);
  });

  it('a ring gives an outer loop and a hole that cancel to the ring area', () => {
    const { o, size } = grid(['.....', '.111.', '.1.1.', '.111.', '.....']);
    const loops = traceOutlines(o, size, [1]).get(1)!;
    expect(loops).toHaveLength(2);
    expect(loops.reduce((s, l) => s + loopArea(l), 0)).toBe(8);
  });

  it('separate blobs and players trace separately, diagonal touches stay two loops', () => {
    const { o, size } = grid(['1...', '.1..', '..22', '..22']);
    const res = traceOutlines(o, size, [1, 2]);
    expect(res.get(1)!).toHaveLength(2);
    expect(res.get(2)!).toHaveLength(1);
    expect(loopArea(res.get(2)![0])).toBe(4);
  });

  it('Chaikin keeps the area close and quadruples points over two passes', () => {
    const sq = [0, 0, 10, 0, 10, 10, 0, 10];
    const s = chaikin(sq, 2);
    expect(s.length).toBe(sq.length * 4);
    expect(loopArea(s)).toBeGreaterThan(80);
    expect(loopArea(s)).toBeLessThan(100);
  });

  it('smoothLoop keeps a big blob close to its area without the staircase', () => {
    const size = 40;
    const o = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - 20) ** 2 + (y - 20) ** 2 < 15 ** 2) o[y * size + x] = 1;
    const loop = traceOutlines(o, size, [1]).get(1)![0];
    const s = smoothLoop(loop);
    const cells = o.reduce((n, v) => n + v, 0);
    expect(Math.abs(loopArea(s) - cells) / cells).toBeLessThan(0.03);
    expect(s.length).toBeLessThan(loop.length);
  });

  it('dropStraight removes points along straight edges', () => {
    expect(dropStraight([0, 0, 1, 0, 2, 0, 2, 2, 0, 2])).toEqual([0, 0, 2, 0, 2, 2, 0, 2]);
  });
});
