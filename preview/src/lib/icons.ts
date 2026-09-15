import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { outlineSvg, type OutlineOptions } from '../../../lib/index.js';
import { optimizeSvg } from '../../../lib/optimize.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const DEMO_ICONS = join(ROOT, 'preview/icons');
const FIXTURES = join(ROOT, 'test/fixtures');

export interface IconSet {
  name: string;
  dir: string;
}

export interface IconEntry {
  name: string;
  set: string;
  source: string;
  /** Source with the overridden stroke width applied, for the overlay comparison. */
  reference: string;
  outline: string;
  optimized: string;
  /** The same icon outlined at other stroke widths. */
  weights: { width: number; outline: string }[];
  error?: string;
  ms: number;
}

export const WEIGHTS = [0.5, 1, 1.5];

function subdirs(dir: string): string[] {
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort();
}

/**
 * Icon sets shown in the preview: every folder under preview/icons (a
 * representative selection of Tabler outline icons lives there, the hard
 * ones from the test fixtures plus everyday ones) followed by the hand-made
 * test fixtures. The Tabler fixtures are skipped because the demo folder
 * already contains them.
 */
export function listSets(): IconSet[] {
  return [
    ...subdirs(DEMO_ICONS).map((d) => ({ name: d, dir: join(DEMO_ICONS, d) })),
    ...subdirs(FIXTURES).filter((d) => d !== 'tabler').map((d) => ({ name: `fixtures-${d}`, dir: join(FIXTURES, d) })),
  ];
}

export function findSet(name: string): IconSet | undefined {
  return listSets().find((s) => s.name === name);
}

export function listIconNames(set: IconSet): string[] {
  return readdirSync(set.dir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4))
    .sort();
}

/** Strip the metadata comment Tabler keeps at the top of its icon files. */
function cleanSource(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, '').trim();
}

export function convertIcon(set: IconSet, name: string, options: OutlineOptions): IconEntry {
  const source = cleanSource(readFileSync(join(set.dir, `${name}.svg`), 'utf8'));
  const reference = options.strokeWidth
    ? source.replace(/stroke-width="[^"]*"/g, `stroke-width="${options.strokeWidth}"`)
    : source;
  const start = performance.now();
  try {
    const outline = outlineSvg(source, options);
    const ms = performance.now() - start;
    const weights = WEIGHTS.map((width) => ({ width, outline: outlineSvg(source, { ...options, strokeWidth: width }) }));
    return { name, set: set.name, source, reference, outline, optimized: optimizeSvg(outline), weights, ms };
  } catch (e) {
    return { name, set: set.name, source, reference, outline: '', optimized: '', weights: [], error: (e as Error).message, ms: performance.now() - start };
  }
}

/** Options taken from the query string: ?width=1.5&tolerance=0.02&curves=0 */
export function optionsFromQuery(params: URLSearchParams): OutlineOptions {
  const options: OutlineOptions = {};
  const width = Number(params.get('width'));
  if (width > 0) options.strokeWidth = width;
  const tolerance = Number(params.get('tolerance'));
  if (tolerance > 0) options.tolerance = tolerance;
  if (params.get('curves') === '0') options.curves = false;
  return options;
}
