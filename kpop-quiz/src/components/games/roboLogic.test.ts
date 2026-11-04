import { describe, it, expect } from 'vitest';
import {
  parseLevel, runProgram, blockCount, kindsUsed, starsFor, levelScore, stripIds, sanitizeProgram, shortestMoves,
  searchShortest, sensorCell, LOOP_PLAYBACK,
} from './roboLogic';
import type { Program, Stmt } from './roboLogic';

const F: Stmt = { t: 'forward' };
const L: Stmt = { t: 'left' };
const R: Stmt = { t: 'right' };

// ######
// #S.*G#      start facing right, one battery before the dock
// ######
const line = parseLevel({ grid: ['######', '#S.*G#', '######'], dir: 1 });

describe('Robo Quest interpreter', () => {
  it('parses a level: start, facing, dock, batteries, walls', () => {
    expect(line.start).toEqual({ x: 1, y: 1 });
    expect(line.dir).toBe(1);
    expect(line.dock).toEqual({ x: 4, y: 1 });
    expect(line.batteries).toEqual([{ x: 3, y: 1 }]);
    expect(line.cells[1][2]).toBe('.');
    expect(line.cells[0][0]).toBe('#');
  });

  it('moves forward, picks up the battery on the way and docks', () => {
    const run = runProgram(line, [F, F, F]);
    expect(run.result).toBe('dock');
    expect(run.steps.map(s => s.kind)).toEqual(['move', 'move', 'move']);
    expect(run.steps[1].got).toBe(0);
    expect(run.steps[2]).toMatchObject({ x: 4, y: 1 });
  });

  it('stops kindly at a wall (bump) and keeps the position', () => {
    const run = runProgram(line, [L, F]);
    expect(run.result).toBe('bump');
    expect(run.steps.at(-1)).toMatchObject({ kind: 'bump', x: 1, y: 1, dir: 0, cell: { x: 1, y: 0 } });
  });

  it('a program that ends early is "short"; on the dock without every battery is "missing"', () => {
    expect(runProgram(line, [F]).result).toBe('short');
    const b = parseLevel({ grid: ['#####', '#*SG#', '#####'], dir: 1 });
    // Over the dock without the battery: the robot rolls on, and the run ends on the dock.
    expect(runProgram(b, [F]).result).toBe('missing');
    expect(runProgram(b, [L, L, F, L, L, F, F]).result).toBe('dock');
  });

  it('repeat runs its body n times; repeat until 🔋 runs until the robot is home', () => {
    expect(runProgram(line, [{ t: 'repeat', n: 3, body: [F] }]).result).toBe('dock');
    expect(runProgram(line, [{ t: 'repeat', n: 2, body: [F] }]).result).toBe('short');
    expect(runProgram(line, [{ t: 'until', body: [F] }]).result).toBe('dock');
  });

  it('an empty loop stops straight away with its block id, so the screen can point at it', () => {
    const run = runProgram(line, [F, { t: 'repeat', n: 3, body: [], id: 'loop1' }]);
    expect(run.result).toBe('empty');
    expect(run.emptyId).toBe('loop1');
    expect(runProgram(line, [{ t: 'until', body: [], id: 'u' }])).toMatchObject({ result: 'empty', emptyId: 'u' });
  });

  it('a loop that never gets home is stopped, and only the first steps are played back', () => {
    const spin: Program = [{ t: 'until', body: [L] }];
    const run = runProgram(line, spin);
    expect(run.result).toBe('loop');
    expect(run.steps.length).toBeLessThanOrEqual(LOOP_PLAYBACK);
    // A loop that only looks around (no moves) is stopped by the evaluation limit too.
    expect(runProgram(line, [{ t: 'until', body: [{ t: 'if', dir: 'left', body: [F] }] }]).result).toBe('loop');
  });

  it('if checks the path ahead / left / right and records the check for the sensor pulse', () => {
    const run = runProgram(line, [{ t: 'if', dir: 'ahead', body: [F], id: 'i' }, { t: 'if', dir: 'left', body: [L], else: [F] }]);
    expect(run.steps[0]).toMatchObject({ kind: 'sense', blockId: 'i', cell: { x: 2, y: 1 }, clear: true });
    expect(run.steps[1]).toMatchObject({ kind: 'move', x: 2 });
    expect(run.steps[2]).toMatchObject({ kind: 'sense', cell: { x: 2, y: 0 }, clear: false });
    expect(run.steps[3]).toMatchObject({ kind: 'move', x: 3 }); // the else branch
    expect(sensorCell({ x: 5, y: 5 }, 0, 'right')).toEqual({ x: 6, y: 5 });
    expect(sensorCell({ x: 5, y: 5 }, 1, 'left')).toEqual({ x: 5, y: 4 });
  });

  it('counts blocks (an if / else is one block) and the kinds used', () => {
    const p: Program = [{ t: 'until', body: [{ t: 'if', dir: 'ahead', body: [F], else: [{ t: 'if', dir: 'left', body: [L], else: [R] }] }] }];
    expect(blockCount(p)).toBe(6);
    expect([...kindsUsed(p)].sort()).toEqual(['forward', 'ifelse', 'left', 'right', 'until']);
    expect([...kindsUsed([{ t: 'if', dir: 'right', body: [R] }])].sort()).toEqual(['if', 'right']);
  });

  it('stars: ⭐⭐⭐ at the target, ⭐⭐ up to 2 over, ⭐ otherwise; points by world', () => {
    expect([3, 4, 5, 6, 9].map(n => starsFor(n, 4))).toEqual([3, 3, 2, 2, 1]);
    expect(levelScore(1, 3)).toBe(300);
    expect(levelScore(3, 3)).toBe(900);
    expect(levelScore(2, 1)).toBe(200);
  });

  it('saves compactly (no ids) and reads saves back safely', () => {
    const p: Program = [{ t: 'repeat', n: 3, body: [{ ...F, id: 'a' }], id: 'b' }];
    expect(stripIds(p)).toEqual([{ t: 'repeat', n: 3, body: [{ t: 'forward' }] }]);
    expect(sanitizeProgram(JSON.parse(JSON.stringify(stripIds(p))))).toEqual(stripIds(p));
    expect(sanitizeProgram('nonsense')).toEqual([]);
    expect(sanitizeProgram([{ t: 'jump' }, { t: 'repeat', n: 99, body: 'x' }, null])).toEqual([{ t: 'repeat', n: 9, body: [] }]);
    expect(sanitizeProgram([{ t: 'if', dir: 'up', body: [] }])).toEqual([]);
  });

  it('the search tools: fewest moves (BFS) and the smallest program', () => {
    expect(shortestMoves(line)).toBe(3);
    const corridor = parseLevel({ grid: ['#########', '#S.....G#', '#########'], dir: 1 });
    expect(shortestMoves(corridor)).toBe(6);
    expect(searchShortest(corridor, ['forward', 'left', 'right'], 6)?.size).toBe(6);
    expect(searchShortest(corridor, ['forward', 'left', 'right', 'repeat'], 3)).toMatchObject({ size: 2, program: [{ t: 'repeat', n: 6 }] });
    expect(searchShortest(corridor, ['left', 'right'], 3)).toBeNull();
  });
});
