import { arcToCubics } from './arc.js';
import { parsePathData } from './parse.js';
import type { Segment } from './types.js';

type Attrs = Record<string, string | undefined>;

const num = (v: string | undefined, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

function ellipseSegments(cx: number, cy: number, rx: number, ry: number): Segment[] {
  if (rx <= 0 || ry <= 0) return [];
  return [
    { type: 'M', x: cx + rx, y: cy },
    ...arcToCubics(cx + rx, cy, rx, ry, 0, false, true, cx, cy + ry),
    ...arcToCubics(cx, cy + ry, rx, ry, 0, false, true, cx - rx, cy),
    ...arcToCubics(cx - rx, cy, rx, ry, 0, false, true, cx, cy - ry),
    ...arcToCubics(cx, cy - ry, rx, ry, 0, false, true, cx + rx, cy),
    { type: 'Z' },
  ];
}

function pointList(v: string | undefined): [number, number][] {
  const nums = (v ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
  return pts;
}

/** Convert any SVG basic shape (or path) element into normalized segments. */
export function shapeToSegments(tag: string, attrs: Attrs): Segment[] | null {
  switch (tag) {
    case 'path':
      return attrs.d ? parsePathData(attrs.d) : [];
    case 'line':
      return [
        { type: 'M', x: num(attrs.x1), y: num(attrs.y1) },
        { type: 'L', x: num(attrs.x2), y: num(attrs.y2) },
      ];
    case 'polyline':
    case 'polygon': {
      const pts = pointList(attrs.points);
      if (pts.length === 0) return [];
      const segs: Segment[] = pts.map(([x, y], i) => ({ type: i === 0 ? 'M' : 'L', x, y }));
      if (tag === 'polygon') segs.push({ type: 'Z' });
      return segs;
    }
    case 'circle': {
      const r = num(attrs.r);
      return ellipseSegments(num(attrs.cx), num(attrs.cy), r, r);
    }
    case 'ellipse':
      return ellipseSegments(num(attrs.cx), num(attrs.cy), num(attrs.rx), num(attrs.ry));
    case 'rect': {
      const x = num(attrs.x);
      const y = num(attrs.y);
      const w = num(attrs.width);
      const h = num(attrs.height);
      if (w <= 0 || h <= 0) return [];
      let rx = attrs.rx != null ? num(attrs.rx) : NaN;
      let ry = attrs.ry != null ? num(attrs.ry) : NaN;
      if (Number.isNaN(rx) && Number.isNaN(ry)) rx = ry = 0;
      else if (Number.isNaN(rx)) rx = ry;
      else if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(rx!, w / 2);
      ry = Math.min(ry!, h / 2);
      if (rx <= 0 || ry <= 0) {
        return [
          { type: 'M', x, y },
          { type: 'L', x: x + w, y },
          { type: 'L', x: x + w, y: y + h },
          { type: 'L', x, y: y + h },
          { type: 'Z' },
        ];
      }
      return [
        { type: 'M', x: x + rx, y },
        { type: 'L', x: x + w - rx, y },
        ...arcToCubics(x + w - rx, y, rx, ry, 0, false, true, x + w, y + ry),
        { type: 'L', x: x + w, y: y + h - ry },
        ...arcToCubics(x + w, y + h - ry, rx, ry, 0, false, true, x + w - rx, y + h),
        { type: 'L', x: x + rx, y: y + h },
        ...arcToCubics(x + rx, y + h, rx, ry, 0, false, true, x, y + h - ry),
        { type: 'L', x, y: y + ry },
        ...arcToCubics(x, y + ry, rx, ry, 0, false, true, x + rx, y),
        { type: 'Z' },
      ];
    }
    default:
      return null;
  }
}
