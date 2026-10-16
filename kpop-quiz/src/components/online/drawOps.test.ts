import { describe, it, expect } from 'vitest';
import {
  addOp, toActions, compactOps, packOps, unpackOps, receiveBatch, opsToSkip, fillImage, replay, strokeCount,
  type DrawOp, type Paintable,
} from './drawOps';

const pt = (x: number, y: number, ns = 0, c = '#1f2937', w = 9): DrawOp => ({ k: 'pt', pt: [x, y, ns], c, w });

describe('drawOps: history', () => {
  it('groups points into strokes and says what to paint', () => {
    const a = toActions([]);
    expect(addOp(a, pt(0.1, 0.1, 1)).k).toBe('dot');
    expect(addOp(a, pt(0.2, 0.2)).k).toBe('seg');
    expect(addOp(a, pt(0.3, 0.3, 1)).k).toBe('dot');
    expect(a).toHaveLength(2);
    // A pen change mid-batch starts a new stroke rather than joining the old one.
    expect(addOp(a, pt(0.4, 0.4, 0, '#ef4444')).k).toBe('dot');
    expect(strokeCount(a)).toBe(3);
  });

  it('undo removes the last stroke, fill or clear — and a clear can be undone', () => {
    const ops: DrawOp[] = [pt(0.1, 0.1, 1), pt(0.2, 0.2), { k: 'fill', x: 0.5, y: 0.5, c: '#ef4444' }, { k: 'clear' }];
    expect(toActions([...ops, { k: 'undo' }]).map(x => x.k)).toEqual(['stroke', 'fill']);
    expect(toActions([...ops, { k: 'undo' }, { k: 'undo' }, { k: 'undo' }]).map(x => x.k)).toEqual([]);
    expect(addOp([], { k: 'undo' }).k).toBe('none');
  });

  it('compacts to the same picture without the undone ops', () => {
    const ops: DrawOp[] = [pt(0.1, 0.1, 1), pt(0.2, 0.2), pt(0.5, 0.5, 1), pt(0.6, 0.6), { k: 'undo' }, { k: 'fill', x: 0.9, y: 0.9, c: '#22c55e' }];
    const c = compactOps(toActions(ops));
    expect(c).toEqual([pt(0.1, 0.1, 1), pt(0.2, 0.2), { k: 'fill', x: 0.9, y: 0.9, c: '#22c55e' }]);
    expect(toActions(c)).toEqual(toActions(ops));
  });
});

describe('drawOps: wire format', () => {
  it('packs and unpacks losslessly at 3 decimals', () => {
    const ops: DrawOp[] = [pt(0.123, 0.456, 1), pt(0.124, 0.5), pt(1, 0, 1, '#ef4444', 20), { k: 'undo' }, { k: 'fill', x: 0.25, y: 0.75, c: '#facc15' }, { k: 'clear' }];
    const p = packOps(ops);
    expect(p[0][0]).toBe('p');
    expect(p).toHaveLength(5); // two point runs (pen changed), undo, fill, clear
    expect(unpackOps(JSON.parse(JSON.stringify(p)))).toEqual(ops);
  });

  it('drops junk from the network', () => {
    expect(unpackOps('nope')).toEqual([]);
    expect(unpackOps([['p', 'red', 5, 1, 2, 1], ['p', '#123456', 500, 1, 2, 1], ['f', 1, 2, 'javascript:'], ['zz'], 7])).toEqual([]);
    expect(unpackOps([['p', '#123456', 5, 100, 200, 1, 'x', 3, 0]])).toEqual([pt(0.1, 0.2, 1, '#123456', 5)]);
  });
});

describe('drawOps: streaming', () => {
  it('skips repeats and spots gaps', () => {
    expect(opsToSkip(0, 0)).toBe(0);
    expect(opsToSkip(5, 3)).toBe(2);
    expect(opsToSkip(5, 6)).toBe(-1);
  });

  it('receives batches in order, ignores duplicates and resets for a new drawing', () => {
    let log = { key: '', n: 0, ops: [] as DrawOp[] };
    let r = receiveBatch(log, 't1', 0, [pt(0, 0, 1), pt(0.1, 0.1)]);
    expect(r.reset).toBe(true);
    expect(r.fresh).toHaveLength(2);
    log = r.log;
    r = receiveBatch(log, 't1', 1, [pt(0.1, 0.1), pt(0.2, 0.2)]); // overlaps by one
    expect(r.fresh).toEqual([pt(0.2, 0.2)]);
    log = r.log;
    expect(log.n).toBe(3);
    r = receiveBatch(log, 't1', 5, [pt(0.5, 0.5)]);
    expect(r.gap).toBe(true);
    expect(r.log.n).toBe(3);
    r = receiveBatch(log, 't2', 0, [pt(0.9, 0.9, 1)]);
    expect(r.reset).toBe(true);
    expect(r.log).toEqual({ key: 't2', n: 1, ops: [pt(0.9, 0.9, 1)] });
  });
});

describe('drawOps: painting', () => {
  it('flood-fills an enclosed area only', () => {
    const W = 20, H = 20;
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    // A black vertical wall at x = 10.
    for (let y = 0; y < H; y++) { const i = (y * W + 10) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
    const img = { data, width: W, height: H };
    const n = fillImage(img, 0.1, 0.5, '#ff0000');
    expect(n).toBe(10 * H);
    expect([data[0], data[1], data[2]]).toEqual([255, 0, 0]);
    const right = (5 * W + 15) * 4;
    expect([data[right], data[right + 1], data[right + 2]]).toEqual([255, 255, 255]);
  });

  it('replays a history onto a context the same way every time', () => {
    const calls: string[] = [];
    const W = 64, H = 48;
    const ctx: Paintable = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
      beginPath: () => calls.push('begin'),
      arc: (x, y, r) => calls.push(`arc ${x} ${y} ${r}`),
      moveTo: (x, y) => calls.push(`move ${x} ${y}`),
      lineTo: (x, y) => calls.push(`line ${x} ${y}`),
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
      fillRect: () => calls.push('rect'),
      getImageData: () => ({ data: new Uint8ClampedArray(W * H * 4).fill(255), width: W, height: H }),
      putImageData: () => calls.push('put'),
    };
    const actions = toActions([pt(0.5, 0.5, 1), pt(1, 1), { k: 'fill', x: 0.1, y: 0.1, c: '#ef4444' }]);
    replay(ctx, actions, W, H);
    const first = [...calls];
    calls.length = 0;
    replay(ctx, actions, W, H);
    expect(calls).toEqual(first);
    expect(first).toContain('arc 32 24 0.45'); // width 9 on a 640 base → 0.9 px here, radius 0.45
    expect(first).toContain('line 64 48');
    expect(first).toContain('put');
  });
});
