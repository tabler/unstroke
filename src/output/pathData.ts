import type { MultiPolygon, Point } from '../geometry/types.js';
import { signedArea } from '../geometry/vec.js';
import { fitRing, type FittedSegment } from './fit.js';

export interface PathDataOptions {
  /** Decimal places in the output. Default 3. */
  precision?: number;
  /**
   * Orientation of outer rings. `'cw'` (default) is clockwise on a y-down
   * screen, which is what TrueType conventionally expects; holes get the
   * opposite winding either way.
   */
  outerWinding?: 'cw' | 'ccw';
  /**
   * Fit the polygon with cubic Béziers instead of emitting every vertex.
   * Default true.
   */
  curves?: boolean;
  /** Maximum deviation of the fitted curves from the polygon. Default 0.02 (outlineSvg passes twice its flattening tolerance). */
  fitTolerance?: number;
  /** Turn angle in degrees above which a vertex is kept as a sharp corner. Default 30. */
  cornerAngle?: number;
}

/** Serialize a multipolygon to SVG path data. */
export function multiPolygonToPathData(mp: MultiPolygon, options: PathDataOptions = {}): string {
  const precision = options.precision ?? 3;
  const outerWinding = options.outerWinding ?? 'cw';
  const curves = options.curves ?? true;
  const fitOptions = { tolerance: options.fitTolerance ?? 0.02, cornerAngle: options.cornerAngle ?? 30 };
  const parts: string[] = [];
  for (const poly of mp) {
    poly.forEach((ring, idx) => {
      if (ring.length < 3) return;
      // signedArea > 0 means counter-clockwise in a y-up system = clockwise on a y-down screen
      const screenCw = signedArea(ring) > 0;
      const wantCw = idx === 0 ? outerWinding === 'cw' : outerWinding !== 'cw';
      const pts: Point[] = screenCw === wantCw ? ring : ring.slice().reverse();
      if (curves) {
        const fitted = fitRing(pts, fitOptions);
        parts.push(segmentsToPathData(fitted.start, fitted.segments, precision));
      } else {
        parts.push(segmentsToPathData(pts[0]!, pts.slice(1).map(([x, y]) => ({ type: 'L', x, y })), precision));
      }
    });
  }
  return parts.join(' ');
}

function fmt(n: number, precision: number): string {
  const s = n.toFixed(precision);
  const t = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  return t === '-0' ? '0' : t;
}

/** Join two numbers with the shortest valid separator. */
function pair(x: string, y: string): string {
  return y.startsWith('-') ? `${x}${y}` : `${x} ${y}`;
}

function segmentsToPathData(start: Point, segments: FittedSegment[], precision: number): string {
  const f = (n: number) => fmt(n, precision);
  const sx = f(start[0]);
  const sy = f(start[1]);
  let d = `M${pair(sx, sy)}`;
  let px = sx;
  let py = sy;
  segments.forEach((s, i) => {
    const x = f(s.x);
    const y = f(s.y);
    const isLast = i === segments.length - 1;
    if (s.type === 'L') {
      // Z draws the closing line, so a final line back to the start is implicit.
      if (isLast && x === sx && y === sy) return;
      if (x === px && y === py) return;
      if (y === py) d += `H${x}`;
      else if (x === px) d += `V${y}`;
      else d += `L${pair(x, y)}`;
    } else {
      d += `C${pair(f(s.x1), f(s.y1))} ${pair(f(s.x2), f(s.y2))} ${pair(x, y)}`;
    }
    px = x;
    py = y;
  });
  return d + 'Z';
}
