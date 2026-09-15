import type { Point } from '../geometry/types.js';
import { add, dist, dot, normalize, scale, sub } from '../geometry/vec.js';

/** Output segments after curve fitting. */
export type FittedSegment =
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

export interface FitOptions {
  /** Maximum distance between the polygon vertices and the fitted curve. */
  tolerance: number;
  /** Turn angle (degrees) above which a vertex is treated as a sharp corner. */
  cornerAngle: number;
}

export interface FittedRing {
  start: Point;
  segments: FittedSegment[];
}

/**
 * Fit a closed polygon with lines and cubic Béziers.
 *
 * Sharp corners split the ring into runs; each run is emitted as a straight
 * line when its points are collinear within tolerance, otherwise it is fitted
 * with Schneider's algorithm (least-squares cubic, Newton reparameterization,
 * recursive split at the point of maximum error).
 */
export function fitRing(ring: Point[], options: FitOptions): FittedRing {
  const pts = dedupe(ring);
  const n = pts.length;
  if (n < 3) {
    return { start: pts[0]!, segments: pts.slice(1).map(([x, y]) => ({ type: 'L', x, y })) };
  }

  const cosCorner = Math.cos((options.cornerAngle * Math.PI) / 180);
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const d1 = normalize(sub(pts[i]!, pts[(i - 1 + n) % n]!));
    const d2 = normalize(sub(pts[(i + 1) % n]!, pts[i]!));
    if (dot(d1, d2) < cosCorner) corners.push(i);
  }

  const segments: FittedSegment[] = [];

  if (corners.length === 0) {
    // Smooth closed curve: fit it as one run that starts and ends at pts[0]
    // with a matching tangent on both ends.
    const run = [...pts, pts[0]!];
    const tangent = tangentAt([pts[n - 1]!, ...run], 1, tangentWindow(options.tolerance));
    fitRun(run, tangent, scale(tangent, -1), options.tolerance, segments);
    return { start: pts[0]!, segments };
  }

  const start = pts[corners[0]!]!;
  for (let c = 0; c < corners.length; c++) {
    const from = corners[c]!;
    const to = corners[(c + 1) % corners.length]!;
    // Walk from one corner to the next (wrapping around); a single corner
    // means the run goes all the way around the ring back to itself.
    const run: Point[] = [pts[from]!];
    for (let i = (from + 1) % n; ; i = (i + 1) % n) {
      run.push(pts[i]!);
      if (i === to) break;
    }
    const w = tangentWindow(options.tolerance);
    fitRun(run, tangentAtStart(run, w), tangentAtEnd(run, w), options.tolerance, segments);
  }
  return { start, segments };
}

function tangentWindow(tolerance: number): number {
  return tolerance * 8;
}

function dedupe(ring: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-9) out.push(p);
  }
  if (out.length > 1 && dist(out[0]!, out[out.length - 1]!) <= 1e-9) out.pop();
  return out;
}

/**
 * Tangent estimates. Polygons coming out of a boolean union mix very short
 * edges (bevels, cap seams) with long ones, so the direction of the nearest
 * edge is a poor estimate; instead the tangent is taken over a window of
 * `window` arc length.
 */
function tangentAtStart(run: Point[], window: number): Point {
  return normalize(sub(pointAlong(run, 0, 1, window), run[0]!));
}

function tangentAtEnd(run: Point[], window: number): Point {
  const last = run.length - 1;
  return normalize(sub(pointAlong(run, last, -1, window), run[last]!));
}

/** Tangent at an interior index, from the points `window` before and after it. */
function tangentAt(pts: Point[], index: number, window: number): Point {
  const before = pointAlong(pts, index, -1, window);
  const after = pointAlong(pts, index, 1, window);
  const t = normalize(sub(after, before));
  return t[0] === 0 && t[1] === 0 ? normalize(sub(pts[Math.min(index + 1, pts.length - 1)]!, pts[index]!)) : t;
}

/** The point `distance` along the polyline from `index` in direction `dir` (clamped to the ends). */
function pointAlong(pts: Point[], index: number, dir: 1 | -1, distance: number): Point {
  let i = index;
  let remaining = distance;
  while (true) {
    const j = i + dir;
    if (j < 0 || j >= pts.length) return pts[i]!;
    const d = dist(pts[i]!, pts[j]!);
    if (d >= remaining) {
      const t = d === 0 ? 0 : remaining / d;
      return [pts[i]![0] + (pts[j]![0] - pts[i]![0]) * t, pts[i]![1] + (pts[j]![1] - pts[i]![1]) * t];
    }
    remaining -= d;
    i = j;
  }
}

