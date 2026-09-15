/**
 * Experiment: Skia (CanvasKit WASM) does the whole job on curves:
 * Path.makeStroked() builds the stroke outline, makeSimplified() removes the
 * overlaps with Skia's PathOps.
 *
 *   npx tsx scripts/experiment-skia.mts <dir> [limit]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import CanvasKitInit from 'canvaskit-wasm';
import { outlineSvg, parseSvg } from '../lib/index.js';
import { transformSegments } from '../lib/path/transform.js';
import type { Segment } from '../lib/path/types.js';
import { optimizeSvg } from '../lib/optimize.js';
import { mismatch, rasterize } from '../test/helpers/raster.js';

const ck = await CanvasKitInit();

function segmentsToSvg(segs: Segment[]): string {
  return segs.map((s) => {
    switch (s.type) {
      case 'M': return `M${s.x} ${s.y}`;
      case 'L': return `L${s.x} ${s.y}`;
      case 'C': return `C${s.x1} ${s.y1} ${s.x2} ${s.y2} ${s.x} ${s.y}`;
      case 'Z': return 'Z';
    }
  }).join('');
}

const JOIN = { miter: () => ck.StrokeJoin.Miter, round: () => ck.StrokeJoin.Round, bevel: () => ck.StrokeJoin.Bevel };
const CAP = { butt: () => ck.StrokeCap.Butt, round: () => ck.StrokeCap.Round, square: () => ck.StrokeCap.Square };

export function outlineWithSkia(svg: string): string {
  const parsed = parseSvg(svg);
  // Paths are immutable in this CanvasKit build; PathBuilder collects the outlines.
  const builder = new ck.PathBuilder();
  let count = 0;
  for (const shape of parsed.shapes) {
    const s = shape.style;
    if (s.stroke === 'none') continue;
    const path = ck.Path.MakeFromSVGString(segmentsToSvg(transformSegments(shape.segments, shape.transform)));
    if (!path) throw new Error('MakeFromSVGString failed');
    const stroked = path.makeStroked({ width: s.strokeWidth, join: JOIN[s.strokeLinejoin](), cap: CAP[s.strokeLinecap](), miter_limit: s.strokeMiterlimit, precision: 4 });
    path.delete();
    if (!stroked) throw new Error('makeStroked failed');
    // Collect every stroke outline into one winding path and let a single
    // simplify() resolve all overlaps; pairwise MakeFromOp(Union) produced
    // inverted contours on some icons.
    builder.addPath(stroked);
    stroked.delete();
    count++;
  }
  if (count === 0) { builder.delete(); return ''; }
  const acc = builder.detachAndDelete();
  const simplified = (acc as unknown as { _makeSimplified(): typeof acc | null })._makeSimplified(); // public wrapper missing in canvaskit 0.42
  acc.delete();
  if (!simplified) throw new Error('makeSimplified failed');
  // PathOps output uses the even-odd fill type (makeAsWinding does not convert it reliably)
  const d = simplified.toSVGString();
  simplified.delete();
  const attrs = Object.entries(parsed.rootAttrs).filter(([k]) => !/^(fill|stroke|stroke-.*)$/.test(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<svg ${attrs} fill="currentColor" fill-rule="evenodd"><path d="${d}"/></svg>`;
}

if (process.argv[1]?.endsWith('experiment-skia.mts')) {
  const dir = process.argv[2] ?? 'test/fixtures/tabler';
  const limit = Number(process.argv[3]) || Infinity;
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).slice(0, limit);
  const st = { n: 0, failed: 0, msNew: 0, msOld: 0, bytesNew: 0, bytesOld: 0, optNew: 0, optOld: 0, curvesNew: 0, curvesOld: 0, bad: [] as [string, number][] };
  const failures: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    if (!/stroke="currentColor"|stroke="#/.test(src)) continue;
    st.n++;
    let t = performance.now();
    const old = outlineSvg(src);
    st.msOld += performance.now() - t;
    st.bytesOld += old.length; st.optOld += optimizeSvg(old).length; st.curvesOld += (old.match(/C/g) ?? []).length;
    t = performance.now();
    try {
      const out = outlineWithSkia(src);
      st.msNew += performance.now() - t;
      st.bytesNew += out.length; st.optNew += optimizeSvg(out).length; st.curvesNew += (out.match(/[CQ]/g) ?? []).length;
      const diff = mismatch(rasterize(src), rasterize(out));
      if (diff > 0.0005) st.bad.push([f, diff]);
    } catch (e) {
      st.msNew += performance.now() - t;
      st.failed++;
      failures.push(`${f}: ${(e as Error).message}`);
    }
  }
  st.bad.sort((a, b) => b[1] - a[1]);
  console.log(`${st.n} icons`);
  console.log(`skia     : ${st.failed} exceptions, ${st.bad.length} visual mismatches, ${(st.msNew / st.n).toFixed(2)} ms avg, ${st.bytesNew} B (${st.optNew} B after svgo), ${st.curvesNew} curves`);
  console.log(`clipper1 : 0 exceptions, ${(st.msOld / st.n).toFixed(2)} ms avg, ${st.bytesOld} B (${st.optOld} B after svgo), ${st.curvesOld} curves`);
  console.log('worst:', st.bad.slice(0, 8).map(([f, d]) => `${f} ${(d * 100).toFixed(2)}%`).join(', '));
  console.log('exceptions:', failures.slice(0, 5).join(' | '));
  writeFileSync(`preview/experiment-skia.json`, JSON.stringify({ bad: st.bad, failures }, null, 2));
}
