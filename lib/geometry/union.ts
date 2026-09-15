import ClipperLib from 'clipper-lib';
import type { MultiPolygon, Ring } from './types.js';

/**
 * Boolean operations on polygons, backed by Clipper (integer arithmetic).
 *
 * Coordinates are scaled to integers before clipping. The scale is the
 * resolution of the union: up to 1e6 (six decimal places, far below any
 * reasonable flattening tolerance). It is lowered for large drawings so that
 * coordinates stay under Clipper's `loRange` (about 4.7e7): beyond it Clipper
 * switches to emulated 128-bit arithmetic and becomes roughly 30 times slower.
 */
const MAX_SCALE = 1e6;
const SAFE_COORD = 4e7;

type IntPath = ClipperLib.IntPoint[];

function pickScale(rings: Ring[]): number {
  let max = 0;
  for (const r of rings) for (const [x, y] of r) {
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (m > max) max = m;
  }
  let scale = MAX_SCALE;
  while (scale > 1 && max * scale > SAFE_COORD) scale /= 10;
  return scale;
}

function toInt(ring: Ring, scale: number): IntPath {
  return ring.map(([x, y]) => ({ X: Math.round(x * scale), Y: Math.round(y * scale) }));
}

function fromInt(path: IntPath, scale: number): Ring {
  return path.map((p) => [p.X / scale, p.Y / scale]);
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
function clean(path: IntPath, scale: number): Ring | null {
  const cleaned = ClipperLib.Clipper.CleanPolygons([path], 2)[0];
  if (!cleaned || cleaned.length < 3) return null;
  return fromInt(cleaned, scale);
}

function treeToMultiPolygon(tree: ClipperLib.PolyTree, scale: number): MultiPolygon {
  const out: MultiPolygon = [];
  const visit = (node: ClipperLib.PolyNode) => {
    for (const child of node.Childs()) {
      if (child.IsHole()) continue; // holes are handled by their outer parent
      const outer = clean(child.Contour(), scale);
      const poly: Ring[] = outer ? [outer] : [];
      for (const hole of child.Childs()) {
        const h = clean(hole.Contour(), scale);
        if (h && outer) poly.push(h);
        visit(hole); // islands inside holes are new outer polygons
      }
      if (outer) out.push(poly);
    }
  };
  visit(tree);
  return out;
}

function multiPolygonToPaths(mp: MultiPolygon, scale: number): IntPath[] {
  const paths: IntPath[] = [];
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const p = toInt(ring, scale);
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
  scale: number,
): MultiPolygon {
  const clipper = new ClipperLib.Clipper();
  clipper.StrictlySimple = false;
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  if (!clipper.Execute(clipType, tree, fill, fill)) throw new Error('Clipper failed to execute');
  return treeToMultiPolygon(tree, scale);
}

/** Union a flat list of rings, each treated as its own filled polygon. */
export function unionRings(rings: Ring[]): MultiPolygon {
  const valid = rings.filter((r) => r.length >= 3);
  if (valid.length === 0) return [];
  const scale = pickScale(valid);
  const paths = valid.map((r) => orientPositive(toInt(r, scale)));
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero, scale);
}

/** Union several already-computed multipolygons. */
export function unionMultiPolygons(mps: MultiPolygon[]): MultiPolygon {
  const valid = mps.filter((m) => m.length > 0);
  if (valid.length === 0) return [];
  if (valid.length === 1) return valid[0]!;
  const scale = pickScale(valid.flat(2));
  const paths = valid.flatMap((m) => multiPolygonToPaths(m, scale));
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero, scale);
}

/** XOR of rings; implements the even-odd fill rule for a compound path. */
export function xorRings(rings: Ring[]): MultiPolygon {
  const valid = rings.filter((r) => r.length >= 3);
  if (valid.length === 0) return [];
  const scale = pickScale(valid);
  const paths = valid.map((r) => toInt(r, scale));
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftEvenOdd, scale);
}

/** Region of a compound path under the nonzero rule, using the rings' own winding. */
export function nonzeroRings(rings: Ring[]): MultiPolygon {
  const valid = rings.filter((r) => r.length >= 3);
  if (valid.length === 0) return [];
  const scale = pickScale(valid);
  const paths = valid.map((r) => toInt(r, scale));
  return execute(ClipperLib.ClipType.ctUnion, paths, [], ClipperLib.PolyFillType.pftNonZero, scale);
}

/** Subtract `b` from `a`. */
export function differenceMultiPolygons(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0) return [];
  if (b.length === 0) return a;
  const scale = pickScale([...a.flat(), ...b.flat()]);
  return execute(
    ClipperLib.ClipType.ctDifference,
    multiPolygonToPaths(a, scale),
    multiPolygonToPaths(b, scale),
    ClipperLib.PolyFillType.pftNonZero,
    scale,
  );
}
