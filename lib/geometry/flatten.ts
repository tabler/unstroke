import type { Segment } from '../path/types.js';
import type { Point, Polyline } from './types.js';
import { dist, equals } from './vec.js';

/**
 * Number of line segments needed so a cubic stays within `tolerance` of the true curve.
 * Uses the standard bound based on the second differences of the control polygon.
 */
export function cubicSubdivisions(
  p0: Point, p1: Point, p2: Point, p3: Point, tolerance: number,
): number {
  const ddx = Math.max(
    Math.abs(p0[0] - 2 * p1[0] + p2[0]),
    Math.abs(p1[0] - 2 * p2[0] + p3[0]),
  );
  const ddy = Math.max(
    Math.abs(p0[1] - 2 * p1[1] + p2[1]),
    Math.abs(p1[1] - 2 * p2[1] + p3[1]),
  );
  const dd = Math.hypot(ddx, ddy);
  // max deviation of a cubic from its chord after n subdivisions is <= (3/4) * dd / n^2
  const n = Math.ceil(Math.sqrt((0.75 * dd) / tolerance));
  return Math.min(Math.max(n, 1), 512);
}

export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Flatten normalized segments into polylines, one per subpath.
 * Consecutive duplicate points are removed. A subpath whose drawing commands
 * all have zero length is kept as a single point (it becomes a dot for round
 * and square caps), while a lone moveto with no drawing command at all is
 * dropped, as the SVG spec says it is not rendered.
 */
export function flattenSegments(segments: Segment[], tolerance: number): Polyline[] {
  const out: Polyline[] = [];
  let current: Polyline | null = null;
  const drawn = new Set<Polyline>();
  let cur: Point = [0, 0];
  let start: Point = [0, 0];

  const push = (p: Point) => {
    if (!current) {
      // drawing after a closepath without a moveto starts at the subpath start
      current = { points: [start], closed: false };
      out.push(current);
    }
    drawn.add(current);
    const last = current.points[current.points.length - 1]!;
    if (!equals(last, p)) current.points.push(p);
  };

  for (const s of segments) {
    switch (s.type) {
      case 'M':
        cur = start = [s.x, s.y];
        current = { points: [cur], closed: false };
        out.push(current);
        break;
      case 'L':
        cur = [s.x, s.y];
        push(cur);
        break;
      case 'C': {
        const p0 = cur;
        const p1: Point = [s.x1, s.y1];
        const p2: Point = [s.x2, s.y2];
        const p3: Point = [s.x, s.y];
        const n = cubicSubdivisions(p0, p1, p2, p3, tolerance);
        for (let i = 1; i <= n; i++) push(i === n ? p3 : cubicPoint(p0, p1, p2, p3, i / n));
        cur = p3;
        break;
      }
      case 'Z':
        if (current) {
          drawn.add(current);
          current.closed = true;
          // drop a trailing point that duplicates the start
          const pts = current.points;
          if (pts.length > 1 && equals(pts[0]!, pts[pts.length - 1]!)) pts.pop();
          // subsequent drawing without a moveto starts a new subpath at the same start
          current = null;
        }
        cur = start;
        break;
    }
  }

  return out.filter((p) => drawn.has(p));
}

/** Total length of a polyline. */
export function polylineLength(p: Polyline): number {
  let l = 0;
  for (let i = 1; i < p.points.length; i++) l += dist(p.points[i - 1]!, p.points[i]!);
  if (p.closed && p.points.length > 2) l += dist(p.points[p.points.length - 1]!, p.points[0]!);
  return l;
}
