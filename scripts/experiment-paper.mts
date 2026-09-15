/**
 * Experiment: build stroke pieces from exact curve offsets and merge them with
 * Paper.js boolean union (curves all the way, no intermediate polygon).
 * Compares failures, time, size and pixel accuracy against the polygon pipeline.
 *
 *   npx tsx scripts/experiment-paper.mts <dir> [limit]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import paper from 'paper-jsdom';
import { outlineSvg, parseSvg } from '../lib/index.js';
import { transformSegments } from '../lib/path/transform.js';
import type { Segment } from '../lib/path/types.js';
import { mismatch, rasterize } from '../test/helpers/raster.js';
import { optimizeSvg } from '../lib/optimize.js';

type P = [number, number];
type Cubic = [P, P, P, P];

paper.setup(new paper.Size(24, 24));

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const scale = (a: P, s: number): P => [a[0] * s, a[1] * s];
const len = (a: P) => Math.hypot(a[0], a[1]);
const norm = (a: P): P => { const l = len(a); return l ? [a[0] / l, a[1] / l] : [0, 0]; };
const perp = (a: P): P => [-a[1], a[0]];

function evalCubic(c: Cubic, t: number): P {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, cc = 3 * mt * t * t, d = t * t * t;
  return [a * c[0][0] + b * c[1][0] + cc * c[2][0] + d * c[3][0], a * c[0][1] + b * c[1][1] + cc * c[2][1] + d * c[3][1]];
}
function tangent(c: Cubic, t: number): P {
  const mt = 1 - t;
  const d: P = [
    3 * mt * mt * (c[1][0] - c[0][0]) + 6 * mt * t * (c[2][0] - c[1][0]) + 3 * t * t * (c[3][0] - c[2][0]),
    3 * mt * mt * (c[1][1] - c[0][1]) + 6 * mt * t * (c[2][1] - c[1][1]) + 3 * t * t * (c[3][1] - c[2][1]),
  ];
  if (len(d) < 1e-9) return norm(sub(c[3], c[0]));
  return norm(d);
}
function split(c: Cubic, t: number): [Cubic, Cubic] {
  const l = (a: P, b: P): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const p01 = l(c[0], c[1]), p12 = l(c[1], c[2]), p23 = l(c[2], c[3]);
  const p012 = l(p01, p12), p123 = l(p12, p23);
  const m = l(p012, p123);
  return [[c[0], p01, p012, m], [m, p123, p23, c[3]]];
}
function intersectLines(p: P, d: P, q: P, e: P): P | null {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return add(p, scale(d, t));
}

/** Tiller–Hanson offset with adaptive subdivision until the offset is within tol. */
function offsetCubic(c: Cubic, d: number, tol: number, depth = 0): Cubic[] {
  const dirs: P[] = [norm(sub(c[1], c[0])), norm(sub(c[2], c[1])), norm(sub(c[3], c[2]))];
  // fall back to neighbouring directions for degenerate handles
  if (!len(dirs[0]!)) dirs[0] = tangent(c, 0);
  if (!len(dirs[2]!)) dirs[2] = tangent(c, 1);
  if (!len(dirs[1]!)) dirs[1] = norm(add(dirs[0]!, dirs[2]!));
  const o0 = add(c[0], scale(perp(dirs[0]!), d));
  const o3 = add(c[3], scale(perp(dirs[2]!), d));
  const l1p = add(c[1], scale(perp(dirs[1]!), d));
  const o1 = intersectLines(o0, dirs[0]!, l1p, dirs[1]!) ?? add(c[1], scale(perp(dirs[0]!), d));
  const o2 = intersectLines(l1p, dirs[1]!, o3, dirs[2]!) ?? add(c[2], scale(perp(dirs[2]!), d));
  const off: Cubic = [o0, o1, o2, o3];
  let worst = 0;
  for (const t of [0.2, 0.4, 0.5, 0.6, 0.8]) {
    const exact = add(evalCubic(c, t), scale(perp(tangent(c, t)), d));
    worst = Math.max(worst, len(sub(evalCubic(off, t), exact)));
  }
  if (worst <= tol || depth >= 8) return [off];
  const [a, b] = split(c, 0.5);
  return [...offsetCubic(a, d, tol, depth + 1), ...offsetCubic(b, d, tol, depth + 1)];
}

function pathFromCubics(left: Cubic[], right: Cubic[]): paper.Path {
  // left side forward, right side backwards, closed with straight ends
  const path = new paper.Path();
  path.moveTo(new paper.Point(...left[0]![0]));
  for (const c of left) path.cubicCurveTo(new paper.Point(...c[1]), new paper.Point(...c[2]), new paper.Point(...c[3]));
  for (let i = right.length - 1; i >= 0; i--) {
    const c = right[i]!;
    path.lineTo(new paper.Point(...c[3]));
    path.cubicCurveTo(new paper.Point(...c[2]), new paper.Point(...c[1]), new paper.Point(...c[0]));
  }
  path.closePath();
  return path;
}

