import type { Point } from './types.js';

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Point, s: number): Point => [a[0] * s, a[1] * s];
export const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Point, b: Point): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: Point): number => Math.hypot(a[0], a[1]);
export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
export const normalize = (a: Point): Point => {
  const l = len(a);
  return l === 0 ? [0, 0] : [a[0] / l, a[1] / l];
};
/** Left-hand normal (rotated -90deg in y-down coordinates). */
export const perp = (a: Point): Point => [-a[1], a[0]];
export const equals = (a: Point, b: Point, eps = 1e-9): boolean =>
  Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;

/** Number of segments needed to approximate an arc of `angle` radians with `radius` within `tolerance`. */
export function arcSegments(radius: number, angle: number, tolerance: number): number {
  if (radius <= tolerance) return 1;
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / radius)));
  return Math.max(1, Math.ceil(Math.abs(angle) / step));
}

/** Polygon approximating a circle, counter-clockwise in math coordinates. */
export function circlePolygon(center: Point, radius: number, tolerance: number): Point[] {
  const n = Math.max(8, arcSegments(radius, Math.PI * 2, tolerance));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  return pts;
}

/** Signed area (positive = counter-clockwise in a y-up system). */
export function signedArea(ring: Point[]): number {
  let area = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}
