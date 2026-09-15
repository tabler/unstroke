/**
 * Experiment: same pipeline as lib/, but the union runs on Clipper2 (WASM)
 * instead of the Clipper 1 JavaScript port.
 *
 *   npx tsx scripts/experiment-clipper2.mts <dir> [limit]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import init from 'clipper2-wasm';
import { flattenSegments, outlineSvg, parseSvg, strokePolyline, type Ring } from '../lib/index.js';
import { fitRing } from '../lib/output/fit.js';
import { applyToPoint, matrixScale } from '../lib/path/transform.js';
import { optimizeSvg } from '../lib/optimize.js';
import { mismatch, rasterize } from '../test/helpers/raster.js';

const m = await init();
const SCALE = 1e6;

function unionClipper2(rings: Ring[]): Ring[] {
  const paths = new m.Paths64();
  for (const r of rings) {
    if (r.length < 3) continue;
    // orient consistently so nonzero union never cancels
    let area = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i]!, b = r[(i + 1) % r.length]!; area += a[0] * b[1] - b[0] * a[1]; }
    const pts = area < 0 ? r.slice().reverse() : r;
    const flat: number[] = [];
    for (const [x, y] of pts) flat.push(Math.round(x * SCALE), Math.round(y * SCALE));
    const p = m.MakePath64(flat);
    paths.push_back(p);
    p.delete();
  }
  const sol = m.UnionSelf64(paths, m.FillRule.NonZero);
  const out: Ring[] = [];
  for (let i = 0; i < sol.size(); i++) {
    const p = sol.get(i);
    const v = p.view();
    const ring: Ring = [];
    for (let j = 0; j < v.length; j += 3) ring.push([Number(v[j]!) / SCALE, Number(v[j + 1]!) / SCALE]); // x, y, z per point
    out.push(ring);
  }
  paths.delete();
  sol.delete();
  return out;
}

const fmt = (n: number) => { const s = n.toFixed(3).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };

function ringsToPathData(rings: Ring[]): string {
  return rings.map((ring) => {
    // keep Clipper2's orientation (outer positive, holes negative) so nonzero works
    const { start, segments } = fitRing(ring, { tolerance: 0.02, cornerAngle: 30 });
    let d = `M${fmt(start[0])} ${fmt(start[1])}`;
    for (const s of segments) {
      d += s.type === 'L' ? `L${fmt(s.x)} ${fmt(s.y)}` : `C${fmt(s.x1)} ${fmt(s.y1)} ${fmt(s.x2)} ${fmt(s.y2)} ${fmt(s.x)} ${fmt(s.y)}`;
    }
    return d + 'Z';
  }).join(' ');
}

export function outlineWithClipper2(svg: string, tolerance = 0.01): string {
  const parsed = parseSvg(svg);
  const rings: Ring[] = [];
  for (const shape of parsed.shapes) {
    const s = shape.style;
    if (s.stroke === 'none') continue;
    const scale = matrixScale(shape.transform) || 1;
    for (const line of flattenSegments(shape.segments, tolerance / scale)) {
      for (const r of strokePolyline(line, { width: s.strokeWidth, linecap: s.strokeLinecap, linejoin: s.strokeLinejoin, miterLimit: s.strokeMiterlimit }, tolerance / scale)) {
        rings.push(r.map(([x, y]) => applyToPoint(shape.transform, x, y)));
      }
    }
  }
  const merged = unionClipper2(rings);
  const attrs = Object.entries(parsed.rootAttrs).filter(([k]) => !/^(fill|stroke|stroke-.*)$/.test(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<svg ${attrs} fill="currentColor"><path d="${ringsToPathData(merged)}"/></svg>`;
}

if (process.argv[1]?.endsWith('experiment-clipper2.mts')) {
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
      const out = outlineWithClipper2(src);
      st.msNew += performance.now() - t;
      st.bytesNew += out.length; st.optNew += optimizeSvg(out).length; st.curvesNew += (out.match(/C/g) ?? []).length;
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
  console.log(`clipper2 : ${st.failed} exceptions, ${st.bad.length} visual mismatches, ${(st.msNew / st.n).toFixed(2)} ms avg, ${st.bytesNew} B (${st.optNew} B after svgo), ${st.curvesNew} curves`);
  console.log(`clipper1 : 0 exceptions, ${(st.msOld / st.n).toFixed(2)} ms avg, ${st.bytesOld} B (${st.optOld} B after svgo), ${st.curvesOld} curves`);
  console.log('worst:', st.bad.slice(0, 8).map(([f, d]) => `${f} ${(d * 100).toFixed(2)}%`).join(', '));
  console.log('exceptions:', failures.slice(0, 5).join(' | '));
  writeFileSync(`preview/experiment-clipper2.json`, JSON.stringify({ bad: st.bad, failures }, null, 2));
}
