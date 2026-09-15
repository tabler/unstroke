import type { Point, Polyline, Ring, StrokeStyle } from '../geometry/types.js';
import { add, arcSegments, circlePolygon, cross, dot, normalize, perp, scale, sub } from '../geometry/vec.js';

/** Offset corners of one stroked segment from `a` to `b`. */
interface SegmentOffsets {
  dir: Point;
  length: number;
  aLeft: Point;
  aRight: Point;
  bLeft: Point;
  bRight: Point;
}

/**
 * Build the set of polygons whose union is the stroked outline of a polyline.
 *
 * Each segment becomes a rectangle, each vertex a join shape and each open end
 * a cap shape. The pieces overlap; a boolean union merges them into the final
 * outline. This is slower than a direct offset but has no special cases for
 * self-intersections, sharp turns or curves tighter than the stroke width.
 *
 * The union is computed on an integer grid, so pieces must not merely touch:
 * shared vertices are computed once and reused bit for bit, and join and cap
 * polygons are pulled slightly into the rectangles so they overlap by area.
 * A vertex that only sits on another piece's edge (a T-junction) can round to
 * a grid point just outside that edge and leave the pieces disjoint.
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

  const segs: SegmentOffsets[] = [];
  for (let i = 0; i < segCount; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const dir = normalize(sub(b, a));
    const nrm = scale(perp(dir), hw);
    const s: SegmentOffsets = { dir, length: Math.hypot(b[0] - a[0], b[1] - a[1]), aLeft: add(a, nrm), aRight: sub(a, nrm), bLeft: add(b, nrm), bRight: sub(b, nrm) };
    segs.push(s);
    out.push([s.aLeft, s.bLeft, s.bRight, s.aRight]);
  }

  // Joins between segment i-1 and segment i, at vertex i
  const firstJoin = closed ? 0 : 1;
  const lastJoin = closed ? n - 1 : n - 2;
  for (let i = firstJoin; i <= lastJoin; i++) {
    const prev = segs[(i - 1 + segCount) % segCount]!;
    const next = segs[i % segCount]!;
    const join = joinPolygon(pts[i]!, prev, next, hw, style, tolerance);
    if (join) out.push(join);
  }

  if (!closed) {
    const first = segs[0]!;
    const last = segs[segCount - 1]!;
    const capStart = capPolygon(pts[0]!, scale(first.dir, -1), first.aRight, first.aLeft, hw, style, tolerance);
    const capEnd = capPolygon(pts[n - 1]!, last.dir, last.bLeft, last.bRight, hw, style, tolerance);
    if (capStart) out.push(capStart);
    if (capEnd) out.push(capEnd);
  }

  return out;
}

/**
 * Polygon filling the gap on the outer side of the corner at `p`, between the
 * end of `prev` and the start of `next`. Returns null when the segments are
 * collinear and the rectangles already meet edge to edge.
 */