function fitRun(run: Point[], tan1: Point, tan2: Point, tolerance: number, out: FittedSegment[]): void {
  const last = run[run.length - 1]!;
  if (run.length === 2 || isCollinear(run, tolerance)) {
    out.push({ type: 'L', x: last[0], y: last[1] });
    return;
  }
  fitCubic(run, 0, run.length - 1, tan1, tan2, tolerance, out);
}

/** Every point lies within `tolerance` of the chord between the run's ends. */
function isCollinear(run: Point[], tolerance: number): boolean {
  const a = run[0]!;
  const b = run[run.length - 1]!;
  const chord = sub(b, a);
  const len = Math.hypot(chord[0], chord[1]);
  if (len < 1e-12) return false;
  for (let i = 1; i < run.length - 1; i++) {
    const p = run[i]!;
    const t = ((p[0] - a[0]) * chord[0] + (p[1] - a[1]) * chord[1]) / (len * len);
    if (t < -1e-9 || t > 1 + 1e-9) return false; // doubles back
    const d = Math.abs((p[0] - a[0]) * chord[1] - (p[1] - a[1]) * chord[0]) / len;
    if (d > tolerance) return false;
  }
  return true;
}

type Cubic = [Point, Point, Point, Point];

function fitCubic(
  pts: Point[], first: number, last: number, tan1: Point, tan2: Point, tolerance: number, out: FittedSegment[],
): void {
  const count = last - first + 1;
  if (count === 2) {
    out.push({ type: 'L', x: pts[last]![0], y: pts[last]![1] });
    return;
  }

  const u = chordLengthParameterize(pts, first, last);
  let curve = generateBezier(pts, first, last, u, tan1, tan2);
  let { error, index } = maxError(pts, first, last, curve, u, tolerance);
  if (error <= tolerance) {
    pushCubic(curve, out, tolerance);
    return;
  }

  // Try to improve the parameterization before giving up and splitting.
  if (error <= tolerance * 16) {
    let bestCurve = curve;
    let bestError = error;
    let bestIndex = index;
    let uPrime = u;
    for (let iter = 0; iter < 4; iter++) {
      uPrime = reparameterize(pts, first, last, uPrime, bestCurve);
      const candidate = generateBezier(pts, first, last, uPrime, tan1, tan2);
      const e = maxError(pts, first, last, candidate, uPrime, tolerance);
      if (e.error < bestError) {
        bestCurve = candidate;
        bestError = e.error;
        bestIndex = e.index;
      }
      if (bestError <= tolerance) {
        pushCubic(bestCurve, out, tolerance);
        return;
      }
    }
    curve = bestCurve;
    index = bestIndex;
  }

  // Split at the point of maximum error and fit both halves.
  const split = Math.min(Math.max(index, first + 1), last - 1);
  const tanCenter = tangentAt(pts, split, tangentWindow(tolerance));
  fitCubic(pts, first, split, tan1, scale(tanCenter, -1), tolerance, out);
  fitCubic(pts, split, last, tanCenter, tan2, tolerance, out);
}

function pushCubic(c: Cubic, out: FittedSegment[], tolerance: number): void {
  // A cubic whose handles lie on the chord is a straight line; say so.
  if (distToSegment(c[1], c[0], c[3]) <= tolerance && distToSegment(c[2], c[0], c[3]) <= tolerance) {
    out.push({ type: 'L', x: c[3][0], y: c[3][1] });
    return;
  }
  out.push({ type: 'C', x1: c[1][0], y1: c[1][1], x2: c[2][0], y2: c[2][1], x: c[3][0], y: c[3][1] });
}

function chordLengthParameterize(pts: Point[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1]! + dist(pts[i]!, pts[i - 1]!));
  const total = u[u.length - 1]!;
  return u.map((v) => (total === 0 ? 0 : v / total));
}

