import type { Point, Polyline, Ring, StrokeStyle } from '../geometry/types.js';
import { add, arcSegments, circlePolygon, cross, dot, normalize, perp, scale, sub } from '../geometry/vec.js';

/**
 * Build the set of polygons whose union is the stroked outline of a polyline.
 *
 * Each segment becomes a rectangle, each vertex a join shape and each open end
 * a cap shape. The pieces overlap; a boolean union merges them into the final
 * outline. This is slower than a direct offset but has no special cases for
 * self-intersections, sharp turns or curves tighter than the stroke width.
 */
export function strokePolyline(line: Polyline, style: StrokeStyle, tolerance: number): Ring[] {
  const hw = style.width / 2;
  if (hw <= 0) return [];
  const pts = line.points;
  const out: Ring[] = [];

  if (pts.length === 1) {
    // Zero-length subpath: SVG renders a dot for round and square caps only.
    const p = pts[0]!;
    if (style.linecap === 'round') out.push(circlePolygon(p, hw, tolerance));
    else if (style.linecap === 'square') {
      out.push([[p[0] - hw, p[1] - hw], [p[0] + hw, p[1] - hw], [p[0] + hw, p[1] + hw], [p[0] - hw, p[1] + hw]]);
    }
    return out;
  }

  const closed = line.closed && pts.length > 2;
  const n = pts.length;
  const segCount = closed ? n : n - 1;

  // Segment rectangles
  for (let i = 0; i < segCount; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const d = normalize(sub(b, a));
    const nrm = scale(perp(d), hw);
    out.push([add(a, nrm), add(b, nrm), sub(b, nrm), sub(a, nrm)]);
  }

  // Joins
  const firstJoin = closed ? 0 : 1;
  const lastJoin = closed ? n - 1 : n - 2;
  for (let i = firstJoin; i <= lastJoin; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const p = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const join = joinPolygon(prev, p, next, hw, style, tolerance);
    if (join) out.push(join);
  }

  // Caps
  if (!closed) {
    const capStart = capPolygon(pts[1]!, pts[0]!, hw, style, tolerance);
    const capEnd = capPolygon(pts[n - 2]!, pts[n - 1]!, hw, style, tolerance);
    if (capStart) out.push(capStart);
    if (capEnd) out.push(capEnd);
  }

  return out;
}

/**
 * Polygon filling the gap on the outer side of a corner at `p`.
 * Returns null when the segments are collinear enough that the rectangles already cover it.
 */
function joinPolygon(
  prev: Point, p: Point, next: Point, hw: number, style: StrokeStyle, tolerance: number,
): Ring | null {
  const d1 = normalize(sub(p, prev));
  const d2 = normalize(sub(next, p));
  const turn = cross(d1, d2); // >0 : turning left (in y-down: clockwise on screen)
  const cosTheta = dot(d1, d2);
  // Collinear: the rectangles already meet edge to edge, nothing to fill.
  if (Math.abs(turn) < 1e-12 && cosTheta > 0) return null;

  // Half of the turn angle. The wedge between the two rectangles on the outer
  // side is the triangle (p, o1, o2); a round join adds a circular cap over it
  // whose extra depth is hw * (1 - cos(halfTurn)). When that depth is below the
  // tolerance a plain bevel is indistinguishable and much cheaper.
  const halfTurn = Math.acos(Math.max(-1, Math.min(1, cosTheta))) / 2;
  const roundIsBevel = hw * (1 - Math.cos(halfTurn)) < tolerance;

  if (style.linejoin === 'round' && !roundIsBevel) {
    return roundJoin(p, d1, d2, turn, hw, tolerance);
  }

  // Outer side is opposite to the turn direction
  const side = turn > 0 ? -1 : 1;
  const n1 = scale(perp(d1), hw * side);
  const n2 = scale(perp(d2), hw * side);
  const o1 = add(p, n1); // end of prev segment's outer edge
  const o2 = add(p, n2); // start of next segment's outer edge

  if (style.linejoin === 'miter') {
    // miter length ratio = 1 / sin(theta/2) where theta is the angle between segments
    const theta = Math.PI - 2 * halfTurn; // interior angle
    const sinHalf = Math.sin(theta / 2);
    if (sinHalf > 1e-9 && 1 / sinHalf <= style.miterLimit) {
      // Miter tip: intersection of the two offset lines
      const bis = normalize(add(n1, n2));
      const tipLen = hw / Math.cos(halfTurn);
      const tip = add(p, scale(bis, tipLen));
      return [p, o1, tip, o2];
    }
  }
  // bevel (also miter fallback)
  return [p, o1, o2];
}

function roundJoin(p: Point, d1: Point, d2: Point, turn: number, hw: number, tolerance: number): Ring {
  // Wedge from the outer normal of d1 to the outer normal of d2 around p
  const side = turn > 0 ? -1 : 1;
  const n1 = scale(perp(d1), side);
  const n2 = scale(perp(d2), side);
  let a1 = Math.atan2(n1[1], n1[0]);
  let a2 = Math.atan2(n2[1], n2[0]);
  let sweep = a2 - a1;
  // choose the short way round
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const steps = arcSegments(hw, sweep, tolerance);
  const ring: Ring = [p];
  for (let i = 0; i <= steps; i++) {
    const a = a1 + (sweep * i) / steps;
    ring.push([p[0] + hw * Math.cos(a), p[1] + hw * Math.sin(a)]);
  }
  return ring;
}

/** Cap at `end`, with `from` being the neighbouring point on the line. */
function capPolygon(from: Point, end: Point, hw: number, style: StrokeStyle, tolerance: number): Ring | null {
  if (style.linecap === 'butt') return null;
  const d = normalize(sub(end, from));
  const nrm = scale(perp(d), hw);
  if (style.linecap === 'square') {
    const ext = scale(d, hw);
    return [add(end, nrm), add(add(end, nrm), ext), add(sub(end, nrm), ext), sub(end, nrm)];
  }
  // round: half disc facing forward
  const a0 = Math.atan2(nrm[1], nrm[0]);
  const steps = arcSegments(hw, Math.PI, tolerance);
  const ring: Ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 - (Math.PI * i) / steps;
    ring.push([end[0] + hw * Math.cos(a), end[1] + hw * Math.sin(a)]);
  }
  return ring;
}