function joinPolygon(
  p: Point, prev: SegmentOffsets, next: SegmentOffsets, hw: number, style: StrokeStyle, tolerance: number,
): Ring | null {
  const d1 = prev.dir;
  const d2 = next.dir;
  const turn = cross(d1, d2); // >0 : turning left (in y-down: clockwise on screen)
  const cosTheta = dot(d1, d2);
  if (Math.abs(turn) < 1e-12 && cosTheta > 0) return null;

  // Outer side is opposite to the turn direction. "Left" corners are on the
  // +perp side, which is what a positive turn bends towards.
  const outerIsLeft = turn < 0;
  const o1 = outerIsLeft ? prev.bLeft : prev.bRight; // end of prev segment's outer edge
  const o2 = outerIsLeft ? next.aLeft : next.aRight; // start of next segment's outer edge

  // Half of the turn angle. A round join adds a circular cap over the bevel
  // triangle (p, o1, o2) whose extra depth is hw * (1 - cos(halfTurn)); below
  // the tolerance a plain bevel is indistinguishable and much cheaper.
  const halfTurn = Math.acos(Math.max(-1, Math.min(1, cosTheta))) / 2;
  const roundIsBevel = hw * (1 - Math.cos(halfTurn)) < tolerance;

  // Anchor of the join polygon: the vertex itself, pulled back into the
  // rectangles along the inward bisector (or backwards for a reversal) so the
  // polygon overlaps them instead of touching their end edges.
  const n1 = sub(o1, p);
  const n2 = sub(o2, p);
  const bis: Point = [n1[0] + n2[0], n1[1] + n2[1]];
  const ref: Point = Math.hypot(bis[0], bis[1]) > 1e-6 ? normalize(bis) : d1;
  const inset = 0.5 * Math.min(hw, prev.length, next.length);
  const anchor = sub(p, scale(ref, inset));

  if (style.linejoin === 'round' && !roundIsBevel) {
    return roundJoin(p, anchor, o1, o2, ref, hw, tolerance);
  }

  if (style.linejoin === 'miter') {
    // SVG miter ratio = 1 / sin(theta / 2), theta being the angle between the segments
    const theta = Math.PI - 2 * halfTurn;
    const sinHalf = Math.sin(theta / 2);
    if (sinHalf > 1e-9 && 1 / sinHalf <= style.miterLimit) {
      const tip = add(p, scale(ref, hw / Math.cos(halfTurn)));
      return [anchor, o1, tip, o2];
    }
  }
  return [anchor, o1, o2];
}

/** Circular wedge around `p` from `o1` to `o2`, bulging towards `ref`. */
function roundJoin(p: Point, anchor: Point, o1: Point, o2: Point, ref: Point, hw: number, tolerance: number): Ring {
  const n1 = sub(o1, p);
  const n2 = sub(o2, p);
  const a1 = Math.atan2(n1[1], n1[0]);
  const a2 = Math.atan2(n2[1], n2[0]);
  let sweep = a2 - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const mid = a1 + sweep / 2;
  if (Math.cos(mid) * ref[0] + Math.sin(mid) * ref[1] < 0) sweep -= Math.sign(sweep || 1) * 2 * Math.PI;

  const steps = arcSegments(hw, sweep, tolerance);
  const ring: Ring = [anchor, o1];
  for (let i = 1; i < steps; i++) {
    const a = a1 + (sweep * i) / steps;
    ring.push([p[0] + hw * Math.cos(a), p[1] + hw * Math.sin(a)]);
  }
  ring.push(o2);
  return ring;
}

/**
 * Cap at `end`, pointing along `dir`. `c1` and `c2` are the rectangle corners
 * at that end, in the order that keeps the ring going around the cap.
 */
function capPolygon(
  end: Point, dir: Point, c1: Point, c2: Point, hw: number, style: StrokeStyle, tolerance: number,
): Ring | null {
  if (style.linecap === 'butt') return null;
  const anchor = sub(end, scale(dir, 0.5 * hw));
  if (style.linecap === 'square') {
    const ext = scale(dir, hw);
    return [anchor, c1, add(c1, ext), add(c2, ext), c2];
  }
  const v1 = sub(c1, end);
  const a0 = Math.atan2(v1[1], v1[0]);
  const v2 = sub(c2, end);
  let sweep = Math.atan2(v2[1], v2[0]) - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  // bulge forward along dir
  const mid = a0 + sweep / 2;
  if (Math.cos(mid) * dir[0] + Math.sin(mid) * dir[1] < 0) sweep -= Math.sign(sweep || 1) * 2 * Math.PI;
  const steps = arcSegments(hw, sweep, tolerance);
  const ring: Ring = [anchor, c1];
  for (let i = 1; i < steps; i++) {
    const a = a0 + (sweep * i) / steps;
    ring.push([end[0] + hw * Math.cos(a), end[1] + hw * Math.sin(a)]);
  }
  ring.push(c2);
  return ring;
}
