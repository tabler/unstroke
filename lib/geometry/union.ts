import ClipperLib from 'clipper-lib';
import type { MultiPolygon, Ring } from './types.js';

/**
 * Boolean operations on polygons, backed by Clipper (integer arithmetic).
 *
 * Coordinates are scaled to integers before clipping, so `SCALE` is the
 * resolution of the union: 1e6 keeps six decimal places, which is far below
 * any reasonable flattening tolerance and still leaves plenty of headroom in
 * Clipper's 2^53 coordinate range for viewBoxes of several thousand units.
 */
const SCALE = 1e6;

type IntPath = ClipperLib.IntPoint[];

function toInt(ring: Ring): IntPath {
  return ring.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
}

function fromInt(path: IntPath): Ring {
  return path.map((p) => [p.X / SCALE, p.Y / SCALE]);
}

/** Make every ring wind the same way so a nonzero union never cancels out. */
function orientPositive(path: IntPath): IntPath {
  return ClipperLib.Clipper.Orientation(path) ? path : path.slice().reverse();
}

/**
 * Without the (very slow) StrictlySimple mode Clipper may leave zero-width
 * spikes and degenerate rings in the result. CleanPolygons removes vertices
 * that join collinear or reversing edges, which is exactly that.
 */
function clean(path: IntPath): Ring | null {
  const cleaned = ClipperLib.Clipper.CleanPolygons([path], 2)[0];
  if (!cleaned || cleaned.length < 3) return null;
  return fromInt(cleaned);
}

function treeToMultiPolygon(tree: ClipperLib.PolyTree): MultiPolygon {
  const out: MultiPolygon = [];
  const visit = (node: ClipperLib.PolyNode) => {
    for (const child of node.Childs()) {
      if (child.IsHole()) continue; // holes are handled by their outer parent
      const outer = clean(child.Contour());
      const poly: Ring[] = outer ? [outer] : [];
      for (const hole of child.Childs()) {
        const h = clean(hole.Contour());
        if (h && outer) poly.push(h);
        visit(hole); // islands inside holes are new outer polygons
      }
      if (outer) out.push(poly);
    }
  };
  visit(tree);
  return out;
}

function multiPolygonToPaths(mp: MultiPolygon): IntPath[] {
  const paths: IntPath[] = [];
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const p = toInt(ring);
      // outer rings positive, holes negative
      const positive = ClipperLib.Clipper.Orientation(p);
      paths.push(positive === (i === 0) ? p : p.slice().reverse());
    });
  }
  return paths;
}

function execute(
  clipType: ClipperLib.ClipType,
  subject: IntPath[],
  clip: IntPath[],
  fill: ClipperLib.PolyFillType,
): MultiPolygon {
  const clipper = new ClipperLib.Clipper();
  clipper.StrictlySimple = false;
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  if (!clipper.Execute(clipType, tree, fill, fill)) throw new Error('Clipper failed to execute');
  return treeToMultiPolygon(tree);
}

/** Union a flat list of rings, each treated as its own filled polygon. */
export function unionRings(rings: Ring[]): MultiPolygon {
  const paths = rings.filter((r) => r.length >= 3).map((r) => orientPositive(toInt(r)));
  if (paths.length === 0) return [];
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero);
}

/** Union several already-computed multipolygons. */
export function unionMultiPolygons(mps: MultiPolygon[]): MultiPolygon {
  const valid = mps.filter((m) => m.length > 0);
  if (valid.length === 0) return [];
  if (valid.length === 1) return valid[0]!;
  const paths = valid.flatMap(multiPolygonToPaths);
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero);
}

/** XOR of rings; implements the even-odd fill rule for a compound path. */
export function xorRings(rings: Ring[]): MultiPolygon {
  const paths = rings.filter((r) => r.length >= 3).map(toInt);
  if (paths.length === 0) return [];
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftEvenOdd);
}

/** Region of a compound path under the nonzero rule, using the rings' own winding. */
export function nonzeroRings(rings: Ring[]): MultiPolygon {
  const paths = rings.filter((r) => r.length >= 3).map(toInt);
  if (paths.length === 0) return [];
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero);
}

/** Subtract `b` from `a`. */
export function differenceMultiPolygons(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0) return [];
  if (b.length === 0) return a;
  return execute(
    ClipperLib.ClipType.ctDifference,
    multiPolygonToPaths(a),
    multiPolygonToPaths(b),
    ClipperLib.PolyFillType.pftNonZero,
  );
}
