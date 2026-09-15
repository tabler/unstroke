import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outlineSvg } from '../src/index.js';

const SRC = process.argv[2] ?? '/Users/chomik/htdocs/tabler-icons/icons/outline';
const files = readdirSync(SRC).filter((f) => f.endsWith('.svg'));
let failed = 0;
const t0 = performance.now();
const slow: [string, number][] = [];
for (const f of files) {
  const t = performance.now();
  try {
    outlineSvg(readFileSync(join(SRC, f), 'utf8'));
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${(e as Error).message}`);
  }
  const dt = performance.now() - t;
  if (dt > 100) slow.push([f, dt]);
}
console.log(`${files.length} icons, ${failed} failed, ${((performance.now() - t0) / 1000).toFixed(1)}s total`);
console.log('slow:', slow.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, d]) => `${f} ${d.toFixed(0)}ms`).join(', '));
