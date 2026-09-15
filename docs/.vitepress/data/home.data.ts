import { defineLoader } from 'vitepress';
import { flattenSegments, multiPolygonToPathData, parseSvg, strokePolyline, transformSegments, type Ring } from '../../../lib/index.js';
import { convertIcon, findSet } from '../lib/icons';

const ICON = 'armchair';
const TOLERANCE = 0.01;

export interface HomeData {
  name: string;
  source: string;
  outline: string;
  optimized: string;
  /** Source shown as code: metadata comment stripped, indentation kept. */
  sourceCode: string;
  /** Outline shown as code: path data shortened to keep the block readable. */
  outlineCode: string;
  /** Every stroke piece (segment rectangles, joins, caps) before the union, as one SVG. */
  pieces: string;
  pieceCount: number;
  sourceShapes: number;
  outlineSubpaths: number;
  outlineCurves: number;
  ms: number;
}
declare const data: HomeData;
export { data };

export default defineLoader({
  load(): HomeData {
    const set = findSet('tabler');
    if (!set) throw new Error('docs/icons/tabler is missing');
    const icon = convertIcon(set, ICON, {}, false);
    const parsed = parseSvg(icon.source);

    const rings: Ring[] = [];
    for (const shape of parsed.shapes) {
      if (shape.style.stroke === 'none') continue;
      const segments = transformSegments(shape.segments, shape.transform);
      for (const line of flattenSegments(segments, TOLERANCE)) {
        rings.push(...strokePolyline(line, {
          width: shape.style.strokeWidth,
          linecap: shape.style.strokeLinecap,
          linejoin: shape.style.strokeLinejoin,
          miterLimit: shape.style.strokeMiterlimit,
        }, TOLERANCE));
      }
    }
    const piecesD = multiPolygonToPathData(rings.map((r) => [r]), { curves: false, precision: 2 });
    const vb = parsed.viewBox ? parsed.viewBox.join(' ') : '0 0 24 24';
    const pieces = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><path d="${piecesD}"/></svg>`;

    const d = /\sd="([^"]*)"/.exec(icon.outline)?.[1] ?? '';
    const shortD = d.length > 140 ? `${d.slice(0, 140).trimEnd()} …` : d;
    const outlineCode = icon.outline
      .replace(d, shortD)
      .replace(/<path /, '\n  <path ')
      .replace(/<\/svg>/, '\n</svg>');

    return {
      name: ICON,
      source: icon.source,
      outline: icon.outline,
      optimized: icon.optimized,
      sourceCode: icon.source,
      outlineCode,
      pieces,
      pieceCount: rings.length,
      sourceShapes: parsed.shapes.length,
      outlineSubpaths: (d.match(/M/g) ?? []).length,
      outlineCurves: (d.match(/C/g) ?? []).length,
      ms: icon.ms,
    };
  },
});
