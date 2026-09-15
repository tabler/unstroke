import { readFileSync } from 'node:fs';
import { outlineSvg } from '../lib/index.js';
const file = process.argv[2]!;
const svg = readFileSync(file, 'utf8');
const t = performance.now();
const out = outlineSvg(svg, { strokeWidth: process.argv[3] ? Number(process.argv[3]) : undefined });
console.error(`${(performance.now() - t).toFixed(1)}ms, ${out.length} bytes`);
console.log(out);
