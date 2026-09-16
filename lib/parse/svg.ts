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
  /** Features of the input that are not supported and would change how the result looks. */
  warnings: SvgWarning[];
}

export type SvgWarningCode =
  /** <text>, <image> or <foreignObject>: skipped, nothing is emitted for it. */
  | 'unsupported-element'
  /** stroke-dasharray: the stroke is outlined as if it were solid. */
  | 'dasharray'
  /** marker-start / marker-mid / marker-end: markers are not drawn. */
  | 'markers'
  /** clip-path or mask: applied to nothing, the full shape is emitted. */
  | 'clip-path'
  /** filter: ignored. */
  | 'filter'
  /** A nested <svg> with its own viewBox or viewport: rendered without the viewport transform. */
  | 'nested-svg'
  /** vector-effect="non-scaling-stroke": the stroke width is scaled with the transform anyway. */
  | 'vector-effect'
  /** opacity, stroke-opacity or fill-opacity below 1: the result is fully opaque. */
  | 'opacity'
  /** More than one paint, or a gradient / pattern: everything becomes one path in one colour. */
  | 'paint';

export interface SvgWarning {
  code: SvgWarningCode;
  /** Human-readable description, e.g. `stroke-dasharray on <path> is ignored`. */
  message: string;
  /** Tag of the element the warning is about. */
  element: string;
}

export interface ParseSvgOptions {
  /** Called once per distinct warning while parsing. */
  onWarning?: (warning: SvgWarning) => void;
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
/** Rendered elements this library cannot outline. */
const UNSUPPORTED_VISUAL = new Set(['text', 'image', 'foreignObject']);
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

function isPainted(paint: string | undefined): boolean {
  return paint != null && paint !== 'none' && paint !== 'transparent';
}

function isSet(v: string | undefined): boolean {
  return v != null && v !== 'none' && v.trim() !== '';
}

/** Parse an SVG document and collect every rendered shape with its resolved style and transform. */
export function parseSvg(svg: string, options: ParseSvgOptions = {}): ParsedSvg {
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

  const warnings: SvgWarning[] = [];
  const seen = new Set<string>();
  const warn = (code: SvgWarningCode, element: string, message: string) => {
    const key = `${code}\n${element}\n${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    const warning = { code, message, element };
    warnings.push(warning);
    options.onWarning?.(warning);
  };
  /** Distinct paints of rendered shapes; more than one cannot be kept in a single path. */
  const paints = new Set<string>();

  /** Presentation properties that change the rendering in ways the outline cannot reproduce. */
  const checkProps = (props: Record<string, string>, tag: string, style: ResolvedStyle) => {
    const el = `<${tag}>`;
    const dash = props['stroke-dasharray'];
    if (isSet(dash) && !/^[\s,0]*$/.test(dash!) && isPainted(style.stroke)) {
      warn('dasharray', tag, `stroke-dasharray on ${el} is ignored, the stroke is outlined as a solid line`);
    }
    for (const m of ['marker-start', 'marker-mid', 'marker-end', 'marker']) {
      if (isSet(props[m])) { warn('markers', tag, `${m} on ${el} is ignored, markers are not drawn`); break; }
    }
    if (isSet(props['clip-path'])) warn('clip-path', tag, `clip-path on ${el} is ignored, the whole shape is emitted`);
    if (isSet(props.mask)) warn('clip-path', tag, `mask on ${el} is ignored, the whole shape is emitted`);
    if (isSet(props.filter)) warn('filter', tag, `filter on ${el} is ignored`);
    if (props['vector-effect'] === 'non-scaling-stroke') {
      warn('vector-effect', tag, `vector-effect="non-scaling-stroke" on ${el} is ignored, the stroke width is scaled with the transform`);
    }
    for (const o of ['opacity', 'stroke-opacity', 'fill-opacity']) {
      const v = props[o];
      if (v != null && parseLength(v, 1) < 1) { warn('opacity', tag, `${o} on ${el} is ignored, the result is fully opaque`); break; }
    }
  };

  /** Render one element (a child of a container, or the target of a <use>). */
  const visit = (el: XmlElement, parentStyle: ResolvedStyle, parentTransform: Matrix, useDepth: number) => {
    const props = computedProps(el, rules);
    if (isHidden(props)) return;
    const style = resolveStyle(props, parentStyle);
    const transform = el.attrs.transform ? multiply(parentTransform, parseTransform(el.attrs.transform)) : parentTransform;
    checkProps(props, el.tag, style);

    if (SHAPE_TAGS.has(el.tag)) {
      const segments = shapeToSegments(el.tag, el.attrs);
      if (segments && segments.length > 0) {
        shapes.push({ tag: el.tag, segments, style, transform });
        if (isPainted(style.stroke) && style.strokeWidth > 0) paints.add(style.stroke);
        if (isPainted(style.fill)) paints.add(style.fill);
      }
    } else if (CONTAINERS.has(el.tag)) {
      if (el.tag === 'svg' && el !== root && ['viewBox', 'x', 'y', 'width', 'height'].some((a) => el.attrs[a] != null)) {
        warn('nested-svg', 'svg', 'a nested <svg> with its own viewport is rendered without the viewport transform');
      }
      // A <symbol> is only ever reached through <use>; its viewBox is ignored.
      for (const child of el.children) {
        if (child.type !== 'element') continue;
        if (UNSUPPORTED_VISUAL.has(child.tag)) {
          if (!isHidden(computedProps(child, rules))) warn('unsupported-element', child.tag, `<${child.tag}> is not supported and was skipped`);
          continue;
        }
        if (!NON_RENDERED.has(child.tag)) visit(child, style, transform, useDepth);
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
  };

  visit(root, SVG_DEFAULT_STYLE, IDENTITY, 0);

  const servers = [...paints].filter((p) => p.startsWith('url('));
  if (servers.length > 0) {
    warn('paint', 'svg', `gradient or pattern paint ${servers[0]} is replaced by a single fill colour`);
  } else if (paints.size > 1) {
    warn('paint', 'svg', `${paints.size} different colours (${[...paints].join(', ')}) are merged into a single fill colour`);
  }

  return { root, rootAttrs: root.attrs, viewBox, shapes, warnings };
}
