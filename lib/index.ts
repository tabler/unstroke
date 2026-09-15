import { flattenSegments } from './geometry/flatten.js';
import type { LineCap, LineJoin, MultiPolygon, Ring, StrokeStyle } from './geometry/types.js';
import { nonzeroRings, unionMultiPolygons, unionRings, xorRings } from './geometry/union.js';
import { multiPolygonToPathData, type PathDataOptions } from './output/pathData.js';
import { type DrawableShape, parseSvg } from './parse/svg.js';
import { parsePathData } from './path/parse.js';
import { applyToPoint, matrixScale, transformSegments } from './path/transform.js';
import type { Segment } from './path/types.js';
import { strokePolyline } from './stroke/stroke.js';

export type { LineCap, LineJoin, MultiPolygon, Point, Polygon, Polyline, Ring, StrokeStyle } from './geometry/types.js';
export type { Segment } from './path/types.js';
export type { DrawableShape, ParsedSvg, ResolvedStyle } from './parse/svg.js';
export type { PathDataOptions } from './output/pathData.js';
export { parseSvg } from './parse/svg.js';
export { parsePathData, tokenizePathData } from './path/parse.js';
export { parseTransform, transformSegments, type Matrix } from './path/transform.js';
export { flattenSegments } from './geometry/flatten.js';
export { strokePolyline } from './stroke/stroke.js';
export { unionRings, unionMultiPolygons, xorRings, nonzeroRings, differenceMultiPolygons } from './geometry/union.js';
export { multiPolygonToPathData } from './output/pathData.js';
export { fitRing, type FittedSegment, type FitOptions } from './output/fit.js';

export interface OutlineOptions extends PathDataOptions {
  /** Override the stroke width for every stroked shape (e.g. to build multiple weights). */
  strokeWidth?: number;
  /** Override stroke-linecap for every stroked shape. */
  linecap?: LineCap;
  /** Override stroke-linejoin for every stroked shape. */
  linejoin?: LineJoin;
  /** Override stroke-miterlimit for every stroked shape. */
  miterLimit?: number;
  /**
   * Maximum distance between the true curve and its flattened approximation, in
   * user units. Defaults to 1/2400 of the larger viewBox dimension (0.01 for a 24px icon).
   * The curve fit that follows uses twice this value unless `fitTolerance` is set,
   * so the output stays within about three times `tolerance` of the exact outline.
   */
  tolerance?: number;
  /** Include shapes that are already filled (fill != none) in the result. Default true. */
  includeFills?: boolean;
  /** Fill colour written on the output path. Default `currentColor`. */
  fill?: string;
}

/** Convert a whole SVG document: every stroke becomes a filled outline, everything is unioned into one path. */
export function outlineSvg(svg: string, options: OutlineOptions = {}): string {
  const parsed = parseSvg(svg);
  const tolerance = defaultTolerance(parsed.viewBox, options);
  const mp = shapesToMultiPolygon(parsed.shapes, options, tolerance);
  const d = multiPolygonToPathData(mp, { fitTolerance: tolerance * 2, ...options });
  return serializeSvg(parsed.rootAttrs, d, options.fill ?? 'currentColor');
}

/** Same as {@link outlineSvg} but returns geometry instead of markup. */
export function outlineSvgToMultiPolygon(svg: string, options: OutlineOptions = {}): MultiPolygon {
  const parsed = parseSvg(svg);
  return shapesToMultiPolygon(parsed.shapes, options, defaultTolerance(parsed.viewBox, options));
}

export interface OutlinePathOptions extends PathDataOptions {
  strokeWidth: number;
  linecap?: LineCap;
  linejoin?: LineJoin;
  miterLimit?: number;
  tolerance?: number;
}

/** Outline a single path data string. */
export function outlinePathData(d: string, options: OutlinePathOptions): string {
  const mp = strokeSegments(parsePathData(d), {
    width: options.strokeWidth,
    linecap: options.linecap ?? 'butt',
    linejoin: options.linejoin ?? 'miter',
    miterLimit: options.miterLimit ?? 4,
  }, options.tolerance ?? 0.01);
  return multiPolygonToPathData(mp, { fitTolerance: (options.tolerance ?? 0.01) * 2, ...options });
}

/** Stroke normalized segments and union the result. */
export function strokeSegments(segments: Segment[], style: StrokeStyle, tolerance: number): MultiPolygon {
  const rings: Ring[] = [];
  for (const line of flattenSegments(segments, tolerance)) {
    rings.push(...strokePolyline(line, style, tolerance));
  }
  return unionRings(rings);
}

/** Region covered by a filled path, honouring the fill rule (exact, using the rings' winding). */
export function fillSegments(segments: Segment[], fillRule: 'nonzero' | 'evenodd', tolerance: number): MultiPolygon {
  const rings: Ring[] = flattenSegments(segments, tolerance)
    .map((l) => l.points)
    .filter((r) => r.length >= 3);
  return fillRule === 'evenodd' ? xorRings(rings) : nonzeroRings(rings);
}

function shapesToMultiPolygon(shapes: DrawableShape[], options: OutlineOptions, tolerance: number): MultiPolygon {
  const parts: MultiPolygon[] = [];
  for (const shape of shapes) {
    const s = shape.style;

    if ((options.includeFills ?? true) && s.fill !== 'none' && s.fill !== 'transparent') {
      parts.push(fillSegments(transformSegments(shape.segments, shape.transform), s.fillRule, tolerance));
    }
    if (s.stroke !== 'none' && s.stroke !== 'transparent') {
      const width = options.strokeWidth ?? s.strokeWidth;
      if (width > 0) {
        // SVG strokes are applied in the element's own coordinate system and
        // then transformed with it, so a non-uniform scale or skew changes the
        // stroke's shape. Stroking locally and transforming the resulting
        // polygons reproduces that exactly; the union is affine-invariant.
        const scale = matrixScale(shape.transform) || 1;
        const rings: Ring[] = [];
        for (const line of flattenSegments(shape.segments, tolerance / scale)) {
          rings.push(...strokePolyline(line, {
            width,
            linecap: options.linecap ?? s.strokeLinecap,
            linejoin: options.linejoin ?? s.strokeLinejoin,
            miterLimit: options.miterLimit ?? s.strokeMiterlimit,
          }, tolerance / scale));
        }
        parts.push(unionRings(rings.map((r) => r.map(([x, y]) => applyToPoint(shape.transform, x, y)))));
      }
    }
  }
  return unionMultiPolygons(parts);
}

function defaultTolerance(viewBox: [number, number, number, number] | null, options: OutlineOptions): number {
  if (options.tolerance != null) return options.tolerance;
  const size = viewBox ? Math.max(viewBox[2], viewBox[3]) : 24;
  return size / 2400;
}

const DROPPED_ROOT_ATTRS = new Set([
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'fill-rule', 'style',
]);

function serializeSvg(rootAttrs: Record<string, string>, d: string, fill: string): string {
  const attrs = Object.entries(rootAttrs)
    .filter(([k]) => !DROPPED_ROOT_ATTRS.has(k))
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`);
  if (!rootAttrs.xmlns) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
  attrs.push(`fill="${escapeAttr(fill)}"`);
  return `<svg ${attrs.join(' ')}><path d="${d}"/></svg>`;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
