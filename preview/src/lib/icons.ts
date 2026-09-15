import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { outlineSvg, type OutlineOptions } from '../../../lib/index.js';
import { optimizeSvg } from '../../../lib/optimize.js';

const ROOT = resolve(import.meta.dirname, '../../..');
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
  error?: string;
  ms: number;
}

/**
 * Icon sets available in the preview: every folder under test/fixtures plus
 * any extra folders listed in ICON_DIRS (colon-separated, relative to the
 * repository root), either as an environment variable or in preview/.env:
 *
 *   ICON_DIRS=../tabler-icons/icons/outline:../tabler-icons/icons/filled
 */
export function listSets(): IconSet[] {
  const sets: IconSet[] = readdirSync(FIXTURES)
    .filter((d) => statSync(join(FIXTURES, d)).isDirectory())
    .map((d) => ({ name: d, dir: join(FIXTURES, d) }));
  const extraDirs = import.meta.env.ICON_DIRS ?? process.env.ICON_DIRS ?? '';
  for (const extra of extraDirs.split(':').filter(Boolean)) {
    const dir = resolve(ROOT, extra);
    if (existsSync(dir)) sets.push({ name: basename(dir), dir });
  }
  return sets;
}

export function findSet(name: string | null): IconSet | undefined {
  const sets = listSets();
  return sets.find((s) => s.name === name) ?? sets[0];
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
    return { name, set: set.name, source, reference, outline, optimized: optimizeSvg(outline), ms };
  } catch (e) {
    return { name, set: set.name, source, reference, outline: '', optimized: '', error: (e as Error).message, ms: performance.now() - start };
  }
}

/** Options taken from the query string, so the UI can override the stroke width etc. */
export function optionsFromQuery(params: URLSearchParams): OutlineOptions {
  const options: OutlineOptions = {};
  const width = Number(params.get('width'));
  if (width > 0) options.strokeWidth = width;
  const tolerance = Number(params.get('tolerance'));
  if (tolerance > 0) options.tolerance = tolerance;
  if (params.get('curves') === '0') options.curves = false;
  return options;
}