/** Stroke pieces for normalized segments: exact offset per segment, circles at every vertex (round joins & caps). */
export function strokePieces(segments: Segment[], hw: number, tol: number): paper.PathItem[] {
  const pieces: paper.PathItem[] = [];
  let cur: P = [0, 0];
  let start: P = [0, 0];
  let segCount = 0;
  const seen = new Set<string>();
  const vertex = (p: P) => {
    // identical circles at repeated vertices are a degenerate input for Paper's booleans
    const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    pieces.push(new paper.Path.Circle(new paper.Point(...p), hw * (1 + 1e-4)));
  };
  for (const s of segments) {
    if (s.type === 'M') { cur = start = [s.x, s.y]; vertex(cur); segCount = 0; continue; }
    const end: P = s.type === 'Z' ? start : [s.x, s.y];
    const c: Cubic = s.type === 'C' ? [cur, [s.x1, s.y1], [s.x2, s.y2], end]
      : [cur, add(cur, scale(sub(end, cur), 1 / 3)), add(cur, scale(sub(end, cur), 2 / 3)), end];
    if (len(sub(end, cur)) > 1e-9 || s.type === 'C') {
      pieces.push(pathFromCubics(offsetCubic(c, hw, tol), offsetCubic(c, -hw, tol)));
      vertex(end);
      segCount++;
    }
    cur = end;
  }
  return pieces;
}

function uniteAll(items: paper.PathItem[]): paper.PathItem {
  // pairwise tree keeps intermediate results small
  while (items.length > 1) {
    const next: paper.PathItem[] = [];
    for (let i = 0; i < items.length; i += 2) {
      if (i + 1 < items.length) {
        const u = items[i]!.unite(items[i + 1]!, { insert: false });
        items[i]!.remove(); items[i + 1]!.remove();
        next.push(u);
      } else next.push(items[i]!);
    }
    items = next;
  }
  return items[0]!;
}

export function outlineWithPaper(svg: string, tol = 0.01): string {
  const parsed = parseSvg(svg);
  const pieces: paper.PathItem[] = [];
  for (const shape of parsed.shapes) {
    if (shape.style.stroke === 'none') continue;
    const segs = transformSegments(shape.segments, shape.transform);
    pieces.push(...strokePieces(segs, shape.style.strokeWidth / 2, tol));
  }
  if (pieces.length === 0) return '';
  const result = uniteAll(pieces);
  const d = result.pathData;
  result.remove();
  paper.project.clear();
  const attrs = Object.entries(parsed.rootAttrs).filter(([k]) => !/^(fill|stroke|stroke-.*)$/.test(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<svg ${attrs} fill="currentColor"><path d="${d}"/></svg>`;
}

if (process.argv[1]?.endsWith('experiment-paper.mts')) main();

function main() {
const dir = process.argv[2] ?? 'test/fixtures/tabler';
const limit = Number(process.argv[3]) || Infinity;
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).slice(0, limit);
const stats = { n: 0, failed: 0, msPaper: 0, msPoly: 0, bytesPaper: 0, bytesPoly: 0, optPaper: 0, optPoly: 0, curvesPaper: 0, curvesPoly: 0, bad: [] as [string, number][] };
const failures: string[] = [];
for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8');
  if (!/stroke="currentColor"|stroke="#/.test(src)) continue; // filled icons: nothing to stroke
  stats.n++;
  let t = performance.now();
  const poly = outlineSvg(src);
  stats.msPoly += performance.now() - t;
  stats.bytesPoly += poly.length;
  stats.optPoly += optimizeSvg(poly).length;
  stats.curvesPoly += (poly.match(/C/g) ?? []).length;
  t = performance.now();
  try {
    const out = outlineWithPaper(src);
    stats.msPaper += performance.now() - t;
    stats.bytesPaper += out.length;
    stats.optPaper += optimizeSvg(out).length;
    stats.curvesPaper += (out.match(/c/gi) ?? []).length;
    const diff = mismatch(rasterize(src), rasterize(out));
    if (diff > 0.0005) stats.bad.push([f, diff]);
  } catch (e) {
    stats.msPaper += performance.now() - t;
    stats.failed++;
    failures.push(`${f}: ${(e as Error).message}`);
    paper.project.clear();
  }
}
stats.bad.sort((a, b) => b[1] - a[1]);
console.log(`${stats.n} icons`);
console.log(`paper : ${stats.failed} exceptions, ${stats.bad.length} visual mismatches, ${(stats.msPaper / stats.n).toFixed(1)} ms avg, ${stats.bytesPaper} B (${stats.optPaper} B after svgo), ${stats.curvesPaper} curves`);
console.log(`poly  : 0 exceptions, ${(stats.msPoly / stats.n).toFixed(1)} ms avg, ${stats.bytesPoly} B (${stats.optPoly} B after svgo), ${stats.curvesPoly} curves`);
console.log('worst paper mismatches:', stats.bad.slice(0, 8).map(([f, d]) => `${f} ${(d * 100).toFixed(2)}%`).join(', '));
console.log('exceptions:', failures.slice(0, 5).join(' | '));
writeFileSync('preview/paper-experiment.json', JSON.stringify({ stats, failures }, null, 2));
}