/** Least-squares fit of the handle lengths along the given end tangents. */
function generateBezier(pts: Point[], first: number, last: number, u: number[], tan1: Point, tan2: Point): Cubic {
  const p0 = pts[first]!;
  const p3 = pts[last]!;
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0, n = last - first + 1; i < n; i++) {
    const t = u[i]!;
    const mt = 1 - t;
    const b0 = mt * mt * mt;
    const b1 = 3 * mt * mt * t;
    const b2 = 3 * mt * t * t;
    const b3 = t * t * t;
    const a1 = scale(tan1, b1);
    const a2 = scale(tan2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const p = pts[first + i]!;
    const tmp: Point = [
      p[0] - (p0[0] * (b0 + b1) + p3[0] * (b2 + b3)),
      p[1] - (p0[1] * (b0 + b1) + p3[1] * (b2 + b3)),
    ];
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alpha1: number, alpha2: number;
  if (Math.abs(det) > 1e-12) {
    alpha1 = (x0 * c11 - x1 * c01) / det;
    alpha2 = (c00 * x1 - c01 * x0) / det;
  } else {
    const c = c00 + c01;
    alpha1 = alpha2 = c !== 0 ? x0 / c : 0;
  }
  const segLength = dist(p0, p3);
  const eps = 1e-6 * segLength;
  if (!(alpha1 > eps) || !(alpha2 > eps) || alpha1 > 3 * segLength || alpha2 > 3 * segLength) {
    // Degenerate or wild solution: fall back to Wu/Barsky heuristic.
    alpha1 = alpha2 = segLength / 3;
  }
  return [p0, add(p0, scale(tan1, alpha1)), add(p3, scale(tan2, alpha2)), p3];
}

function evalCubic(c: Cubic, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, cc = 3 * mt * t * t, d = t * t * t;
  return [
    a * c[0][0] + b * c[1][0] + cc * c[2][0] + d * c[3][0],
    a * c[0][1] + b * c[1][1] + cc * c[2][1] + d * c[3][1],
  ];
}

/**
 * Largest distance between the polygon and the curve. Besides the vertices
 * themselves, long edges are sampled along their length so a curve bulging
 * between two distant vertices (a straight edge next to an arc) is caught.
 */
function maxError(
  pts: Point[], first: number, last: number, c: Cubic, u: number[], tolerance: number,
): { error: number; index: number } {
  let error = 0;
  let index = Math.floor((first + last) / 2);
  for (let i = first; i <= last; i++) {
    if (i > first && i < last) {
      const d = dist(evalCubic(c, u[i - first]!), pts[i]!);
      if (d > error) {
        error = d;
        index = i;
      }
    }
    if (i === last) break;
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const k = Math.min(16, Math.ceil(dist(a, b) / (8 * tolerance)));
    for (let j = 1; j < k; j++) {
      const t = u[i - first]! + ((u[i + 1 - first]! - u[i - first]!) * j) / k;
      const d = distToSegment(evalCubic(c, t), a, b);
      if (d > error) {
        error = d;
        index = j * 2 < k ? i : i + 1;
      }
    }
  }
  return { error, index };
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}

/** One Newton-Raphson step per point towards the parameter of the closest curve point. */
function reparameterize(pts: Point[], first: number, last: number, u: number[], c: Cubic): number[] {
  const d1: [Point, Point, Point] = [
    scale(sub(c[1], c[0]), 3), scale(sub(c[2], c[1]), 3), scale(sub(c[3], c[2]), 3),
  ];
  const d2: [Point, Point] = [scale(sub(d1[1], d1[0]), 2), scale(sub(d1[2], d1[1]), 2)];
  return u.map((t, i) => {
    const p = pts[first + i]!;
    const q = evalCubic(c, t);
    const mt = 1 - t;
    const q1: Point = [
      mt * mt * d1[0][0] + 2 * mt * t * d1[1][0] + t * t * d1[2][0],
      mt * mt * d1[0][1] + 2 * mt * t * d1[1][1] + t * t * d1[2][1],
    ];
    const q2: Point = [mt * d2[0][0] + t * d2[1][0], mt * d2[0][1] + t * d2[1][1]];
    const diff = sub(q, p);
    const df = dot(q1, q1) + dot(diff, q2);
    if (Math.abs(df) < 1e-12) return t;
    const next = t - dot(diff, q1) / df;
    return Math.min(1, Math.max(0, next));
  });
}
