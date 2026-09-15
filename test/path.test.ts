import { describe, expect, it } from 'vitest';
import { parsePathData, tokenizePathData } from '../lib/path/parse.js';
import { parseTransform, transformSegments } from '../lib/path/transform.js';
import { shapeToSegments } from '../lib/path/shapes.js';
import { cubicPoint, flattenSegments } from '../lib/geometry/flatten.js';

describe('tokenizePathData', () => {
  it('expands implicit repeats and handles compact syntax', () => {
    expect(tokenizePathData('M1 2 3 4')).toEqual([
      { cmd: 'M', args: [1, 2] },
      { cmd: 'L', args: [3, 4] },
    ]);
    expect(tokenizePathData('m1-2.5.5e1,3')).toEqual([
      { cmd: 'm', args: [1, -2.5] },
      { cmd: 'l', args: [5, 3] },
    ]);
  });

  it('allows a comma between implicit repeats', () => {
    // seen in Wikimedia Commons files exported by Illustrator
    expect(tokenizePathData('M91,114.1s-14.18-2.84-25.51,2.84-17,14.17-17,17,0,5.67,2.83,14.18S1 1 2 2')).toHaveLength(5);
    expect(tokenizePathData('M0 0,1 1,2 2')).toHaveLength(3);
  });

  it('parses arc flags without separators', () => {
    expect(tokenizePathData('M0 0a2 2 0 1112 0')).toEqual([
      { cmd: 'M', args: [0, 0] },
      { cmd: 'a', args: [2, 2, 0, 1, 1, 12, 0] },
    ]);
  });

  it('rejects garbage', () => {
    expect(() => tokenizePathData('X1 2')).toThrow();
    expect(() => tokenizePathData('1 2')).toThrow();
  });
});

describe('parsePathData', () => {
  it('resolves relative, H, V and Z', () => {
    expect(parsePathData('M1 1h2v2l-1 1z')).toEqual([
      { type: 'M', x: 1, y: 1 },
      { type: 'L', x: 3, y: 1 },
      { type: 'L', x: 3, y: 3 },
      { type: 'L', x: 2, y: 4 },
      { type: 'Z' },
    ]);
  });

  it('reflects control points for S and T', () => {
    const [, c1, c2] = parsePathData('M0 0C1 1 2 1 3 0S5 -1 6 0');
    expect(c2).toMatchObject({ type: 'C', x1: 4, y1: -1, x2: 5, y2: -1, x: 6, y: 0 });
    const [, q1, q2] = parsePathData('M0 0Q1 2 2 0T4 0');
    expect(q1).toMatchObject({ type: 'C' });
    // T reflects (1,2) around (2,0) -> (3,-2); cubic ctrl1 = P0 + 2/3 (Q - P0)
    expect(q2).toMatchObject({ x1: 2 + (2 / 3) * (3 - 2), y1: (2 / 3) * -2 });
  });

  it('converts arcs to cubics that stay on the circle', () => {
    const segs = parsePathData('M3 10a2 2 0 1 1 4 0');
    expect(segs.every((s) => s.type === 'M' || s.type === 'C')).toBe(true);
    const last = segs[segs.length - 1]!;
    expect(last).toMatchObject({ type: 'C', x: 7, y: 10 });
    // sample points on the flattened curve and check the radius
    for (const line of flattenSegments(segs, 0.001)) {
      for (const [x, y] of line.points) {
        expect(Math.hypot(x - 5, y - 10)).toBeCloseTo(2, 2);
      }
    }
  });

  it('draws a full circle with two arcs', () => {
    const segs = parsePathData('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0 -20');
    const pts = flattenSegments(segs, 0.001)[0]!.points;
    expect(pts.length).toBeGreaterThan(50);
    for (const [x, y] of pts) expect(Math.hypot(x - 12, y - 12)).toBeCloseTo(10, 2);
  });
});

describe('transform', () => {
  it('parses and composes transform lists', () => {
    const m = parseTransform('translate(10 5) scale(2)');
    expect(m).toEqual([2, 0, 0, 2, 10, 5]);
    const r = parseTransform('rotate(90)');
    expect(r.map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 1, -1, 0, 0, 0]);
    const rc = parseTransform('rotate(90 1 1)');
    const [x, y] = [rc[0] * 2 + rc[2] * 1 + rc[4], rc[1] * 2 + rc[3] * 1 + rc[5]];
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(2);
  });

  it('applies to segments', () => {
    const segs = transformSegments(parsePathData('M1 1L2 2'), [2, 0, 0, 2, 1, 0]);
    expect(segs).toEqual([
      { type: 'M', x: 3, y: 2 },
      { type: 'L', x: 5, y: 4 },
    ]);
  });
});

describe('shapes', () => {
  it('converts rect with radius, circle, line, polygon', () => {
    expect(shapeToSegments('line', { x1: '0', y1: '0', x2: '3', y2: '4' })).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 3, y: 4 },
    ]);
    expect(shapeToSegments('polygon', { points: '0,0 4,0 4,4' })).toHaveLength(4);
    const circle = shapeToSegments('circle', { cx: '5', cy: '5', r: '3' })!;
    for (const [x, y] of flattenSegments(circle, 0.001)[0]!.points) {
      expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(3, 2);
    }
    const rect = shapeToSegments('rect', { x: '0', y: '0', width: '10', height: '6', rx: '2' })!;
    expect(rect[0]).toEqual({ type: 'M', x: 2, y: 0 });
    expect(rect[rect.length - 1]).toEqual({ type: 'Z' });
  });
});

describe('flatten', () => {
  it('keeps flattening error within tolerance', () => {
    const p0: [number, number] = [0, 0], p1: [number, number] = [0, 10], p2: [number, number] = [10, 10], p3: [number, number] = [10, 0];
    const tol = 0.05;
    const line = flattenSegments([{ type: 'M', x: 0, y: 0 }, { type: 'C', x1: 0, y1: 10, x2: 10, y2: 10, x: 10, y: 0 }], tol)[0]!;
    // every true curve point must be within tol of the polyline
    for (let t = 0; t <= 1; t += 0.01) {
      const [x, y] = cubicPoint(p0, p1, p2, p3, t);
      let best = Infinity;
      for (let i = 1; i < line.points.length; i++) {
        best = Math.min(best, distToSegment([x, y], line.points[i - 1]!, line.points[i]!));
      }
      expect(best).toBeLessThanOrEqual(tol + 1e-9);
    }
  });

  it('splits subpaths and marks closed ones', () => {
    const lines = flattenSegments(parsePathData('M0 0L1 0L1 1zM5 5L6 6'), 0.01);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.closed).toBe(true);
    expect(lines[0]!.points).toHaveLength(3);
    expect(lines[1]!.closed).toBe(false);
  });

  it('keeps a zero-length subpath as a single point but drops a lone moveto', () => {
    expect(flattenSegments(parsePathData('M3 3L3 3'), 0.01)[0]!.points).toEqual([[3, 3]]);
    expect(flattenSegments(parsePathData('M3 3z'), 0.01)[0]!.points).toEqual([[3, 3]]);
    expect(flattenSegments(parsePathData('M3 3'), 0.01)).toEqual([]);
    expect(flattenSegments(parsePathData('M1 1h2M5 5'), 0.01)).toHaveLength(1);
  });
});

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const l2 = abx * abx + aby * aby;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / l2));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby));
}
