export type Point = [number, number];

/** A flattened subpath. */
export interface Polyline {
  points: Point[];
  closed: boolean;
}

/** A simple closed ring of points (not repeated at the end). */
export type Ring = Point[];

/** GeoJSON-style polygon: first ring is the outer boundary, the rest are holes. */
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'miter' | 'round' | 'bevel';

export interface StrokeStyle {
  width: number;
  linecap: LineCap;
  linejoin: LineJoin;
  miterLimit: number;
}
