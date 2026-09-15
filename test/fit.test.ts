import { describe, expect, it } from 'vitest';
import { fitRing, type FittedSegment } from '../src/output/fit.js';
import { cubicPoint } from '../src/geometry/flatten.js';
import { multiPolygonToPathData } from '../src/output/pathData.js';
import type { Point } from '../src/geometry/types.js';

const circle = (cx: number, cy: number, r: number, n: number): Point[] =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);

/** Sample every fitted segment and return the largest distance to the closest polygon edge. */
function maxDeviation(start: Point, segments: FittedSegment[], ring: Point[]): number {
  let worst = 0;
  let cur = start;
  for (const s of segments) {
    const end: Point = [s.x, s.y];
    for (let t = 0; t <= 1; t += 0.05) {
      const p = s.type === 'L' ? [cur[0] + (end[0] - cur[0]) * t, cur[1] + (end[1] - cur[1]) * t] as Point
        : cubicPoint(cur, [s.x1, s.y1], [s.x2, s.y2], end, t);
      let best = Infinity;
      for (let i = 0; i < ring.length; i++) best = Math.min(best, distToSegment(p, ring[i]!, ring[(i + 1) % ring.length]!));
      worst = Math.max(worst, best);
    }
    cur = end;
  }
  return worst;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const l2 = abx * abx + aby * aby;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / l2));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby));
}

describe('fitRing', () => {
  it('keeps a square as four lines', () => {
    const { start, segments } = fitRing([[0, 0], [10, 0], [10, 10], [0, 10]], { tolerance: 0.01, cornerAngle: 30 });
    expect(start).toEqual([0, 0]);
    expect(segments).toEqual([
      { type: 'L', x: 10, y: 0 }, { type: 'L', x: 10, y: 10 }, { type: 'L', x: 0, y: 10 }, { type: 'L', x: 0, y: 0 },
    ]);
  });

  it('fits a circle with a handful of cubics within tolerance', () => {
    const ring = circle(5, 5, 4, 200);
    const fit = fitRing(ring, { tolerance: 0.01, cornerAngle: 30 });
    expect(fit.segments.every((s) => s.type === 'C')).toBe(true);
    expect(fit.segments.length).toBeLessThanOrEqual(8);
    expect(maxDeviation(fit.start, fit.segments, ring)).toBeLessThanOrEqual(0.01 * 1.05);
  });

  it('splits a rounded rectangle into lines and arcs at the right places', () => {
    // rounded rect: straight edges of length 10 and quarter circles of radius 2
    const ring: Point[] = [];
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 20; i++) {
        const a = a0 + (i / 20) * (Math.PI / 2);
        ring.push([cx + 2 * Math.cos(a), cy + 2 * Math.sin(a)]);
      }
    };
    corner(12, 2, -Math.PI / 2); corner(12, 12, 0); corner(2, 12, Math.PI / 2); corner(2, 2, Math.PI);
    const fit = fitRing(ring, { tolerance: 0.01, cornerAngle: 30 });
    const lines = fit.segments.filter((s) => s.type === 'L');
    expect(lines.length).toBe(4);
    expect(fit.segments.length).toBeLessThanOrEqual(12);
    expect(maxDeviation(fit.start, fit.segments, ring)).toBeLessThanOrEqual(0.0105);
  });

  it('detects sharp corners in a stroked triangle and keeps them sharp', () => {
    const ring: Point[] = [[0, 0], [10, 0], [5, 8]];
    const fit = fitRing(ring, { tolerance: 0.01, cornerAngle: 30 });
    expect(fit.segments.map((s) => s.type)).toEqual(['L', 'L', 'L']);
  });

  it('does not bulge a straight edge next to an arc', () => {
    // half stadium: straight top edge, semicircle on the right, straight bottom, semicircle left
    const ring: Point[] = [];
    for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * Math.PI; ring.push([20 + 5 * Math.cos(a), 5 + 5 * Math.sin(a)]); }
    for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 + (i / 40) * Math.PI; ring.push([5 + 5 * Math.cos(a), 5 + 5 * Math.sin(a)]); }
    const fit = fitRing(ring, { tolerance: 0.02, cornerAngle: 30 });
    expect(maxDeviation(fit.start, fit.segments, ring)).toBeLessThanOrEqual(0.021);
  });
});

describe('multiPolygonToPathData', () => {
  it('emits compact absolute path data and implicit closing lines', () => {
    const d = multiPolygonToPathData([[[[0, 0], [10, 0], [10, 10], [0, 10]]]], { curves: true });
    expect(d).toBe('M0 0H10V10H0Z');
    const dNoFit = multiPolygonToPathData([[[[0, 0], [10, 0], [10, 10], [0, 10]]]], { curves: false });
    expect(dNoFit).toBe('M0 0H10V10H0Z');
  });

  it('writes holes with the opposite winding', () => {
    const outer: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const hole: Point[] = [[2, 2], [8, 2], [8, 8], [2, 8]];
    const d = multiPolygonToPathData([[outer, hole]], { curves: false });
    expect(d).toBe('M0 0H10V10H0Z M2 8H8V2H2Z');
  });
});
