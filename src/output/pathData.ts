import type { MultiPolygon, Point } from '../geometry/types.js';
import { signedArea } from '../geometry/vec.js';

export interface PathDataOptions {
  /** Decimal places in the output. Default 3. */
  precision?: number;
  /**
   * Orientation of outer rings. polygon-clipping emits outer rings counter-clockwise
   * (in math coordinates, which is clockwise on a y-down screen). TrueType
   * conventionally wants outer contours clockwise on screen, i.e. `'cw'`.
   * Default `'cw'`.
   */
  outerWinding?: 'cw' | 'ccw';
}

function fmt(n: number, precision: number): string {
  const s = n.toFixed(precision);
  // trim trailing zeros and a dangling dot, normalise -0
  const t = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  return t === '-0' ? '0' : t;
}

/** Serialize a multipolygon to SVG path data using straight lines only. */
export function multiPolygonToPathData(mp: MultiPolygon, options: PathDataOptions = {}): string {
  const precision = options.precision ?? 3;
  const outerWinding = options.outerWinding ?? 'cw';
  const parts: string[] = [];
  for (const poly of mp) {
    poly.forEach((ring, idx) => {
      if (ring.length < 3) return;
      // signedArea > 0 means counter-clockwise in a y-up system = clockwise on a y-down screen
      const screenCw = signedArea(ring) > 0;
      const wantCw = idx === 0 ? outerWinding === 'cw' : outerWinding !== 'cw';
      const pts: Point[] = screenCw === wantCw ? ring : ring.slice().reverse();
      parts.push(ringToPathData(pts, precision));
    });
  }
  return parts.join(' ');
}

function ringToPathData(ring: Point[], precision: number): string {
  let d = `M${fmt(ring[0]![0], precision)} ${fmt(ring[0]![1], precision)}`;
  let prev = ring[0]!;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i]!;
    const px = fmt(p[0], precision);
    const py = fmt(p[1], precision);
    if (px === fmt(prev[0], precision) && py === fmt(prev[1], precision)) continue;
    if (py === fmt(prev[1], precision)) d += `H${px}`;
    else if (px === fmt(prev[0], precision)) d += `V${py}`;
    else d += `L${px} ${py}`;
    prev = p;
  }
  return d + 'Z';
}
