import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { outlineSvg, type OutlineOptions } from '../../../lib/index.js';
import { optimizeSvg } from '../../../lib/optimize.js';

/**
 * Repository root: walk up from the working directory until the workspace
 * file is found. `import.meta.dirname` is useless here because the static
 * build bundles this module into dist/.prerender/chunks.
 */
function findRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Cannot find the repository root (pnpm-workspace.yaml)');
}
const ROOT = findRoot();
const DEMO_ICONS = join(ROOT, 'docs/icons');
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

/** Stroke widths for the variants, given for a 24-unit viewBox and scaled to each file's size. */
export const WEIGHTS = [0.5, 1, 1.5];

function viewBoxSize(svg: string): number {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4) return Math.max(vb[2]!, vb[3]!);
  const w = parseFloat(/\swidth="([^"]*)"/.exec(svg)?.[1] ?? '');
  const h = parseFloat(/\sheight="([^"]*)"/.exec(svg)?.[1] ?? '');
  return Math.max(w || 24, h || 24);
}

/** Sources above this size skip the extra stroke-width variants on the index page (large maps take seconds each). */
const WEIGHT_VARIANTS_MAX_BYTES = 40_000;

const cache = new Map<string, IconEntry>();

function subdirs(dir: string): string[] {
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort();
}

/**
 * Icon sets shown in the demo: every folder under docs/icons (a
 * representative selection of Tabler outline icons lives there, the hard
 * ones from the test fixtures plus everyday ones) followed by the hand-made
 * test fixtures. The Tabler fixtures are skipped because the demo folder
 * already contains them.
 */
export function listSets(): IconSet[] {
  const rank = (name: string) => (name === 'tabler' ? 0 : 1);
  return [
    ...subdirs(DEMO_ICONS).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((d) => ({ name: d, dir: join(DEMO_ICONS, d) })),
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

export function convertIcon(set: IconSet, name: string, options: OutlineOptions, withWeights = true): IconEntry {
  const key = `${set.dir}/${name}?${JSON.stringify(options)}&w=${withWeights}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const entry = convertUncached(set, name, options, withWeights);
  cache.set(key, entry);
  return entry;
}

function convertUncached(set: IconSet, name: string, options: OutlineOptions, withWeights: boolean): IconEntry {
  const source = cleanSource(readFileSync(join(set.dir, `${name}.svg`), 'utf8'));
  const reference = options.strokeWidth
    ? source.replace(/stroke-width="[^"]*"/g, `stroke-width="${options.strokeWidth}"`)
    : source;
  const start = performance.now();
  try {
    const outline = outlineSvg(source, options);
    const ms = performance.now() - start;
    const weights = withWeights && source.length <= WEIGHT_VARIANTS_MAX_BYTES
      ? WEIGHTS.map((width) => ({ width, outline: outlineSvg(source, { ...options, strokeWidth: (width * viewBoxSize(source)) / 24 }) }))
      : [];
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
