import type { LineCap, LineJoin } from '../geometry/types.js';
import type { Segment } from '../path/types.js';
import { shapeToSegments } from '../path/shapes.js';
import { IDENTITY, type Matrix, multiply, parseTransform } from '../path/transform.js';
import { parseXml, type XmlElement } from './xml.js';

/** Style values that are inherited down the SVG tree. */
export interface ResolvedStyle {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: LineCap;
  strokeLinejoin: LineJoin;
  strokeMiterlimit: number;
  fill: string;
  fillRule: 'nonzero' | 'evenodd';
  opacity: number;
}

export interface DrawableShape {
  tag: string;
  segments: Segment[];
  style: ResolvedStyle;
  /** Accumulated transform from the root <svg> down to this element. */
  transform: Matrix;
}

export interface ParsedSvg {
  root: XmlElement;
  rootAttrs: Record<string, string>;
  viewBox: [number, number, number, number] | null;
  shapes: DrawableShape[];
}

const SVG_DEFAULT_STYLE: ResolvedStyle = {
  stroke: 'none',
  strokeWidth: 1,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeMiterlimit: 4,
  fill: 'black',
  fillRule: 'nonzero',
  opacity: 1,
};

const NON_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'linearGradient', 'radialGradient',
  'metadata', 'title', 'desc', 'style', 'script', 'filter', 'foreignObject',
]);

const SHAPE_TAGS = new Set(['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect']);

function parseStyleAttr(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    out[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim();
  }
  return out;
}

function prop(attrs: Record<string, string>, inline: Record<string, string>, name: string): string | undefined {
  const v = inline[name] ?? attrs[name];
  if (v == null || v === 'inherit') return undefined;
  return v;
}

function parseLength(v: string | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveStyle(el: XmlElement, parent: ResolvedStyle): ResolvedStyle {
  const inline = parseStyleAttr(el.attrs.style);
  const get = (name: string) => prop(el.attrs, inline, name);
  const cap = get('stroke-linecap');
  const join = get('stroke-linejoin');
  const fillRule = get('fill-rule');
  const opacity = get('opacity');
  return {
    stroke: get('stroke') ?? parent.stroke,
    strokeWidth: parseLength(get('stroke-width'), parent.strokeWidth),
    strokeLinecap: cap === 'round' || cap === 'square' || cap === 'butt' ? cap : parent.strokeLinecap,
    strokeLinejoin: join === 'round' || join === 'bevel' || join === 'miter' ? join : parent.strokeLinejoin,
    strokeMiterlimit: parseLength(get('stroke-miterlimit'), parent.strokeMiterlimit),
    fill: get('fill') ?? parent.fill,
    fillRule: fillRule === 'evenodd' ? 'evenodd' : fillRule === 'nonzero' ? 'nonzero' : parent.fillRule,
    opacity: opacity != null ? parseLength(opacity, 1) * parent.opacity : parent.opacity,
  };
}

function isHidden(el: XmlElement): boolean {
  const inline = parseStyleAttr(el.attrs.style);
  const display = inline.display ?? el.attrs.display;
  const visibility = inline.visibility ?? el.attrs.visibility;
  return display === 'none' || visibility === 'hidden' || visibility === 'collapse';
}

/** Parse an SVG document and collect every rendered shape with its resolved style and transform. */
export function parseSvg(svg: string): ParsedSvg {
  const doc = parseXml(svg);
  const root = doc.children.find((c): c is XmlElement => c.type === 'element' && c.tag === 'svg');
  if (!root) throw new Error('No <svg> root element found');

  const viewBoxAttr = root.attrs.viewBox;
  let viewBox: ParsedSvg['viewBox'] = null;
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      viewBox = parts as [number, number, number, number];
    }
  }

  const shapes: DrawableShape[] = [];
  const rootStyle = resolveStyle(root, SVG_DEFAULT_STYLE);

  const walk = (el: XmlElement, style: ResolvedStyle, transform: Matrix) => {
    for (const child of el.children) {
      if (child.type !== 'element') continue;
      if (NON_RENDERED.has(child.tag) || isHidden(child)) continue;
      const childStyle = resolveStyle(child, style);
      const childTransform = child.attrs.transform
        ? multiply(transform, parseTransform(child.attrs.transform))
        : transform;
      if (SHAPE_TAGS.has(child.tag)) {
        const segments = shapeToSegments(child.tag, child.attrs);
        if (segments && segments.length > 0) {
          shapes.push({ tag: child.tag, segments, style: childStyle, transform: childTransform });
        }
      } else if (child.tag === 'g' || child.tag === 'svg' || child.tag === 'a' || child.tag === 'switch') {
        walk(child, childStyle, childTransform);
      }
      // <use>, <text>, <image> are not supported (yet) and are skipped silently.
    }
  };
  walk(root, rootStyle, IDENTITY);

  return { root, rootAttrs: root.attrs, viewBox, shapes };
}
