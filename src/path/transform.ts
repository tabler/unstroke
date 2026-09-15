import type { Segment } from './types.js';

/** Affine matrix [a b c d e f] as in SVG: x' = a*x + c*y + e, y' = b*x + d*y + f */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function isIdentity(m: Matrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

/** Parse an SVG `transform` attribute into a single matrix. */
export function parseTransform(value: string | undefined | null): Matrix {
  let result: Matrix = IDENTITY;
  if (!value) return result;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const name = m[1]!;
    const args = m[2]!.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let t: Matrix;
    switch (name) {
      case 'matrix':
        if (args.length !== 6) throw new Error(`matrix() expects 6 arguments`);
        t = args as Matrix;
        break;
      case 'translate':
        t = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
        break;
      case 'scale':
        t = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const a = ((args[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        t = [cos, sin, -sin, cos, 0, 0];
        if (args.length >= 3) {
          const cx = args[1]!;
          const cy = args[2]!;
          t = multiply(multiply([1, 0, 0, 1, cx, cy], t), [1, 0, 0, 1, -cx, -cy]);
        }
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
      default:
        throw new Error(`Unknown transform "${name}"`);
    }
    result = multiply(result, t);
  }
  return result;
}

export function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Apply a matrix to normalized segments. Exact, since all segments are lines or cubics. */
export function transformSegments(segments: Segment[], m: Matrix): Segment[] {
  if (isIdentity(m)) return segments;
  return segments.map((s) => {
    switch (s.type) {
      case 'M':
      case 'L': {
        const [x, y] = applyToPoint(m, s.x, s.y);
        return { type: s.type, x, y };
      }
      case 'C': {
        const [x1, y1] = applyToPoint(m, s.x1, s.y1);
        const [x2, y2] = applyToPoint(m, s.x2, s.y2);
        const [x, y] = applyToPoint(m, s.x, s.y);
        return { type: 'C', x1, y1, x2, y2, x, y };
      }
      case 'Z':
        return s;
    }
  });
}

/**
 * Scale factor a matrix applies to lengths (geometric mean of singular values).
 * Used to scale stroke width when a transform is baked into the geometry.
 */
export function matrixScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}
