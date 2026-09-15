import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { outlineSvg } from '../lib/index.js';

const SRC = process.argv[2] ?? '/Users/chomik/htdocs/tabler-icons/icons/outline';
const SIZE = 192;
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;

function render(svg: string): Uint8Array {
  const r = new Resvg(svg.replace(/currentColor/g, '#000'), { fitTo: { mode: 'width', value: SIZE } });
  return r.render().pixels; // RGBA
}

/** Fraction of pixels whose alpha differs by more than 128 (i.e. clearly present in one, absent in the other). */
function diff(a: Uint8Array, b: Uint8Array): number {
  let bad = 0;
  for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) > 128) bad++;
  return bad / (a.length / 4);
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).slice(0, LIMIT);
const results: [string, number][] = [];
let failed = 0;
const t0 = performance.now();
for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8');
  try {
    const out = outlineSvg(src);
    results.push([f, diff(render(src), render(out))]);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${(e as Error).message}`);
  }
}
results.sort((a, b) => b[1] - a[1]);
const worst = results.slice(0, 15);
console.log(`${files.length} icons, ${failed} failed, ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log('worst mismatch (fraction of pixels):');
for (const [f, d] of worst) console.log(`  ${f}  ${(d * 100).toFixed(3)}%`);
console.log(`icons with > 0.05% mismatch: ${results.filter(([, d]) => d > 0.0005).length}`);
mkdirSync('test/.diff', { recursive: true });
writeFileSync('test/.diff/pixel-diff.json', JSON.stringify(results));
