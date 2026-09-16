import { flattenSegments } from './geometry/flatten.js';
import type { LineCap, LineJoin, MultiPolygon, Ring, StrokeStyle } from './geometry/types.js';
import { nonzeroRings, unionMultiPolygons, unionRings, xorRings } from './geometry/union.js';
import { multiPolygonToPathData, type PathDataOptions } from './output/pathData.js';
import { type DrawableShape, type ParsedSvg, parseSvg, type SvgWarning } from './parse/svg.js';
import { parsePathData } from './path/parse.js';
import { applyToPoint, matrixScale, transformSegments } from './path/transform.js';
import type { Segment } from './path/types.js';
import { strokePolyline } from './stroke/stroke.js';

export type { LineCap, LineJoin, MultiPolygon, Point, Polygon, Polyline, Ring, StrokeStyle } from './geometry/types.js';
export type { Segment } from './path/types.js';
export type { DrawableShape, ParsedSvg, ParseSvgOptions, ResolvedStyle, SvgWarning, SvgWarningCode } from './parse/svg.js';
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
  /** Include shapes that are already filled (fill != none) in the result. Default true. `--no-fills` on the CLI. */
  fills?: boolean;
  /** Fill colour written on the output path. Default `currentColor`. */
  fill?: string;
  /**
   * Called for every feature of the input that is not supported and changes
   * how the result looks (dashes, text, markers, clip paths, opacity, several
   * colours, …). Nothing is reported when the input only uses
   * supported features. Without a handler the warnings are dropped.
   */
  onWarning?: (warning: SvgWarning) => void;
  /**
   * Throw an `UnsupportedSvgError` instead of producing a result when the input
   * uses an unsupported feature. Default false. `onWarning` is still called first.
   */
  strict?: boolean;
}

/** Thrown in `strict` mode when the input uses a feature the outline cannot reproduce. */
export class UnsupportedSvgError extends Error {
  readonly warnings: SvgWarning[];
  constructor(warnings: SvgWarning[]) {
    super(warnings.map((w) => w.message).join('; '));
    this.name = 'UnsupportedSvgError';
    this.warnings = warnings;
  }
}

function parseInput(svg: string, options: OutlineOptions): ParsedSvg {
  const parsed = parseSvg(svg, { onWarning: options.onWarning });
  if (options.strict && parsed.warnings.length > 0) throw new UnsupportedSvgError(parsed.warnings);
  return parsed;
}

/** Convert a whole SVG document: every stroke becomes a filled outline, everything is unioned into one path. */
export function outlineSvg(svg: string, options: OutlineOptions = {}): string {
  const parsed = parseInput(svg, options);
  const tolerance = effectiveTolerance(parsed, options);
  const mp = shapesToMultiPolygon(parsed.shapes, options, tolerance);
  const d = multiPolygonToPathData(mp, { fitTolerance: tolerance * 2, ...options });
  return serializeSvg(parsed.rootAttrs, d, options.fill ?? 'currentColor');
}

/** Same as {@link outlineSvg} but returns geometry instead of markup. */
export function outlineSvgToMultiPolygon(svg: string, options: OutlineOptions = {}): MultiPolygon {
  const parsed = parseInput(svg, options);
  return shapesToMultiPolygon(parsed.shapes, options, effectiveTolerance(parsed, options));
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
    if ((options.fills ?? true) && isPainted(s.fill)) {
      parts.push(fillSegments(transformSegments(shape.segments, shape.transform), s.fillRule, tolerance));
    }
    if (isPainted(s.stroke)) {
      const width = options.strokeWidth ?? s.strokeWidth;
      if (width > 0) parts.push(strokeShape(shape, width, options, tolerance));
    }
  }
  return unionMultiPolygons(parts);
}

function isPainted(paint: string): boolean {
  return paint !== 'none' && paint !== 'transparent';
}

function strokeShape(shape: DrawableShape, width: number, options: OutlineOptions, tolerance: number): MultiPolygon {
  const s = shape.style;
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
  return unionRings(rings.map((r) => r.map(([x, y]) => applyToPoint(shape.transform, x, y))));
}

/**
 * Tolerance used for flattening, stroking and (doubled) curve fitting.
 * Defaults to 1/2400 of the viewBox, but the error budget must also stay
 * small relative to the stroke: a thin line at the viewBox-based tolerance
 * would come out visibly thinner or shifted, so it is capped at 1/200 of the
 * thinnest stroke in the document. An explicit `tolerance` wins.
 */
function effectiveTolerance(parsed: ParsedSvg, options: OutlineOptions): number {
  if (options.tolerance != null) return options.tolerance;
  const size = parsed.viewBox ? Math.max(parsed.viewBox[2], parsed.viewBox[3]) : 24;
  let tolerance = size / 2400;
  for (const shape of parsed.shapes) {
    if (shape.style.stroke === 'none' || shape.style.stroke === 'transparent') continue;
    const width = options.strokeWidth ?? shape.style.strokeWidth;
    if (width > 0) tolerance = Math.min(tolerance, width / 200);
  }
  return tolerance;
}

/**
 * Root attributes that described the strokes and fills of the input and would
 * be wrong or misleading on the output (a `stroke-dasharray` on the result
 * would suggest the dashes survived). `clip-path`, `mask`, `filter` and
 * `opacity` stay: on the root they apply to the whole picture either way.
 */
function isPaintAttr(name: string): boolean {
  return name === 'fill' || name === 'style' || name === 'vector-effect'
    || name.startsWith('stroke') || name.startsWith('fill-') || name.startsWith('marker');
}

function serializeSvg(rootAttrs: Record<string, string>, d: string, fill: string): string {
  const attrs = Object.entries(rootAttrs)
    .filter(([k]) => !isPaintAttr(k))
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`);
  if (!rootAttrs.xmlns) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
  attrs.push(`fill="${escapeAttr(fill)}"`);
  return `<svg ${attrs.join(' ')}><path d="${d}"/></svg>`;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
