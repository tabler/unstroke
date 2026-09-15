/**
 * Output size comparison across stroke-to-outline engines on the same icons.
 *
 *   npx tsx scripts/compare-size.mts [dir] [every-nth]
 *
 * Engines: unstroke, the current Tabler webfont pipeline (svg-path-outline per
 * segment + paper reorient + concatenation), Skia PathOps (CanvasKit),
 * Paper.js booleans and FontForge. Every output is passed through the same
 * SVGO pass with 3 decimal places so the numbers only reflect geometry.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { outlineSvg, parsePathData, transformSegments } from '../lib/index.js';
import { optimizeSvg } from '../lib/optimize.js';
import { mismatch, rasterize } from '../test/helpers/raster.js';
import { outlineWithSkia } from './experiment-skia.mts';
import { outlineWithPaper } from './experiment-paper.mts';

/** FontForge exports in 1000-unit glyph space; bring it back to the icon's viewBox so digits are comparable. */
export function fontforgeToIcon(svg: string, viewBoxAttr: string): string {
  const d = /d="([^"]*)"/s.exec(svg)?.[1] ?? '';
  // FontForge maps the 24-unit viewBox onto a 1000-unit em; its own viewBox margin is not an offset
  const scale = 24 / 1000;
  const segs = transformSegments(parsePathData(d), [scale, 0, 0, scale, 0, 0]);
  const f = (n: number) => String(Math.round(n * 1e4) / 1e4);
  const out = segs.map((s) => s.type === 'M' ? `M${f(s.x)} ${f(s.y)}` : s.type === 'L' ? `L${f(s.x)} ${f(s.y)}`
    : s.type === 'C' ? `C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}` : 'Z').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxAttr}" fill="currentColor"><path d="${out}"/></svg>`;
}

if (process.argv[1]?.endsWith('compare-size.mts')) main();

function main() {
const DIR = process.argv[2] ?? '/Users/chomik/htdocs/tabler-icons/icons/outline';
const NTH = Number(process.argv[3]) || 25;
const TABLER_OLD = '/Users/chomik/htdocs/tabler-icons/packages/icons-webfont/icons-outlined/400';

const all = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();
const sample = all
  .filter((_, i) => i % NTH === 0)
  .filter((f) => !/fill="currentColor"/.test(readFileSync(join(DIR, f), 'utf8'))); // engines under test skip fills

const oldByName = new Map<string, string>();
if (existsSync(TABLER_OLD)) {
  for (const f of readdirSync(TABLER_OLD)) {
    const m = /^u[0-9A-F]+-(.+)\.svg$/.exec(f);
    if (m) oldByName.set(m[1]!, join(TABLER_OLD, f));
  }
}

// FontForge runs once for the whole batch
const ffDir = mkdtempSync(join(tmpdir(), 'ff-'));
const ffJobs = sample.map((f) => {
  const src = join(ffDir, f);
  writeFileSync(src, readFileSync(join(DIR, f), 'utf8').replace(/<!--[\s\S]*?-->/, ''));
  return [src, join(ffDir, 'out-' + f)] as const;
});
writeFileSync(join(ffDir, 'jobs.txt'), ffJobs.map((j) => j.join('\t')).join('\n'));
let fontforgeAvailable = true;
try {
  execFileSync('fontforge', ['-lang=py', '-script', 'scripts/experiment-fontforge.py', join(ffDir, 'jobs.txt')], { stdio: ['ignore', 'ignore', 'ignore'] });
} catch {
  fontforgeAvailable = false;
}

type Engine = { name: string; convert: (name: string, src: string) => string | null };
const engines: Engine[] = [
  { name: 'unstroke', convert: (_, src) => outlineSvg(src) },
  { name: 'unstroke, tolerance 0.02', convert: (_, src) => outlineSvg(src, { tolerance: 0.02 }) },
  { name: 'unstroke, tolerance 0.05', convert: (_, src) => outlineSvg(src, { tolerance: 0.05 }) },
  { name: 'Tabler webfont pipeline', convert: (name) => {
    const p = oldByName.get(name);
    return p ? readFileSync(p, 'utf8').replace(/<!--.*?-->/g, '') : null;
  } },
  { name: 'Skia PathOps (CanvasKit)', convert: (_, src) => outlineWithSkia(src) },
  { name: 'Paper.js', convert: (_, src) => outlineWithPaper(src) },
  { name: 'FontForge', convert: (name, src) => {
    if (!fontforgeAvailable) return null;
    const p = join(ffDir, 'out-' + name + '.svg');
    if (!existsSync(p)) return null;
    return fontforgeToIcon(readFileSync(p, 'utf8'), /viewBox="([^"]*)"/.exec(src)?.[1] ?? '0 0 24 24');
  } },
];

const rows: { name: string; n: number; raw: number; opt: number; curves: number; bad: number; diff: number; worst: [string, number][] }[] = [];
for (const engine of engines) {
  const row = { name: engine.name, n: 0, raw: 0, opt: 0, curves: 0, bad: 0, diff: 0, worst: [] as [string, number][] };
  for (const f of sample) {
    const name = basename(f, '.svg');
    const src = readFileSync(join(DIR, f), 'utf8');
    let out: string | null;
    try {
      out = engine.convert(name, src);
    } catch {
      out = null;
    }
    if (!out) { row.bad++; continue; }
    const opt = optimizeSvg(out, { precision: 3 });
    row.n++;
    row.raw += out.length;
    row.opt += opt.length;
    row.curves += (opt.match(/[csqCSQ]/g) ?? []).length;
    try {
      const d = mismatch(rasterize(src), rasterize(opt));
      row.diff += d;
      if (d > 0.0005) { row.bad++; row.worst.push([name, d]); }
    } catch {
      row.bad++;
    }
  }
  rows.push(row);
}

console.log(`${sample.length} icons (every ${NTH}th Tabler outline icon without filled paths)\n`);
console.log('| engine | avg raw bytes | avg bytes after SVGO | avg curves | mean pixel mismatch | wrong / failed |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const r of rows) {
  if (r.n === 0) { console.log(`| ${r.name} | n/a | n/a | n/a | n/a | not available |`); continue; }
  console.log(`| ${r.name} | ${(r.raw / r.n).toFixed(0)} | ${(r.opt / r.n).toFixed(0)} | ${(r.curves / r.n).toFixed(1)} | ${((r.diff / r.n) * 100).toFixed(3)}% | ${r.bad} |`);
}
console.log();
for (const r of rows) {
  if (r.worst.length) console.log(`${r.name} worst: ${r.worst.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, d]) => `${n} ${(d * 100).toFixed(2)}%`).join(', ')}`);
}
}
