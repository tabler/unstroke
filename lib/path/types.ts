/**
 * Normalized absolute path segments. Everything an SVG path can express is
 * reduced to move / line / cubic / close, which keeps every later stage simple.
 */
export type Segment =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };
