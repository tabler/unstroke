import type { LineCap, LineJoin } from '../geometry/types.js';
import type { Segment } from '../path/types.js';
import { shapeToSegments } from '../path/shapes.js';
import { IDENTITY, type Matrix, multiply, parseTransform } from '../path/transform.js';
import { type CssRule, matchRules, parseCss, parseDeclarations } from './css.js';
import { parseXml, type XmlElement, type XmlNode } from './xml.js';

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
  /** Rendered shapes in paint order. */
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

/** Elements that are never painted directly (only through <use>, if at all). */
const NON_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'linearGradient', 'radialGradient',
  'metadata', 'title', 'desc', 'style', 'script', 'filter', 'foreignObject',
]);

const CONTAINERS = new Set(['g', 'svg', 'a', 'switch', 'symbol']);
const SHAPE_TAGS = new Set(['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect']);
const MAX_USE_DEPTH = 32;

/** Presentation properties of an element: attributes < stylesheet rules < inline style. */
function computedProps(el: XmlElement, rules: CssRule[]): Record<string, string> {
  return { ...el.attrs, ...matchRules(rules, el.tag, el.attrs), ...parseDeclarations(el.attrs.style ?? '') };
}

function parseLength(v: string | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveStyle(props: Record<string, string>, parent: ResolvedStyle): ResolvedStyle {
  const get = (name: string) => {
    const v = props[name];
    return v == null || v === 'inherit' ? undefined : v;
  };
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

function isHidden(props: Record<string, string>): boolean {
  return props.display === 'none' || props.visibility === 'hidden' || props.visibility === 'collapse';
}

function collectText(node: XmlNode): string {
  if (node.type === 'text') return node.text;
  return node.children.map(collectText).join('');
}

/** Index every element by id and gather the text of every <style> element. */
function indexDocument(root: XmlElement): { ids: Map<string, XmlElement>; css: string } {
  const ids = new Map<string, XmlElement>();
  let css = '';
  const visit = (el: XmlElement) => {
    if (el.attrs.id && !ids.has(el.attrs.id)) ids.set(el.attrs.id, el);
    if (el.tag === 'style') css += collectText(el) + '\n';
    for (const child of el.children) if (child.type === 'element') visit(child);
  };
  visit(root);
  return { ids, css };
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

  const { ids, css } = indexDocument(root);
  const rules = parseCss(css);
  const shapes: DrawableShape[] = [];

  /** Render one element (a child of a container, or the target of a <use>). */
  const visit = (el: XmlElement, parentStyle: ResolvedStyle, parentTransform: Matrix, useDepth: number) => {
    const props = computedProps(el, rules);
    if (isHidden(props)) return;
    const style = resolveStyle(props, parentStyle);
    const transform = el.attrs.transform ? multiply(parentTransform, parseTransform(el.attrs.transform)) : parentTransform;

    if (SHAPE_TAGS.has(el.tag)) {
      const segments = shapeToSegments(el.tag, el.attrs);
      if (segments && segments.length > 0) shapes.push({ tag: el.tag, segments, style, transform });
    } else if (CONTAINERS.has(el.tag)) {
      // A <symbol> is only ever reached through <use>; its viewBox is ignored.
      for (const child of el.children) {
        if (child.type === 'element' && !NON_RENDERED.has(child.tag)) visit(child, style, transform, useDepth);
      }
    } else if (el.tag === 'use') {
      const href = el.attrs.href ?? el.attrs['xlink:href'] ?? '';
      const target = href.startsWith('#') ? ids.get(href.slice(1)) : undefined;
      if (!target || useDepth >= MAX_USE_DEPTH) return;
      // The referenced element behaves like a child of the <use>, offset by x/y.
      const x = parseLength(el.attrs.x, 0);
      const y = parseLength(el.attrs.y, 0);
      const useTransform = x || y ? multiply(transform, [1, 0, 0, 1, x, y]) : transform;
      visit(target, style, useTransform, useDepth + 1);
    }
    // <text>, <image> and the like are not supported and are skipped silently.
  };

  visit(root, SVG_DEFAULT_STYLE, IDENTITY, 0);

  return { root, rootAttrs: root.attrs, viewBox, shapes };
}
